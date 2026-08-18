// Resolves a share link for a task list or a day's SOP checklist.
//
// The app mints links of the form:
//   {SUPABASE_URL}/functions/v1/share-task-list?t={share_token}       (task list)
//   {SUPABASE_URL}/functions/v1/share-task-list?t={token}&k=sop      (daily SOP)
//
// This function used to return the checklist page itself. It can't: Supabase
// serves edge-function HTML on the default *.supabase.co domain as
// `content-type: text/plain` under `content-security-policy: default-src
// 'none'; sandbox`, so browsers showed the page source and no script would
// have run. The page now lives in share/index.html and is hosted separately;
// this function redirects to it so links already out in the world keep working.
//
// Set the destination once, then redeploy:
//   supabase secrets set SHARE_PAGE_URL=https://<your-host>/
//   supabase functions deploy share-task-list --no-verify-jwt
//
// (--no-verify-jwt because browsers hit this URL with no Authorization header.)
// See share/README.md for hosting options.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SETUP_MESSAGE = [
  'This share link is not finished being set up.',
  '',
  'The checklist page needs a host that serves HTML: deploy share/index.html,',
  'then point this function at it with',
  '  supabase secrets set SHARE_PAGE_URL=https://<your-host>/',
  'and redeploy with',
  '  supabase functions deploy share-task-list --no-verify-jwt',
].join('\n');

serve((req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const pageUrl = Deno.env.get('SHARE_PAGE_URL') ?? '';
  if (!pageUrl) {
    return new Response(SETUP_MESSAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  let target: URL;
  try {
    target = new URL(pageUrl);
  } catch {
    return new Response(`SHARE_PAGE_URL is not a valid URL: ${pageUrl}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // Carry the link's own parameters over untouched — the page reads `t` for
  // the share token and `k=sop` to tell an SOP run from a task list.
  const incoming = new URL(req.url).searchParams;
  const token = incoming.get('t');
  const kind = incoming.get('k');
  if (token) target.searchParams.set('t', token);
  if (kind) target.searchParams.set('k', kind);

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
  });
});
