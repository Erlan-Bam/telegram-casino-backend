# 🚨 CRITICAL BACKEND FIXES REQUIRED

## Статус: ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА

Backend **НЕ отправляет** событие `aviator:lose` игрокам, которые проиграли ставку. Это **100% backend проблема**, frontend готов получить и обработать событие.

---

## Проблема 1: LOSE EVENT НЕ ОТПРАВЛЯЕТСЯ (КРИТИЧНО!)

### Доказательства из Frontend Логов:

```
✅ Bet placed: betId: 167, amount: 500⭐
✅ Game started: Status ACTIVE
✅ Multiplier grew: 0.92x → 1.17x
✅ CRASH EVENT RECEIVED: multiplier 1.17x
✅ Crash history updated
✅ Game status: FINISHED

❌ LOSE EVENT NEVER RECEIVED  ← ПРОБЛЕМА!
❌ No "😢 LOSE EVENT RECEIVED FROM BACKEND" log
❌ No lose popup shown to player
```

### Что Должно Происходить:

```typescript
// Backend crash handler должен делать это:

async handleGameCrash(gameId: number, crashMultiplier: number) {
  console.log(`🔥 [Gateway] Game ${gameId} crashed at ${crashMultiplier}x`);

  // 1. Emit crash event to all players ✅ (ЭТО РАБОТАЕТ)
  this.server.to(`aviator-game-${gameId}`).emit('aviator:crashed', {
    gameId,
    multiplier: crashMultiplier,
    timestamp: new Date().toISOString(),
  });

  // 2. Find all losing bets (players who didn't cashout)
  const losingBets = await this.prisma.bet.findMany({
    where: {
      aviatorId: gameId,
      status: 'ACTIVE',  // или 'PLACED' - зависит от вашей модели
      cashedOut: false,
    },
    include: {
      user: true,
    },
  });

  console.log(`📊 [Gateway] Found ${losingBets.length} losing bets to process`);

  // 3. 🚨 ЭТА ЧАСТЬ ОТСУТСТВУЕТ ИЛИ НЕ РАБОТАЕТ!
  for (const bet of losingBets) {
    console.log(`📤 [Gateway] EMITTING aviator:lose to Player ${bet.userId}`);
    console.log(`   betId: ${bet.id}, amount: ${bet.amount}, crash: ${crashMultiplier}x`);

    // Emit lose event to specific player
    this.server.to(bet.userId).emit('aviator:lose', {
      betId: bet.id,
      betAmount: bet.amount,
      crashMultiplier: crashMultiplier,
    });

    console.log(`✅ [Gateway] aviator:lose event SENT for bet ${bet.id}`);

    // Update bet status in database
    await this.prisma.bet.update({
      where: { id: bet.id },
      data: {
        status: 'LOST',
        crashedAt: crashMultiplier,
        updatedAt: new Date(),
      },
    });
  }

  // 4. Update game status
  await this.updateGameStatus(gameId, 'FINISHED');

  // 5. Emit status change
  this.server.to(`aviator-game-${gameId}`).emit('aviator:statusChange', {
    gameId,
    status: 'FINISHED',
    timestamp: new Date().toISOString(),
  });

  console.log(`✅ [Gateway] All lose events processed for game ${gameId}`);
}
```

### Где Искать Код На Backend:

**Файлы для проверки:**

1. `src/aviator/aviator.gateway.ts` - основной файл Gateway с WebSocket событиями
2. `src/aviator/aviator.service.ts` - бизнес-логика игры
3. Любой файл с названием `crash`, `handleCrash`, `game-crash`

**Что искать:**

```typescript
// Ищите функцию которая обрабатывает краш:
-handleGameCrash() -
  onGameCrash() -
  processCrash() -
  handleMultiplierReached() -
  stopGame();
```

---

## Проблема 2: WIN EVENT ПОСЛЕ CASHOUT (СРЕДНИЙ ПРИОРИТЕТ)

### Что Должно Происходить После Cashout:

```typescript
// В cashout handler (aviator.gateway.ts):

async handleCashOut(client: Socket, data: { betId: number, multiplier: number }) {
  console.log(`💰 [Gateway] Processing cashout for bet ${data.betId} at ${data.multiplier}x`);

  // 1. Validate cashout
  const bet = await this.findBetById(data.betId);
  if (!bet || bet.cashedOut) {
    return { error: 'Invalid bet or already cashed out' };
  }

  // 2. Calculate win amount
  const winAmount = bet.amount * data.multiplier;

  // 3. Update bet in database
  await this.prisma.bet.update({
    where: { id: data.betId },
    data: {
      cashedOut: true,
      cashedOutAt: data.multiplier,
      winAmount: winAmount,
      status: 'WON',
      updatedAt: new Date(),
    },
  });

  // 4. Update user balance
  await this.prisma.user.update({
    where: { id: bet.userId },
    data: {
      balance: { increment: winAmount },
    },
  });

  // 5. Emit cashout success (BROADCAST) ✅ (ЭТО РАБОТАЕТ)
  this.server.to(`aviator-game-${bet.aviatorId}`).emit('aviator:cashOut', {
    betId: bet.id,
    username: bet.user.username,
    multiplier: data.multiplier,
    winAmount: winAmount,
  });

  // 6. 🚨 ЭТОТ EMIT МОЖЕТ ОТСУТСТВОВАТЬ!
  // Emit personal win event to player
  this.server.to(bet.userId).emit('aviator:win', {
    betId: bet.id,
    betAmount: bet.amount,
    cashedAt: data.multiplier,
    winAmount: winAmount,
    crashMultiplier: null, // Will be set when game crashes
    timestamp: new Date().toISOString(),
  });

  console.log(`✅ [Gateway] Cashout processed for bet ${bet.id}`);
}
```

**Примечание:** Frontend добавил fallback - если win событие не придет в течение 5 секунд после cashout, ставка автоматически сбросится. Но лучше исправить backend!

---

## Как Проверить Что Нужно Исправить

### Шаг 1: Проверьте Railway Logs

**Откройте Railway Dashboard → Ваш Backend → Logs**

**Фильтруйте по времени краша:** `16:02:50` (Nov 26, 2025)

**Ищите эти паттерны:**

#### ✅ Что ДОЛЖНО быть в логах:

```
🔥 [Gateway] Game 25226 crashed at 1.17x
📊 [Gateway] Found 1 losing bets to process
📤 [Gateway] EMITTING aviator:lose to Player faabf8ff-87dc-42e3-a105-8fe27c72d6d0
   betId: 167, amount: 500, crash: 1.17x
✅ [Gateway] aviator:lose event SENT for bet 167
✅ [Gateway] All lose events processed for game 25226
```

#### ❌ Что СКОРЕЕ ВСЕГО в логах (проблема):

**Вариант 1: Crash handler вообще не выполняется**

```
[только события от frontend, нет логов от crash handler]
```

**Вариант 2: Crash handler выполняется, но не находит ставки**

```
🔥 [Gateway] Game 25226 crashed at 1.17x
⚠️ [Gateway] No active bets found for game 25226
```

**Вариант 3: Crash handler выполняется, но не эмитит lose**

```
🔥 [Gateway] Game 25226 crashed at 1.17x
📊 [Gateway] Processing game crash...
[нет логов про emit aviator:lose]
```

**Вариант 4: Ошибка в crash handler**

```
🔥 [Gateway] Game 25226 crashed at 1.17x
❌ [Gateway] Error processing losing bets: [error message]
```

### Шаг 2: Найдите Crash Handler

**В вашем backend проекте найдите:**

```bash
# В терминале backend проекта:
grep -r "aviator:crashed" src/
grep -r "handleCrash" src/
grep -r "processCrash" src/
grep -r "multiplierReached" src/
```

**Или в файлах:**

- `src/aviator/aviator.gateway.ts`
- `src/aviator/aviator.service.ts`
- `src/game/game.controller.ts`

### Шаг 3: Добавьте Логи Если Их Нет

**Добавьте подробные логи в crash handler:**

```typescript
async handleGameCrash(gameId: number, crashMultiplier: number) {
  console.log(`🔥 ===== CRASH HANDLER STARTED =====`);
  console.log(`🔥 Game ID: ${gameId}`);
  console.log(`🔥 Crash Multiplier: ${crashMultiplier}x`);

  // Emit crash to all
  this.server.to(`aviator-game-${gameId}`).emit('aviator:crashed', {
    gameId,
    multiplier: crashMultiplier,
    timestamp: new Date().toISOString(),
  });
  console.log(`✅ aviator:crashed event emitted`);

  // Find losing bets
  console.log(`📊 Searching for losing bets...`);
  const losingBets = await this.prisma.bet.findMany({
    where: {
      aviatorId: gameId,
      status: 'ACTIVE', // или 'PLACED'
      cashedOut: false,
    },
    include: { user: true },
  });

  console.log(`📊 Found ${losingBets.length} losing bets`);

  if (losingBets.length === 0) {
    console.log(`⚠️ No losing bets to process`);
    return;
  }

  // Process each losing bet
  for (const bet of losingBets) {
    console.log(`📤 Processing losing bet:`);
    console.log(`   betId: ${bet.id}`);
    console.log(`   userId: ${bet.userId}`);
    console.log(`   amount: ${bet.amount}`);
    console.log(`   username: ${bet.user.username}`);

    // Emit lose event
    console.log(`📤 EMITTING aviator:lose to user ${bet.userId}`);
    this.server.to(bet.userId).emit('aviator:lose', {
      betId: bet.id,
      betAmount: bet.amount,
      crashMultiplier: crashMultiplier,
    });
    console.log(`✅ aviator:lose event EMITTED for bet ${bet.id}`);

    // Update bet status
    await this.prisma.bet.update({
      where: { id: bet.id },
      data: {
        status: 'LOST',
        crashedAt: crashMultiplier,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Bet ${bet.id} updated to LOST status`);
  }

  console.log(`✅ ===== CRASH HANDLER COMPLETED =====`);
}
```

---

## Возможные Проблемы И Решения

### Проблема A: Socket Room Mismatch

**Симптом:** Backend эмитит событие, но frontend не получает

**Причина:** Игрок не в правильной socket room

**Проверка:**

```typescript
// В handleConnection (aviator.gateway.ts)
async handleConnection(client: Socket) {
  const userId = this.getUserIdFromSocket(client);

  console.log(`✅ Player connected: ${userId}`);

  // 🚨 ВАЖНО: Добавить пользователя в его личную комнату
  client.join(userId);
  console.log(`✅ Player ${userId} joined personal room`);

  // Также добавить в комнату игры
  const currentGame = await this.getCurrentGame();
  if (currentGame) {
    client.join(`aviator-game-${currentGame.id}`);
    console.log(`✅ Player ${userId} joined game room ${currentGame.id}`);
  }
}
```

**Фикс:**

```typescript
// Убедитесь что вызывается:
client.join(userId); // Личная комната для personal events
```

### Проблема B: Bet Status Не Обновляется

**Симптом:** Crash handler не находит активные ставки

**Причина:** Статус ставки не `'ACTIVE'` или `cashedOut` не `false`

**Проверка:**

```sql
-- В Railway Postgres Console:
SELECT id, "aviatorId", "userId", amount, status, "cashedOut", "createdAt"
FROM "Bet"
WHERE "aviatorId" = 25226;

-- Ожидаемый результат для betId 167:
-- id: 167
-- aviatorId: 25226
-- userId: faabf8ff-87dc-42e3-a105-8fe27c72d6d0
-- amount: 500
-- status: 'ACTIVE' или 'PLACED'
-- cashedOut: false
```

**Фикс:** Проверьте условие в query:

```typescript
const losingBets = await this.prisma.bet.findMany({
  where: {
    aviatorId: gameId,
    OR: [{ status: "ACTIVE" }, { status: "PLACED" }, { status: "PENDING" }],
    cashedOut: false,
  },
});
```

### Проблема C: Crash Handler Не Вызывается

**Симптом:** Нет логов от crash handler вообще

**Причина:** Таймер краша не срабатывает или неправильный event listener

**Проверка:**

```typescript
// Найдите где запускается crash timer:
setTimeout(() => {
  this.handleGameCrash(gameId, crashPoint);
}, crashTimeMs);
```

**Фикс:** Убедитесь что:

1. Таймер запускается при старте игры ✅
2. `crashTimeMs` правильно рассчитывается ✅
3. `handleGameCrash` существует и вызывается ✅

---

## Минимальный Фикс (Quick Solution)

Если у вас уже есть crash handler, просто **добавьте эти строки**:

```typescript
// В конце вашего crash handler, ПЕРЕД emit('aviator:statusChange'):

// Find and process losing bets
const losingBets = await this.prisma.bet.findMany({
  where: {
    aviatorId: gameId,
    OR: [{ status: "ACTIVE" }, { status: "PLACED" }],
    cashedOut: false,
  },
  include: { user: true },
});

console.log(`📊 [Gateway] Found ${losingBets.length} losing bets`);

for (const bet of losingBets) {
  console.log(`📤 [Gateway] Emitting lose to ${bet.userId} for bet ${bet.id}`);

  this.server.to(bet.userId).emit("aviator:lose", {
    betId: bet.id,
    betAmount: bet.amount,
    crashMultiplier: crashPoint,
  });

  await this.prisma.bet.update({
    where: { id: bet.id },
    data: { status: "LOST", crashedAt: crashPoint },
  });
}
```

---

## Test Data Для Поиска В Логах

Используйте эти данные для поиска в Railway logs:

- **Game ID:** `25226`
- **Bet ID:** `167`
- **User ID:** `faabf8ff-87dc-42e3-a105-8fe27c72d6d0`
- **Username:** `GaidarTheDev`
- **Bet Amount:** `500`
- **Crash Multiplier:** `1.17`
- **Crash Time:** `2025-11-26T16:02:50.886Z`

**Команды поиска в Railway logs:**

```
game 25226
bet 167
faabf8ff-87dc-42e3-a105-8fe27c72d6d0
crashed at 1.17
aviator:lose
```

---

## Приоритеты Исправлений

### 🔴 КРИТИЧНО (Исправить СЕЙЧАС):

1. **Добавить emit `aviator:lose` в crash handler**
2. **Убедиться что игрок в socket room (userId)**
3. **Добавить подробные логи в crash handler**

### 🟡 ВАЖНО (Исправить Скоро):

4. Добавить emit `aviator:win` в cashout handler
5. Проверить обновление статуса ставки в БД

### 🟢 ОПЦИОНАЛЬНО:

6. Добавить error handling в crash handler
7. Добавить retry logic для failed events

---

## Как Проверить Что Фикс Работает

### После Деплоя Backend:

1. **Откройте frontend в браузере**
2. **Откройте F12 → Console**
3. **Разместите ставку (500⭐)**
4. **НЕ делайте cashout**
5. **Дождитесь краша**

**Ожидаемые логи в FRONTEND консоли:**

```
💥 CRASH EVENT RECEIVED: x1.47
😢 ===== LOSE EVENT RECEIVED FROM BACKEND =====  ← НОВЫЙ ЛОГ!
😢 Bet ID: 167
😢 Bet Amount: 500
😢 Crash Multiplier: 1.47
💔 ===== LOSE CONFIRMED BY BACKEND =====
💔 This is MY bet - showing lose popup!
[Красный popup "Вы потеряли 500⭐" появляется]
```

**Ожидаемые логи в BACKEND (Railway):**

```
🔥 [Gateway] Game 25226 crashed at 1.47x
📊 [Gateway] Found 1 losing bets
📤 [Gateway] EMITTING aviator:lose to Player faabf8ff...
✅ [Gateway] aviator:lose event SENT for bet 167
```

---

## Резюме

### Frontend Status: ✅ ГОТОВ

- ✅ Crash animation показывается 3 секунды
- ✅ Fallback сброс ставки через 3 секунды
- ✅ Lose event handler готов и ждет события
- ✅ Все логи для диагностики добавлены

### Backend Status: ❌ ТРЕБУЕТ ИСПРАВЛЕНИЙ

- ❌ **НЕ эмитит `aviator:lose` event**
- ⚠️ Возможно не эмитит `aviator:win` event
- ⚠️ Возможно проблема с socket rooms

### Action Required:

1. **Проверьте Railway logs** (game 25226, bet 167)
2. **Найдите crash handler** в backend коде
3. **Добавьте emit `aviator:lose`** как показано выше
4. **Добавьте логи** для диагностики
5. **Деплой backend**
6. **Тест** с новой ставкой

**Без фикса backend игроки НЕ будут видеть lose popup и ставка будет сбрасываться только через fallback!**
