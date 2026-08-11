# Usagecheck_GPT

Central ChatGPT usage counter prototype.

## Goal

Show one combined daily usage number without separating Browser, App, Device, or Channel in the main dashboard.

> Important: ChatGPT personal accounts do not expose a public real-time API that reports total remaining message quota across Web, Desktop, and Mobile. This project therefore aggregates usage events from collectors that we control. Additional collectors can be added later without changing the dashboard model.

## V1 architecture

```text
Collector(s) -> POST /api/events -> Central counter -> Dashboard
```

The dashboard displays only the combined total. `source` and `channel` are retained only as internal event metadata for debugging and future integrations.

## Run locally

Requirements: Node.js 20+

```bash
npm start
```

Open:

```text
http://localhost:8787
```

## API

### Read aggregate usage

```http
GET /api/usage
```

### Add usage

```http
POST /api/events
Content-Type: application/json

{
  "count": 1,
  "source": "browser-extension",
  "channel": "chatgpt-web",
  "deviceId": "optional-device-id"
}
```

### Change daily limit

```http
PUT /api/settings
Content-Type: application/json

{
  "dailyLimit": 100,
  "warnAt": [70, 90, 100]
}
```

### Reset today

```http
POST /api/reset-today
```

## Data policy in V1

The server stores count events only. Do not send prompt text, ChatGPT responses, customer names, document contents, or confidential conversation data to `/api/events`.

## Next collectors

Possible collectors can include:

- Chrome / Edge extension for ChatGPT Web
- Desktop helper application
- API usage collector when OpenAI API is used
- Workspace analytics import for Business / Enterprise where available

All collectors should submit to the same `/api/events` endpoint so the dashboard remains one combined usage total.

## Time zone

Daily aggregation currently resets using `Asia/Bangkok`.
