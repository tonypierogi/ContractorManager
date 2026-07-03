-- Add section headers: sop_items can be 'task' or 'section'
ALTER TABLE sop_items
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'task' CHECK (item_type IN ('task', 'section'));
