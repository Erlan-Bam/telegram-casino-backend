# Case Prizes WebSocket Events

This document describes the WebSocket events for real-time case prize notifications.

## Overview

The system broadcasts prize wins from case openings in real-time to all connected clients. This includes:
- **Real prizes**: Actual prizes won by users when they open cases
- **Fake prizes**: Randomly generated prizes for animation/engagement (generated every 3-8 seconds)

## WebSocket Events

### Client → Server

No special events required. Simply connect to the WebSocket server with JWT authentication.

### Server → Client

#### 1. `case:initialPrizes`

Sent immediately when a client connects. Contains the last 20 prizes (mix of real and fake).

**Payload:**
```typescript
{
  prizes: Array<{
    username: string;        // Username who won the prize
    caseName: string;        // Name of the case opened
    prizeName: string;       // Name of the prize won
    prizeAmount: number;     // Amount/value of the prize
    prizeUrl: string;        // Image URL of the prize
    timestamp: string;       // ISO timestamp when prize was won
    isFake?: boolean;        // True if this is a fake prize for animation
  }>;
  timestamp: string;         // ISO timestamp of the event
}
```

**Example:**
```json
{
  "prizes": [
    {
      "username": "Lucky777",
      "caseName": "Gold Box",
      "prizeName": "100 Coins",
      "prizeAmount": 100,
      "prizeUrl": "https://example.com/coin.png",
      "timestamp": "2025-11-28T12:34:56.789Z",
      "isFake": true
    },
    {
      "username": "john_doe",
      "caseName": "Silver Chest",
      "prizeName": "Premium Skin",
      "prizeAmount": 500,
      "prizeUrl": "https://example.com/skin.png",
      "timestamp": "2025-11-28T12:33:45.123Z",
      "isFake": false
    }
  ],
  "timestamp": "2025-11-28T12:35:00.000Z"
}
```

#### 2. `case:prizeWon`

Broadcast to all clients when ANY user wins a prize (real or fake).

**Payload:**
```typescript
{
  username: string;        // Username who won the prize
  caseName: string;        // Name of the case opened
  prizeName: string;       // Name of the prize won
  prizeAmount: number;     // Amount/value of the prize
  prizeUrl: string;        // Image URL of the prize
  timestamp: string;       // ISO timestamp when prize was won
  isFake?: boolean;        // True if this is a fake prize for animation
}
```

**Example:**
```json
{
  "username": "john_doe",
  "caseName": "Diamond Vault",
  "prizeName": "Legendary Item",
  "prizeAmount": 1000,
  "prizeUrl": "https://example.com/legendary.png",
  "timestamp": "2025-11-28T12:36:20.456Z",
  "isFake": false
}
```

## Client Implementation Example

### React/TypeScript

```typescript
import { io, Socket } from 'socket.io-client';

interface PrizeWon {
  username: string;
  caseName: string;
  prizeName: string;
  prizeAmount: number;
  prizeUrl: string;
  timestamp: string;
  isFake?: boolean;
}

const socket: Socket = io('ws://your-server.com/ws', {
  auth: {
    token: 'your-jwt-token',
  },
});

// Listen for initial prizes when connecting
socket.on('case:initialPrizes', (data: { prizes: PrizeWon[]; timestamp: string }) => {
  console.log('Initial prizes:', data.prizes);
  // Display initial prizes in your UI (e.g., scrolling ticker)
  displayPrizeHistory(data.prizes);
});

// Listen for real-time prize wins
socket.on('case:prizeWon', (prize: PrizeWon) => {
  console.log('New prize won:', prize);
  
  if (prize.isFake) {
    console.log('This is a fake prize for animation');
  } else {
    console.log('Real prize won by user!');
  }
  
  // Add to your prize ticker/animation
  addPrizeToTicker(prize);
});

// Handle connection
socket.on('connected', (data) => {
  console.log('Connected to WebSocket:', data);
});

// Handle errors
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### JavaScript (Plain)

```javascript
const socket = io('ws://your-server.com/ws', {
  auth: {
    token: localStorage.getItem('jwt_token'),
  },
});

// Listen for initial prizes
socket.on('case:initialPrizes', (data) => {
  const prizeList = document.getElementById('prize-list');
  data.prizes.forEach(prize => {
    const prizeElement = createPrizeElement(prize);
    prizeList.appendChild(prizeElement);
  });
});

// Listen for new prizes
socket.on('case:prizeWon', (prize) => {
  const prizeElement = createPrizeElement(prize);
  
  // Add animation class
  prizeElement.classList.add('prize-animation');
  
  // Prepend to list
  const prizeList = document.getElementById('prize-list');
  prizeList.insertBefore(prizeElement, prizeList.firstChild);
  
  // Limit to 20 items
  while (prizeList.children.length > 20) {
    prizeList.removeChild(prizeList.lastChild);
  }
});

function createPrizeElement(prize) {
  const div = document.createElement('div');
  div.className = 'prize-item';
  div.innerHTML = `
    <img src="${prize.prizeUrl}" alt="${prize.prizeName}">
    <div class="prize-info">
      <strong>${prize.username}</strong> won
      <span class="prize-name">${prize.prizeName}</span>
      from <span class="case-name">${prize.caseName}</span>
    </div>
    ${prize.isFake ? '<span class="fake-badge">Demo</span>' : ''}
  `;
  return div;
}
```

## UI Suggestions

1. **Scrolling Ticker**: Show a horizontal scrolling list of recent prizes
2. **Toast Notifications**: Pop-up notification when a major prize is won
3. **Badge Indicator**: Show "REAL" vs "DEMO" badges for transparency
4. **Animation**: Add smooth transitions when new prizes appear
5. **Filter Options**: Allow users to show only real prizes or all prizes

## Fake Prize Generation

Fake prizes are generated to:
- Keep the UI active and engaging
- Demonstrate the prize system to new users
- Create FOMO (Fear of Missing Out) effect

**Generation Rules:**
- Random interval: 3-8 seconds
- Random case selection from available cases
- Random prize from selected case (weighted by chances)
- Random username from predefined list
- Marked with `isFake: true` flag

## Security Notes

- JWT token required for WebSocket connection
- Banned users cannot connect
- All prize data is read-only on client side
- Real prizes are only created via backend API calls
- Fake prizes are server-generated, not client-controlled

## Testing

To test the WebSocket events:

1. Connect to WebSocket with valid JWT:
```javascript
const socket = io('http://localhost:3000/ws', {
  auth: { token: 'your-jwt-token' }
});
```

2. Listen for events:
```javascript
socket.on('case:initialPrizes', console.log);
socket.on('case:prizeWon', console.log);
```

3. Open a case via API:
```bash
curl -X POST http://localhost:3000/case/1/open \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"multiplier": 1}'
```

4. Observe real-time broadcast of the prize won

## Performance Considerations

- Initial prizes are cached in-memory (last 20)
- Fake prize generation is staggered to avoid DB overload
- All clients receive broadcasts simultaneously (O(n) broadcast)
- WebSocket events are lightweight JSON payloads
