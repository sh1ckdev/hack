# Деплой МТС Дежурки

На сервере нужны Docker и Docker Compose. Из каталога проекта:

```bash
cp .env.deploy.example .env.deploy
docker compose --env-file .env.deploy up -d --build
docker compose --env-file .env.deploy ps
curl --fail http://127.0.0.1:8080/healthz
```

Production-сервер отдаёт интерфейс и API на одном адресе. По умолчанию порт доступен только на сервере. Для команды настройте HTTPS через reverse proxy с доступом по VPN или с аутентификацией. В [Caddyfile.example](Caddyfile.example) есть пример для Caddy на том же сервере. Замените домен, задайте `DASHBOARD_USER` и `DASHBOARD_PASSWORD_HASH` в окружении Caddy. Хеш создаётся командой `caddy hash-password`. Если меняете `DASHBOARD_PORT`, обновите и порт в прокси. Весь сайт, включая API, должен быть за одним контуром доступа. HTTPS нужен для микрофона на рабочих компьютерах.

## Редактирование и смена выгрузки

При первом запуске Docker помещает стартовый JSON в том `incident-data`. Отметки смены хранятся отдельно в `shift-state`. Обычный перезапуск и пересборка образа сохраняют оба тома.

Чтобы отредактировать текущую выгрузку, сохраните копию на сервере и откройте её в редакторе:

```bash
mkdir -p deploy-data
docker compose --env-file .env.deploy exec -T app sh -c 'cat "$INCIDENTS_FILE"' > deploy-data/current.json
cp deploy-data/current.json deploy-data/current.before-edit.json
nano deploy-data/current.json
docker compose --env-file .env.deploy exec -T app npm run data:replace -- - < deploy-data/current.json
```

Чтобы переключаться между выгрузками, загрузите их на сервер через SCP или SFTP. Храните каждую под своим именем. Например:

```bash
docker compose --env-file .env.deploy exec -T app npm run data:check -- - < deploy-data/shift-a.json
docker compose --env-file .env.deploy exec -T app npm run data:replace -- - < deploy-data/shift-a.json
docker compose --env-file .env.deploy exec -T app npm run data:replace -- - < deploy-data/shift-b.json
```

Заменяйте файл по одному разу нужной командой. JSON должен содержать массив заявок в формате `data/character_problems.json`. Невалидный JSON и дубли номеров отклоняются, текущая выгрузка при ошибке сохраняется. При успешной проверке замена происходит атомарно. Дашборд подхватывает её за несколько секунд. Чтобы вернуться к предыдущей выгрузке, передайте её в ту же команду. Управление файлом доступно оператору с SSH и доступом к Docker.

## Модели и настройки

- Для сводок по правилам оставьте `INCIDENT_AI_MODE=template`. Для облачной модели заполните режим, ID модели и ключ в `.env.deploy`. При модели OpenRouter используйте `INCIDENT_AI_MODE=openrouter` и `OPENROUTER_API_KEY`.
- Чтобы использовать уже запущенные Whisper и Qwen, укажите их приватные URL в `.env.deploy`. Адреса должны быть доступны из контейнера. На Linux сервисы, слушающие только `127.0.0.1` хоста, для контейнера недоступны.
- `VITE_ITSM_INCIDENT_URL` задаётся при сборке. После его изменения запустите `up -d --build`. Для применения остальных переменных перезапустите сервис через `up -d`.
- Мастер, который меняет демо-данные, работает в режиме разработки. На сервере для показа сценариев используйте заранее подготовленные JSON.


### Голосовые сервисы в Docker

Если моделей на сервере ещё нет, положите мультиязычный файл Whisper (например, `ggml-base.bin`) и GGUF-файл Qwen Instruct на диск. Укажите их абсолютные пути в `.env.deploy`:

```dotenv
WHISPER_MODEL_PATH=/opt/mts-models/ggml-base.bin
VOICE_AI_MODEL_PATH=/opt/mts-models/qwen-instruct.gguf
```

Запустите приложение вместе с обоими сервисами:

```bash
docker compose --env-file .env.deploy -f compose.yaml -f compose.voice.yaml up -d --build
docker compose --env-file .env.deploy -f compose.yaml -f compose.voice.yaml logs --tail=30 whisper qwen
```

В этой конфигурации приложение обращается к моделям по именам сервисов внутри Docker-сети. Порты моделей не публикуются, файлы весов подключаются только для чтения. [Whisper Docker](https://github.com/ggml-org/whisper.cpp#docker) · [llama.cpp Docker](https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md)

### Импорт и редактирование в браузере

В локальном режиме откройте `http://localhost:5173/data-editor.html`. На сервере путь тот же. Чтобы включить редактор на сервере, сгенерируйте ключ командой `openssl rand -hex 32`, задайте его в `INCIDENTS_EDITOR_KEY` в `.env.deploy` и выполните `docker compose --env-file .env.deploy up -d --build`. Открывайте страницу через HTTPS и вводите ключ в форму доступа.

«Импортировать файл» загружает JSON в черновик. «Сохранить» проверяет черновик и применяет его к активной выгрузке. Если файл обновился после открытия страницы, редактор отклонит сохранение и оставит черновик в поле ввода.
