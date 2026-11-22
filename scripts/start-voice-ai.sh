#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != '--check' ]]; then
  if curl --noproxy '*' -fs --max-time 2 http://127.0.0.1:8180/props |
    node -e '
      try {
        const props = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
        if (!props.default_generation_settings || !props.model_path) process.exitCode = 1
      } catch {
        process.exitCode = 1
      }
    '; then
    echo 'Голосовой ИИ уже запущен на 127.0.0.1:8180.'
    exit 0
  fi
  if command -v lsof >/dev/null 2>&1 &&
    lsof -nP -t -iTCP:8180 -sTCP:LISTEN >/dev/null 2>&1; then
    echo 'Порт 8180 занят, а llama.cpp пока не отвечает. Если модель запускается, подождите несколько секунд.' >&2
    exit 1
  fi
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="${VOICE_LLAMA_SERVER:-$ROOT/.local/llama.cpp/build/bin/llama-server}"
MODEL="${VOICE_AI_MODEL_PATH:-$ROOT/.local/models/voice.gguf}"

if [[ -z "${VOICE_AI_MODEL_PATH:-}" && ! -f "$MODEL" ]]; then
  # Reuse Qwen weights if the model was downloaded by Ollama.
  MODEL="$(node --input-type=module <<'JS'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = process.env.OLLAMA_MODELS || join(homedir(), '.ollama', 'models')
try {
  const path = join(root, 'manifests/registry.ollama.ai/library/qwen2.5/1.5b')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const layer = manifest.layers.find(({ mediaType }) => mediaType === 'application/vnd.ollama.image.model')
  if (/^sha256:[a-f0-9]{64}$/.test(layer?.digest)) {
    console.log(join(root, 'blobs', layer.digest.replace(':', '-')))
  }
} catch {
  // A standalone GGUF file may be configured instead.
}
JS
)"
fi

if [[ "${1:-}" == '--check' ]]; then
  [[ -x "$SERVER" && -s "$MODEL" ]]
  exit
fi
if [[ ! -x "$SERVER" || ! -s "$MODEL" ]]; then
  echo 'Для голосового ИИ нужны llama-server и файл GGUF. См. VOICE.md.' >&2
  exit 1
fi

exec "$SERVER" --host 127.0.0.1 --port 8180 --model "$MODEL" \
  --ctx-size 2048 --parallel 1 --cors-origins localhost
