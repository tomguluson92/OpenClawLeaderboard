#!/usr/bin/env bash
#
# OpenClaw Leaderboard — Hourly Update Script
#
# Fetches latest data from github.com/openclaw/openclaw and rebuilds
# all leaderboard + profile JSONs. Designed to run via cron every hour.
#
# Usage:
#   ./scripts/update.sh
#
# Crontab example (every hour):
#   0 * * * * cd /path/to/OpenClawLeaderboard && ./scripts/update.sh >> logs/update.log 2>&1
#
# Requirements:
#   - bun (https://bun.sh)
#   - .env file with GITHUB_TOKEN set
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
OUTPUT_DIR="$PROJECT_DIR/output"
SITE_API_DIR="$PROJECT_DIR/site/public/api"

mkdir -p "$LOG_DIR" "$OUTPUT_DIR" "$SITE_API_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo ""
echo "============================================"
echo "  OpenClaw Leaderboard Update"
echo "  Started: $TIMESTAMP"
echo "============================================"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
else
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  exit 1
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set in .env"
  exit 1
fi

# Track timing
START_TIME=$(date +%s)

step_time() {
  local now=$(date +%s)
  local elapsed=$((now - START_TIME))
  echo "  [${elapsed}s elapsed]"
}

# Step 1: Fetch all contributor data (PRs, issues, reviews, comments, commits)
echo ""
echo "━━━ Step 1/3: Fetching contributor data (REST + GraphQL) ━━━"
cd "$PROJECT_DIR"
bun scripts/fetch-rest.ts
step_time

# Step 2: Fetch detailed commit statistics (additions/deletions per commit)
echo ""
echo "━━━ Step 2/3: Fetching commit statistics (GraphQL) ━━━"
bun scripts/fetch-commit-stats.ts
step_time

# Step 3: Re-score all profiles and rebuild leaderboards
echo ""
echo "━━━ Step 3/3: Re-scoring and rebuilding leaderboards ━━━"
bun scripts/rescore.ts
step_time

# Step 4: Sync output to site/public/api
echo ""
echo "━━━ Syncing data to site ━━━"

# Copy top-level JSON files
for f in "$OUTPUT_DIR"/*.json; do
  [ -f "$f" ] && cp "$f" "$SITE_API_DIR/"
done

# Copy profiles directory
if [ -d "$OUTPUT_DIR/profiles" ]; then
  mkdir -p "$SITE_API_DIR/profiles"
  cp "$OUTPUT_DIR/profiles/"*.json "$SITE_API_DIR/profiles/"
  PROFILE_COUNT=$(ls -1 "$OUTPUT_DIR/profiles/"*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "  Synced $PROFILE_COUNT profiles to site/public/api/profiles/"
fi

LEADERBOARD_COUNT=$(ls -1 "$SITE_API_DIR"/leaderboard-*.json 2>/dev/null | wc -l | tr -d ' ')
echo "  Synced $LEADERBOARD_COUNT leaderboard files + summary.json"

# Done
END_TIME=$(date +%s)
TOTAL_ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_ELAPSED / 60))
SECONDS=$((TOTAL_ELAPSED % 60))

echo ""
echo "============================================"
echo "  Update complete!"
echo "  Duration: ${MINUTES}m ${SECONDS}s"
echo "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
