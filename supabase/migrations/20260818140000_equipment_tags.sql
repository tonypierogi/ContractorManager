-- Migration: equipment tags
--
-- Equipment has only ever been findable by name and by the room it lives in.
-- Tags let an admin group gear the way the crew actually talks about it
-- ("ladders", "cleaning", "truck kit"), and let anyone signed in — admin or
-- contractor — narrow the equipment list to those groups.
--
-- Two tables rather than a text[] column on equipment: a tag is created once
-- and renamed in one place, and a link has to disappear when either side of it
-- does (delete a tag, or the piece of equipment).

CREATE TABLE IF NOT EXISTS equipment_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One tag per name however it was typed: "Ladders" and "ladders" are the same
-- tag, so the picker never shows two chips that read alike.
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_tags_name_lower
    ON equipment_tags (lower(name));

CREATE TABLE IF NOT EXISTS equipment_tag_links (
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES equipment_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (equipment_id, tag_id)
);

-- The primary key already covers equipment_id -> tags; this covers the other
-- direction (everything tagged X), which is what the filters ask for.
CREATE INDEX IF NOT EXISTS idx_equipment_tag_links_tag
    ON equipment_tag_links (tag_id);

ALTER TABLE equipment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_tag_links ENABLE ROW LEVEL SECURITY;

-- Admins create, rename, delete and attach tags; everyone signed in reads them
-- (contractors filter by tag, they just don't author them).
CREATE POLICY "Admins can manage equipment_tags" ON equipment_tags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view equipment_tags" ON equipment_tags
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage equipment_tag_links" ON equipment_tag_links
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view equipment_tag_links" ON equipment_tag_links
    FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_equipment_tags_updated_at
    BEFORE UPDATE ON equipment_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
