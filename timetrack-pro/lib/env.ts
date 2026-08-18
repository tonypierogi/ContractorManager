const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env, fill in the values, and restart with `npx expo start -c`.'
  );
}

export const Env = {
  supabaseUrl,
  supabaseAnonKey,
  /**
   * Where the public share page (share/index.html) is hosted. Optional: when
   * unset, share links point at the share-task-list edge function, which
   * redirects to the same page. See share/README.md.
   */
  sharePageUrl: process.env.EXPO_PUBLIC_SHARE_PAGE_URL || '',
};
