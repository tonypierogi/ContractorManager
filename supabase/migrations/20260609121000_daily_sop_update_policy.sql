-- Migration: Allow authenticated employees to mark a daily SOP as complete.
--
-- The original migration-sop.sql only granted SELECT, INSERT, and ALL (admin)
-- on daily_sops. There was no UPDATE policy for non-admin users, so calls to
-- set completed_at were silently ignored by RLS.

CREATE POLICY "Authenticated users can update daily_sops" ON daily_sops
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- Also allow employees to delete their own sop_item_checks (uncheck an item).
-- The original migration only granted INSERT for employees, so unchecking was
-- silently blocked for non-admins.
CREATE POLICY "Authenticated can delete own sop_item_checks" ON sop_item_checks
    FOR DELETE TO authenticated
    USING (checked_by = auth.uid());
