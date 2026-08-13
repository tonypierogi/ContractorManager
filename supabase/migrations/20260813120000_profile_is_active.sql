-- Soft-deactivation for team members: inactive members keep their history
-- (shifts, invoices, assignments) but the app hides them from schedules,
-- timesheets, and assignment pickers. Toggled from the admin team member page.
alter table public.profiles
  add column if not exists is_active boolean not null default true;
