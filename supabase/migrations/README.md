# Database migrations

These files document the schema history of the production Supabase project (`eleegjfvsriqzgbdsjid`). They were reorganized from loose files in the repo root into Supabase CLI naming (`YYYYMMDDHHMMSS_name.sql`), ordered by dependency and authoring date.

## Important caveats

- **Production already has every migration here applied.** Never run `supabase db push` against the remote without first baselining: `supabase link --project-ref eleegjfvsriqzgbdsjid`, then `supabase migration repair --status applied <timestamp>` for each file. Until then, treat this folder as documentation plus the source for fresh local stacks (`supabase db reset` replays it cleanly).
- **Not purely chronological.** `20260115000000_baseline_schema.sql` was edited after some later migrations were written — it already contains the profile address columns that `20260301161000_address_fields.sql` adds (that file is idempotent, so replay is harmless). Some early files use bare `CREATE TABLE`, so this set replays only on a fresh database.
- **`20260609122000_inventory.sql` is dormant**: the tables exist in production and are used by the legacy app (git tag `legacy-html`), but the current timetrack-pro app has no inventory feature yet.
- New schema changes: add a new timestamped file here and apply it manually — never modify an existing migration, and never apply changes to the database directly from tooling.
