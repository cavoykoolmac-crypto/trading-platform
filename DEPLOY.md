# Deploy The Trading Platform

## Recommended Host

Use Render first.

Why:
- easiest Node deployment flow
- automatic HTTPS
- simple environment variable management
- easy to keep the app online 24/7

Your final mobile URL will look like:

`https://your-trading-platform.onrender.com`

## Required Environment Variables

Set these in Render before using the app:

- `OPENAI_API_KEY`
- `FINNHUB_API_KEY`
- `EXECUTION_ACCOUNT_SIZE`
- `EXECUTION_RISK_PCT`
- `EXECUTION_MAX_POSITION_PCT`
- `DASHBOARD_USERNAME`
- `DASHBOARD_PASSWORD`

Optional but recommended if you use alerts:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `DISCORD_WEBHOOK_URL`
- `WEBHOOK_SECRET`
- `OPENAI_MODEL`
- `AUTO_SCAN_INTERVAL_MS`
- `DASHBOARD_SESSION_TIMEOUT_MS`

## Local Run

The app still runs locally with:

```bash
npm start
```

Local defaults:

- `PORT=8787` if `PORT` is not set
- dashboard auth is disabled unless both `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` are set

## Render Deployment Steps

1. Push this project to GitHub.
2. Create a Render account at `https://render.com`.
3. Click `New +` and choose `Web Service`.
4. Connect your GitHub repo.
5. Use these settings:

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

6. Add the environment variables listed above in Render's `Environment` tab.
7. Deploy the service.
8. Open the Render URL when deployment finishes.
9. Log in with `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.

## Health Check

Render health check path:

`/health`

Expected response:

```json
{
  "ok": true,
  "status": "running"
}
```

## Important Notes

- The app binds to `process.env.PORT` in production.
- Static frontend assets are served by the same Node server.
- Frontend API calls use relative paths, so they work in local and hosted environments.
- Basic auth protects the dashboard and API surface when `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` are set.
- `/health` stays public so Render can monitor the service.

## Production Checklist

Before you rely on the hosted app from your phone:

1. Confirm `/health` returns `ok: true`.
2. Confirm login prompt appears.
3. Confirm `Buy Now`, `Movers`, `Watchlist`, `Execution`, and `Market Browser` load.
4. Confirm OpenAI is connected in `Signal Brain`.
5. Confirm Finnhub data is loading.
6. Confirm alerts still work if you use Telegram or Discord.
