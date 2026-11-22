#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/.local/whisper.cpp/build/bin/whisper-server"
MODEL="$ROOT/.local/whisper.cpp/models/ggml-base.bin"

if [[ ! -x "$SERVER" || ! -f "$MODEL" ]]; then
  echo 'Сначала установите локальный Whisper: npm run voice:setup' >&2
  exit 1
fi

"$SERVER" --host 127.0.0.1 --port 8178 --language ru -m "$MODEL" &
whisper_pid=$!
voice_ai_pid=''
if bash "$ROOT/scripts/start-voice-ai.sh" --check; then
  bash "$ROOT/scripts/start-voice-ai.sh" &
  voice_ai_pid=$!
fi
cleanup() {
  if [[ -n "$voice_ai_pid" ]]; then
    kill "$voice_ai_pid" 2>/dev/null || true
    wait "$voice_ai_pid" 2>/dev/null || true
  fi
  kill "$whisper_pid" 2>/dev/null || true
  wait "$whisper_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT"
npm run dev -- "$@"
