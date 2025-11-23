# Документация WebSocket состояний Aviator

## Обзор

Игра Aviator использует WebSocket для передачи состояний игры в реальном времени. Игровой цикл автоматически управляется сервером и проходит через следующие состояния:

```
WAITING (5 сек) → ACTIVE (игра идет) → FINISHED (краш) → WAITING (новая игра)
```

## WebSocket Endpoint

```
ws://your-domain/ws
```

### Аутентификация

При подключении необходимо передать JWT токен:

```javascript
const socket = io('ws://your-domain/ws', {
  auth: {
    token: 'your-jwt-token',
  },
});
```

## События от сервера (Server → Client)

### 1. `connected`

**Когда отправляется:** При успешном подключении клиента

**Payload:**

```typescript
{
  message: "Connected successfully",
  activeUsers: number  // Количество активных пользователей
}
```

**Пример:**

```json
{
  "message": "Connected successfully",
  "activeUsers": 15
}
```

---

### 2. `aviator:game`

**Когда отправляется:**

- При инициализации игрового цикла
- При создании новой игры
- По запросу клиента (`aviator:createOrGet`, `aviator:getCurrent`)

**Payload:**

```typescript
{
  id: number,
  status: "WAITING" | "ACTIVE" | "FINISHED",
  multiplier: number,        // Множитель краша
  clientSeed: string,        // Клиентский сид (для провайбли-феа)
  nonce: number,             // Номер игры
  startsAt: string,          // ISO дата начала игры
  createdAt: string,         // ISO дата создания
  updatedAt: string,         // ISO дата обновления
  bets: Array<{
    id: number,
    amount: number,
    cashedAt: number | null, // Множитель кешаута (если сделан)
    createdAt: string,
    user: {
      id: string,
      username: string,
      telegramId: string
    }
  }>
}
```

**Пример:**

```json
{
  "id": 123,
  "status": "WAITING",
  "multiplier": 2.45,
  "clientSeed": "a1b2c3d4e5f6...",
  "nonce": 5678,
  "startsAt": "2025-11-23T12:00:05.000Z",
  "createdAt": "2025-11-23T12:00:00.000Z",
  "updatedAt": "2025-11-23T12:00:00.000Z",
  "bets": [
    {
      "id": 1,
      "amount": 100,
      "cashedAt": null,
      "createdAt": "2025-11-23T12:00:02.000Z",
      "user": {
        "id": "user123",
        "username": "player1",
        "telegramId": "123456789"
      }
    }
  ]
}
```

---

### 3. `aviator:statusChange`

**Когда отправляется:**

- При переходе из `WAITING` → `ACTIVE`
- При переходе из `ACTIVE` → `FINISHED`

**Payload:**

```typescript
{
  gameId: number,
  status: "WAITING" | "ACTIVE" | "FINISHED",
  timestamp: string  // ISO дата
}
```

**Примеры:**

```json
// Начало игры
{
  "gameId": 123,
  "status": "ACTIVE",
  "timestamp": "2025-11-23T12:00:05.000Z"
}

// Окончание игры
{
  "gameId": 123,
  "status": "FINISHED",
  "timestamp": "2025-11-23T12:00:15.000Z"
}
```

---

### 4. `aviator:countdown`

**Когда отправляется:** Каждую секунду во время статуса `WAITING`

**Payload:**

```typescript
{
  gameId: number,
  secondsLeft: number,     // Оставшиеся секунды до старта
  startsAt: string         // ISO дата старта
}
```

**Пример:**

```json
{
  "gameId": 123,
  "secondsLeft": 3,
  "startsAt": "2025-11-23T12:00:05.000Z"
}
```

---

### 5. `aviator:crashed`

**Когда отправляется:** Когда самолет крашится (игра завершается)

**Payload:**

```typescript
{
  gameId: number,
  multiplier: number,      // Множитель на котором произошел краш
  timestamp: string        // ISO дата
}
```

**Пример:**

```json
{
  "gameId": 123,
  "multiplier": 2.45,
  "timestamp": "2025-11-23T12:00:15.000Z"
}
```

---

### 6. `aviator:crashHistory`

**Когда отправляется:**

- При подключении нового клиента
- После каждого краша (обновленная история)

**Payload:**

```typescript
{
  history: number[],       // Массив последних 20 множителей крашей
  timestamp: string        // ISO дата
}
```

**Пример:**

```json
{
  "history": [2.45, 1.00, 5.67, 3.21, 1.50, ...],
  "timestamp": "2025-11-23T12:00:15.000Z"
}
```

**Примечание:** Массив отсортирован от новых к старым (первый элемент - самый последний краш)

---

### 7. `aviator:win`

**Когда отправляется:** Персонально игроку, который успешно сделал кешаут

**Payload:**

```typescript
{
  betId: number,
  betAmount: number,           // Сумма ставки
  cashedAt: number,            // Множитель кешаута
  winAmount: number,           // Сумма выигрыша
  crashMultiplier: number,     // Множитель краша игры
  timestamp: string            // ISO дата
}
```

**Пример:**

```json
{
  "betId": 456,
  "betAmount": 100,
  "cashedAt": 2.0,
  "winAmount": 200,
  "crashMultiplier": 2.45,
  "timestamp": "2025-11-23T12:00:15.000Z"
}
```

---

### 8. `aviator:lose`

**Когда отправляется:** Персонально игроку, который не успел сделать кешаут

**Payload:**

```typescript
{
  betId: number,
  betAmount: number,           // Сумма ставки
  crashMultiplier: number,     // Множитель краша игры
  timestamp: string            // ISO дата
}
```

**Пример:**

```json
{
  "betId": 457,
  "betAmount": 100,
  "crashMultiplier": 2.45,
  "timestamp": "2025-11-23T12:00:15.000Z"
}
```

---

### 9. `aviator:newBet`

**Когда отправляется:** Всем клиентам, когда кто-то делает ставку

**Payload:**

```typescript
{
  betId: number,
  aviatorId: number,
  userId: string,
  username: string,
  amount: number,
  timestamp: string        // ISO дата
}
```

**Пример:**

```json
{
  "betId": 789,
  "aviatorId": 123,
  "userId": "user123",
  "username": "player1",
  "amount": 100,
  "timestamp": "2025-11-23T12:00:02.000Z"
}
```

---

### 10. `aviator:cashOut`

**Когда отправляется:** Всем клиентам, когда кто-то делает кешаут

**Payload:**

```typescript
{
  betId: number,
  aviatorId: number,
  userId: string,
  username: string,
  amount: number,              // Изначальная ставка
  multiplier: number,          // Множитель кешаута
  winAmount: number,           // Сумма выигрыша
  timestamp: string            // ISO дата
}
```

**Пример:**

```json
{
  "betId": 789,
  "aviatorId": 123,
  "userId": "user123",
  "username": "player1",
  "amount": 100,
  "multiplier": 2.0,
  "winAmount": 200,
  "timestamp": "2025-11-23T12:00:10.000Z"
}
```

---

### 11. `aviator:newInventoryBet`

**Когда отправляется:** Всем клиентам, когда кто-то делает ставку предметом из инвентаря

**Payload:**

```typescript
{
  betId: number,
  aviatorId: number,
  userId: string,
  username: string,
  initialAmount: number,       // Стоимость предмета
  depositedItem: {
    id: number,
    name: string,
    amount: number,
    url: string
  },
  timestamp: string            // ISO дата
}
```

---

### 12. `aviator:giftCashedOut`

**Когда отправляется:** Всем клиентам, когда кто-то кешаутит предмет за приз

**Payload:**

```typescript
{
  betId: number,
  userId: string,
  username: string,
  initialAmount: number,       // Начальная стоимость
  finalAmount: number,         // Финальная стоимость после множителя
  multiplier: number,          // Множитель кешаута
  prize: {
    id: number,
    name: string,
    amount: number,
    url: string
  },
  timestamp: string            // ISO дата
}
```

---

### 13. `aviator:possiblePrize`

**Когда отправляется:** В ответ на запрос `aviator:getPossiblePrize`

**Payload:**

```typescript
{
  id: number,
  name: string,
  amount: number,
  url: string
} | null
```

---

### 14. `aviator:history`

**Когда отправляется:** В ответ на запрос `aviator:getHistory`

**Payload:**

```typescript
{
  games: Array<{
    id: number,
    multiplier: number,          // Множитель краша
    clientSeed: string,          // Клиентский сид (для провайбли-феа)
    nonce: number,               // Номер игры
    status: "FINISHED",          // Всегда FINISHED для истории
    startsAt: string,            // ISO дата начала игры
    createdAt: string,           // ISO дата создания
    updatedAt: string,           // ISO дата обновления
    totalBets: number            // Количество ставок в игре
  }>,
  count: number,                 // Количество игр в истории
  timestamp: string              // ISO дата запроса
}
```

**Пример:**

```json
{
  "games": [
    {
      "id": 123,
      "multiplier": 2.45,
      "clientSeed": "a1b2c3d4e5f6...",
      "nonce": 5678,
      "status": "FINISHED",
      "startsAt": "2025-11-23T12:00:05.000Z",
      "createdAt": "2025-11-23T12:00:00.000Z",
      "updatedAt": "2025-11-23T12:00:15.000Z",
      "totalBets": 15
    },
    {
      "id": 122,
      "multiplier": 1.0,
      "clientSeed": "b2c3d4e5f6a7...",
      "nonce": 5677,
      "status": "FINISHED",
      "startsAt": "2025-11-23T11:59:45.000Z",
      "createdAt": "2025-11-23T11:59:40.000Z",
      "updatedAt": "2025-11-23T11:59:46.000Z",
      "totalBets": 8
    }
  ],
  "count": 2,
  "timestamp": "2025-11-23T12:01:00.000Z"
}
```

---

### 15. `activeUsersCount`

**Когда отправляется:**

- При подключении/отключении любого пользователя
- Периодически для синхронизации

**Payload:**

```typescript
{
  count: number,           // Количество активных пользователей
  timestamp: string        // ISO дата
}
```

**Пример:**

```json
{
  "count": 15,
  "timestamp": "2025-11-23T12:00:00.000Z"
}
```

---

### 16. `error`

**Когда отправляется:** При возникновении ошибки в обработке запроса

**Payload:**

```typescript
{
  message: string; // Описание ошибки
}
```

**Пример:**

```json
{
  "message": "Insufficient balance"
}
```

---

## События от клиента (Client → Server)

### 1. `aviator:createOrGet`

**Описание:** Создать или получить текущую игру

**Payload:** Нет

**Ответ:** `aviator:game`

---

### 2. `aviator:getCurrent`

**Описание:** Получить текущую активную игру

**Payload:** Нет

**Ответ:** `aviator:game` или `aviator:noGame`

---

### 3. `aviator:getHistory`

**Описание:** Получить историю завершенных игр

**Payload:**

```typescript
{
  limit?: number  // Опционально: количество игр (1-100), по умолчанию 20
}
```

**Ответ:** `aviator:history` или `error`

**Пример запроса:**

```javascript
// Получить последние 20 игр (по умолчанию)
socket.emit('aviator:getHistory');

// Получить последние 50 игр
socket.emit('aviator:getHistory', { limit: 50 });
```

---

### 4. `aviator:placeBet`

**Описание:** Сделать ставку на текущую игру

**Payload:**

```typescript
{
  aviatorId: number,
  amount: number
}
```

**Ответ:** `aviator:betPlaced` или `error`

**Правила:**

- Ставки принимаются только в статусе `WAITING`
- Ставка должна быть в диапазоне `[minBet, maxBet]`
- У пользователя должен быть достаточный баланс
- Один пользователь может сделать только одну ставку на игру

---

### 5. `aviator:cashOut`

**Описание:** Забрать выигрыш при текущем множителе

**Payload:**

```typescript
{
  betId: number,
  currentMultiplier: number
}
```

**Ответ:** `aviator:cashedOut` или `error`

**Правила:**

- Кешаут возможен только в статусе `ACTIVE`
- Множитель не должен превышать множитель краша
- Ставка не должна быть уже закэшаучена

---

### 6. `aviator:depositInventory`

**Описание:** Внести предмет из инвентаря в качестве ставки

**Payload:**

```typescript
{
  inventoryItemId: number,
  aviatorId: number
}
```

**Ответ:** `aviator:inventoryDeposited` или `error`

**Правила:**

- Предмет должен принадлежать пользователю
- Предмет будет удален из инвентаря
- Ставка создается со стоимостью предмета

---

### 7. `aviator:getPossiblePrize`

**Описание:** Получить возможный приз для текущей суммы

**Payload:**

```typescript
{
  currentAmount: number;
}
```

**Ответ:** `aviator:possiblePrize` или `error`

---

### 8. `aviator:cashOutGift`

**Описание:** Забрать приз за ставку предметом

**Payload:**

```typescript
{
  betId: number,
  currentMultiplier: number
}
```

**Ответ:** `aviator:giftCashed` или `error`

**Правила:**

- Работает только для ставок предметами (`isInventoryBet: true`)
- Приз выбирается случайно из доступных призов >= finalAmount
- Приз добавляется в инвентарь пользователя

---

### 9. `ping`

**Описание:** Проверка соединения

**Payload:** Нет

**Ответ:** `pong` с данными:

```typescript
{
  timestamp: string,
  activeUsers: number
}
```

---

### 10. `getActiveUsers`

**Описание:** Получить количество активных пользователей

**Payload:** Нет

**Ответ:** `activeUsersCount`

---

## Жизненный цикл игры

### Временная диаграмма

```
t=0s:    Создается игра со статусом WAITING
         ├─ Отправляется aviator:game
         └─ startsAt = now + 5s

t=0-5s:  Каждую секунду отправляется aviator:countdown
         ├─ Игроки могут делать ставки (placeBet)
         └─ secondsLeft уменьшается от 5 до 0

t=5s:    Игра переходит в статус ACTIVE
         ├─ Отправляется aviator:statusChange (status: "ACTIVE")
         ├─ Отправляется обновленный aviator:game
         └─ Начинается полет самолета

t=5-Xs:  Самолет летит, множитель растет
         ├─ Игроки могут делать cashOut
         ├─ При каждом cashOut всем отправляется aviator:cashOut
         └─ Игроку отправляется персональный aviator:win

t=Xs:    Самолет крашится (X зависит от multiplier)
         ├─ Отправляется aviator:crashed
         ├─ Отправляется aviator:statusChange (status: "FINISHED")
         ├─ Игрокам без cashOut отправляется aviator:lose
         ├─ Отправляется обновленный aviator:crashHistory
         └─ Игра переходит в FINISHED

t=X+3s:  Создается новая игра
         └─ Цикл повторяется с t=0s
```

---

## Примеры использования

### Подключение и получение игры

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://your-domain/ws', {
  auth: {
    token: 'your-jwt-token',
  },
});

socket.on('connected', (data) => {
  console.log('Connected!', data);

  // Запросить текущую игру
  socket.emit('aviator:getCurrent');
});

socket.on('aviator:game', (game) => {
  console.log('Current game:', game);

  if (game.status === 'WAITING') {
    console.log('Game is waiting, you can place bets!');
  } else if (game.status === 'ACTIVE') {
    console.log('Game is active! Plane is flying!');
  }
});
```

---

### Получение истории игр

```typescript
// Получить последние 20 игр
socket.emit('aviator:getHistory');

socket.on('aviator:history', (data) => {
  console.log(`Received ${data.count} games history:`, data.games);

  data.games.forEach((game, index) => {
    console.log(
      `#${index + 1} Game ${game.id}: crashed at ${game.multiplier}x (${game.totalBets} bets)`,
    );
  });

  // Обновить UI с историей
  updateHistoryUI(data.games);
});

// Получить последние 50 игр
socket.emit('aviator:getHistory', { limit: 50 });

socket.on('aviator:history', (data) => {
  console.log('Extended history:', data.games);

  // Показать график множителей
  const multipliers = data.games.map((g) => g.multiplier);
  renderMultiplierChart(multipliers);

  // Статистика
  const avgMultiplier =
    multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  console.log(`Average multiplier: ${avgMultiplier.toFixed(2)}x`);

  const instantCrashes = multipliers.filter((m) => m === 1.0).length;
  console.log(`Instant crashes: ${instantCrashes} out of ${data.count} games`);
});
```

---

### Отслеживание обратного отсчета

```typescript
socket.on('aviator:countdown', (data) => {
  console.log(`Game starts in ${data.secondsLeft} seconds`);

  // Обновить UI с таймером
  updateCountdownUI(data.secondsLeft);
});
```

---

### Размещение ставки

```typescript
socket.on('aviator:game', (game) => {
  if (game.status === 'WAITING') {
    // Сделать ставку 100 монет
    socket.emit('aviator:placeBet', {
      aviatorId: game.id,
      amount: 100,
    });
  }
});

socket.on('aviator:betPlaced', (bet) => {
  console.log('Bet placed successfully:', bet);
});

socket.on('aviator:newBet', (bet) => {
  console.log('Someone placed a bet:', bet);
  // Добавить ставку в список на UI
});
```

---

### Кешаут во время игры

```typescript
let currentMultiplier = 1.0;

socket.on('aviator:statusChange', (data) => {
  if (data.status === 'ACTIVE') {
    console.log('Game started! Plane is flying!');

    // Запустить таймер для расчета множителя
    const gameStartTime = Date.now();
    const updateInterval = setInterval(() => {
      const elapsed = (Date.now() - gameStartTime) / 1000;
      // Формула роста множителя (примерная)
      currentMultiplier = 1 + Math.pow(elapsed / 1000, 1.5) * 3;
      updateMultiplierUI(currentMultiplier);
    }, 100);
  }
});

// Кешаут при достижении желаемого множителя
function cashOut(betId) {
  socket.emit('aviator:cashOut', {
    betId: betId,
    currentMultiplier: currentMultiplier,
  });
}

socket.on('aviator:cashedOut', (result) => {
  console.log('Cashed out successfully!', result);
  console.log(`Won ${result.winAmount} coins at ${result.multiplier}x`);
});

socket.on('aviator:win', (data) => {
  console.log('🎉 YOU WON!', data);
  showWinNotification(data.winAmount);
});

socket.on('aviator:lose', (data) => {
  console.log('💥 You lost', data);
  showLoseNotification(data.betAmount);
});
```

---

### Отслеживание краша

```typescript
socket.on('aviator:crashed', (data) => {
  console.log(`💥 Plane crashed at ${data.multiplier}x`);

  // Остановить анимацию
  stopMultiplierAnimation();

  // Показать экран краша
  showCrashScreen(data.multiplier);
});

socket.on('aviator:crashHistory', (data) => {
  console.log('Crash history:', data.history);

  // Обновить историю на UI
  updateCrashHistoryUI(data.history);
});
```

---

### Работа с предметами инвентаря

```typescript
// Внести предмет из инвентаря
socket.emit('aviator:depositInventory', {
  inventoryItemId: 123,
  aviatorId: currentGame.id,
});

socket.on('aviator:inventoryDeposited', (result) => {
  console.log('Item deposited:', result);
});

// Получить возможный приз
socket.emit('aviator:getPossiblePrize', {
  currentAmount: currentBetAmount * currentMultiplier,
});

socket.on('aviator:possiblePrize', (prize) => {
  console.log('Possible prize:', prize);
  showPrizePreview(prize);
});

// Забрать приз
socket.emit('aviator:cashOutGift', {
  betId: myBetId,
  currentMultiplier: currentMultiplier,
});

socket.on('aviator:giftCashed', (result) => {
  console.log('🎁 Prize received!', result.prize);
  showPrizeWinNotification(result.prize);
});
```

---

## Обработка ошибок

```typescript
socket.on('error', (error) => {
  console.error('Error:', error.message);

  switch (error.message) {
    case 'Insufficient balance':
      showBalanceError();
      break;
    case 'Game is not accepting bets':
      showBettingClosedError();
      break;
    case 'You already have a bet on this game':
      showDuplicateBetError();
      break;
    default:
      showGenericError(error.message);
  }
});
```

---

## Отслеживание активных пользователей

```typescript
socket.on('activeUsersCount', (data) => {
  console.log(`Active users: ${data.count}`);
  updateActiveUsersUI(data.count);
});

// Или запросить вручную
socket.emit('getActiveUsers');
```

---

## Провайбли-фейр (Provably Fair)

Каждая игра содержит:

- `serverSeed` - серверный сид (хранится в секрете)
- `clientSeed` - клиентский сид (генерируется случайно)
- `nonce` - номер игры

Множитель рассчитывается по формуле:

```javascript
hash = HMAC - SHA256(serverSeed, clientSeed + ':' + nonce);
multiplier = calculateFromHash(hash);
```

Игроки могут проверить честность игры после её завершения, используя:

- Публичный `clientSeed` (в ответе `aviator:game`)
- `nonce` (в ответе `aviator:game`)
- `serverSeed` (раскрывается администратором после игры)

---

## Технические детали

### Частота обновлений

- `aviator:countdown`: **1 раз в секунду** (во время WAITING)
- Проверка статуса игры: **1 раз в секунду** (в gameLoop)
- `aviator:game`: По событиям (переходы состояний)
- `aviator:newBet`, `aviator:cashOut`: В реальном времени (при действии игрока)

### Ограничения

- **Один активный сокет на пользователя:** При повторном подключении старое соединение разрывается
- **Одна ставка на игру:** Пользователь может сделать только одну ставку (обычную или инвентарем)
- **Диапазон ставок:** От `minBet` до `maxBet` (по умолчанию 25-10000)
- **История крашей:** Хранится последние 20 игр

### Безопасность

- JWT токен обязателен для подключения
- Проверка владельца при cashOut
- Проверка баланса при ставках
- Атомарные транзакции БД для финансовых операций
- Проверка статуса игры перед действиями

---

## Диаграмма состояний

```
┌─────────┐
│ WAITING │ ──5 секунд──> ┌────────┐
└─────────┘               │ ACTIVE │
    ▲                     └────────┘
    │                         │
    │                         │ краш через X секунд
    │                         ▼
    │                     ┌──────────┐
    └──── 3 секунды ───── │ FINISHED │
                          └──────────┘
```

## Формула роста множителя

В игре используется экспоненциальная формула роста:

```javascript
elapsed = текущее_время - время_старта (в секундах)
multiplier = 1 + (elapsed)^1.5 * 3
```

Обратная формула для расчета времени краша:

```javascript
crashTime = ((crashMultiplier - 1) / 3)^(1/1.5) * 1000 мс
```

**Примеры:**

- Множитель 1.00x → краш сразу
- Множитель 2.00x → краш через ~0.577 сек
- Множитель 5.00x → краш через ~1.587 сек
- Множитель 10.00x → краш через ~2.466 сек

---

## Заключение

Эта документация описывает все состояния и события WebSocket для игры Aviator. Для дополнительной информации о:

- Provably Fair алгоритме: см. `PROVABLY_FAIR.md`
- API эндпоинтах: см. основную документацию API
- Настройках игры: см. документацию администратора
