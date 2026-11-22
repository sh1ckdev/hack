#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHISPER_DIR="$ROOT/.local/whisper.cpp"
LOCAL_CMAKE="$ROOT/.local/python/cmake/data/bin"

if ! command -v cmake >/dev/null 2>&1; then
  if [[ -x "$LOCAL_CMAKE/cmake" ]]; then
    export PATH="$LOCAL_CMAKE:$PATH"
  elif command -v python3 >/dev/null 2>&1; then
    echo 'CMake не найден. Устанавливаю его локально в .local/python…'
    python3 -m pip install --disable-pip-version-check --target "$ROOT/.local/python" cmake
    export PATH="$LOCAL_CMAKE:$PATH"
  else
    echo 'Не найден cmake или python3. Установите CMake и инструменты командной строки Xcode, затем повторите.' >&2
    exit 1
  fi
fi
if ! command -v git >/dev/null 2>&1; then
  echo 'Не найден git. Установите Git и повторите npm run voice:setup.' >&2
  exit 1
fi

mkdir -p "$ROOT/.local"
if [[ ! -d "$WHISPER_DIR/.git" ]]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
fi

metal=OFF
if [[ "$(uname -s)" == 'Darwin' && "$(uname -m)" == 'arm64' ]]; then
  metal=ON
fi

cmake -S "$WHISPER_DIR" -B "$WHISPER_DIR/build" \
  -DWHISPER_BUILD_SERVER=ON \
  -DWHISPER_BUILD_EXAMPLES=ON \
  -DGGML_METAL="$metal" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "$WHISPER_DIR/build" --config Release --target whisper-server -j 4
MODEL="$WHISPER_DIR/models/ggml-base.bin"
MODEL_SHA1=465707469ff3a37a2b9b8d8f89f2f99de7299dac
verify_model() {
  printf '%s  %s\n' "$MODEL_SHA1" "$1" | shasum -c --status
}

if [[ ! -f "$MODEL" ]] || ! verify_model "$MODEL"; then
  if ! curl -fL --continue-at - --connect-timeout 15 --speed-limit 1024 \
    --speed-time 30 --output "$MODEL.part" \
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true'; then
    echo 'Не удалось скачать модель. Повторите npm run voice:setup, чтобы продолжить загрузку.' >&2
    exit 1
  fi
  if ! verify_model "$MODEL.part"; then
    rm -f "$MODEL.part"
    echo 'Контрольная сумма модели не совпала. Повторите npm run voice:setup.' >&2
    exit 1
  fi
  mv "$MODEL.part" "$MODEL"
fi

echo 'Локальный Whisper установлен. Запустите npm run dev:voice.'
