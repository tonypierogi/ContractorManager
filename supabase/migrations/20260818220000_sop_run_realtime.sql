-- Migration: stream SOP run lifecycle + task comments over realtime.
--
-- Checks (sop_item_checks / ad_hoc_tasks / sop_anonymous_checks) already
-- publish, so ticking an item shows up on a teammate's device. The run row
-- itself did not, which left the other contractors stale in exactly the
-- moments that matter: someone starts today's checklist and everyone else
-- still sees "pick an SOP"; someone marks it done or cancels it and the rest
-- keep working a run that is finished or gone. Comments on a task had the
-- same problem.
--
-- daily_sops keeps its default (primary key) replica identity: subscribers
-- don't filter on it, and a DELETE payload carrying the id is enough to know
-- the run ended.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'daily_sops'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_sops;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public' AND tablename = 'sop_task_comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_task_comments;
    END IF;
END;
$$;

-- Comment deletes/updates need the old row's daily_sop_id for filter matching.
ALTER TABLE sop_task_comments REPLICA IDENTITY FULL;
