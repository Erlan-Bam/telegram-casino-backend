# Пример использования истории игр Aviator

## Описание

Новый WebSocket endpoint `aviator:getHistory` позволяет получить историю завершенных игр Aviator с информацией о крашах, ставках и других деталях.

## Быстрый старт

### Подключение к WebSocket

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://your-domain/ws', {
  auth: {
    token: 'your-jwt-token',
  },
});

socket.on('connected', () => {
  console.log('✅ Connected to Aviator WebSocket');

  // Запросить историю игр
  socket.emit('aviator:getHistory');
});
```

---

## Получение истории

### Базовый запрос (последние 20 игр)

```typescript
socket.emit('aviator:getHistory');

socket.on('aviator:history', (data) => {
  console.log(`📊 Received ${data.count} games:`);

  data.games.forEach((game, index) => {
    console.log(
      `${index + 1}. Game #${game.id}: ${game.multiplier}x (${game.totalBets} bets)`,
    );
  });
});
```

**Пример вывода:**

```
📊 Received 20 games:
1. Game #523: 2.45x (15 bets)
2. Game #522: 1.00x (8 bets)
3. Game #521: 5.67x (22 bets)
4. Game #520: 3.21x (12 bets)
...
```

---

### Запрос с указанием лимита

```typescript
// Получить последние 50 игр
socket.emit('aviator:getHistory', { limit: 50 });

// Получить последние 10 игр
socket.emit('aviator:getHistory', { limit: 10 });

// Получить последние 100 игр (максимум)
socket.emit('aviator:getHistory', { limit: 100 });
```

---

## Структура данных

### Ответ `aviator:history`

```typescript
{
  games: [
    {
      id: number,              // ID игры
      multiplier: number,      // Множитель краша (1.00 - 100000.00)
      clientSeed: string,      // Клиентский сид для провайбли-феа
      nonce: number,           // Номер игры (для провайбли-феа)
      status: "FINISHED",      // Всегда FINISHED
      startsAt: string,        // ISO дата начала игры
      createdAt: string,       // ISO дата создания
      updatedAt: string,       // ISO дата завершения
      totalBets: number        // Количество ставок в игре
    },
    // ... еще игры
  ],
  count: number,               // Количество игр в ответе
  timestamp: string            // ISO дата запроса
}
```

---

## Практические примеры

### 1. Отображение истории в UI

```typescript
function displayGameHistory() {
  socket.emit('aviator:getHistory', { limit: 20 });

  socket.on('aviator:history', (data) => {
    const historyContainer = document.getElementById('history');
    historyContainer.innerHTML = '';

    data.games.forEach((game) => {
      const gameElement = document.createElement('div');
      gameElement.className = 'game-item';

      // Цвет в зависимости от множителя
      const colorClass =
        game.multiplier < 2 ? 'low' : game.multiplier < 5 ? 'medium' : 'high';

      gameElement.innerHTML = `
        <span class="multiplier ${colorClass}">${game.multiplier}x</span>
        <span class="bets">${game.totalBets} bets</span>
        <span class="time">${formatTime(game.createdAt)}</span>
      `;

      historyContainer.appendChild(gameElement);
    });
  });
}

function formatTime(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

---

### 2. Статистика по истории

```typescript
socket.emit('aviator:getHistory', { limit: 100 });

socket.on('aviator:history', (data) => {
  const multipliers = data.games.map((g) => g.multiplier);

  // Средний множитель
  const avgMultiplier =
    multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  console.log(`📊 Average multiplier: ${avgMultiplier.toFixed(2)}x`);

  // Минимальный и максимальный
  const minMultiplier = Math.min(...multipliers);
  const maxMultiplier = Math.max(...multipliers);
  console.log(`📉 Min: ${minMultiplier}x | Max: ${maxMultiplier}x`);

  // Количество инста-крашей (1.00x)
  const instantCrashes = multipliers.filter((m) => m === 1.0).length;
  console.log(
    `💥 Instant crashes: ${instantCrashes} (${((instantCrashes / data.count) * 100).toFixed(1)}%)`,
  );

  // Количество больших множителей (>10x)
  const bigWins = multipliers.filter((m) => m >= 10).length;
  console.log(
    `🚀 Big multipliers (≥10x): ${bigWins} (${((bigWins / data.count) * 100).toFixed(1)}%)`,
  );

  // Средний размер ставки
  const totalBets = data.games.reduce((sum, g) => sum + g.totalBets, 0);
  const avgBets = totalBets / data.count;
  console.log(`🎲 Average bets per game: ${avgBets.toFixed(1)}`);
});
```

**Пример вывода:**

```
📊 Average multiplier: 2.34x
📉 Min: 1.00x | Max: 45.67x
💥 Instant crashes: 11 (11.0%)
🚀 Big multipliers (≥10x): 3 (3.0%)
🎲 Average bets per game: 14.5
```

---

### 3. График множителей

```typescript
import Chart from 'chart.js/auto';

socket.emit('aviator:getHistory', { limit: 50 });

socket.on('aviator:history', (data) => {
  const ctx = document.getElementById('multiplierChart').getContext('2d');

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.games.map((g, i) => `#${data.count - i}`).reverse(),
      datasets: [
        {
          label: 'Multiplier',
          data: data.games.map((g) => g.multiplier).reverse(),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Last 50 Games Multipliers',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Multiplier',
          },
        },
      },
    },
  });
});
```

---

### 4. Автообновление истории

```typescript
let historyCache = [];

// Получить начальную историю
socket.emit('aviator:getHistory', { limit: 20 });

socket.on('aviator:history', (data) => {
  historyCache = data.games;
  updateHistoryUI(historyCache);
});

// При каждом краше добавлять в историю
socket.on('aviator:crashed', (data) => {
  console.log(`💥 Game #${data.gameId} crashed at ${data.multiplier}x`);

  // Запросить обновленную историю
  socket.emit('aviator:getHistory', { limit: 20 });
});

function updateHistoryUI(games) {
  const container = document.getElementById('history');
  container.innerHTML = games
    .map(
      (game) => `
    <div class="game-chip ${getChipClass(game.multiplier)}">
      ${game.multiplier}x
    </div>
  `,
    )
    .join('');
}

function getChipClass(multiplier) {
  if (multiplier < 2) return 'red';
  if (multiplier < 5) return 'yellow';
  if (multiplier < 10) return 'green';
  return 'blue';
}
```

---

### 5. Провайбли-фейр верификация

```typescript
socket.emit('aviator:getHistory', { limit: 10 });

socket.on('aviator:history', (data) => {
  data.games.forEach((game) => {
    console.log(`\n🔍 Game #${game.id} Verification:`);
    console.log(`   Nonce: ${game.nonce}`);
    console.log(`   Client Seed: ${game.clientSeed}`);
    console.log(`   Multiplier: ${game.multiplier}x`);
    console.log(`   Started: ${new Date(game.startsAt).toLocaleString()}`);
    console.log(`   Bets: ${game.totalBets}`);

    // Здесь можно добавить логику проверки через HMAC-SHA256
    // используя serverSeed (получить от администратора)
  });
});
```

---

### 6. Поиск паттернов

```typescript
socket.emit('aviator:getHistory', { limit: 100 });

socket.on('aviator:history', (data) => {
  const multipliers = data.games.map((g) => g.multiplier);

  // Найти самую длинную серию инста-крашей
  let currentStreak = 0;
  let maxStreak = 0;

  multipliers.forEach((m) => {
    if (m === 1.0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  console.log(`🔥 Longest instant crash streak: ${maxStreak} games`);

  // Найти самую длинную серию без больших множителей
  let gamesWithout10x = 0;
  let maxWithout10x = 0;

  multipliers.forEach((m) => {
    if (m < 10) {
      gamesWithout10x++;
      maxWithout10x = Math.max(maxWithout10x, gamesWithout10x);
    } else {
      gamesWithout10x = 0;
    }
  });

  console.log(`⏳ Longest streak without 10x+: ${maxWithout10x} games`);
});
```

---

## React Component пример

```tsx
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AviatorGame {
  id: number;
  multiplier: number;
  clientSeed: string;
  nonce: number;
  status: string;
  startsAt: string;
  createdAt: string;
  updatedAt: string;
  totalBets: number;
}

interface HistoryData {
  games: AviatorGame[];
  count: number;
  timestamp: string;
}

export function AviatorHistory() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [history, setHistory] = useState<AviatorGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newSocket = io('ws://your-domain/ws', {
      auth: { token: 'your-jwt-token' },
    });

    newSocket.on('connected', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('aviator:getHistory', { limit: 20 });
    });

    newSocket.on('aviator:history', (data: HistoryData) => {
      setHistory(data.games);
      setLoading(false);
    });

    // Обновлять историю при крашах
    newSocket.on('aviator:crashed', () => {
      newSocket.emit('aviator:getHistory', { limit: 20 });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="aviator-history">
      <h2>Game History</h2>
      <div className="history-grid">
        {history.map((game) => (
          <div
            key={game.id}
            className={`game-chip ${getMultiplierColor(game.multiplier)}`}
          >
            <span className="multiplier">{game.multiplier}x</span>
            <span className="bets">{game.totalBets} bets</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMultiplierColor(multiplier: number): string {
  if (multiplier < 2) return 'red';
  if (multiplier < 5) return 'yellow';
  if (multiplier < 10) return 'green';
  return 'purple';
}
```

---

## CSS для истории

```css
.aviator-history {
  padding: 20px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.game-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  font-weight: bold;
  transition: transform 0.2s;
}

.game-chip:hover {
  transform: scale(1.05);
  cursor: pointer;
}

.game-chip.red {
  background: linear-gradient(135deg, #ff4757 0%, #ff6348 100%);
  color: white;
}

.game-chip.yellow {
  background: linear-gradient(135deg, #ffa502 0%, #ffcc00 100%);
  color: #333;
}

.game-chip.green {
  background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%);
  color: white;
}

.game-chip.purple {
  background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
  color: white;
}

.multiplier {
  font-size: 18px;
  margin-bottom: 5px;
}

.bets {
  font-size: 12px;
  opacity: 0.8;
}
```

---

## Обработка ошибок

```typescript
socket.on('error', (error) => {
  console.error('❌ Error:', error.message);

  if (error.message === 'Failed to get game history') {
    // Показать уведомление пользователю
    showNotification('Unable to load game history', 'error');

    // Попробовать еще раз через 3 секунды
    setTimeout(() => {
      socket.emit('aviator:getHistory');
    }, 3000);
  }
});
```

---

## Лимиты и ограничения

- **Минимальный лимит:** 1 игра
- **Максимальный лимит:** 100 игр
- **По умолчанию:** 20 игр
- **Порядок:** От новых к старым (descending)
- **Статус:** Только завершенные игры (`FINISHED`)

---

## Связь с другими событиями

История автоматически обновляется при:

```typescript
// При краше игры
socket.on('aviator:crashed', (data) => {
  console.log(`Game crashed at ${data.multiplier}x`);

  // Обновить историю
  socket.emit('aviator:getHistory', { limit: 20 });
});

// При подключении нового клиента
socket.on('connected', () => {
  // Загрузить историю при подключении
  socket.emit('aviator:getHistory');
});
```

---

## Производительность

**Рекомендации:**

1. Не запрашивать историю слишком часто (используйте debounce)
2. Кэшировать данные на клиенте
3. Использовать разумный лимит (20-50 игр для UI)
4. Обновлять только при необходимости (после краша)

```typescript
// Debounce для запросов истории
let historyTimeout: NodeJS.Timeout;

function requestHistory(limit = 20) {
  clearTimeout(historyTimeout);

  historyTimeout = setTimeout(() => {
    socket.emit('aviator:getHistory', { limit });
  }, 500); // Задержка 500ms
}
```

---

## Заключение

Endpoint `aviator:getHistory` предоставляет мощный инструмент для:

- 📊 Отображения истории игр
- 📈 Построения графиков и статистики
- 🔍 Верификации провайбли-феа
- 🎯 Анализа паттернов
- 🎨 Улучшения UX приложения

Используйте его вместе с другими WebSocket событиями для создания полноценного игрового интерфейса.
