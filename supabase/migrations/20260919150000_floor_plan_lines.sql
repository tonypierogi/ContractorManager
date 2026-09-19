-- Migration: measure floor plans with lines instead of boxes
--
-- Follows 20260919120000_floor_layouts.sql. Apply that one first.
--
-- Boxes turned out to be the wrong tool: you measure a wall or a gap between
-- two points with a tape, not a whole rectangle. Now an admin drags a line
-- along something on the floor-plan image and types its real length. Each
-- floor's scale comes from all of its lines together, so the more lines, the
-- better the fit.
--
-- Layouts move with this. They used to live inside one measured box; now
-- they sit on a whole floor, optionally tagged with a room. Pieces are
-- positioned as fractions of the plan image rather than inches, so adding or
-- correcting a line rescales the furniture without sliding it off the spot
-- it was placed on.
--
-- Anything already saved is carried over: each measured box becomes two lines
-- (its top edge = its width, its left edge = its depth), and each layout's
-- pieces are converted from inches inside the box to positions on the plan.
--
-- Also adds L-shaped furniture (sectional sofas, L desks, corner bars): see
-- section 4.

-- ---------------------------------------------------------------------------
-- 1. Measurement lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS floor_plan_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Which bundled floor-plan image the line is drawn on
    -- (features/locations/zones.ts FLOOR_PLAN_DEFAULT).
    floor TEXT NOT NULL CHECK (floor IN ('upstairs', 'downstairs')),
    -- Optional note on what was measured, e.g. "Big Room, back wall".
    label TEXT,
    -- The two ends, as fractions of the image's width and height
    -- (0 = left/top edge, 1 = right/bottom edge).
    x1 DOUBLE PRECISION NOT NULL CHECK (x1 >= 0 AND x1 <= 1),
    y1 DOUBLE PRECISION NOT NULL CHECK (y1 >= 0 AND y1 <= 1),
    x2 DOUBLE PRECISION NOT NULL CHECK (x2 >= 0 AND x2 <= 1),
    y2 DOUBLE PRECISION NOT NULL CHECK (y2 >= 0 AND y2 <= 1),
    -- The real length between the two ends.
    length_in INTEGER NOT NULL CHECK (length_in > 0),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- A line needs two different ends to measure anything.
    CHECK (x1 <> x2 OR y1 <> y2)
);

CREATE INDEX IF NOT EXISTS idx_floor_plan_measurements_floor
    ON floor_plan_measurements (floor);

-- Each measured box becomes two lines: across its top, and down its left side.
INSERT INTO floor_plan_measurements (floor, label, x1, y1, x2, y2, length_in, created_by)
SELECT floor, label || ' – width', rect_x, rect_y, rect_x + rect_w, rect_y, width_in, created_by
FROM floor_plan_areas
UNION ALL
SELECT floor, label || ' – depth', rect_x, rect_y, rect_x, rect_y + rect_h, depth_in, created_by
FROM floor_plan_areas;

-- ---------------------------------------------------------------------------
-- 2. Layouts: from "inside a box" to "on a floor"
-- ---------------------------------------------------------------------------

ALTER TABLE floor_layouts ADD COLUMN IF NOT EXISTS floor TEXT;
-- Optional room the layout is for, e.g. 'big-room': used to group layouts and
-- to open the plan scrolled to that room.
ALTER TABLE floor_layouts ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- Items change shape from
--   { id, piece_id, x_in, y_in, rotation, label }   inches inside the box
-- to
--   { id, piece_id, x, y, rotation, label }         fractions of the plan image
-- keeping their order (later items draw on top).
UPDATE floor_layouts AS l
SET floor = a.floor,
    zone_id = a.zone_id,
    items = COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', t.e->>'id',
                    'piece_id', t.e->>'piece_id',
                    'x', a.rect_x + ((t.e->>'x_in')::DOUBLE PRECISION / a.width_in) * a.rect_w,
                    'y', a.rect_y + ((t.e->>'y_in')::DOUBLE PRECISION / a.depth_in) * a.rect_h,
                    'rotation', COALESCE((t.e->>'rotation')::DOUBLE PRECISION, 0),
                    'label', t.e->'label'
                )
                ORDER BY t.n
            )
            FROM jsonb_array_elements(l.items) WITH ORDINALITY AS t(e, n)
        ),
        '[]'::jsonb
    )
FROM floor_plan_areas AS a
WHERE a.id = l.area_id;

ALTER TABLE floor_layouts ALTER COLUMN floor SET NOT NULL;
ALTER TABLE floor_layouts ADD CONSTRAINT floor_layouts_floor_check
    CHECK (floor IN ('upstairs', 'downstairs'));

CREATE INDEX IF NOT EXISTS idx_floor_layouts_floor ON floor_layouts (floor);

-- The boxes are fully replaced by lines.
DROP INDEX IF EXISTS idx_floor_layouts_area;
ALTER TABLE floor_layouts DROP COLUMN IF EXISTS area_id;
DROP TABLE IF EXISTS floor_plan_areas;

-- ---------------------------------------------------------------------------
-- 3. Access: admins measure; everyone signed in reads (layouts need the
-- scale to draw).
-- ---------------------------------------------------------------------------

ALTER TABLE floor_plan_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage floor_plan_measurements" ON floor_plan_measurements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Employees can view floor_plan_measurements" ON floor_plan_measurements
    FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_floor_plan_measurements_updated_at
    BEFORE UPDATE ON floor_plan_measurements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. L-shaped furniture
-- ---------------------------------------------------------------------------
--
-- An L is drawn inside its width x depth: one arm runs the full width along
-- the top, the other the full depth down the left side, both arm_in deep
-- (a sectional's seat depth, a desk's top depth). Rotating and mirroring it
-- in a layout covers every corner it can face.

ALTER TABLE furniture_pieces DROP CONSTRAINT IF EXISTS furniture_pieces_shape_check;
ALTER TABLE furniture_pieces ADD CONSTRAINT furniture_pieces_shape_check
    CHECK (shape IN ('rect', 'round', 'l'));

ALTER TABLE furniture_pieces ADD COLUMN IF NOT EXISTS arm_in INTEGER;

-- An L needs an arm depth, and it has to leave room for the L's inside corner.
ALTER TABLE furniture_pieces ADD CONSTRAINT furniture_pieces_arm_check
    CHECK (
        shape <> 'l'
        OR (arm_in IS NOT NULL AND arm_in > 0 AND arm_in < width_in AND arm_in < depth_in)
    );
