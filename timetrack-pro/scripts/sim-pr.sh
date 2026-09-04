#!/usr/bin/env bash
# Serve a branch's JS to the installed TimeTrack Pro dev client on the iOS simulator.
#
# Usage:
#   scripts/sim-pr.sh            # serve the checkout this script lives in
#   scripts/sim-pr.sh 42         # fetch PR #42 into a worktree and serve it
#   scripts/sim-pr.sh my-branch  # same, by branch name
#
# Requires a dev client already installed on the simulator (one-time:
# `npx expo run:ios` from any checkout). Pure JS/TS PRs never need a rebuild;
# rebuild only when native deps or app.config.ts plugins change.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"   # the timetrack-pro app dir for this checkout
REPO_MAIN="/Users/Tony-Work/Documents/CodingProjects/contractortimesheet-invoice/timetrack-pro"
BUNDLE_ID="com.tonypierogi.timetrackpro"

# --- Resolve which checkout to serve -----------------------------------------
if [ $# -ge 1 ]; then
  target="$1"
  if [[ "$target" =~ ^[0-9]+$ ]]; then
    branch="$(gh pr view "$target" --json headRefName -q .headRefName)"
  else
    branch="$target"
  fi
  # Reuse an existing worktree for this branch, else create one.
  wt="$(git -C "$REPO_MAIN" worktree list --porcelain | awk -v b="refs/heads/$branch" '
    /^worktree /{w=$2} /^branch /{if ($2==b) print w}')"
  if [ -z "$wt" ]; then
    wt="$REPO_MAIN/.claude/worktrees/sim-$(echo "$branch" | tr '/' '-')"
    git -C "$REPO_MAIN" fetch origin "$branch"
    git -C "$REPO_MAIN" worktree add "$wt" "$branch"
  fi
  APP_DIR="$wt/timetrack-pro"
fi

echo "Serving: $APP_DIR"
cd "$APP_DIR"

# --- Dependencies (per-worktree node_modules) --------------------------------
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm install
fi

# --- Pick a free Metro port ---------------------------------------------------
PORT=""
for p in $(seq 8081 8099); do
  if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then PORT="$p"; break; fi
done
[ -n "$PORT" ] || { echo "No free port in 8081-8099" >&2; exit 1; }

# --- Start Metro (background, logged) ----------------------------------------
LOG="/tmp/metro-$PORT.log"
nohup npx expo start --port "$PORT" >"$LOG" 2>&1 &
METRO_PID=$!
echo "Metro starting on port $PORT (pid $METRO_PID, log $LOG)"

for i in $(seq 1 60); do
  if curl -sf "http://localhost:$PORT/status" >/dev/null 2>&1; then break; fi
  kill -0 "$METRO_PID" 2>/dev/null || { echo "Metro died — see $LOG" >&2; exit 1; }
  sleep 1
done

# --- Boot simulator and open the dev client ----------------------------------
open -a Simulator
xcrun simctl bootstatus booted -b >/dev/null 2>&1 || true

if ! xcrun simctl listapps booted 2>/dev/null | grep -q "$BUNDLE_ID"; then
  echo "Dev client not installed on this simulator."
  echo "One-time setup: cd $APP_DIR && npx expo run:ios"
  exit 1
fi

xcrun simctl openurl booted "timetrackpro://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$PORT"
echo "Simulator is now running this branch's code from port $PORT."
echo "Stop with: kill $METRO_PID"
