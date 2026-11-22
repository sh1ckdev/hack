#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHISPER_DIR="$ROOT/.local/whisper.cpp"
SERVER="$WHISPER_DIR/build/bin/whisper-server"
MODEL="$WHISPER_DIR/models/ggml-base.bin"

if [[ ! -x "$SERVER" || ! -f "$MODEL" ]]; then
  echo 'Whisper ещё не установлен. Сначала выполните npm run voice:setup.' >&2
  exit 1
fi

exec "$SERVER" --host 127.0.0.1 --port 8178 --language ru -m "$MODEL"
