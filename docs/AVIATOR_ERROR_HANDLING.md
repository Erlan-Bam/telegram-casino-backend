# Обработка ошибок в Aviator WebSocket

## Проблема

При работе игрового цикла Aviator возникала ошибка:

```
TypeError: Cannot read properties of undefined (reading 'get')
```

**Причина:** При попытке отправить персональные события win/lose игрокам, метод `this.server.sockets.sockets.get(socketId)` возвращал undefined для отключенных пользователей.

---

## Решение

Добавлена полная обработка ошибок во всех критических методах WebSocket Gateway:

### 1. `sendWinLoseEvents()` - Персональные события

**Проблема:**

- Пользователь мог отключиться после размещения ставки
- `server.sockets.sockets` мог быть undefined
- У ставки могло не быть информации о пользователе

**Решение:**

```typescript
private async sendWinLoseEvents(game: any) {
  try {
    // Проверка что у игры есть ставки
    if (!game.bets || game.bets.length === 0) {
      return;
    }

    // Проверка что server.sockets.sockets существует
    if (!this.server?.sockets?.sockets) {
      this.logger.error('Server sockets not available');
      return;
    }

    for (const bet of game.bets) {
      try {
        // Проверка user и socketId
        const userId = bet.user?.id;
        if (!userId) continue;

        const socketId = this.activeUsers.get(userId);
        if (!socketId) continue;

        const socket = this.server.sockets.sockets.get(socketId);
        if (!socket) continue;

        // Отправка события
        socket.emit('aviator:win', { ... });
      } catch (betError) {
        this.logger.error(`Error for bet #${bet.id}`, betError);
      }
    }
  } catch (error) {
    this.logger.error('Error in sendWinLoseEvents', error);
  }
}
```

**Результат:**

- ✅ Ошибки не останавливают игровой цикл
- ✅ Отключенные пользователи пропускаются
- ✅ Логируются все ошибки для отладки

---

### 2. `broadcastGameState()` - Трансляция состояния

**Проблема:**

- `game` мог быть null/undefined
- `game.bets` мог быть undefined

**Решение:**

```typescript
private broadcastGameState(game: any) {
  try {
    if (!game) {
      this.logger.warn('Cannot broadcast: game is null');
      return;
    }

    const response = {
      ...game,
      multiplier: Number(game.multiplier),
      bets: (game.bets || []).map(bet => ({ ... }))
    };

    this.server.emit('aviator:game', response);
  } catch (error) {
    this.logger.error('Error broadcasting game state', error);
  }
}
```

---

### 3. `broadcastCrashHistory()` - История крашей

**Решение:**

```typescript
private broadcastCrashHistory() {
  try {
    this.server.emit('aviator:crashHistory', {
      history: this.crashHistory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    this.logger.error('Error broadcasting crash history', error);
  }
}
```

---

### 4. `updateGameState()` - Создание новой игры

**Проблема:** Ошибка при создании новой игры после краша останавливала цикл

**Решение:**

```typescript
setTimeout(async () => {
  try {
    const newGame = await this.aviatorService.createOrGetAviator();
    this.currentGameId = newGame.id;
    this.broadcastGameState(newGame);
  } catch (error) {
    this.logger.error('Error creating new game', error);
  }
}, 3000);
```

---

## Типы ошибок и их обработка

### ❌ Критические ошибки (логируются и пропускаются)

1. **Socket не найден**

   ```
   Socket ${socketId} for user ${userId} not found
   ```

   **Действие:** Пропустить пользователя, продолжить со следующим

2. **Server.sockets.sockets undefined**

   ```
   Server sockets not available
   ```

   **Действие:** Прервать sendWinLoseEvents, продолжить игровой цикл

3. **Game is null**

   ```
   Cannot broadcast game state: game is null
   ```

   **Действие:** Не транслировать, продолжить

4. **Bet без user**
   ```
   Bet #123 has no user ID, skipping
   ```
   **Действие:** Пропустить ставку

---

## Логирование ошибок

### Debug уровень (нормальные ситуации)

```typescript
this.logger.debug('User not connected, skipping');
```

### Warn уровень (подозрительные ситуации)

```typescript
this.logger.warn('Bet has no user ID');
```

### Error уровень (реальные ошибки)

```typescript
this.logger.error('Error in sendWinLoseEvents', error);
```

---

## Мониторинг

### Проверка логов на наличие ошибок:

```bash
# Ошибки в sendWinLoseEvents
grep "Error in sendWinLoseEvents" logs/app.log

# Ошибки broadcast
grep "Error broadcasting" logs/app.log

# Ошибки создания игры
grep "Error creating new game" logs/app.log

# Пропущенные пользователи
grep "not connected, skipping" logs/app.log
```

---

## Восстановление после ошибок

### Игровой цикл продолжает работать

- ✅ Ошибки в персональных событиях не останавливают цикл
- ✅ Новая игра создается даже если предыдущая упала
- ✅ Broadcast продолжается даже если не удалось для одного клиента

### Автоматическое восстановление

```typescript
// Игровой цикл проверяет состояние каждую секунду
setInterval(async () => {
  await this.updateGameState();
}, 1000);
```

### Если цикл всё же остановился

```bash
# Перезапуск сервера
npm run start:prod

# Или через PM2
pm2 restart aviator-backend
```

---

## Проверка здоровья системы

### Endpoint для проверки:

```typescript
GET /api/system/health

Response:
{
  "gameLoop": "running",
  "currentGame": 16027,
  "activeUsers": 15,
  "lastUpdate": "2025-11-23T17:46:32Z"
}
```

### WebSocket ping:

```typescript
socket.emit('ping');

socket.on('pong', (data) => {
  console.log('System healthy:', data);
});
```

---

## Best Practices

### 1. Всегда проверяйте существование

```typescript
// ❌ Плохо
const socket = this.server.sockets.sockets.get(socketId);
socket.emit('event', data);

// ✅ Хорошо
const socket = this.server.sockets.sockets.get(socketId);
if (socket) {
  socket.emit('event', data);
}
```

### 2. Используйте Optional Chaining

```typescript
// ❌ Плохо
const userId = bet.user.id;

// ✅ Хорошо
const userId = bet.user?.id;
```

### 3. Оборачивайте в try-catch

```typescript
// ✅ Хорошо
for (const bet of bets) {
  try {
    // Обработка ставки
  } catch (error) {
    this.logger.error(`Error for bet #${bet.id}`, error);
    // Продолжить со следующей ставкой
  }
}
```

### 4. Логируйте контекст

```typescript
// ❌ Плохо
this.logger.error('Error', error);

// ✅ Хорошо
this.logger.error(
  `Error sending event to user ${userId} (bet #${betId})`,
  error,
);
```

---

## Заключение

После добавления обработки ошибок:

- ✅ Игровой цикл не останавливается при отключении пользователей
- ✅ Все ошибки логируются с контекстом
- ✅ Система автоматически восстанавливается
- ✅ Остальные пользователи продолжают получать события

### Дальнейшие улучшения:

- [ ] Добавить метрики (количество ошибок за период)
- [ ] Алерты при превышении порога ошибок
- [ ] Dashboard для мониторинга здоровья системы
- [ ] Автоматическая очистка отключенных пользователей из activeUsers
