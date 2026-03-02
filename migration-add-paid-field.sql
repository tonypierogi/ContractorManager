-- Migration: Add 'paid' column to time_entries table
-- This allows tracking whether a shift has been paid or is still pending payment

-- Add the paid column (defaults to false = pending payment)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;

-- Create index for faster queries filtering by payment status
CREATE INDEX IF NOT EXISTS idx_time_entries_paid ON time_entries(paid);

-- Update RLS policies to allow admins to update the paid status
-- (The existing admin policies should already cover this, but here's an explicit one if needed)

-- Drop the policy if it exists and recreate
DROP POLICY IF EXISTS "Admins can update time entries paid status" ON time_entries;

CREATE POLICY "Admins can update time entries paid status" ON time_entries
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
