-- Migration: Task Lists with Video-Powered AI Generation
-- Admins can create assignable task lists (optionally flagged as SOPs) either
-- manually or by uploading a video. Video upload triggers transcript extraction
-- and AI task generation. Assigned lists appear for employees at clock-in.

-- Task list definitions (created by admin)
CREATE TABLE task_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_sop BOOLEAN NOT NULL DEFAULT FALSE,
    source_video_url TEXT,
    source_transcript TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual task items within a list
CREATE TABLE task_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    media JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links a task list to a specific employee
CREATE TABLE task_list_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-assignment item completion tracking
CREATE TABLE task_list_item_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES task_list_assignments(id) ON DELETE CASCADE,
    task_list_item_id UUID NOT NULL REFERENCES task_list_items(id) ON DELETE CASCADE,
    checked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, task_list_item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_list_items_list ON task_list_items(task_list_id);
CREATE INDEX IF NOT EXISTS idx_task_list_assignments_to ON task_list_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_list_assignments_list ON task_list_assignments(task_list_id);
CREATE INDEX IF NOT EXISTS idx_task_list_item_checks_assignment ON task_list_item_checks(assignment_id);

-- RLS
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_list_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_list_item_checks ENABLE ROW LEVEL SECURITY;

-- task_lists: admins full CRUD, employees read-only
CREATE POLICY "Admins can manage task_lists" ON task_lists
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view task_lists" ON task_lists
    FOR SELECT TO authenticated USING (true);

-- task_list_items: admins full CRUD, employees read-only
CREATE POLICY "Admins can manage task_list_items" ON task_list_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view task_list_items" ON task_list_items
    FOR SELECT TO authenticated USING (true);

-- task_list_assignments: admins full CRUD, employees can view and update their own
CREATE POLICY "Admins can manage task_list_assignments" ON task_list_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view own assignments" ON task_list_assignments
    FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Employees can update own assignments" ON task_list_assignments
    FOR UPDATE TO authenticated USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());

-- task_list_item_checks: admins full CRUD, employees can view and insert their own
CREATE POLICY "Admins can manage task_list_item_checks" ON task_list_item_checks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view own checks" ON task_list_item_checks
    FOR SELECT TO authenticated USING (checked_by = auth.uid());
CREATE POLICY "Employees can insert own checks" ON task_list_item_checks
    FOR INSERT TO authenticated WITH CHECK (checked_by = auth.uid());

-- Trigger for updated_at on task_lists
CREATE TRIGGER update_task_lists_updated_at
    BEFORE UPDATE ON task_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
