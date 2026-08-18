-- Migration: allow more than one SOP run per day.
--
-- daily_sops.date was declared UNIQUE, so the whole org got exactly one SOP
-- run per calendar day. Once that run was marked complete the app still
-- offered every template as startable (the "active run" guard only covers a
-- run in progress), so tapping any SOP failed the unique index and the
-- contractor just saw "Could not start that SOP". Crews run more than one
-- checklist a day — opening, closing, a weekly deep clean — so the day-level
-- constraint is the thing that's wrong.
--
-- What replaces it: a partial unique index allowing many completed runs per
-- day but only one *in progress*. That's the invariant the UI presents (finish
-- or cancel the current checklist before starting another) and it keeps two
-- contractors tapping at the same moment from opening duplicate runs.

DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT con.conname INTO v_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'daily_sops'
      AND con.contype = 'u'
      AND con.conkey = ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = rel.oid AND attname = 'date'
      )];
    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.daily_sops DROP CONSTRAINT %I', v_constraint);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_sops_active_per_day
    ON daily_sops(date) WHERE completed_at IS NULL;
