#!/bin/bash
# OpenClaw Contributor Analytics - Daily Sync Script
# Run via cron: 0 2 * * * /path/to/scripts/daily-sync.sh
#
# Setup cron:
#   crontab -e
#   0 2 * * * cd /Users/dinq-staff/Documents/OpenClawLeaderboard && ./scripts/daily-sync.sh >> ./data/daily-sync.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "========================================"
echo "OpenClaw Daily Sync - $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check required env vars
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set. Add it to .env file."
  exit 1
fi

export PIPELINE_CONFIG_FILE=config/openclaw.json

# Run full pipeline (fetch last 7 days for daily sync)
echo ""
echo "Running pipeline..."
bun run cli/run.ts all --days 7 --verbose

echo ""
echo "========================================"
echo "Daily sync completed at $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
