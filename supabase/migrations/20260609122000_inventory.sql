-- ========================================================
-- INVENTORY FEATURE
-- Tables: inventory_items, inventory_runs, inventory_checks
-- ========================================================

-- Items the admin defines for the team to inventory
CREATE TABLE inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,  -- stores a zone ID from LOCATION_ZONES (e.g. 'office', 'lobby')
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Each time a team member runs through the inventory checklist
CREATE TABLE inventory_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- Individual item checks within a run
CREATE TABLE inventory_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID REFERENCES inventory_runs(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Plenty', 'Some', 'OUT')),
    notes TEXT,
    photo_url TEXT,
    checked_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inventory_items_active ON inventory_items (is_active, sort_order);
CREATE INDEX idx_inventory_runs_user ON inventory_runs (user_id, started_at DESC);
CREATE INDEX idx_inventory_checks_run ON inventory_checks (run_id);
CREATE INDEX idx_inventory_checks_item ON inventory_checks (item_id);

-- RLS policies
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_checks ENABLE ROW LEVEL SECURITY;

-- Inventory items: all authenticated users can read, admins can write
CREATE POLICY "inventory_items_select" ON inventory_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_items_insert" ON inventory_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "inventory_items_update" ON inventory_items
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "inventory_items_delete" ON inventory_items
    FOR DELETE TO authenticated USING (true);

-- Inventory runs: all authenticated users can read and create
CREATE POLICY "inventory_runs_select" ON inventory_runs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_runs_insert" ON inventory_runs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inventory_runs_update" ON inventory_runs
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Inventory checks: all authenticated users can read and create
CREATE POLICY "inventory_checks_select" ON inventory_checks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_checks_insert" ON inventory_checks
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "inventory_checks_update" ON inventory_checks
    FOR UPDATE TO authenticated USING (true);

-- Storage bucket (reuse sop-media or create a new one)
-- If you want a separate bucket:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('inventory-media', 'inventory-media', true);
