-- Migration: equipment image annotations
--
-- "The filter is the one behind the panel, not the one on top" is the kind of
-- thing a photo alone never says. Annotations let an admin circle the part
-- that matters and scribble an arrow at it, right on the item's photo.
--
-- The drawing is stored as data rather than burnt into the JPEG: the original
-- photo stays untouched (so a bad circle is undone, not re-uploaded), and the
-- same marks render over every size the photo is shown at.
--
-- Shape of the column — an array of strokes, each with normalised (0..1)
-- coordinates so it scales to any rendered size:
--   [{ "id": "...", "type": "path" | "ellipse" | "arrow",
--      "color": "#f43f5e", "width": 0.008,
--      "points": [{ "x": 0.12, "y": 0.4 }, ...] }]

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS image_annotations JSONB;

COMMENT ON COLUMN equipment.image_annotations IS
    'Freehand/circle/arrow marks drawn over image_url, in normalised 0..1 coordinates. NULL or [] = unmarked.';
