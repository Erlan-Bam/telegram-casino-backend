# 🎯 Fix: aviator:win и aviator:lose Events

## Проблемы Исправлены

### 🔴 КРИТИЧНО: aviator:lose события не доходят до игроков

### 🟡 ВАЖНО: aviator:win события не отправляются после cashout

---

## Проблема 1: Игроки не присоединяются к личным комнатам

### Что было:

```typescript
// При подключении клиента НЕ добавлялся в личную комнату
client.data.userId = user.id;
this.activeUsers.set(user.id, client.id);
// ❌ Отсутствует: client.join(userId)
```

### Что исправили:

```typescript
// Теперь клиент присоединяется к личной комнате
client.data.userId = user.id;

// 🚨 CRITICAL FIX: Join user to personal room
client.join(user.id);
this.logger.log(
  `🚪 [Gateway] User ${user.username} joined personal room: ${user.id}`,
);

// Also join current game room
const currentGame = await this.aviatorService.getCurrentGame();
if (currentGame) {
  const gameRoom = `aviator-game-${currentGame.id}`;
  client.join(gameRoom);
  this.logger.log(
    `🚪 [Gateway] User ${user.username} joined game room: ${gameRoom}`,
  );
}

this.activeUsers.set(user.id, client.id);
```

**Почему важно:**

- Socket.IO комнаты позволяют отправлять события группе клиентов
- `this.server.to(userId).emit()` работает только если клиент в комнате `userId`
- Теперь каждый пользователь автоматически присоединяется к своей личной комнате

---

## Проблема 2: aviator:win не отправляется после cashout

### Что было:

```typescript
// В handleCashOut только broadcast событие
this.server.emit('aviator:cashOut', { ... }); // Всем клиентам
// ❌ Отсутствует: персональное win событие игроку
```

### Что исправили:

```typescript
// Broadcast событие (всем)
this.server.emit('aviator:cashOut', { ... });

// 🎯 NEW: Personal win event to player
const winEvent = {
  betId: result.bet.id,
  betAmount: result.bet.amount,
  cashedAt: result.multiplier,
  winAmount: result.winAmount,
  crashMultiplier: null,
  timestamp: new Date().toISOString(),
};

// Method 1: Via room (primary)
this.server.to(userId).emit('aviator:win', winEvent);

// Method 2: Via direct socket (fallback)
const socket = this.getSocketById(socketId);
if (socket) {
  socket.emit('aviator:win', winEvent);
}
```

**Почему важно:**

- Frontend ожидает `aviator:win` событие для показа popup с выигрышем
- Без этого события frontend полагается на fallback timeout (3 секунды)
- Теперь событие приходит мгновенно при cashout

---

## Проблема 3: aviator:lose использует только прямую отправку

### Что было:

```typescript
// В processGameResults только direct socket send
const socket = this.getSocketById(socketId);
if (socket) {
  socket.emit('aviator:lose', loseEvent);
}
// ⚠️ Не работает если socket недоступен
```

### Что исправили:

```typescript
// Двойная отправка для надежности
// Method 1: Via room (primary) - работает даже если socket недоступен
this.server.to(userId).emit('aviator:lose', loseEvent);

// Method 2: Via direct socket (fallback) - дополнительная гарантия
const socket = this.getSocketById(socketId);
if (socket) {
  socket.emit('aviator:lose', loseEvent);
}
```

**Почему важно:**

- Двойная отправка увеличивает надежность доставки
- Room-based отправка работает даже при проблемах с socket map
- Direct socket - дополнительная гарантия доставки

---

## Проблема 4: aviator:win в processGameResults также требует двойной отправки

### Что исправили:

То же самое для win событий при крэше игры - добавлена двойная отправка через комнату и direct socket.

---

## Изменения в Коде

### 1. handleConnection (websocket.gateway.ts)

**Добавлено:**

```typescript
// Join personal room
client.join(user.id);

// Join game room
const currentGame = await this.aviatorService.getCurrentGame();
if (currentGame) {
  client.join(`aviator-game-${currentGame.id}`);
}
```

### 2. handleCashOut (websocket.gateway.ts)

**Добавлено:**

```typescript
// Personal win event after cashout
const winEvent = {
  betId: result.bet.id,
  betAmount: result.bet.amount,
  cashedAt: result.multiplier,
  winAmount: result.winAmount,
  crashMultiplier: null,
  timestamp: new Date().toISOString(),
};

// Send via room
this.server.to(userId).emit('aviator:win', winEvent);

// Send via socket (fallback)
const socket = this.getSocketById(socketId);
if (socket) {
  socket.emit('aviator:win', winEvent);
}
```

### 3. processGameResults (websocket.gateway.ts)

**Изменено для WIN:**

```typescript
// Old: Only direct socket
socket.emit('aviator:win', winEvent);

// New: Room + direct socket
this.server.to(userId).emit('aviator:win', winEvent);
socket.emit('aviator:win', winEvent); // fallback
```

**Изменено для LOSE:**

```typescript
// Old: Only direct socket
socket.emit('aviator:lose', loseEvent);

// New: Room + direct socket
this.server.to(userId).emit('aviator:lose', loseEvent);
socket.emit('aviator:lose', loseEvent); // fallback
```

---

## Как Работает Socket.IO Rooms

### До исправления:

```
User connects → No room join
Backend: this.server.to(userId).emit('lose', ...) → ❌ Not delivered (user not in room)
```

### После исправления:

```
User connects → client.join(userId) → User in personal room
Backend: this.server.to(userId).emit('lose', ...) → ✅ Delivered to room
Backend: socket.emit('lose', ...) → ✅ Also delivered directly (double guarantee)
```

---

## Логирование

Добавлено подробное логирование для отладки:

### Connection:

```
🚪 [Gateway] User GaidarTheDev joined personal room: faabf8ff-87dc-42e3-a105-8fe27c72d6d0
🚪 [Gateway] User GaidarTheDev joined game room: aviator-game-25226
```

### Cashout Win Event:

```
📤 [Gateway] EMITTING aviator:win after cashout to user GaidarTheDev
✅ [Gateway] WIN event sent via room to GaidarTheDev
✅ [Gateway] WIN event also sent via direct socket to GaidarTheDev
```

### Lose Event:

```
📤 [Gateway] Attempting to send lose event via room: faabf8ff-87dc-42e3-a105-8fe27c72d6d0
✅ [Gateway] LOSE event sent via room to GaidarTheDev
✅ [Gateway] LOSE event also sent via direct socket to GaidarTheDev
```

### Win Event (after crash):

```
📤 [Gateway] Attempting to send win event via room: faabf8ff-87dc-42e3-a105-8fe27c72d6d0
✅ [Gateway] WIN event sent via room to GaidarTheDev
✅ [Gateway] WIN event also sent via direct socket to GaidarTheDev
```

---

## Testing Checklist

### Test 1: Lose Event

1. ✅ Подключиться к игре
2. ✅ Поставить ставку (500⭐)
3. ✅ НЕ делать cashout
4. ✅ Дождаться crash
5. ✅ **Проверить:** Красный popup "Вы потеряли 500⭐"
6. ✅ **Проверить логи:** `LOSE event sent via room`

### Test 2: Win Event After Cashout

1. ✅ Подключиться к игре
2. ✅ Поставить ставку (500⭐)
3. ✅ Сделать cashout на 2.00x
4. ✅ **Проверить:** Зеленый popup "Вы выиграли 1000⭐"
5. ✅ **Проверить логи:** `WIN event sent via room to GaidarTheDev`

### Test 3: Win Event After Crash (cashed out)

1. ✅ Подключиться к игре
2. ✅ Поставить ставку (500⭐)
3. ✅ Сделать cashout на 2.00x
4. ✅ Дождаться crash
5. ✅ **Проверить:** Popup уже показан при cashout (не должно быть дубликата)
6. ✅ **Проверить логи:** `WIN event sent via room` при crash

---

## Expected Frontend Logs (Success)

### После Lose:

```
💥 CRASH EVENT RECEIVED: x1.47
😢 ===== LOSE EVENT RECEIVED FROM BACKEND =====
😢 Bet ID: 167
😢 Bet Amount: 500
😢 Crash Multiplier: 1.47
💔 ===== LOSE CONFIRMED BY BACKEND =====
💔 This is MY bet - showing lose popup!
[Red popup appears: "Вы потеряли 500⭐"]
```

### После Cashout:

```
💰 ===== CASHOUT SUCCESS =====
💰 Bet ID: 167
💰 Win Amount: 1000
🎉 ===== WIN EVENT RECEIVED FROM BACKEND =====
🎉 Bet ID: 167
🎉 Win Amount: 1000
🎉 Cashed At: 2.00x
✅ ===== WIN CONFIRMED BY BACKEND =====
[Green popup appears: "Вы выиграли 1000⭐"]
```

---

## Expected Backend Logs (Success)

### Connection:

```
✅ User GaidarTheDev (faabf8ff-...) connected with socket abc123
🚪 [Gateway] User GaidarTheDev joined personal room: faabf8ff-...
🚪 [Gateway] User GaidarTheDev joined game room: aviator-game-25226
   - Added to activeUsers map (size: 1)
```

### Cashout:

```
💰 [Gateway] Processing cashout for bet 167 at 2.00x
📡 [Gateway] Broadcasted aviator:cashOut event to all clients
📤 [Gateway] EMITTING aviator:win after cashout to user GaidarTheDev
✅ [Gateway] WIN event sent via room to GaidarTheDev
✅ [Gateway] WIN event also sent via direct socket to GaidarTheDev
✅ [Gateway] WIN event after cashout completed for GaidarTheDev (won 1000 at 2.00x)
```

### Crash:

```
💥 [Gateway] ===== CRASHING GAME #25226 =====
💥 [Gateway] Game #25226 crashed at 1.47x (1 bets)
📡 [Gateway] EMITTING aviator:crashed event
✅ [Gateway] aviator:crashed event SENT to 1 connected clients
🎲 [Gateway] Processing game results for 1 bets at 1.47x
🎯 [Gateway] Processing bet #167 for user GaidarTheDev
   - Cashed At: NULL (NOT CASHED OUT)
💔 [Gateway] Bet #167 is a LOSING BET
📤 [Gateway] Attempting to send lose event via room: faabf8ff-...
✅ [Gateway] LOSE event sent via room to GaidarTheDev
✅ [Gateway] LOSE event also sent via direct socket to GaidarTheDev
✅ [Gateway] LOSE event processing completed for GaidarTheDev (lost 500 at 1.47x)
```

---

## Summary

### ✅ Что исправлено:

1. **Socket Rooms** - Пользователи теперь присоединяются к личным комнатам при подключении
2. **Win Event After Cashout** - Добавлено персональное событие `aviator:win` сразу после cashout
3. **Двойная отправка** - Все личные события отправляются двумя способами (room + direct socket)
4. **Подробное логирование** - Добавлены логи для отладки каждого шага отправки событий

### 📊 Ожидаемый результат:

- ✅ Игроки получают `aviator:lose` при проигрыше
- ✅ Игроки получают `aviator:win` при cashout
- ✅ Игроки получают `aviator:win` после crash (если сделали cashout)
- ✅ События доставляются надежно даже при проблемах с socket
- ✅ Подробные логи для диагностики проблем

### 🚀 Следующие шаги:

1. Deploy на Railway
2. Протестировать оба сценария (lose и win)
3. Проверить логи в Railway Dashboard
4. Убедиться что popups показываются правильно
