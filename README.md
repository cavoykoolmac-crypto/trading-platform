# TradingView ChatGPT Bridge

This project links TradingView alerts to ChatGPT through a webhook server.

TradingView can send alerts out with webhooks, but Pine Script cannot receive a live ChatGPT response back inside a chart. This bridge acknowledges TradingView quickly, sends the alert to OpenAI asynchronously, and shows the latest analysis in a small local dashboard.

## Setup

1. Copy `.env.example` to `.env`, then put in your real values:

```sh
cp .env.example .env
```

2. Start the server:

```sh
npm start
```

3. Open the dashboard:

```text
http://localhost:8787
```

The root page is the local trading command center. It shows overview, signals, alerts, execution plans, lifecycle, journal, and settings in one dark-theme web UI.

## Test Locally

```sh
curl -X POST "http://localhost:8787/webhook/tradingview?token=make-this-long-and-random" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","interval":"15","price":"190.25","signal":"EMA 9 crossed above EMA 21"}'
```

Then refresh:

```text
http://localhost:8787/latest
```

## Connect TradingView

TradingView webhooks need a public HTTPS URL on port 443 or 80. For local testing, start a tunnel in a second terminal:

```sh
npm run tunnel
```

Then put the public URL into the TradingView alert webhook field:

```text
https://your-public-url.example/webhook/tradingview?token=make-this-long-and-random
```

Use `tradingview-alert-template.json` as the alert message. TradingView sends `application/json` when the alert message is valid JSON.

Important TradingView constraints:

- Webhooks require 2-factor authentication on your TradingView account.
- TradingView cancels webhook requests that take longer than about 3 seconds, so this server returns `202 Accepted` immediately and analyzes in the background.
- Do not put API keys, passwords, or broker credentials in TradingView alert messages.

## Pine Script Example

`tradingview-example.pine` shows a simple EMA crossover indicator that sends JSON alert messages. Add it to TradingView, create an alert from the indicator, choose "Any alert() function call", and add your webhook URL.

## Market Scanner

The scanner uses Finnhub quotes, rotates through a broad default universe in batches, filters the market before calling OpenAI, then asks OpenAI for strict JSON trade-plan signals for the top candidates.

Add both keys to `.env`:

```text
FINNHUB_API_KEY=your_finnhub_key_here
OPENAI_API_KEY=your_openai_key_here
```

Optional alert delivery settings:

```text
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
DISCORD_WEBHOOK_URL=your_discord_webhook_url
ENABLE_DESKTOP_NOTIFICATIONS=false
ALERT_EMAIL_TO=
EXECUTION_ACCOUNT_SIZE=10000
EXECUTION_RISK_PCT=0.5
EXECUTION_MAX_POSITION_PCT=20
```

Start the server:

```sh
npm start
```

Open the broad default scan:

```text
http://127.0.0.1:8787/scan
```

Open mode-specific boards:

```text
http://127.0.0.1:8787/scan?mode=intraday
http://127.0.0.1:8787/scan?mode=swing
http://127.0.0.1:8787/scan?mode=futures
http://127.0.0.1:8787/scan?mode=bitcoin
http://127.0.0.1:8787/scan?mode=all
```

Force the next rotating batch:

```text
http://127.0.0.1:8787/scan?refresh=1
```

Use a custom symbol list:

```text
http://127.0.0.1:8787/scan?symbols=AAPL,TSLA,NVDA
```

Get JSON output:

```text
http://127.0.0.1:8787/scan.json
```

Force a fresh scan instead of using the short cache:

```text
http://127.0.0.1:8787/scan?refresh=1
```

Read the latest cached scan:

```text
http://127.0.0.1:8787/scan/latest.json
```

Read the merged in-memory market state:

```text
http://127.0.0.1:8787/market/latest.json
http://127.0.0.1:8787/regime.json
```

Read the latest AI signals only:

```text
http://127.0.0.1:8787/signals/latest.json
http://127.0.0.1:8787/signals/latest.json?mode=intraday
http://127.0.0.1:8787/signals/intraday.json
http://127.0.0.1:8787/signals/swing.json
http://127.0.0.1:8787/signals/futures.json
http://127.0.0.1:8787/signals/take.json
http://127.0.0.1:8787/signals/watch.json
http://127.0.0.1:8787/signals/skip.json
http://127.0.0.1:8787/decisions/latest.json
```

Read priority alerts only:

```text
http://127.0.0.1:8787/alerts/latest.json
http://127.0.0.1:8787/alerts/intraday.json
http://127.0.0.1:8787/alerts/swing.json
http://127.0.0.1:8787/alerts/futures.json
http://127.0.0.1:8787/alerts/sent.json
```

Test Telegram/Discord delivery safely:

```sh
curl -X POST "http://127.0.0.1:8787/alerts/test"
```

Track signal outcomes in the journal:

```text
http://127.0.0.1:8787/journal.json
http://127.0.0.1:8787/journal/stats.json
```

Add a signal or manual trade:

```sh
curl -X POST "http://127.0.0.1:8787/journal/add" \
  -H "Content-Type: application/json" \
  -d '{"signal_id":"sig_example","ticker":"AAPL","mode":"intraday","bias":"bullish","entry":"190","stop":"187","target1":"194","target2":"198","confidence":8,"final_quality_score":74,"status":"open","execution_status":"entered","actual_entry":190.25,"notes":"Entered from Webull summary."}'
```

Update an outcome:

```sh
curl -X POST "http://127.0.0.1:8787/journal/update" \
  -H "Content-Type: application/json" \
  -d '{"signal_id":"sig_example","status":"closed","actual_exit":194.1,"outcome":"win","notes":"Target hit."}'
```

Journal data is saved locally at `data/journal.json`.

Read execution plans and sizing settings:

```text
http://127.0.0.1:8787/execution/plan.json
http://127.0.0.1:8787/execution/plan.json?mode=intraday
http://127.0.0.1:8787/execution/settings.json
```

Dashboard aggregation API routes:

```text
http://127.0.0.1:8787/api/dashboard/overview
http://127.0.0.1:8787/api/dashboard/signals?mode=intraday
http://127.0.0.1:8787/api/dashboard/alerts
http://127.0.0.1:8787/api/dashboard/execution
http://127.0.0.1:8787/api/dashboard/lifecycle
http://127.0.0.1:8787/api/dashboard/journal
http://127.0.0.1:8787/api/dashboard/settings
```

Track signal lifecycle:

```text
http://127.0.0.1:8787/lifecycle/latest.json
http://127.0.0.1:8787/lifecycle/open.json
http://127.0.0.1:8787/lifecycle/closed.json
```

Read the diversified scanner universe:

```text
http://127.0.0.1:8787/universe.json
```

Read live stock news for current top symbols:

```text
http://127.0.0.1:8787/news/latest.json
http://127.0.0.1:8787/news/latest.json?symbols=AMD,NVDA,TSLA
http://127.0.0.1:8787/news/latest.json?mode=swing
```

Auto-scan starts when the server starts. It runs one rotating batch every 3 minutes by default and skips ticks if a scan is already running.

Auto-scan status:

```text
http://127.0.0.1:8787/auto-scan/status.json
```

Control auto-scan:

```sh
curl -X POST "http://127.0.0.1:8787/auto-scan/run-now"
curl -X POST "http://127.0.0.1:8787/auto-scan/start"
curl -X POST "http://127.0.0.1:8787/auto-scan/stop"
```

Trigger a scan with a POST body:

```sh
curl -X POST "http://127.0.0.1:8787/scan/run" \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","TSLA","NVDA"]}'
```

Scanner pipeline:

- Default intraday universe is diversified across indexes, sector ETFs, international markets, commodities, bonds, currencies, and individual stocks.
- `mode=all` combines the intraday, swing, and futures-proxy universes.
- Fresh default scans rotate through 20-symbol batches.
- Supports `intraday`, `swing`, `futures`, and `all` scan modes.
- Supports `bitcoin` mode for Bitcoin-linked stocks/ETFs: `MSTR, COIN, GLXY, SQ, IREN, MARA, RIOT, CLSK, CIFR, WULF, BTDR, FUFU, HUT, BITF, BTBT, HIVE, CORZ, IBIT, GBTC, FBTC, BITO, ARKB, BITB, HODL, MSTU, MSBT, BITX, MSTY, BLOK, BKCH, BITQ, WGMI`.
- Futures mode currently uses liquid ETF/proxy instruments for futures-style direction.
- Fetches Finnhub quotes in small batches with short delays.
- Keeps a merged in-memory market state by ticker.
- Ignores stocks under `$5`.
- Prefers positive daily change and stronger intraday positioning.
- Keeps the top 10 candidates for OpenAI.
- Returns ranked candidates, AI signals, and Webull-ready manual trade summaries.
- Adds priority alerts when confidence is high, bias changes, confidence jumps, a ticker is new, or entry is close to current price.
- Adds market regime from SPY/QQQ, rough sector strength, entry-distance scoring, and a participation proxy.
- Adds `final_quality_score` to signals and alerts.
- Sends Telegram/Discord alerts only when `final_quality_score >= 70`, `confidence >= 7`, entry is close to current price, the signal is fresh, and the sent alert is not a duplicate.
- Adds `signal_id` to signals/alerts and file-based trade journaling at `data/journal.json`.
- Tracks journal performance by mode, bias, regime, and asset class.
- Adds execution plans with take/watch/skip guidance, risk dollars, suggested shares, position dollars, and reward-risk.
- Adds final decision hardening with `final_decision`, signal expiry, market session, and MTF confirmation placeholders.
- Sends Telegram/Discord alerts only for `final_decision=take` signals that are not expired.
- Adds price-based lifecycle tracking from signal to entered, target hit, stopped, expired, or closed.
- Auto-links lifecycle transitions into `data/journal.json` by `signal_id`.
- Adds a single local website command center at `/` with dark UI, tabs, filters, execution cards, lifecycle, journal, settings, and copy buttons for Webull workflow.
- Adds bull-run flags, buy triggers, sell triggers, 1-5 day swing hold windows, setup scores, and Webull-ready summaries.
- Shows a Live Stock News section using Finnhub company news for the current top alert/signal symbols.
- Caches scans briefly to avoid burning Finnhub/OpenAI calls on every page refresh.
- Auto-scans the next batch every 3 minutes while the server is running.

## Notes

This bridge is for analysis and workflow automation. It does not place trades. Keep order execution, broker credentials, and risk controls in a separate, carefully secured system.
