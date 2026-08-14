-- Scheduling for task list / SOP assignments.
--
-- 1. task_list_assignments.due_date  — the day the assignment is for. An
--    assignment can carry a date on its own, a shift (shift_id, added in
--    20260812090000), or both.
-- 2. task_list_recurrences          — "this list, for this person, every
--    Mon/Wed". Occurrences are materialized into task_list_assignments rows
--    for a rolling window by the admin app
--    (features/task-lists/api.ts materializeRecurringAssignments), so the
--    employee checklist flow works unchanged on a real assignment row.

ALTER TABLE task_list_assignments
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS recurrence_id UUID;

CREATE TABLE IF NOT EXISTS task_list_recurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- 0 = Sunday .. 6 = Saturday, matching JS Date.getDay()
    days_of_week SMALLINT[] NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT task_list_recurrences_days_valid CHECK (
        array_length(days_of_week, 1) BETWEEN 1 AND 7
        AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'task_list_assignments_recurrence_fkey'
    ) THEN
        ALTER TABLE task_list_assignments
            ADD CONSTRAINT task_list_assignments_recurrence_fkey
            FOREIGN KEY (recurrence_id)
            REFERENCES task_list_recurrences(id) ON DELETE SET NULL;
    END IF;
END $$;

-- One row per (recurrence, person, day) so re-running materialization is a
-- no-op. Deliberately NOT partial: recurrence_id IS NULL rows (manual
-- assignments) never collide because NULLs are distinct, and a plain index
-- lets ON CONFLICT inference work for the upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_list_assignment_occurrence
    ON task_list_assignments(recurrence_id, assigned_to, due_date);

CREATE INDEX IF NOT EXISTS idx_task_list_assignments_due
    ON task_list_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_task_list_recurrences_list
    ON task_list_recurrences(task_list_id);
CREATE INDEX IF NOT EXISTS idx_task_list_recurrences_to
    ON task_list_recurrences(assigned_to);

ALTER TABLE task_list_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage task_list_recurrences" ON task_list_recurrences
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view own recurrences" ON task_list_recurrences
    FOR SELECT TO authenticated USING (assigned_to = auth.uid());
