# Deploy The Trading Platform

## Recommended Host

Use Render for the public website.

Why:
- easiest Node deployment flow
- automatic HTTPS
- simple secret management
- works well for this single-server app

Your public URL will look like:

`https://your-trading-platform.onrender.com`

## What Is Ready

This repo now includes:
- `render.yaml` for one-click Render blueprint setup
- `npm start` for the web service start command
- public health check at `/health`
- a single Node server that serves both frontend and API routes

## Important Hosting Reality

Render can host the public website, but it cannot directly use integrations that only live on your Mac.

These stay local-only unless you build a separate bridge:
- moomoo OpenD on `127.0.0.1:11111`
- saved Trade Ideas browser sessions on your machine
- Trade Ideas local CSV/session files
- Incite browser sessions saved on your machine

So the best public Render version should rely on cloud-safe sources like:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `FINNHUB_API_KEY`

That is why the Render blueprint defaults `TRADE_IDEAS_PREMIUM_ONLY=false` for public hosting.

## Required Environment Variables

Set these in Render:

- `OPENAI_API_KEY`
- `FINNHUB_API_KEY`
- `DASHBOARD_USERNAME`
- `DASHBOARD_PASSWORD`

Strongly recommended:

- `ANTHROPIC_API_KEY`
- `OPENAI_MODEL`
- `AI_MODE`
- `EXECUTION_ACCOUNT_SIZE`
- `EXECUTION_RISK_PCT`
- `EXECUTION_MAX_POSITION_PCT`

Optional:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `DISCORD_WEBHOOK_URL`
- `WEBHOOK_SECRET`
- `AUTO_SCAN_INTERVAL_MS`
- `DASHBOARD_SESSION_TIMEOUT_MS`

## Render Deployment Steps

### Option 1: Blueprint

1. Push this project to GitHub.
2. Create a new Render Blueprint service from the repo.
3. Render will read `render.yaml`.
4. Fill in the secret env vars.
5. Deploy.

### Option 2: Manual Web Service

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

6. Add the environment variables listed above.
7. Deploy the service.
8. Open the Render URL when deployment finishes.
9. Log in with `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.

## Local Run

```bash
npm start
```

Local defaults:
- `PORT=8787` if `PORT` is not set
- dashboard auth is disabled unless both `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` are set

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

## Production Notes

- The app binds to `process.env.PORT` in production.
- Static frontend assets are served by the same Node server.
- Frontend API calls use relative paths, so they work in local and hosted environments.
- Basic auth protects the dashboard and API surface when `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` are set.
- `/health` stays public so Render can monitor the service.
- Public Render deploys should not depend on your Mac-only market data processes.

## Production Checklist

Before you rely on the hosted app from your phone:

1. Confirm `/health` returns `ok: true`.
2. Confirm the login prompt appears.
3. Confirm `Home`, `Buy Now`, `Movers`, `Execution`, and `Market Browser` load.
4. Confirm `Signal Brain` shows OpenAI and Claude status correctly.
5. Confirm Finnhub-backed data is loading.
6. Confirm alerts still work if you use Telegram or Discord.
