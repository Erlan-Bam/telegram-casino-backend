# 🎮 Aviator Frontend Integration Guide

**Полное руководство по интеграции Aviator игры на фронтенде**

---

## 📋 Содержание

1. [Обзор архитектуры](#обзор-архитектуры)
2. [WebSocket подключение](#websocket-подключение)
3. [Жизненный цикл игры](#жизненный-цикл-игры)
4. [События от сервера](#события-от-сервера)
5. [События на сервер](#события-на-сервер)
6. [Работа с множителем](#работа-с-множителем)
7. [История крашей](#история-крашей)
8. [Размещение ставок](#размещение-ставок)
9. [Кешаут (Cash Out)](#кешаут-cash-out)
10. [Обработка ошибок](#обработка-ошибок)
11. [React примеры](#react-примеры)
12. [Решение проблем](#решение-проблем)

---

## 🏗️ Обзор архитектуры

### Как работает игра

```
┌─────────────────────────────────────────────────────────────┐
│                     ЖИЗНЕННЫЙ ЦИКЛ ИГРЫ                      │
└─────────────────────────────────────────────────────────────┘

1️⃣ WAITING (5 секунд)
   ├─ Игроки делают ставки
   ├─ Множитель: 1.00x
   ├─ Таймер обратного отсчета
   └─ Кешаут НЕВОЗМОЖЕН

2️⃣ ACTIVE (динамическое время)
   ├─ Множитель растет: 1.00x → 2.50x → 10.00x...
   ├─ Ставки ЗАБЛОКИРОВАНЫ
   ├─ Игроки делают кешаут
   └─ Игра может крашнуться в любой момент

3️⃣ FINISHED (3 секунды)
   ├─ Множитель остановлен
   ├─ Определение выигрышей/проигрышей
   ├─ Отображение результатов
   └─ Переход к новой игре

┌─────────────────────────────────────────────────────────────┐
│  WAITING → ACTIVE → FINISHED → WAITING (новая игра) → ...   │
└─────────────────────────────────────────────────────────────┘
```

### Ключевые концепции

1. **Автоматический игровой цикл** - сервер автоматически создает и управляет играми
2. **Реальное время** - все события синхронизируются через WebSocket
3. **Одна активная игра** - в любой момент времени существует только одна WAITING/ACTIVE игра
4. **Provably Fair** - результат каждой игры верифицируемый через HMAC-SHA256

---

## 🔌 WebSocket подключение

### 1. Установка зависимостей

```bash
npm install socket.io-client
```

### 2. Базовое подключение

```typescript
import { io, Socket } from 'socket.io-client';

// Создание подключения
const socket: Socket = io('https://your-backend-url/ws', {
  auth: {
    token: 'YOUR_JWT_TOKEN', // JWT токен пользователя
  },
  transports: ['websocket'], // Использовать только WebSocket
  reconnection: true, // Автоматическое переподключение
  reconnectionDelay: 1000, // Задержка перед переподключением (мс)
  reconnectionAttempts: 5, // Максимум попыток переподключения
});

// Обработка успешного подключения
socket.on('connect', () => {
  console.log('✅ Connected to server', socket.id);
});

// Обработка ошибок подключения
socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

// Обработка отключения
socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});
```

### 3. React Hook для подключения

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (jwtToken: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!jwtToken) return;

    const newSocket = io('https://your-backend-url/ws', {
      auth: { token: jwtToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
    });

    // Событие при подключении (от сервера)
    newSocket.on('connected', (data) => {
      console.log('🎮 Server says connected:', data);
    });

    setSocket(newSocket);

    // Cleanup при размонтировании
    return () => {
      newSocket.close();
    };
  }, [jwtToken]);

  return { socket, isConnected };
};
```

**Использование:**

```typescript
function App() {
  const { socket, isConnected } = useSocket(yourJwtToken);

  return (
    <div>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      {socket && <AviatorGame socket={socket} />}
    </div>
  );
}
```

---

## 🎯 Жизненный цикл игры

### Получение текущей игры

**При загрузке страницы:**

```typescript
// Запросить текущую игру
socket.emit('aviator:getCurrent');

// Получить ответ
socket.on('aviator:game', (game) => {
  console.log('Current game:', game);
  /*
    game = {
      id: 123,
      status: 'WAITING' | 'ACTIVE' | 'FINISHED',
      multiplier: 2.50, // Множитель краша (для WAITING/ACTIVE)
      startsAt: '2025-11-25T10:00:00Z', // Время начала
      createdAt: '2025-11-25T09:59:55Z',
      updatedAt: '2025-11-25T10:00:00Z',
      bets: [
        {
          id: 456,
          amount: 100,
          cashedAt: null, // null = еще не кешаут
          user: {
            id: '789',
            username: 'player1',
            telegramId: '123456789'
          }
        }
      ]
    }
  */
});

// Если игры нет (редкий случай)
socket.on('aviator:noGame', () => {
  console.log('No active game found');
});
```

### Отслеживание статусов игры

```typescript
// Изменение статуса игры
socket.on('aviator:statusChange', (data) => {
  console.log('Status changed:', data);
  /*
    data = {
      gameId: 123,
      status: 'ACTIVE' | 'FINISHED' | 'WAITING',
      timestamp: '2025-11-25T10:00:05Z'
    }
  */
  
  switch (data.status) {
    case 'ACTIVE':
      // Игра началась - множитель начинает расти
      console.log('🚀 Game started!');
      startMultiplierAnimation();
      disableBetting();
      break;
      
    case 'FINISHED':
      // Игра завершена - показать результаты
      console.log('💥 Game crashed!');
      stopMultiplierAnimation();
      showResults();
      break;
      
    case 'WAITING':
      // Новая игра ожидает - принимаем ставки
      console.log('⏳ New game waiting...');
      enableBetting();
      resetMultiplier();
      break;
  }
});
```

---

## 📡 События от сервера

### 1. **connected** - Подтверждение подключения

```typescript
socket.on('connected', (data) => {
  console.log('✅ Connected successfully');
  console.log('Active users:', data.activeUsers);
  /*
    data = {
      message: 'Connected successfully',
      activeUsers: 42
    }
  */
});
```

---

### 2. **aviator:game** - Текущая игра

```typescript
socket.on('aviator:game', (game) => {
  setCurrentGame(game);
  /*
    game = {
      id: number,
      status: 'WAITING' | 'ACTIVE' | 'FINISHED',
      multiplier: number, // Множитель краша
      startsAt: string, // ISO timestamp
      createdAt: string,
      updatedAt: string,
      bets: Array<{
        id: number,
        amount: number,
        cashedAt: number | null,
        user: {
          id: string,
          username: string,
          telegramId: string
        }
      }>
    }
  */
});
```

---

### 3. **aviator:statusChange** - Смена статуса

```typescript
socket.on('aviator:statusChange', (data) => {
  console.log(`Status: ${data.status}`);
  /*
    data = {
      gameId: number,
      status: 'WAITING' | 'ACTIVE' | 'FINISHED',
      timestamp: string
    }
  */
});
```

---

### 4. **aviator:multiplierTick** - Обновление множителя (50ms)

**КРИТИЧНО**: Это событие приходит каждые 50ms во время ACTIVE статуса!

```typescript
socket.on('aviator:multiplierTick', (data) => {
  setCurrentMultiplier(data.currentMultiplier);
  /*
    data = {
      gameId: number,
      currentMultiplier: number, // 1.00, 1.05, 1.10, 1.15...
      elapsed: number, // Прошедшие миллисекунды с начала игры
      timestamp: number // Unix timestamp
    }
  */
  
  // Обновляем UI
  updateMultiplierDisplay(data.currentMultiplier);
});
```

**Частота**: 20 раз в секунду (каждые 50ms)
**Формула роста**: `множитель = 1.0 + (crashMultiplier - 1.0) * (elapsed / crashTime)`

---

### 5. **aviator:crashed** - Игра крашнулась

```typescript
socket.on('aviator:crashed', (data) => {
  console.log(`💥 Game crashed at ${data.multiplier}x`);
  /*
    data = {
      gameId: number,
      multiplier: number, // Финальный множитель краша
      timestamp: string
    }
  */
  
  showCrashAnimation(data.multiplier);
});
```

---

### 6. **aviator:crashHistory** - История крашей

```typescript
socket.on('aviator:crashHistory', (data) => {
  console.log('History:', data.history);
  /*
    data = {
      history: [2.50, 1.08, 5.43, 1.00, 10.25, ...], // Последние 20 крашей
      timestamp: string
    }
  */
  
  setCrashHistory(data.history);
  updateHistoryDisplay(data.history);
});
```

**Важно**: 
- Массив содержит **последние 20 крашей**
- Порядок: **от нового к старому** (первый элемент - самый свежий краш)
- Обновляется после каждого краша

---

### 7. **aviator:newBet** - Новая ставка

```typescript
socket.on('aviator:newBet', (data) => {
  console.log(`New bet: ${data.username} - ${data.amount}`);
  /*
    data = {
      betId: number,
      aviatorId: number,
      userId: string,
      username: string,
      amount: number,
      timestamp: string
    }
  */
  
  addBetToUI(data);
  playBetSound();
});
```

---

### 8. **aviator:betPlaced** - Ваша ставка принята

```typescript
socket.on('aviator:betPlaced', (data) => {
  console.log('✅ Your bet placed:', data.id);
  /*
    data = {
      id: number, // ВАЖНО! Сохраните для кешаута
      aviatorId: number,
      userId: string,
      amount: number,
      cashedAt: null,
      isInventoryBet: boolean,
      createdAt: string,
      updatedAt: string,
      user: {
        id: string,
        username: string,
        telegramId: string
      }
    }
  */
  
  // 🚨 КРИТИЧНО: Сохраните betId для кешаута!
  setMyBetId(data.id);
  setMyBetAmount(data.amount);
  showBetConfirmation();
});
```

**ВАЖНО**: Без `betId` вы НЕ сможете сделать кешаут!

---

### 9. **aviator:cashOut** - Кто-то сделал кешаут

```typescript
socket.on('aviator:cashOut', (data) => {
  console.log(`${data.username} cashed out at ${data.multiplier}x`);
  /*
    data = {
      betId: number,
      aviatorId: number,
      userId: string,
      username: string,
      amount: number,
      multiplier: number,
      winAmount: number,
      timestamp: string
    }
  */
  
  showCashOutInUI(data);
  playCashOutSound();
});
```

---

### 10. **aviator:cashedOut** - Ваш кешаут успешен

```typescript
socket.on('aviator:cashedOut', (result) => {
  console.log(`💰 You won ${result.winAmount}!`);
  /*
    result = {
      bet: {
        id: number,
        aviatorId: number,
        userId: string,
        amount: number,
        cashedAt: number,
        user: { ... }
      },
      multiplier: number,
      winAmount: number,
      success: true
    }
  */
  
  showWinAnimation(result.winAmount);
  updateBalance(result.winAmount);
  clearMyBet();
});
```

---

### 11. **aviator:win** - Вы выиграли

```typescript
socket.on('aviator:win', (data) => {
  console.log(`🎉 You won ${data.winAmount}!`);
  /*
    data = {
      betId: number,
      betAmount: number,
      cashedAt: number,
      winAmount: number,
      crashMultiplier: number,
      timestamp: string
    }
  */
  
  showWinMessage(data);
});
```

---

### 12. **aviator:lose** - Вы проиграли

```typescript
socket.on('aviator:lose', (data) => {
  console.log(`😢 You lost ${data.betAmount}`);
  /*
    data = {
      betId: number,
      betAmount: number,
      crashMultiplier: number,
      timestamp: string
    }
  */
  
  showLoseMessage(data);
  clearMyBet();
});
```

---

### 13. **error** - Ошибка

```typescript
socket.on('error', (data) => {
  console.error('Error:', data.message);
  /*
    data = {
      message: string // Описание ошибки
    }
  */
  
  showErrorNotification(data.message);
});
```

**Типичные ошибки**:
- `"Game not found"` - игра не найдена
- `"Game is not in WAITING status"` - нельзя делать ставку
- `"Insufficient balance"` - недостаточно средств
- `"Bet not found"` - ставка не найдена
- `"Game is not ACTIVE"` - кешаут невозможен
- `"Bet already cashed out"` - уже сделан кешаут

---

## 📤 События на сервер

### 1. **aviator:getCurrent** - Получить текущую игру

```typescript
socket.emit('aviator:getCurrent');

// Ответ: aviator:game или aviator:noGame
```

---

### 2. **aviator:placeBet** - Сделать ставку

```typescript
socket.emit('aviator:placeBet', {
  aviatorId: currentGame.id, // ID текущей игры
  amount: 100 // Сумма ставки
});

// Ответ: aviator:betPlaced или error
```

**Валидация на сервере:**
- ✅ Игра в статусе WAITING
- ✅ Сумма >= 25 (minBet)
- ✅ Сумма <= 10000 (maxBet)
- ✅ Баланс >= сумма ставки
- ✅ Нет активной ставки в этой игре

---

### 3. **aviator:cashOut** - Забрать выигрыш

```typescript
socket.emit('aviator:cashOut', {
  betId: myBetId, // ID вашей ставки (из aviator:betPlaced)
  currentMultiplier: 2.50 // Текущий множитель
});

// Ответ: aviator:cashedOut или error
```

**Валидация на сервере:**
- ✅ Игра в статусе ACTIVE
- ✅ Ставка существует и принадлежит вам
- ✅ Ставка еще не кешаутнута
- ✅ Множитель <= crashMultiplier

---

## 🎰 Работа с множителем

### Формула расчета множителя

```
Множитель = 1.0 + (crashMultiplier - 1.0) * (elapsed / crashTime)

где:
- crashMultiplier - финальный множитель (из game.multiplier)
- elapsed - прошедшее время с начала игры (мс)
- crashTime - время до краша (мс)
```

### Время краша

```
crashTime = (crashMultiplier - 1.0) * 5000 мс

Примеры:
- 2.00x → (2.0 - 1.0) * 5000 = 5000 мс = 5 секунд
- 5.00x → (5.0 - 1.0) * 5000 = 20000 мс = 20 секунд
- 10.00x → (10.0 - 1.0) * 5000 = 45000 мс = 45 секунд
```

### React Hook для множителя

```typescript
import { useState, useEffect, useRef } from 'react';

interface UseMultiplierProps {
  socket: Socket | null;
  gameStatus: 'WAITING' | 'ACTIVE' | 'FINISHED';
}

export const useMultiplier = ({ socket, gameStatus }: UseMultiplierProps) => {
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [finalMultiplier, setFinalMultiplier] = useState<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Слушаем тики множителя (каждые 50ms)
    socket.on('aviator:multiplierTick', (data) => {
      setCurrentMultiplier(data.currentMultiplier);
    });

    // Когда игра крашнулась
    socket.on('aviator:crashed', (data) => {
      setFinalMultiplier(data.multiplier);
      setCurrentMultiplier(data.multiplier);
    });

    // Когда начинается новая игра
    socket.on('aviator:statusChange', (data) => {
      if (data.status === 'WAITING') {
        setCurrentMultiplier(1.0);
        setFinalMultiplier(null);
      }
    });

    return () => {
      socket.off('aviator:multiplierTick');
      socket.off('aviator:crashed');
      socket.off('aviator:statusChange');
    };
  }, [socket]);

  return {
    currentMultiplier,
    finalMultiplier,
    displayMultiplier: currentMultiplier.toFixed(2) + 'x',
  };
};
```

**Использование:**

```typescript
function MultiplierDisplay({ socket, gameStatus }) {
  const { displayMultiplier, finalMultiplier } = useMultiplier({
    socket,
    gameStatus,
  });

  return (
    <div className={`multiplier ${gameStatus === 'FINISHED' ? 'crashed' : ''}`}>
      {displayMultiplier}
      {finalMultiplier && <span className="final">Crashed!</span>}
    </div>
  );
}
```

---

## 📊 История крашей

### Почему история не работает?

**Проблема**: История приходит как пустой массив или не отображается.

**Решение**:

1. **Слушайте событие `aviator:crashHistory`**:

```typescript
useEffect(() => {
  if (!socket) return;

  // Получаем историю при подключении
  socket.on('aviator:crashHistory', (data) => {
    console.log('📊 Crash history received:', data.history);
    setCrashHistory(data.history);
  });

  // Также слушаем обновления после каждого краша
  socket.on('aviator:crashed', (data) => {
    console.log('💥 Game crashed, waiting for history update...');
  });

  return () => {
    socket.off('aviator:crashHistory');
    socket.off('aviator:crashed');
  };
}, [socket]);
```

2. **История отправляется автоматически**:
   - При подключении к серверу
   - После каждого краша

3. **Формат данных**:

```typescript
{
  history: [2.50, 1.08, 5.43, 1.00, 10.25, 3.75, ...], // 20 элементов max
  timestamp: '2025-11-25T10:00:00Z'
}
```

### React компонент истории

```typescript
interface CrashHistoryProps {
  socket: Socket | null;
}

export const CrashHistory: React.FC<CrashHistoryProps> = ({ socket }) => {
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('aviator:crashHistory', (data) => {
      setHistory(data.history);
    });

    return () => {
      socket.off('aviator:crashHistory');
    };
  }, [socket]);

  return (
    <div className="crash-history">
      <h3>Recent Crashes</h3>
      <div className="history-grid">
        {history.map((multiplier, index) => (
          <div
            key={index}
            className={`history-item ${
              multiplier < 2 ? 'low' : multiplier > 5 ? 'high' : 'medium'
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
        ))}
      </div>
    </div>
  );
};
```

**CSS стили:**

```css
.crash-history {
  padding: 20px;
  background: #1a1a2e;
  border-radius: 10px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.history-item {
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  font-weight: bold;
  font-size: 14px;
}

.history-item.low {
  background: #ff4444;
  color: white;
}

.history-item.medium {
  background: #ffaa00;
  color: white;
}

.history-item.high {
  background: #00cc66;
  color: white;
}
```

---

## 💰 Размещение ставок

### Полный процесс ставки

```typescript
interface PlaceBetProps {
  socket: Socket | null;
  currentGame: Game | null;
  balance: number;
}

export const BetForm: React.FC<PlaceBetProps> = ({
  socket,
  currentGame,
  balance,
}) => {
  const [betAmount, setBetAmount] = useState(100);
  const [myBetId, setMyBetId] = useState<number | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Ваша ставка принята
    socket.on('aviator:betPlaced', (data) => {
      console.log('✅ Bet placed:', data);
      setMyBetId(data.id); // КРИТИЧНО!
      setIsPlacingBet(false);
      showSuccessMessage('Bet placed successfully!');
    });

    // Ошибка при ставке
    socket.on('error', (data) => {
      console.error('❌ Error:', data.message);
      setIsPlacingBet(false);
      showErrorMessage(data.message);
    });

    return () => {
      socket.off('aviator:betPlaced');
      socket.off('error');
    };
  }, [socket]);

  const handlePlaceBet = () => {
    // Валидация на клиенте
    if (!socket || !currentGame) {
      showErrorMessage('No active game');
      return;
    }

    if (currentGame.status !== 'WAITING') {
      showErrorMessage('Game already started');
      return;
    }

    if (betAmount < 25) {
      showErrorMessage('Minimum bet is 25');
      return;
    }

    if (betAmount > 10000) {
      showErrorMessage('Maximum bet is 10000');
      return;
    }

    if (betAmount > balance) {
      showErrorMessage('Insufficient balance');
      return;
    }

    if (myBetId) {
      showErrorMessage('You already have a bet in this game');
      return;
    }

    // Отправляем ставку
    setIsPlacingBet(true);
    socket.emit('aviator:placeBet', {
      aviatorId: currentGame.id,
      amount: betAmount,
    });
  };

  const canPlaceBet =
    currentGame?.status === 'WAITING' &&
    !myBetId &&
    betAmount >= 25 &&
    betAmount <= 10000 &&
    betAmount <= balance &&
    !isPlacingBet;

  return (
    <div className="bet-form">
      <input
        type="number"
        value={betAmount}
        onChange={(e) => setBetAmount(Number(e.target.value))}
        min={25}
        max={10000}
        step={25}
        disabled={currentGame?.status !== 'WAITING' || myBetId !== null}
      />
      
      <button
        onClick={handlePlaceBet}
        disabled={!canPlaceBet}
        className={canPlaceBet ? 'active' : 'disabled'}
      >
        {isPlacingBet ? 'Placing...' : myBetId ? 'Bet Placed' : 'Place Bet'}
      </button>

      {myBetId && (
        <div className="bet-info">
          ✅ Your bet: {betAmount} (ID: {myBetId})
        </div>
      )}
    </div>
  );
};
```

---

## 🎯 Кешаут (Cash Out)

### Полный процесс кешаута

```typescript
interface CashOutProps {
  socket: Socket | null;
  myBetId: number | null;
  currentMultiplier: number;
  gameStatus: 'WAITING' | 'ACTIVE' | 'FINISHED';
}

export const CashOutButton: React.FC<CashOutProps> = ({
  socket,
  myBetId,
  currentMultiplier,
  gameStatus,
}) => {
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Успешный кешаут
    socket.on('aviator:cashedOut', (result) => {
      console.log('💰 Cashed out:', result);
      setHasCashedOut(true);
      setIsCashingOut(false);
      showWinAnimation(result.winAmount);
    });

    // Игра крашнулась
    socket.on('aviator:crashed', () => {
      if (!hasCashedOut && myBetId) {
        showLoseMessage('You lost!');
      }
    });

    // Новая игра
    socket.on('aviator:statusChange', (data) => {
      if (data.status === 'WAITING') {
        setHasCashedOut(false);
        setIsCashingOut(false);
      }
    });

    // Ошибка кешаута
    socket.on('error', (data) => {
      console.error('❌ Cash out error:', data.message);
      setIsCashingOut(false);
      showErrorMessage(data.message);
    });

    return () => {
      socket.off('aviator:cashedOut');
      socket.off('aviator:crashed');
      socket.off('aviator:statusChange');
      socket.off('error');
    };
  }, [socket, myBetId, hasCashedOut]);

  const handleCashOut = () => {
    if (!socket || !myBetId) {
      console.error('Cannot cash out: missing socket or betId');
      return;
    }

    if (gameStatus !== 'ACTIVE') {
      showErrorMessage('Game is not active');
      return;
    }

    if (hasCashedOut) {
      showErrorMessage('Already cashed out');
      return;
    }

    console.log('💰 Cashing out at', currentMultiplier);
    setIsCashingOut(true);

    socket.emit('aviator:cashOut', {
      betId: myBetId,
      currentMultiplier: currentMultiplier,
    });
  };

  const canCashOut =
    gameStatus === 'ACTIVE' &&
    myBetId !== null &&
    !hasCashedOut &&
    !isCashingOut;

  return (
    <button
      onClick={handleCashOut}
      disabled={!canCashOut}
      className={`cash-out-button ${canCashOut ? 'active' : 'disabled'}`}
    >
      {isCashingOut
        ? 'Cashing Out...'
        : hasCashedOut
          ? 'Cashed Out ✅'
          : `Cash Out ${currentMultiplier.toFixed(2)}x`}
    </button>
  );
};
```

### Почему кешаут не работает?

**Проблема**: При нажатии на кешаут ничего не происходит или ошибка "Bet not found".

**Решения**:

1. **Сохраняйте `betId` из `aviator:betPlaced`**:

```typescript
socket.on('aviator:betPlaced', (data) => {
  setMyBetId(data.id); // ✅ ОБЯЗАТЕЛЬНО!
  console.log('Bet ID saved:', data.id);
});
```

2. **Проверьте статус игры**:

```typescript
if (gameStatus !== 'ACTIVE') {
  console.error('Cannot cash out: game is not ACTIVE');
  return;
}
```

3. **Передавайте правильный множитель**:

```typescript
// ✅ ПРАВИЛЬНО: используйте текущий множитель из aviator:multiplierTick
socket.emit('aviator:cashOut', {
  betId: myBetId,
  currentMultiplier: currentMultiplier, // из state
});

// ❌ НЕПРАВИЛЬНО: не используйте game.multiplier (это краш-множитель)
socket.emit('aviator:cashOut', {
  betId: myBetId,
  currentMultiplier: game.multiplier, // ОШИБКА!
});
```

---

## 🚨 Обработка ошибок

### Типы ошибок

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Game not found` | Игра не существует | Запросите текущую игру |
| `Game is not in WAITING status` | Попытка ставки в ACTIVE/FINISHED | Проверьте статус перед ставкой |
| `Insufficient balance` | Недостаточно средств | Проверьте баланс |
| `Bet not found` | betId не найден | Сохраняйте betId из betPlaced |
| `Game is not ACTIVE` | Попытка кешаута вне ACTIVE | Проверьте статус |
| `Bet already cashed out` | Повторный кешаут | Отслеживайте hasCashedOut |

### Универсальный обработчик ошибок

```typescript
export const useErrorHandler = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;

    socket.on('error', (data) => {
      console.error('❌ Error:', data.message);

      switch (data.message) {
        case 'Game not found':
          showError('Game not found. Refreshing...');
          socket.emit('aviator:getCurrent');
          break;

        case 'Game is not in WAITING status':
          showError('Cannot place bet: game already started');
          break;

        case 'Insufficient balance':
          showError('Not enough balance');
          break;

        case 'Bet not found':
          showError('Bet not found. Please refresh.');
          break;

        case 'Game is not ACTIVE':
          showError('Cannot cash out: game not active');
          break;

        case 'Bet already cashed out':
          showError('Already cashed out');
          break;

        default:
          showError(data.message);
      }
    });

    return () => {
      socket.off('error');
    };
  }, [socket]);
};
```

---

## ⚛️ React примеры

### Полный компонент Aviator игры

```typescript
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface Game {
  id: number;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  multiplier: number;
  startsAt: string;
  bets: Bet[];
}

interface Bet {
  id: number;
  amount: number;
  cashedAt: number | null;
  user: {
    username: string;
  };
}

interface AviatorGameProps {
  socket: Socket;
  balance: number;
}

export const AviatorGame: React.FC<AviatorGameProps> = ({
  socket,
  balance,
}) => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashHistory, setCrashHistory] = useState<number[]>([]);
  const [myBetId, setMyBetId] = useState<number | null>(null);
  const [myBetAmount, setMyBetAmount] = useState<number | null>(null);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [betAmount, setBetAmount] = useState(100);

  // Инициализация: получаем текущую игру
  useEffect(() => {
    socket.emit('aviator:getCurrent');
  }, [socket]);

  // Слушаем все события
  useEffect(() => {
    // Текущая игра
    socket.on('aviator:game', (game) => {
      setCurrentGame(game);
    });

    // Изменение статуса
    socket.on('aviator:statusChange', (data) => {
      if (data.status === 'WAITING') {
        setCurrentMultiplier(1.0);
        setMyBetId(null);
        setMyBetAmount(null);
        setHasCashedOut(false);
      }
    });

    // Тики множителя
    socket.on('aviator:multiplierTick', (data) => {
      setCurrentMultiplier(data.currentMultiplier);
    });

    // Краш
    socket.on('aviator:crashed', (data) => {
      setCurrentMultiplier(data.multiplier);
    });

    // История
    socket.on('aviator:crashHistory', (data) => {
      setCrashHistory(data.history);
    });

    // Ставка принята
    socket.on('aviator:betPlaced', (data) => {
      setMyBetId(data.id);
      setMyBetAmount(data.amount);
    });

    // Кешаут успешен
    socket.on('aviator:cashedOut', (result) => {
      setHasCashedOut(true);
      alert(`You won ${result.winAmount}!`);
    });

    // Ошибки
    socket.on('error', (data) => {
      alert(`Error: ${data.message}`);
    });

    return () => {
      socket.off('aviator:game');
      socket.off('aviator:statusChange');
      socket.off('aviator:multiplierTick');
      socket.off('aviator:crashed');
      socket.off('aviator:crashHistory');
      socket.off('aviator:betPlaced');
      socket.off('aviator:cashedOut');
      socket.off('error');
    };
  }, [socket]);

  const handlePlaceBet = () => {
    if (!currentGame || currentGame.status !== 'WAITING') {
      alert('Cannot place bet now');
      return;
    }

    if (betAmount < 25 || betAmount > 10000) {
      alert('Bet must be between 25 and 10000');
      return;
    }

    if (betAmount > balance) {
      alert('Insufficient balance');
      return;
    }

    socket.emit('aviator:placeBet', {
      aviatorId: currentGame.id,
      amount: betAmount,
    });
  };

  const handleCashOut = () => {
    if (!myBetId || currentGame?.status !== 'ACTIVE' || hasCashedOut) {
      return;
    }

    socket.emit('aviator:cashOut', {
      betId: myBetId,
      currentMultiplier: currentMultiplier,
    });
  };

  return (
    <div className="aviator-game">
      {/* Множитель */}
      <div className={`multiplier ${currentGame?.status}`}>
        {currentMultiplier.toFixed(2)}x
      </div>

      {/* Статус */}
      <div className="status">
        Status: {currentGame?.status || 'Loading...'}
      </div>

      {/* История */}
      <div className="history">
        {crashHistory.slice(0, 10).map((mult, i) => (
          <span key={i}>{mult.toFixed(2)}x</span>
        ))}
      </div>

      {/* Форма ставки */}
      {currentGame?.status === 'WAITING' && !myBetId && (
        <div className="bet-form">
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            min={25}
            max={10000}
          />
          <button onClick={handlePlaceBet}>Place Bet</button>
        </div>
      )}

      {/* Кешаут */}
      {currentGame?.status === 'ACTIVE' && myBetId && !hasCashedOut && (
        <button onClick={handleCashOut} className="cash-out">
          Cash Out {currentMultiplier.toFixed(2)}x
        </button>
      )}

      {/* Информация о ставке */}
      {myBetId && (
        <div className="bet-info">
          Your bet: {myBetAmount} | Bet ID: {myBetId}
          {hasCashedOut && ' ✅ Cashed Out'}
        </div>
      )}
    </div>
  );
};
```

---

## 🔧 Решение проблем

### 1. История множителей не работает

**Симптомы**: Массив `crashHistory` пустой или не обновляется.

**Решение**:

```typescript
useEffect(() => {
  if (!socket) return;

  // Слушаем историю
  socket.on('aviator:crashHistory', (data) => {
    console.log('📊 History received:', data.history);
    setCrashHistory(data.history);
  });

  // Запрашиваем текущую игру (история придет автоматически)
  socket.emit('aviator:getCurrent');

  return () => {
    socket.off('aviator:crashHistory');
  };
}, [socket]);
```

**Проверка**: История отправляется:
- При подключении (в `handleConnection`)
- После каждого краша (в `crashGame`)

---

### 2. Краши плохо работают

**Симптомы**: Множитель не останавливается, игра зависает.

**Решение**:

```typescript
useEffect(() => {
  if (!socket) return;

  // Слушаем краш
  socket.on('aviator:crashed', (data) => {
    console.log('💥 Crashed at', data.multiplier);
    setCurrentMultiplier(data.multiplier); // Фиксируем финальный множитель
    setGameStatus('FINISHED');
  });

  // Слушаем статус
  socket.on('aviator:statusChange', (data) => {
    console.log('Status changed:', data.status);
    setGameStatus(data.status);
    
    if (data.status === 'WAITING') {
      setCurrentMultiplier(1.0); // Сброс при новой игре
    }
  });

  return () => {
    socket.off('aviator:crashed');
    socket.off('aviator:statusChange');
  };
}, [socket]);
```

---

### 3. Кешаут не работает

**Симптомы**: Ошибка "Bet not found" или ничего не происходит.

**Решение**:

```typescript
// 1. ОБЯЗАТЕЛЬНО сохраняйте betId
socket.on('aviator:betPlaced', (data) => {
  console.log('✅ Bet placed, ID:', data.id);
  setMyBetId(data.id); // КРИТИЧНО!
});

// 2. Используйте правильный множитель
socket.on('aviator:multiplierTick', (data) => {
  setCurrentMultiplier(data.currentMultiplier); // Обновляем текущий
});

// 3. Кешаут
const handleCashOut = () => {
  console.log('Cashing out:', { betId: myBetId, mult: currentMultiplier });
  
  socket.emit('aviator:cashOut', {
    betId: myBetId, // из aviator:betPlaced
    currentMultiplier: currentMultiplier, // из aviator:multiplierTick
  });
};
```

---

### 4. Подключение зависает

**Симптомы**: `connect` не срабатывает, постоянные переподключения.

**Решение**:

```typescript
const socket = io('https://your-backend-url/ws', {
  auth: {
    token: jwtToken, // Проверьте что токен валиден
  },
  transports: ['websocket'], // Используйте только WebSocket
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Добавьте логирование
socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  // Проверьте JWT токен
  // Проверьте CORS настройки
  // Проверьте URL сервера
});
```

---

### 5. Множитель не растет плавно

**Симптомы**: Множитель "прыгает", не плавно растет.

**Решение**: Используйте события `aviator:multiplierTick` (приходят каждые 50ms):

```typescript
socket.on('aviator:multiplierTick', (data) => {
  // Обновляем без анимации (сервер уже отправляет 20 раз/сек)
  setCurrentMultiplier(data.currentMultiplier);
});
```

**НЕ используйте** собственную анимацию - она рассинхронизируется!

---

## 📝 Чек-лист интеграции

### Обязательно реализовать:

- [ ] WebSocket подключение с JWT токеном
- [ ] Получение текущей игры при загрузке (`aviator:getCurrent`)
- [ ] Отслеживание статуса игры (`aviator:statusChange`)
- [ ] Отображение множителя (`aviator:multiplierTick`)
- [ ] Сохранение `betId` из `aviator:betPlaced`
- [ ] Размещение ставок (`aviator:placeBet`)
- [ ] Кешаут (`aviator:cashOut`)
- [ ] Обработка краша (`aviator:crashed`)
- [ ] Отображение истории (`aviator:crashHistory`)
- [ ] Обработка ошибок (`error`)
- [ ] Обработка выигрышей/проигрышей (`aviator:win`/`aviator:lose`)

### Рекомендуется:

- [ ] Звуковые эффекты для ставок, кешаутов, крашей
- [ ] Анимации выигрышей
- [ ] Таймер обратного отсчета в WAITING
- [ ] Список активных ставок
- [ ] Статистика игрока
- [ ] Проверка баланса перед ставкой
- [ ] Автоматическое переподключение

---

## 🎨 Пример UI состояний

### WAITING

```
┌────────────────────────────────┐
│       🕐 Starting in 5s...     │
│                                │
│          1.00x                 │
│                                │
│  [Bet Amount: 100]             │
│  [Place Bet] ✅                │
│                                │
│  History: 2.5x 1.08x 5.4x...   │
└────────────────────────────────┘
```

### ACTIVE (без ставки)

```
┌────────────────────────────────┐
│       🚀 Game In Progress      │
│                                │
│          2.45x 📈              │
│                                │
│  Too late to bet!              │
│                                │
│  Players: 5 active             │
└────────────────────────────────┘
```

### ACTIVE (со ставкой)

```
┌────────────────────────────────┐
│       🚀 Game In Progress      │
│                                │
│          3.75x 📈              │
│                                │
│  Your bet: 100                 │
│  Potential win: 375            │
│                                │
│  [Cash Out 3.75x] 💰           │
└────────────────────────────────┘
```

### FINISHED

```
┌────────────────────────────────┐
│       💥 Crashed at 5.43x!     │
│                                │
│          5.43x ❌              │
│                                │
│  You won 543! 🎉               │
│  (or "You lost 100 😢")        │
│                                │
│  Next game in 3s...            │
└────────────────────────────────┘
```

---

## 📚 Дополнительные ресурсы

- [AVIATOR_WEBSOCKET_STATES.md](./AVIATOR_WEBSOCKET_STATES.md) - Подробная документация WebSocket API
- [AVIATOR_QUICK_REFERENCE.md](./AVIATOR_QUICK_REFERENCE.md) - Быстрый справочник
- [AVIATOR_ERROR_CODES.md](./AVIATOR_ERROR_CODES.md) - Коды ошибок
- [PROVABLY_FAIR.md](./PROVABLY_FAIR.md) - Алгоритм Provably Fair

---

## 🆘 Поддержка

Если у вас возникли проблемы:

1. Проверьте консоль браузера на ошибки
2. Проверьте Network tab в DevTools (WebSocket frames)
3. Убедитесь что JWT токен валиден
4. Проверьте что сохраняете `betId` из `aviator:betPlaced`
5. Проверьте статус игры перед действиями

**Типичные ошибки:**
- Не сохранен `betId` → кешаут не работает
- Неправильный множитель → кешаут отклоняется
- Не слушаете `aviator:crashHistory` → история пустая
- Статус не WAITING → ставка отклоняется
- Статус не ACTIVE → кешаут невозможен

---

**Успешной интеграции! 🚀**
