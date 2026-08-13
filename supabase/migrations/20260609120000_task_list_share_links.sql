-- Migration: Shareable Task List Links (no account required)
-- Allows admins to generate a share link for any task list. Recipients can view
-- the list and check items off without creating an account.

-- Add share token to task_lists (unique, unguessable - used in URL)
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Table for anonymous check completions (shared lists only)
-- One row per checked item; shared across all viewers of the same link
CREATE TABLE IF NOT EXISTS task_list_anonymous_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    task_list_item_id UUID NOT NULL REFERENCES task_list_items(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_list_id, task_list_item_id)
);

CREATE INDEX IF NOT EXISTS idx_task_list_anonymous_checks_list ON task_list_anonymous_checks(task_list_id);

ALTER TABLE task_list_anonymous_checks ENABLE ROW LEVEL SECURITY;

-- Anonymous users can read shared task lists (where share_token is set)
CREATE POLICY "Anon can read shared task_lists" ON task_lists
    FOR SELECT TO anon USING (share_token IS NOT NULL);

-- Anonymous users can read items for shared lists
CREATE POLICY "Anon can read items of shared task_lists" ON task_list_items
    FOR SELECT TO anon USING (
        EXISTS (SELECT 1 FROM task_lists WHERE id = task_list_id AND share_token IS NOT NULL)
    );

-- Anonymous users can read/insert/delete their own checks (for shared lists only)
CREATE POLICY "Anon can read anonymous_checks for shared lists" ON task_list_anonymous_checks
    FOR SELECT TO anon USING (
        EXISTS (SELECT 1 FROM task_lists WHERE id = task_list_id AND share_token IS NOT NULL)
    );
CREATE POLICY "Anon can insert anonymous_checks for shared lists" ON task_list_anonymous_checks
    FOR INSERT TO anon WITH CHECK (
        EXISTS (SELECT 1 FROM task_lists WHERE id = task_list_id AND share_token IS NOT NULL)
    );
CREATE POLICY "Anon can delete anonymous_checks for shared lists" ON task_list_anonymous_checks
    FOR DELETE TO anon USING (
        EXISTS (SELECT 1 FROM task_lists WHERE id = task_list_id AND share_token IS NOT NULL)
    );

-- Allow anonymous users to read equipment (for shared list equipment tags)
CREATE POLICY "Anon can read equipment" ON equipment
    FOR SELECT TO anon USING (true);
