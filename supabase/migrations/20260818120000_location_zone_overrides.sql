-- Migration: admin-editable floor-plan room names and photos
--
-- Rooms have always been hardcoded in timetrack-pro/features/locations/zones.ts
-- (ids, labels, overlay rectangles, bundled photos). The ids must stay frozen:
-- task_lists.location, task_list_items.location_from/to, the equipment JSONB,
-- equipment.location and inventory_items.location all store them verbatim.
--
-- This table lets an admin change what a room is *called* and what photo crews
-- see for it, without touching those ids. One row per edited room; rooms with
-- no row keep the bundled name and photo, so an empty table behaves exactly
-- like today. A NULL column means "keep the bundled value" for that field,
-- which is how the editor clears an edit.

CREATE TABLE IF NOT EXISTS location_zone_overrides (
    -- Zone id from features/locations/zones.ts, e.g. 'big-room'.
    zone_id TEXT PRIMARY KEY,
    label TEXT,
    photo_url TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE location_zone_overrides ENABLE ROW LEVEL SECURITY;

-- Admins edit; everyone signed in reads (crews need the names and photos).
CREATE POLICY "Admins can manage location_zone_overrides" ON location_zone_overrides
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view location_zone_overrides" ON location_zone_overrides
    FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_location_zone_overrides_updated_at
    BEFORE UPDATE ON location_zone_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
