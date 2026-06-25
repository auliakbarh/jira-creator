#!/usr/bin/env bash
# Launch the JIRA Creator bridge: starts Claude Code in this project and runs the
# /jira-web skill (processes web UI jobs locally — no Anthropic API cost).
#
# Usage:
#   ./bin/jira-web.sh           # interactive bridge (keeps running; type "stop" to end)
#   ./bin/jira-web.sh --once    # headless one-shot: drain pending jobs, then exit
#
# Requires the `claude` CLI in PATH and an authenticated Claude Code session.
set -euo pipefail

# cd to the project root (parent of this script's dir), regardless of where invoked.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: 'claude' CLI not found in PATH. Install Claude Code first." >&2
  exit 1
fi

if [[ "${1:-}" == "--once" ]]; then
  exec claude -p --permission-mode acceptEdits "/jira-web"
else
  exec claude "/jira-web"
fi
