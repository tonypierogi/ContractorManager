-- Migration: Mark daily SOPs as completed when all tasks + ad hoc tasks are done.
-- completed_at is set by the app when progress reaches 100%; rows with completed_at
-- are hidden from "today's" active view and shown in the "Completed SOPs" list.
-- Multiple completed SOPs can exist per day; only one active (incomplete) SOP per day.

ALTER TABLE daily_sops
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Drop the old one-per-day unique constraint so multiple completed SOPs can exist.
ALTER TABLE daily_sops DROP CONSTRAINT IF EXISTS daily_sops_date_key;

-- Only one *active* (non-completed) SOP per day.
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_sops_active_date
ON daily_sops (date)
WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_sops_completed_at
ON daily_sops (completed_at)
WHERE completed_at IS NOT NULL;

-- Allow authenticated users to delete daily SOPs they created (cancel active checklist).
CREATE POLICY "Creator can delete own daily_sops" ON daily_sops
    FOR DELETE TO authenticated
    USING (created_by = auth.uid());
