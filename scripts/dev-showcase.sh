#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export INCIDENTS_FILE="$ROOT/.local/showcase/character_problems.json"
export INCIDENTS_DEMO_BASELINE_FILE="$ROOT/.local/showcase/character_problems.source.json"
export INCIDENTS_DEMO_PROFILE=showcase

if [[ ! -f "$INCIDENTS_FILE" || ! -f "$INCIDENTS_DEMO_BASELINE_FILE" ]]; then
  npm run demo:showcase
fi

command=dev
if [[ "${1:-}" == '--voice' ]]; then
  command=dev:voice
  shift
fi
exec npm run "$command" -- --host 127.0.0.1 --port "${DEMO_PORT:-5182}" --strictPort "$@"
