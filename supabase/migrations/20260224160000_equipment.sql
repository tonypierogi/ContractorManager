-- Migration: Equipment feature
-- Reusable equipment items with name, location, and optional image.
-- Equipment can be attached to SOP tasks (1-5 per task).

-- Equipment table
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    image_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name);

-- Add equipment column to sop_items (array of equipment UUIDs, max 5 enforced in app)
ALTER TABLE sop_items ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '[]'::jsonb;

-- RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage equipment" ON equipment
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Employees can view equipment" ON equipment
    FOR SELECT TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
