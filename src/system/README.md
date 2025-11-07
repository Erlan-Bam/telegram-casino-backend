# System Module

This module manages system-wide configuration variables stored in the database.

## Features

- **CRU operations** (Create, Read, Update - no Delete) for system variables
- **Hot-reload support** - Bot token and WebApp URL changes are applied immediately without restart
- **Validation** - Aviator chances ranges are validated for:
  - No overlapping ranges
  - `from` < `to` for each range
  - Sum of all chances = 100%

## System Variables

### 1. TELEGRAM_BOT_TOKEN
- **Type**: String
- **Description**: Telegram bot token for authentication
- **Hot-reload**: ✅ Bot restarts automatically with new token

### 2. WEBAPP_URL
- **Type**: String (URL)
- **Description**: URL of the Telegram Mini App WebApp
- **Hot-reload**: ✅ Updated immediately for new bot commands

### 3. AVIATOR_CHANCES
- **Type**: Array of ranges
- **Description**: Configuration for aviator multiplier chances
- **Structure**:
```json
[
  { "from": 1, "to": 2, "chance": 70 },
  { "from": 2, "to": 5, "chance": 20 },
  { "from": 5, "to": 10, "chance": 8 },
  { "from": 10, "to": 20, "chance": 2 }
]
```

## API Endpoints

All endpoints require admin authentication (`@UseGuards(AdminGuard)`).

### GET /admin/system
Get all system variables

**Response**:
```json
[
  {
    "key": "TELEGRAM_BOT_TOKEN",
    "value": "123456:ABC-DEF..."
  },
  {
    "key": "WEBAPP_URL",
    "value": "https://your-webapp.com"
  },
  {
    "key": "AVIATOR_CHANCES",
    "value": [
      { "from": 1, "to": 2, "chance": 70 },
      { "from": 2, "to": 5, "chance": 20 },
      { "from": 5, "to": 10, "chance": 8 },
      { "from": 10, "to": 20, "chance": 2 }
    ]
  }
]
```

### GET /admin/system/:key
Get specific system variable by key

**Parameters**:
- `key`: One of `TELEGRAM_BOT_TOKEN`, `WEBAPP_URL`, `AVIATOR_CHANCES`

### PUT /admin/system/bot-token
Update Telegram bot token

**Body**:
```json
{
  "token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
}
```

**Note**: Bot will automatically restart with the new token.

### PUT /admin/system/webapp-url
Update WebApp URL

**Body**:
```json
{
  "url": "https://your-webapp.com"
}
```

### PUT /admin/system/aviator-chances
Update aviator multiplier chances configuration

**Body**:
```json
{
  "ranges": [
    { "from": 1, "to": 2, "chance": 70 },
    { "from": 2, "to": 5, "chance": 20 },
    { "from": 5, "to": 10, "chance": 8 },
    { "from": 10, "to": 20, "chance": 2 }
  ]
}
```

**Validation Rules**:
1. `from` must be less than `to` for each range
2. Ranges must not overlap
3. Sum of all `chance` values must equal 100

## Usage Example

```bash
# Get admin JWT token first
curl -X POST http://localhost:3000/user/test

# Update aviator chances
curl -X PUT http://localhost:3000/admin/system/aviator-chances \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ranges": [
      { "from": 1, "to": 1.5, "chance": 60 },
      { "from": 1.5, "to": 3, "chance": 25 },
      { "from": 3, "to": 5, "chance": 10 },
      { "from": 5, "to": 10, "chance": 5 }
    ]
  }'
```

## Database Seeding

Run `yarn prisma db seed` to populate default values:
- **AVIATOR_CHANCES**: Default range configuration
- **WEBAPP_URL**: From `WEBAPP_URL` env var or `http://localhost:5173`
- **TELEGRAM_BOT_TOKEN**: Must be set manually via API for security
