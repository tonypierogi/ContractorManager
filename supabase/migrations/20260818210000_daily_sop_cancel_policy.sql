-- Migration: let any authenticated crew member cancel an in-progress SOP run.
--
-- Cancelling a daily SOP deletes the row (its checks cascade). The only DELETE
-- policy so far was "Creator can delete own daily_sops", so a contractor who
-- picked up a checklist someone else started could not cancel it. Completed
-- runs stay protected — they're the record of what was done, and only admins
-- (covered by the existing "Admins can manage daily_sops" policy) can remove
-- those.

CREATE POLICY "Authenticated can delete active daily_sops" ON daily_sops
    FOR DELETE TO authenticated
    USING (completed_at IS NULL);
