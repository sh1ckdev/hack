import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const COORDINATORS = 'КЦ ИТ Координаторы Массовых Инцидентов'
export const ENGINEERS_PRIMORYE = 'ОГЭ Приморье'

export const PRIORITY_LABELS = {
  1: 'Низкий',
  2: 'Средний',
  3: 'Высокий',
  4: 'Наивысший',
}

/** Как в README и матрице §9. */
export const DEMO_IDS = {
  highPriority: 'INC000021938167',
  research: 'INC000021930418',
  coordinatorAssigned: 'INC000021931151',
  removable: 'INC000021929735',
}

export function defaultDataFile() {
  return resolve(import.meta.dirname, '..', 'data', 'character_problems.json')
}

export function loadIncidents(file) {
  const raw = readFileSync(file, 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new Error('Ожидается массив инцидентов в JSON')
  }
  return data
}

export function saveIncidents(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function findById(data, id) {
  const row = data.find((r) => r?.id === id)
  if (!row) throw new Error(`Инцидент ${id} не найден в выгрузке`)
  return row
}

export function patchById(data, id, patch) {
  const row = findById(data, id)
  Object.assign(row, patch)
  if (patch.priorityId != null) {
    row.priority = PRIORITY_LABELS[patch.priorityId] ?? row.priority
  }
  return row
}

export function removeById(data, id) {
  const index = data.findIndex((r) => r?.id === id)
  if (index < 0) throw new Error(`Инцидент ${id} не найден в выгрузке`)
  data.splice(index, 1)
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

export function isoIn(hoursFromNow = 0) {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString()
}