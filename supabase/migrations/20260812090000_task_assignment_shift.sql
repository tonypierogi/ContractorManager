-- Adds optional shift linkage to task list assignments so an admin can
-- attach an assignment to one of the member's upcoming scheduled shifts.
-- The app reads this via the scheduled_shifts embed in
-- features/task-lists/api.ts fetchTaskListAssignments.
ALTER TABLE task_list_assignments
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES scheduled_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_list_assignments_shift
    ON task_list_assignments(shift_id);
