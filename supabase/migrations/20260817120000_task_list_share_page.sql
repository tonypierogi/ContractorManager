-- Migration: Shared task list web page (token-gated RPCs + realtime)
-- Wires up the share-link feature that 20260609120000_task_list_share_links.sql
-- prepared. The original anon policies let any anonymous client enumerate every
-- shared list; this replaces those broad table reads/writes with SECURITY
-- DEFINER functions that require knowing the specific share token, and adds the
-- checks table to the realtime publication so the share page and the app can
-- watch each other's checks live.

-- ============================================================
-- 1. Token minting
-- ============================================================
-- SECURITY DEFINER because task_lists updates are admin-only under RLS, but
-- any signed-in user (e.g. the contractor running the checklist) should be
-- able to generate a link for a list they can already see.
CREATE OR REPLACE FUNCTION ensure_task_list_share_token(p_task_list_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT share_token INTO v_token FROM task_lists WHERE id = p_task_list_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task list not found';
    END IF;
    IF v_token IS NULL THEN
        -- Two UUIDs' worth of hex = 64 chars of unguessability.
        v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
        UPDATE task_lists SET share_token = v_token WHERE id = p_task_list_id;
    END IF;
    RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION ensure_task_list_share_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_task_list_share_token(UUID) TO authenticated;

-- ============================================================
-- 2. Read a shared list by token (used by the public share page)
-- ============================================================
-- Returns NULL for an unknown token. Equipment names are included so the page
-- can render tags without a table grant on equipment.
CREATE OR REPLACE FUNCTION get_shared_task_list(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_list task_lists%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_list FROM task_lists WHERE share_token = p_token;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    RETURN jsonb_build_object(
        'list', jsonb_build_object(
            'id', v_list.id,
            'title', v_list.title,
            'description', v_list.description,
            'is_sop', v_list.is_sop,
            'location', v_list.location
        ),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', i.id,
                'sort_order', i.sort_order,
                'title', i.title,
                'description', i.description,
                'item_type', i.item_type,
                'media', i.media,
                'location_from', i.location_from,
                'location_to', i.location_to,
                'equipment', i.equipment
            ) ORDER BY i.sort_order)
            FROM task_list_items i
            WHERE i.task_list_id = v_list.id
        ), '[]'::jsonb),
        'checked_item_ids', COALESCE((
            SELECT jsonb_agg(c.task_list_item_id)
            FROM task_list_anonymous_checks c
            WHERE c.task_list_id = v_list.id
        ), '[]'::jsonb),
        'equipment', COALESCE((
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', e.id, 'name', e.name))
            FROM equipment e
            WHERE EXISTS (
                SELECT 1 FROM task_list_items i
                WHERE i.task_list_id = v_list.id
                  AND i.equipment ? e.id::text
            )
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION get_shared_task_list(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_task_list(TEXT) TO anon, authenticated;

-- ============================================================
-- 3. Check/uncheck an item by token
-- ============================================================
-- Shared state: one row per checked item for the whole link, so every viewer
-- (and the app) sees the same progress. Also called by the app when a signed-in
-- user checks an item on a shared list, keeping the web page in sync.
CREATE OR REPLACE FUNCTION set_shared_task_check(
    p_token TEXT,
    p_item_id UUID,
    p_checked BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_list_id UUID;
BEGIN
    SELECT id INTO v_list_id FROM task_lists WHERE share_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid share link';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM task_list_items
        WHERE id = p_item_id AND task_list_id = v_list_id
    ) THEN
        RAISE EXCEPTION 'Item does not belong to this list';
    END IF;
    IF p_checked THEN
        INSERT INTO task_list_anonymous_checks (task_list_id, task_list_item_id)
        VALUES (v_list_id, p_item_id)
        ON CONFLICT (task_list_id, task_list_item_id) DO NOTHING;
    ELSE
        DELETE FROM task_list_anonymous_checks
        WHERE task_list_id = v_list_id AND task_list_item_id = p_item_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_shared_task_check(TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_shared_task_check(TEXT, UUID, BOOLEAN) TO anon, authenticated;

-- ============================================================
-- 4. Tighten the original anon policies
-- ============================================================
-- These allowed any anonymous client to enumerate every shared list (the
-- predicate was `share_token IS NOT NULL`, not a token match). All reads and
-- writes now go through the token-gated functions above. The SELECT policy on
-- task_list_anonymous_checks stays (and gains authenticated) because realtime
-- subscriptions evaluate RLS — the rows expose only item UUIDs and timestamps.
DROP POLICY IF EXISTS "Anon can read shared task_lists" ON task_lists;
DROP POLICY IF EXISTS "Anon can read items of shared task_lists" ON task_list_items;
DROP POLICY IF EXISTS "Anon can insert anonymous_checks for shared lists" ON task_list_anonymous_checks;
DROP POLICY IF EXISTS "Anon can delete anonymous_checks for shared lists" ON task_list_anonymous_checks;
DROP POLICY IF EXISTS "Anon can read equipment" ON equipment;

-- The app (signed-in users) merges shared-page checks into the checklist view.
DROP POLICY IF EXISTS "Authenticated can read anonymous_checks" ON task_list_anonymous_checks;
CREATE POLICY "Authenticated can read anonymous_checks" ON task_list_anonymous_checks
    FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5. Realtime
-- ============================================================
-- FULL replica identity so DELETE events (unchecking) still carry the
-- task_list_id / daily_sop_id columns that subscription filters match on.
ALTER TABLE task_list_anonymous_checks REPLICA IDENTITY FULL;
ALTER TABLE sop_item_checks REPLICA IDENTITY FULL;
ALTER TABLE ad_hoc_tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'task_list_anonymous_checks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_list_anonymous_checks;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'sop_item_checks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_item_checks;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'ad_hoc_tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_hoc_tasks;
    END IF;
END;
$$;
