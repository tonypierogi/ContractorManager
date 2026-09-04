# TimeTrack Pro — repo notes for Claude

Repo layout: the Expo app lives in `timetrack-pro/`; Supabase migrations in `supabase/`.

## Running a branch/PR on the iOS simulator

The simulator app is a reusable Expo dev client (built once via `npx expo run:ios`).
Any branch can be run without merging by serving Metro from its worktree:

```bash
timetrack-pro/scripts/sim-pr.sh          # serve the current checkout
timetrack-pro/scripts/sim-pr.sh <PR#>    # serve a PR by number
```

**After creating a PR from a worktree session:** run `timetrack-pro/scripts/sim-pr.sh`
from that worktree so the PR's version is live on the simulator, and attach the
simulator panel (iOS Simulator MCP `attach`) so the user can try it. Rebuild the
dev client (`npx expo run:ios`) only if the branch changed native dependencies or
`app.config.ts` plugins/permissions — plain TS/React changes never need a rebuild.
