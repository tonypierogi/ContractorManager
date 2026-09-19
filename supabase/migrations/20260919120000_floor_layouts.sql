-- Migration: measured floor plans, furniture library and floor layouts
--
-- Three steps, one table each:
--
--   1. floor_plan_areas  - an admin draws a box over part of the bundled
--                          floor-plan image ("Big Room") and types its real
--                          width and depth. That box is what gives the plan a
--                          scale.
--   2. furniture_pieces  - the furniture we own, measured once (a 6' banquet
--                          table, a 60" round, a folding chair).
--   3. floor_layouts     - a saved arrangement of pieces inside one measured
--                          area, drawn to scale on top of the floor plan
--                          ("Big Room - theater, 80 seats"). Crews open it on
--                          their phones and set the room to match.
--
-- Lengths are whole inches: that's how furniture is sold and measured here,
-- and it keeps the numbers exact. A 40' x 30' room is 480 x 360 of them.

-- ---------------------------------------------------------------------------
-- 1. Measured areas of the floor plan
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS floor_plan_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Which bundled floor-plan image the box is drawn on
    -- (features/locations/zones.ts FLOOR_PLAN_DEFAULT).
    floor TEXT NOT NULL CHECK (floor IN ('upstairs', 'downstairs')),
    label TEXT NOT NULL,
    -- Optional room this area is, e.g. 'big-room'.
    zone_id TEXT,
    -- The box on the image, as fractions of the image's width and height
    -- (0 = left/top edge, 1 = right/bottom edge), so it survives the image
    -- being shown at any size.
    rect_x DOUBLE PRECISION NOT NULL CHECK (rect_x >= 0 AND rect_x < 1),
    rect_y DOUBLE PRECISION NOT NULL CHECK (rect_y >= 0 AND rect_y < 1),
    rect_w DOUBLE PRECISION NOT NULL CHECK (rect_w > 0 AND rect_x + rect_w <= 1.000001),
    rect_h DOUBLE PRECISION NOT NULL CHECK (rect_h > 0 AND rect_y + rect_h <= 1.000001),
    -- The real size of what the box covers. Width is the box's left-to-right
    -- side, depth its top-to-bottom side. Width and depth set the scale
    -- separately, so a plan drawn slightly squashed still measures true.
    width_in INTEGER NOT NULL CHECK (width_in > 0),
    depth_in INTEGER NOT NULL CHECK (depth_in > 0),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_floor_plan_areas_floor ON floor_plan_areas (floor);

-- ---------------------------------------------------------------------------
-- 2. Furniture library
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS furniture_pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- 'rect' covers tables, stages, bars, sofas; 'round' is a round or oval
    -- table drawn as an ellipse inside width x depth.
    shape TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'round')),
    width_in INTEGER NOT NULL CHECK (width_in > 0),
    depth_in INTEGER NOT NULL CHECK (depth_in > 0),
    -- How many we own. NULL = not tracked; when set, a layout that places more
    -- than this many is flagged in the editor.
    quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
    -- Fill colour on the plan, a hex like '#6b8afd'. Purely visual.
    color TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Layouts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS floor_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- The measured area the furniture is arranged in. RESTRICT, not CASCADE:
    -- deleting a measured room must never silently take its layouts with it.
    -- The app asks for the layouts to be moved or deleted first.
    area_id UUID NOT NULL REFERENCES floor_plan_areas(id) ON DELETE RESTRICT,
    notes TEXT,
    -- The placed pieces, as a JSON array of
    --   { id, piece_id, x_in, y_in, rotation, label }
    -- where x_in/y_in is the piece's centre measured from the area's top-left
    -- corner and rotation is clockwise degrees.
    --
    -- A column rather than a child table because a layout is only ever read
    -- and saved whole: the editor saves every piece in one write, so a save
    -- can never leave half a layout behind. The trade-off is that a piece
    -- deleted from the library isn't cascaded out of layouts here; the app
    -- skips placements whose piece no longer exists, and warns before a piece
    -- that's in use is deleted.
    items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_floor_layouts_area ON floor_layouts (area_id);

-- ---------------------------------------------------------------------------
-- Access: admins build all three; everyone signed in reads them, because
-- crews are the ones setting the room up.
-- ---------------------------------------------------------------------------

ALTER TABLE floor_plan_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage floor_plan_areas" ON floor_plan_areas
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view floor_plan_areas" ON floor_plan_areas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage furniture_pieces" ON furniture_pieces
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view furniture_pieces" ON furniture_pieces
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage floor_layouts" ON floor_layouts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view floor_layouts" ON floor_layouts
    FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_floor_plan_areas_updated_at
    BEFORE UPDATE ON floor_plan_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_furniture_pieces_updated_at
    BEFORE UPDATE ON furniture_pieces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_floor_layouts_updated_at
    BEFORE UPDATE ON floor_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
