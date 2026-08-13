-- ========================================================
-- SCHEDULED SHIFTS (shift scheduling calendar)
-- DOCUMENTATION MIGRATION: this table already exists in production;
-- it was created outside the migration files. DDL reconstructed from
-- the legacy client code (git tag legacy-html, old/js/schedule.js).
-- Do NOT run against production. Needed only for fresh environments.
--
-- Note convention (relied on by both the legacy app and timetrack-pro):
-- note beginning with '[OFF] '  -> time-off day
-- note beginning with '[OOT] '  -> out-of-town day
-- otherwise                     -> regular shift note
-- Time-off blocks are stored as one row per day with
-- start_time '00:00' and end_time '23:59'.
-- ========================================================

CREATE TABLE scheduled_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_shifts_employee_date
    ON scheduled_shifts (employee_id, shift_date);
CREATE INDEX idx_scheduled_shifts_date ON scheduled_shifts (shift_date);

ALTER TABLE scheduled_shifts ENABLE ROW LEVEL SECURITY;

-- Reconstructed permissive policies (exact prod policies unknown — the
-- legacy client lets all authenticated users read the whole schedule and
-- admins manage it; employee self-service paths exist in the client).
CREATE POLICY "scheduled_shifts_select" ON scheduled_shifts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "scheduled_shifts_insert" ON scheduled_shifts
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "scheduled_shifts_update" ON scheduled_shifts
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "scheduled_shifts_delete" ON scheduled_shifts
    FOR DELETE TO authenticated USING (true);
