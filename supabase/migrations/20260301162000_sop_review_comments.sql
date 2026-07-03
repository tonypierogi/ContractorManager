-- Migration: SOP task review comments
-- Admins can review completed SOPs and leave per-task comments that
-- contractors see on their next daily checklist for the same template.

CREATE TABLE sop_task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sop_item_id UUID NOT NULL REFERENCES sop_items(id) ON DELETE CASCADE,
    daily_sop_id UUID NOT NULL REFERENCES daily_sops(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sop_task_comments_item ON sop_task_comments(sop_item_id);
CREATE INDEX IF NOT EXISTS idx_sop_task_comments_daily ON sop_task_comments(daily_sop_id);

ALTER TABLE sop_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sop_task_comments" ON sop_task_comments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view sop_task_comments" ON sop_task_comments
    FOR SELECT TO authenticated USING (true);
