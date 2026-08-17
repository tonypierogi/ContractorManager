-- Migration: per-equipment pickup/dropoff zones on task list items
--
-- Tasks could already record one from/to pair for the whole item
-- (task_list_items.location_from / location_to), which cannot express "the
-- stanchions come from the Back Closet, the cutting boards come from the Bar
-- Closet" on a single task. Equipment tags now carry their own zones.
--
-- No DDL: task_list_items.equipment is already JSONB. What changes is the
-- shape stored inside it.
--
--   old:  ["<equipment-uuid>", "<equipment-uuid>"]
--   new:  [{"id": "<equipment-uuid>", "from": "back-closet", "to": "lobby"}]
--
-- "from"/"to" are zone ids from timetrack-pro/features/locations/zones.ts.
-- null means "inherit the task's own location_from / location_to".
--
-- The app reads BOTH shapes — see parseEquipmentRefs() in
-- timetrack-pro/features/equipment/refs.ts — so this backfill is a tidiness
-- pass, not a prerequisite. The app behaves correctly whether or not it runs.
--
-- sop_items.equipment is deliberately left alone: the SOP editor still writes
-- bare id strings, so converting those rows would only be undone on next save.

UPDATE task_list_items
SET equipment = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem.value) = 'string'
          THEN jsonb_build_object('id', elem.value #>> '{}', 'from', NULL, 'to', NULL)
        ELSE elem.value
      END
      ORDER BY elem.ordinality
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(task_list_items.equipment)
       WITH ORDINALITY AS elem(value, ordinality)
)
WHERE jsonb_typeof(equipment) = 'array'
  -- Idempotent: rows already fully converted have no string elements left.
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(task_list_items.equipment) AS probe(value)
    WHERE jsonb_typeof(probe.value) = 'string'
  );
