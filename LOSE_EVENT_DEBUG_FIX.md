# 🔍 aviator:lose Event Debugging Fix

## Problem

Frontend wasn't receiving `aviator:lose` events after game crash, even though the bet was placed and the crash event was received.

## Root Cause Analysis

The issue could be one of several problems:

1. **User not in activeUsers map** - User disconnected or map not updated properly
2. **Socket not found** - socketId stored but socket instance missing from server.sockets
3. **Event not emitted** - Logic error preventing emit() call
4. **Silent failure** - Emit called but failed silently

## Diagnostic Logging Added

### 1. Enhanced Bet Processing Logs

In `processGameResults()`, added detailed logging for each bet:

```typescript
this.logger.log(
  `🎯 [Gateway] Processing bet #${bet.id} for user ${username} (${userId})`,
);
this.logger.log(`   - Bet Amount: ${betAmount}`);
this.logger.log(
  `   - Cashed At: ${cashedAt !== null ? `${cashedAt}x` : 'NULL (NOT CASHED OUT)'}`,
);
this.logger.log(`   - Socket ID: ${socketId || 'NOT IN activeUsers MAP'}`);
this.logger.log(`   - Active Users Map Size: ${this.activeUsers.size}`);
```

### 2. Losing Bet Identification

Added clear identification when a bet is losing:

```typescript
if (cashedAt === null) {
  this.logger.log(
    `💔 [Gateway] Bet #${bet.id} is a LOSING BET (cashedAt is NULL)`,
  );
}
```

### 3. Socket Lookup Diagnostics

Added comprehensive socket lookup logging:

```typescript
if (!socketId) {
  this.logger.error(
    `❌ [Gateway] CRITICAL: User ${username} (${userId}) NOT FOUND in activeUsers map!`,
  );
  this.logger.error(
    `   - activeUsers map has ${this.activeUsers.size} entries`,
  );
  this.logger.error(
    `   - User IDs in map: ${Array.from(this.activeUsers.keys()).join(', ')}`,
  );
}

if (socketId) {
  this.logger.log(
    `🔍 [Gateway] Found socketId ${socketId} for user ${username}, getting socket...`,
  );

  const socket = this.getSocketById(socketId);

  if (socket) {
    this.logger.log(
      `🎯 [Gateway] Socket found! Emitting aviator:lose event...`,
    );
    socket.emit('aviator:lose', loseEvent);
    this.logger.log(`✅ [Gateway] LOSE event EMITTED successfully`);
  } else {
    this.logger.error(
      `❌ [Gateway] CRITICAL: Socket ${socketId} not found in server.sockets.sockets!`,
    );
    this.logger.error(
      `   - server.sockets.sockets.size: ${this.server?.sockets?.sockets?.size || 'undefined'}`,
    );
    this.logger.error(
      `   - Socket IDs: ${Array.from(this.server?.sockets?.sockets?.keys() || []).join(', ')}`,
    );
  }
}
```

### 4. Connection Tracking

Enhanced connection logging to track activeUsers map:

```typescript
this.logger.log(
  `✅ User ${user.username} (${user.id}) connected with socket ${client.id}`,
);
this.logger.log(
  `   - Added to activeUsers map (size: ${this.activeUsers.size})`,
);
this.logger.log(
  `   - Active users: ${Array.from(this.activeUsers.keys()).slice(0, 5).join(', ')}...`,
);
```

### 5. Bet Placement Tracking

Added logging when bets are placed to verify user is in activeUsers:

```typescript
this.logger.log(
  `🎰 [BET] User ${username} (${userId}) placing bet on aviator #${data.aviatorId} for ${data.amount}`,
);
this.logger.log(
  `🔍 [BET] User ${username} activeUsers check: ${socketId ? `✅ Found (${socketId})` : '❌ NOT FOUND'}`,
);
this.logger.log(
  `📊 [BET] Current activeUsers map size: ${this.activeUsers.size}`,
);
```

## How to Debug

### Step 1: Check Connection

Look for this in Railway logs when user connects:

```
✅ User GaidarTheDev (faabf8ff-87dc-42e3-a105-8fe27c72d6d0) connected with socket abc123
   - Added to activeUsers map (size: 1)
```

**If missing:** User didn't connect properly or auth failed

### Step 2: Check Bet Placement

Look for this when user places bet:

```
🎰 [BET] User GaidarTheDev (faabf8ff-...) placing bet on aviator #25226 for 500
🔍 [BET] User GaidarTheDev activeUsers check: ✅ Found (abc123)
📊 [BET] Current activeUsers map size: 1
✅ [BET] Bet #167 placed successfully
🔍 [BET] User GaidarTheDev activeUsers check AFTER bet: ✅ Found (abc123)
```

**If socketId is NOT FOUND:** User disconnected between connection and bet, or map corrupted

### Step 3: Check Game Crash

Look for crash processing logs:

```
💥 [Gateway] ===== CRASHING GAME #25226 =====
💥 [Gateway] Game #25226 crashed at 1.17x (1 bets)
📡 [Gateway] EMITTING aviator:crashed event
✅ [Gateway] aviator:crashed event SENT to 1 connected clients
🎲 [Gateway] Processing game results for 1 bets at 1.17x
```

**If no processing logs:** crashGame() never executed or threw error before processing

### Step 4: Check Bet Result Processing

Look for detailed bet processing:

```
🎯 [Gateway] Processing bet #167 for user GaidarTheDev (faabf8ff-...)
   - Bet Amount: 500
   - Cashed At: NULL (NOT CASHED OUT)
   - Socket ID: abc123
   - Active Users Map Size: 1
💔 [Gateway] Bet #167 is a LOSING BET (cashedAt is NULL)
📤 [Gateway] PREPARING TO EMIT aviator:lose to GaidarTheDev
   - Lose Event: {"betId":167,"betAmount":500,"crashMultiplier":1.17,...}
```

**If socket ID is NULL:** User disconnected before crash or removed from activeUsers map

### Step 5: Check Event Emission

Look for emission confirmation:

```
🔍 [Gateway] Found socketId abc123 for user GaidarTheDev, getting socket...
🎯 [Gateway] Socket found! Emitting aviator:lose event...
✅ [Gateway] LOSE event EMITTED successfully to GaidarTheDev (lost 500 at 1.17x)
```

**If socket not found error:** Socket disconnected but not removed from activeUsers map

## Common Issues & Solutions

### Issue 1: User Not in activeUsers Map

**Symptoms:**

```
❌ [Gateway] CRITICAL: User GaidarTheDev (faabf8ff-...) NOT FOUND in activeUsers map!
   - activeUsers map has 0 entries
```

**Causes:**

- User disconnected before crash
- Connection lost during game
- activeUsers map not updated on connection

**Solution:**

- Check connection logs - did user connect?
- Check disconnect logs - did user disconnect before crash?
- Verify `handleConnection()` is adding user to map

### Issue 2: Socket Not Found

**Symptoms:**

```
❌ [Gateway] CRITICAL: Socket abc123 not found in server.sockets.sockets!
   - server.sockets.sockets.size: 0
```

**Causes:**

- Socket disconnected but activeUsers map not updated
- Race condition between disconnect and crash
- Socket.IO namespace mismatch

**Solution:**

- Ensure `handleDisconnect()` removes from activeUsers
- Check socket namespace matches ('/ws')
- Verify socket is using same server instance

### Issue 3: Bet Not Fetched

**Symptoms:**

```
🎲 [Gateway] Processing game results for 0 bets at 1.17x
📝 [Gateway] No bets in game, skipping results processing
```

**Causes:**

- Bets not included in Prisma query
- Wrong game ID
- Bet not saved properly

**Solution:**

- Check `crashGame()` includes bets in query
- Verify bet was saved with correct aviatorId
- Check database for bet existence

### Issue 4: cashedAt Not NULL

**Symptoms:**

```
🎯 [Gateway] Processing bet #167 for user GaidarTheDev
   - Cashed At: 0.00x
📤 [Gateway] EMITTING aviator:win to GaidarTheDev
```

**Causes:**

- User cashed out but frontend didn't record it
- Database shows cashedAt value when it shouldn't

**Solution:**

- Check if cashOut was called
- Verify database bet.cashedAt value
- Check cashOut transaction logic

## Expected Log Flow (Success Case)

```
1. Connection:
   ✅ User GaidarTheDev (...) connected with socket abc123
      - Added to activeUsers map (size: 1)

2. Bet Placement:
   🎰 [BET] User GaidarTheDev placing bet on aviator #25226 for 500
   🔍 [BET] User activeUsers check: ✅ Found (abc123)
   ✅ [BET] Bet #167 placed successfully

3. Game Crash:
   💥 [Gateway] Game #25226 crashed at 1.17x (1 bets)
   ✅ [Gateway] aviator:crashed event SENT

4. Result Processing:
   🎯 [Gateway] Processing bet #167 for user GaidarTheDev
      - Cashed At: NULL (NOT CASHED OUT)
      - Socket ID: abc123
   💔 [Gateway] Bet #167 is a LOSING BET
   📤 [Gateway] PREPARING TO EMIT aviator:lose

5. Event Emission:
   🔍 [Gateway] Found socketId abc123
   🎯 [Gateway] Socket found! Emitting aviator:lose event...
   ✅ [Gateway] LOSE event EMITTED successfully
```

## Testing Instructions

1. **Open Railway logs** and filter by timeframe around game crash
2. **Search for user ID** from frontend logs (faabf8ff-87dc-42e3-a105-8fe27c72d6d0)
3. **Search for bet ID** (167) to track the bet lifecycle
4. **Follow the log flow** above to identify where it breaks
5. **Copy relevant logs** showing the failure point
6. **Use error messages** to match with common issues above

## Files Modified

- `src/websocket/websocket.gateway.ts`
  - Enhanced `processGameResults()` with comprehensive logging
  - Added activeUsers map diagnostics
  - Added socket lookup error handling
  - Enhanced connection and bet placement logging

## Next Steps

Once logs are collected:

1. Identify which step in the log flow is missing
2. Match symptoms to common issues
3. Apply appropriate solution
4. Test with another bet to verify fix
