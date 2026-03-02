-- Migration: SOP (Standard Operating Procedure) feature
-- Admins create SOP templates with tasks; staff see a shared daily checklist when clocked in.

-- SOP templates (created by admin)
CREATE TABLE sop_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOP items (tasks or section headers within a template)
CREATE TABLE sop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sop_template_id UUID NOT NULL REFERENCES sop_templates(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    item_type TEXT NOT NULL DEFAULT 'task' CHECK (item_type IN ('task', 'section')),
    title TEXT NOT NULL,
    description TEXT,
    media JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active SOP per day (set when first person clocks in that day)
CREATE TABLE daily_sops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    sop_template_id UUID NOT NULL REFERENCES sop_templates(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which items have been checked off for that day (shared across all staff that day)
CREATE TABLE sop_item_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_sop_id UUID NOT NULL REFERENCES daily_sops(id) ON DELETE CASCADE,
    sop_item_id UUID NOT NULL REFERENCES sop_items(id) ON DELETE CASCADE,
    checked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(daily_sop_id, sop_item_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_items_template ON sop_items(sop_template_id);
CREATE INDEX IF NOT EXISTS idx_daily_sops_date ON daily_sops(date);
CREATE INDEX IF NOT EXISTS idx_sop_item_checks_daily ON sop_item_checks(daily_sop_id);

ALTER TABLE sop_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_item_checks ENABLE ROW LEVEL SECURITY;

-- Templates: admins full; employees read-only (to display checklist)
CREATE POLICY "Admins can manage sop_templates" ON sop_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view sop_templates" ON sop_templates
    FOR SELECT TO authenticated USING (true);

-- Items: same
CREATE POLICY "Admins can manage sop_items" ON sop_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view sop_items" ON sop_items
    FOR SELECT TO authenticated USING (true);

-- Daily SOPs: employees can read and create (one per day); admins full
CREATE POLICY "Anyone authenticated can view daily_sops" ON daily_sops
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can create daily_sops" ON daily_sops
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage daily_sops" ON daily_sops
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Item checks: everyone can read; authenticated can insert (check off)
CREATE POLICY "Anyone authenticated can view sop_item_checks" ON sop_item_checks
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sop_item_checks" ON sop_item_checks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = checked_by);
CREATE POLICY "Admins can manage sop_item_checks" ON sop_item_checks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Triggers for updated_at
CREATE TRIGGER update_sop_templates_updated_at
    BEFORE UPDATE ON sop_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sop_items_updated_at
    BEFORE UPDATE ON sop_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Optional: Create Storage bucket for SOP media (photos/videos)
-- In Supabase Dashboard: Storage -> New bucket -> name: sop-media, Public: ON
-- Then add policy: Allow authenticated uploads (INSERT) for authenticated, SELECT for all.
