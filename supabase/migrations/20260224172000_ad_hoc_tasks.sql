-- Migration: Ad hoc tasks for active daily SOPs
-- Admins can add temporary one-off tasks to a day's checklist without
-- modifying the underlying SOP template. Tasks are tied to daily_sops,
-- not sop_templates, so they don't carry over to subsequent days.

-- Ad hoc tasks table
CREATE TABLE ad_hoc_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_sop_id UUID NOT NULL REFERENCES daily_sops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_hoc_tasks_daily ON ad_hoc_tasks(daily_sop_id);

-- Allow sop_item_checks to reference ad hoc tasks instead of template items.
-- We make sop_item_id nullable and add ad_hoc_task_id, with a check that
-- exactly one of the two is set.

ALTER TABLE sop_item_checks ADD COLUMN ad_hoc_task_id UUID REFERENCES ad_hoc_tasks(id) ON DELETE CASCADE;
ALTER TABLE sop_item_checks ALTER COLUMN sop_item_id DROP NOT NULL;

-- Replace the old composite unique with two partial unique indexes
ALTER TABLE sop_item_checks DROP CONSTRAINT IF EXISTS sop_item_checks_daily_sop_id_sop_item_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_check_sop_item
    ON sop_item_checks (daily_sop_id, sop_item_id)
    WHERE sop_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_check_ad_hoc_task
    ON sop_item_checks (daily_sop_id, ad_hoc_task_id)
    WHERE ad_hoc_task_id IS NOT NULL;

ALTER TABLE sop_item_checks ADD CONSTRAINT check_one_item_type CHECK (
    (sop_item_id IS NOT NULL AND ad_hoc_task_id IS NULL)
    OR (sop_item_id IS NULL AND ad_hoc_task_id IS NOT NULL)
);

-- RLS for ad_hoc_tasks
ALTER TABLE ad_hoc_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ad_hoc_tasks" ON ad_hoc_tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view ad_hoc_tasks" ON ad_hoc_tasks
    FOR SELECT TO authenticated USING (true);
