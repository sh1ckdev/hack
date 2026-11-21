# Демонстрация на защите

Рабочая копия — `data/character_problems.json`. Эталон: `data/character_problems.source.json`.

## Сброс

```bash
npm run demo:reset
```

Сбрасывает файл и ленту событий на dev-сервере (если он запущен).

## Сценарии кейса (§9–10)

Вместо случайных сдвигов приоритетов — **имитации по матрице МТС**:

```bash
npm run demo:case              # список сценариев
npm run demo:case -- critical-up
npm run demo:case -- dual-section
npm run demo:case -- coordinator-roundtrip
npm run demo:defense           # цепочка для защиты (~2 мин, пауза 1.5 с)
npm run demo:case -- all --wait 1500   # все сценарии подряд (сначала reset!)
```

| Ключ | Что проверяет |
|------|----------------|
| `critical-up` | Высокий → критический (`INC000021938167`) |
| `critical-down` | Снятие критического без ложного «решён» |
| `coordinators` / `engineers` | Вход и выход из очереди координаторов |
| `deadline` | Только срок, таймер на карточках |
| `employee` | Смена исполнителя |
| `dual-section` | Один ID в **критических** и у **координаторов** |
| `coordinator-roundtrip` | Два сигнала «назначен координаторам» (§9) |
| `research-coordinators` | Исследование + координаторы |
| `resolved-research` | `resolvedCritical`, исследование |
| `remove` | Исчезновение из выгрузки |

Живой показ: `npm run dev`, открытый дашборд, после каждого сценария ждите **~1 с** до обновления снимка.

## Защита из UI (без терминала)

На дашборде кнопка **«Защита §10»**: сброс выгрузки и пошаговое применение тех же сценариев через `POST /api/demo/scenario/…` (только `npm run dev`).

Для смены: **«Фокус смены»**, панель **«Риск смены»**, **«Смена началась»** (дельта по якорю), **«Протокол»** в карточке INC.

Подробнее: [README §сценарий защиты](../README.md#сценарий-защиты), `MTS-Codex-Guide.md` §9–10, [data-contract.md](../docs/data-contract.md).