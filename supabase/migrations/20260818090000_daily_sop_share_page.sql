-- Migration: Shareable link for today's SOP checklist
-- Mirrors 20260817130000_task_list_share_page.sql, but for the daily SOP —
-- the other half of the contractor's checklist world. A contractor with an
-- account can hand a link to a helper who has no account; the helper opens the
-- same share page in a browser and checks items off with the crew live.
--
-- Anonymous checks live in their own table because sop_item_checks.checked_by
-- is NOT NULL and references profiles — a link viewer has no profile row.

-- ============================================================
-- 1. Token column
-- ============================================================
-- On daily_sops, not sop_templates: the link points at one day's run of the
-- checklist, so yesterday's link doesn't keep ticking today's boxes.
ALTER TABLE daily_sops ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_sops_share_token
    ON daily_sops(share_token) WHERE share_token IS NOT NULL;

-- ============================================================
-- 2. Anonymous checks
-- ============================================================
CREATE TABLE IF NOT EXISTS sop_anonymous_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_sop_id UUID NOT NULL REFERENCES daily_sops(id) ON DELETE CASCADE,
    sop_item_id UUID NOT NULL REFERENCES sop_items(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(daily_sop_id, sop_item_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_anonymous_checks_daily
    ON sop_anonymous_checks(daily_sop_id);

ALTER TABLE sop_anonymous_checks ENABLE ROW LEVEL SECURITY;

-- Bare `true`, for the same reason as task_list_anonymous_checks: realtime
-- delivery re-evaluates the subscriber's own SELECT RLS, and a predicate that
-- reaches into daily_sops would never match for anon. The rows are opaque
-- UUIDs and a timestamp. Writes go only through the token-gated function below.
DROP POLICY IF EXISTS "Anyone can read sop_anonymous_checks" ON sop_anonymous_checks;
CREATE POLICY "Anyone can read sop_anonymous_checks" ON sop_anonymous_checks
    FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 3. Token minting
-- ============================================================
-- SECURITY DEFINER: daily_sops updates are restricted under RLS, but any
-- signed-in user running today's checklist should be able to share it.
CREATE OR REPLACE FUNCTION ensure_daily_sop_share_token(p_daily_sop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT share_token INTO v_token
    FROM public.daily_sops WHERE id = p_daily_sop_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Daily SOP not found';
    END IF;
    IF v_token IS NULL THEN
        -- Guarded against a concurrent first mint, then re-read, so both
        -- callers get whichever token won — a just-shared link must not die.
        UPDATE public.daily_sops
        SET share_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
        WHERE id = p_daily_sop_id AND share_token IS NULL;
        SELECT share_token INTO v_token
        FROM public.daily_sops WHERE id = p_daily_sop_id;
    END IF;
    RETURN v_token;
END;
$$;

-- Supabase grants EXECUTE on new functions to anon by default; revoke it
-- explicitly so the anon key can't turn a daily-SOP UUID into a live token.
REVOKE ALL ON FUNCTION ensure_daily_sop_share_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ensure_daily_sop_share_token(UUID) TO authenticated;

-- ============================================================
-- 4. Read a shared SOP by token
-- ============================================================
-- Returns the same JSON shape as get_shared_task_list so the share page can
-- render either kind from one code path. sop_items carry no per-item zones,
-- so location_from / location_to come back NULL.
CREATE OR REPLACE FUNCTION get_shared_daily_sop(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sop public.daily_sops%ROWTYPE;
    v_template public.sop_templates%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_sop FROM public.daily_sops WHERE share_token = p_token;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_template
    FROM public.sop_templates WHERE id = v_sop.sop_template_id;

    RETURN jsonb_build_object(
        'list', jsonb_build_object(
            'id', v_sop.id,
            'title', COALESCE(v_template.name, 'Daily SOP'),
            'description', v_template.description,
            'is_sop', true,
            'location', NULL
        ),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', i.id,
                'sort_order', i.sort_order,
                'title', i.title,
                'description', i.description,
                'item_type', i.item_type,
                'media', i.media,
                'location_from', NULL,
                'location_to', NULL,
                'equipment', i.equipment
            ) ORDER BY i.sort_order)
            FROM public.sop_items i
            WHERE i.sop_template_id = v_sop.sop_template_id
        ), '[]'::jsonb),
        -- Both sources merge into one set: a check made in the app and a check
        -- made through the link mean the same thing to whoever is looking.
        'checked_item_ids', COALESCE((
            SELECT jsonb_agg(item_id) FROM (
                SELECT c.sop_item_id AS item_id
                FROM public.sop_anonymous_checks c
                WHERE c.daily_sop_id = v_sop.id
                UNION
                SELECT c.sop_item_id
                FROM public.sop_item_checks c
                WHERE c.daily_sop_id = v_sop.id
            ) merged
        ), '[]'::jsonb),
        -- sop_items.equipment holds bare id strings; match the object shape
        -- too, in case it ever picks up placement objects like task items did.
        'equipment', COALESCE((
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', e.id, 'name', e.name))
            FROM public.equipment e
            WHERE EXISTS (
                SELECT 1
                FROM public.sop_items i
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE WHEN jsonb_typeof(i.equipment) = 'array'
                         THEN i.equipment ELSE '[]'::jsonb END
                ) AS elem(value)
                WHERE i.sop_template_id = v_sop.sop_template_id
                  AND CASE jsonb_typeof(elem.value)
                        WHEN 'string' THEN elem.value #>> '{}'
                        WHEN 'object' THEN elem.value ->> 'id'
                        ELSE NULL
                      END = e.id::text
            )
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION get_shared_daily_sop(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_daily_sop(TEXT) TO anon, authenticated;

-- ============================================================
-- 5. Check/uncheck an item by token
-- ============================================================
-- Also called by the app when a signed-in user checks an item on a shared SOP,
-- so the web page sees it land. Unchecking clears the anonymous row only —
-- the app owns sop_item_checks, where the check is attributed to a person.
CREATE OR REPLACE FUNCTION set_shared_sop_check(
    p_token TEXT,
    p_item_id UUID,
    p_checked BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sop_id UUID;
    v_template_id UUID;
BEGIN
    SELECT id, sop_template_id INTO v_sop_id, v_template_id
    FROM public.daily_sops WHERE share_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid share link';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.sop_items
        WHERE id = p_item_id AND sop_template_id = v_template_id
    ) THEN
        RAISE EXCEPTION 'Item does not belong to this checklist';
    END IF;
    IF p_checked THEN
        INSERT INTO public.sop_anonymous_checks (daily_sop_id, sop_item_id)
        VALUES (v_sop_id, p_item_id)
        ON CONFLICT (daily_sop_id, sop_item_id) DO NOTHING;
    ELSE
        DELETE FROM public.sop_anonymous_checks
        WHERE daily_sop_id = v_sop_id AND sop_item_id = p_item_id;
        -- An uncheck from the link must also clear the in-app check, or the
        -- item springs back the moment either side refetches.
        DELETE FROM public.sop_item_checks
        WHERE daily_sop_id = v_sop_id AND sop_item_id = p_item_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_shared_sop_check(TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_shared_sop_check(TEXT, UUID, BOOLEAN) TO anon, authenticated;

-- ============================================================
-- 6. Realtime
-- ============================================================
-- FULL replica identity so DELETE events (unchecking) carry the old row's
-- item id and daily_sop_id for filter matching.
ALTER TABLE sop_anonymous_checks REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'sop_anonymous_checks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_anonymous_checks;
    END IF;
END;
$$;
