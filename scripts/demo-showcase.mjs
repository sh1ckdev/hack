import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  COORDINATORS,
  DEMO_IDS,
  ENGINEERS_PRIMORYE,
  PRIORITY_LABELS,
  saveIncidents,
} from './demo-lib.mjs'

const now = Date.now()
const at = (minutes) => new Date(now + minutes * 60_000).toISOString()
const stateIds = { Assigned: 0, WorkInProgress: 2, Research: 20, Resolved: 7, Closed: 10 }
const stateLabels = { Assigned: 'Назначен', WorkInProgress: 'В работе', Research: 'Исследование', Resolved: 'Решён', Closed: 'Закрыт' }

function incident({
  id, product, service, title, symptom, detail, team, owner, login, priority,
  state = 'WorkInProgress', age = 90, due = null, ended = null, solution = null,
}) {
  return {
    id,
    productName: product,
    service,
    header: title,
    shortDescription: symptom,
    description: detail ?? symptom,
    priorityId: priority,
    priority: PRIORITY_LABELS[priority],
    stateEnum: state,
    stateId: stateIds[state],
    state: stateLabels[state],
    assignedGroupName: team,
    assignedEmployee: owner ?? null,
    assignedEmployeeLogin: login ?? null,
    submitDate: at(-age),
    deadline: due === null ? null : at(due),
    completionDate: ended === null ? null : at(-ended),
    solution,
  }
}

const lte = { product: 'Мобильный интернет', service: 'LTE-доступ' }
const payment = { product: 'Личный кабинет', service: 'Онлайн-оплата' }
const identity = { product: 'Личный кабинет', service: 'Авторизация по SMS' }
const lteTeam = ENGINEERS_PRIMORYE
const paymentTeam = 'ИТ · Команда платежей'
const identityTeam = 'ИТ · Команда авторизации'

const rows = [
  incident({
    ...lte, id: 'INC000021940001', priority: 4, team: lteTeam, age: 75, due: -18,
    owner: 'Анна Соколова', login: 'asokolova',
    title: 'Не устанавливаются LTE-сессии в части Владивостока',
    symptom: 'Устройства регистрируются в сети, но не получают доступ в интернет.',
    detail: 'За последние 40 минут выросло число неуспешных установлений сессий. На одном из соседних узлов жалоб пока нет. Дежурный сверяет состояние шлюза и последнюю смену конфигурации.',
  }),
  incident({
    ...lte, id: DEMO_IDS.highPriority, priority: 3, team: lteTeam, age: 34, due: 38,
    owner: 'Дмитрий Волков', login: 'dvolkov',
    title: 'Растут таймауты LTE на соседних узлах',
    symptom: 'Часть абонентов повторно подключается после разрыва сессии.',
    detail: 'Жалобы поступают с площадок рядом с зоной критического инцидента. Проверьте, совпадают ли ошибки шлюза и время начала. Общая причина ещё не установлена.',
  }),
  incident({
    ...payment, id: DEMO_IDS.coordinatorAssigned, priority: 3, team: COORDINATORS, age: 52, due: 66,
    state: 'Assigned', owner: 'Марина Котова', login: 'mkotova',
    title: 'Оплата зависает после подтверждения',
    symptom: 'У части клиентов статус платежа остаётся «Обрабатывается».',
    detail: 'Сумма на счёте списана, но статус в кабинете не обновился. Нужно определить, дошло ли подтверждение от платёжного шлюза.',
  }),
  incident({
    ...payment, id: 'INC000021940004', priority: 3, team: paymentTeam, age: 49, due: 92,
    owner: 'Павел Громов', login: 'pgromov',
    title: 'Запаздывают события подтверждения оплаты',
    symptom: 'В платёжном шлюзе видна очередь необработанных подтверждений.',
  }),
  incident({
    ...payment, id: 'INC000021940005', priority: 2, team: paymentTeam, age: 38, due: 210,
    owner: 'Павел Громов', login: 'pgromov',
    title: 'Данные чека появляются с задержкой',
    symptom: 'На части платежей чек становится доступен через несколько минут.',
  }),
  incident({
    ...identity, id: 'INC000021940006', priority: 3, team: identityTeam, age: 21, due: 105,
    state: 'Assigned', title: 'Не приходит SMS для входа в личный кабинет',
    symptom: 'Код не приходит с первой попытки. Повторный запрос помогает не всем.',
  }),
  incident({
    ...identity, id: 'INC000021940007', priority: 2, team: COORDINATORS, age: 108, due: 180,
    state: 'Assigned', title: 'Повторная отправка кода недоступна',
    symptom: 'Кнопка повторной отправки не активируется по истечении таймера.',
  }),
  incident({
    ...identity, id: 'INC000021940008', priority: 2, team: identityTeam, age: 32, due: 245,
    owner: 'Ирина Миронова', login: 'imironova',
    title: 'Увеличилась задержка доставки кодов',
    symptom: 'Доставка SMS идёт медленнее обычного, доля ошибок не растёт.',
  }),
  incident({
    ...payment, id: DEMO_IDS.research, priority: 2, team: COORDINATORS, age: 300, due: -110, ended: 88,
    state: 'Research', owner: 'Марина Котова', login: 'mkotova',
    title: 'Разбор задержки обновления платежей',
    symptom: 'После восстановления обработки нужно проверить, почему накопилась очередь.',
    solution: 'Возобновили обработку подтверждений и сверили статусы с платёжным шлюзом.',
  }),
  incident({
    ...lte, id: 'INC000021940010', priority: 2, team: lteTeam, age: 380, due: -160, ended: 135,
    state: 'Research', owner: 'Анна Соколова', login: 'asokolova',
    title: 'Разбор кратковременных обрывов LTE',
    symptom: 'После восстановления доступа команда проверяет последовательность событий на узле.',
    solution: 'Восстановили сессии переключением трафика на резервный шлюз.',
  }),
  incident({
    ...payment, id: DEMO_IDS.removable, priority: 2, team: paymentTeam, age: 980, due: -740, ended: 780,
    state: 'Resolved', owner: 'Павел Громов', login: 'pgromov',
    title: 'Задерживались подтверждения онлайн-оплаты',
    symptom: 'Подтверждённые шлюзом платежи оставались в статусе обработки.',
    solution: 'Повторно обработали очередь и сверили выборку платежей по идентификаторам операций.',
  }),
  incident({
    ...identity, id: 'INC000021940012', priority: 2, team: identityTeam, age: 870, due: -620, ended: 665,
    state: 'Closed', owner: 'Ирина Миронова', login: 'imironova',
    title: 'Коды входа не доставлялись части пользователей',
    symptom: 'У одного канала отправки выросла доля ошибок доставки.',
    solution: 'Переключили отправку на резервный канал и подтвердили доставку тестовых сообщений.',
  }),
]

const directory = resolve(import.meta.dirname, '..', '.local', 'showcase')
const source = resolve(directory, 'character_problems.source.json')
const working = resolve(directory, 'character_problems.json')
mkdirSync(directory, { recursive: true })
saveIncidents(source, rows)
copyFileSync(source, working)
console.log(`Создано заявок: ${rows.length}`)
console.log(`Выгрузка: ${working}`)
console.log(`Эталон: ${source}`)
