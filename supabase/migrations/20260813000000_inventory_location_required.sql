-- Every inventory item must have a zone. The app enforces this in the item
-- editor; this constraint backstops it at the database level.
--
-- SAFETY: refuses to apply while any item still lacks a zone. Fix those
-- first in the admin Inventory screen (they're flagged "No zone"), then
-- re-run this migration.

DO $$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing FROM inventory_items WHERE location IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION
      'inventory_items has % row(s) with no zone assigned - fix them in the admin Inventory screen before applying this migration',
      missing;
  END IF;
END $$;

ALTER TABLE inventory_items ALTER COLUMN location SET NOT NULL;
