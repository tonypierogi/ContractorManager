# Share page

The public page a helper without an account opens when someone shares a task
list or a day's SOP checklist. It is a single static file, `index.html`, with
no build step: it reads `?t=<share_token>` (plus `&k=sop` for SOP links), calls
the token-gated `get_shared_*` / `set_shared_*` RPCs with the project's anon
key, and streams other people's checks in over Realtime.

## Why it isn't the edge function any more

`supabase/functions/share-task-list` used to return this HTML itself. Supabase
serves edge-function HTML on the default `*.supabase.co` domain as
`content-type: text/plain` under a `content-security-policy: default-src
'none'; sandbox`, so browsers displayed the page source instead of rendering
the checklist, and no script could have run anyway. Hosting the same file
anywhere that serves real `text/html` fixes it.

The edge function now redirects to wherever this page is hosted, so links that
have already been shared keep working.

## Deploying it (one time)

Any static host works — the page is one file. Using EAS, which this project
already uses for builds:

```bash
npx eas-cli@latest deploy --export-dir share --prod
```

That prints a URL like `https://<name>.expo.app`. Netlify Drop, Cloudflare
Pages, GitHub Pages or an S3 bucket are all equally fine.

Then point the edge function at it and redeploy:

```bash
npx supabase secrets set SHARE_PAGE_URL=https://<your-host>/
```

```bash
npx supabase functions deploy share-task-list --no-verify-jwt
```

Optionally set the same URL as `EXPO_PUBLIC_SHARE_PAGE_URL` in the app's `.env`
(and in `eas.json`'s `build.base.env`) so newly minted links point straight at
the page instead of taking the redirect hop.

## Alternative: a Supabase custom domain

With the custom-domain add-on, edge functions serve HTML normally and the
redirect is unnecessary — but this file stays the source of truth for the page.

## Notes

- The anon key in the file is the project's publishable key, already shipped in
  the app bundle and in `eas.json`. Item data is not reachable with it alone:
  every read and write goes through a SECURITY DEFINER function that requires
  the share token.
- Room names come from the bundled list in the page. Admin renames
  (`location_zone_overrides`) are not visible to anonymous viewers, so a
  renamed room shows its original name here.
