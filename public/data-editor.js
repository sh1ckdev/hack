const endpoint = '/api/incident-data-editor'
const access = document.querySelector('#access')
const key = document.querySelector('#key')
const workspace = document.querySelector('#workspace')
const editor = document.querySelector('#json')
const file = document.querySelector('#file')
const importButton = document.querySelector('#import')
const save = document.querySelector('#save')
const reload = document.querySelector('#reload')
const status = document.querySelector('#status')
const maxBytes = 64 * 1024 * 1024

let version
let changed = false
let busy = false

function report(message, error = false) {
  status.textContent = message
  status.classList.toggle('error', error)
}

function updateControls() {
  save.disabled = busy || !changed || !version
  editor.readOnly = busy
  reload.disabled = busy
  importButton.disabled = busy
  access.querySelector('button').disabled = busy
}

async function request(options = {}) {
  const headers = new Headers(options.headers)
  headers.set('X-Relay-Request', 'incident-editor')
  if (key.value) headers.set('X-Incident-Editor-Key', key.value.trim())
  const response = await fetch(endpoint, { ...options, headers, cache: 'no-store' })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401) {
      access.hidden = false
      key.focus()
    }
    throw new Error(error.error || 'Не удалось обратиться к серверу.')
  }
  return response
}

async function load() {
  busy = true
  updateControls()
  try {
    const response = await request()
    editor.value = await response.text()
    version = response.headers.get('ETag')
    changed = false
    workspace.hidden = false
    access.hidden = true
    report('Загружена текущая выгрузка.')
  } catch (error) {
    report(error.message, true)
  } finally {
    busy = false
    updateControls()
  }
}

access.addEventListener('submit', (event) => {
  event.preventDefault()
  if (busy || (changed && !confirm('Заменить текущий черновик выгрузкой с сервера?'))) return
  void load()
})
reload.addEventListener('click', () => {
  if (changed && !confirm('Заменить текущий черновик выгрузкой с сервера?')) return
  void load()
})
importButton.addEventListener('click', () => file.click())
file.addEventListener('change', async () => {
  const candidate = file.files[0]
  file.value = ''
  if (!candidate || (changed && !confirm('Заменить текущий черновик выбранным файлом?'))) return
  if (candidate.size > maxBytes) return report('Размер файла превышает 64 МБ.', true)
  busy = true
  updateControls()
  try {
    editor.value = await candidate.text()
    changed = true
    report(`Загружен черновик «${candidate.name}». Нажмите «Сохранить», чтобы применить его.`)
    editor.focus()
  } catch {
    report('Не удалось прочитать выбранный файл.', true)
  } finally {
    busy = false
    updateControls()
  }
})
editor.addEventListener('input', () => {
  if (!changed) report('Есть несохранённые изменения.')
  changed = true
  updateControls()
})
save.addEventListener('click', async () => {
  if (!changed || busy || !version) return
  busy = true
  updateControls()
  try {
    const response = await request({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': version },
      body: editor.value,
    })
    const result = await response.json()
    version = response.headers.get('ETag')
    changed = false
    report(`Выгрузка сохранена. Заявок: ${result.count}.`)
  } catch (error) {
    report(error.message, true)
  } finally {
    busy = false
    updateControls()
  }
})
window.addEventListener('beforeunload', (event) => {
  if (changed) event.preventDefault()
})
void load()
