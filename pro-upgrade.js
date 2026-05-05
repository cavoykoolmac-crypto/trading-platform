/**
 * pro-upgrade.js
 * Wall Street grade signal engine upgrade.
 */

const CRYPTO_TOP10 = [
  { symbol: "BTCUSD", pair: "BTCUSDT", name: "Bitcoin", ticker: "BTC" },
  { symbol: "ETHUSD", pair: "ETHUSDT", name: "Ethereum", ticker: "ETH" },
  { symbol: "SOLUSD", pair: "SOLUSDT", name: "Solana", ticker: "SOL" },
  { symbol: "XRPUSD", pair: "XRPUSDT", name: "XRP", ticker: "XRP" },
  { symbol: "DOGEUSD", pair: "DOGEUSDT", name: "Dogecoin", ticker: "DOGE" },
  { symbol: "ADAUSD", pair: "ADAUSDT", name: "Cardano", ticker: "ADA" },
  { symbol: "AVAXUSD", pair: "AVAXUSDT", name: "Avalanche", ticker: "AVAX" },
  { symbol: "LINKUSD", pair: "LINKUSDT", name: "Chainlink", ticker: "LINK" },
  { symbol: "DOTUSD", pair: "DOTUSDT", name: "Polkadot", ticker: "DOT" },
  { symbol: "MATICUSD", pair: "MATICUSDT", name: "Polygon", ticker: "MATIC" },
];

const MOMENTUM_WATCHLIST = [
  "NVDA", "AAPL", "MSFT", "META", "GOOGL", "AMZN", "TSLA",
  "AMD", "COIN", "MSTR", "PLTR", "SMCI", "ARM", "AVGO", "MRVL",
  "SPY", "QQQ", "IWM", "SMH", "SOXX",
  "XLK", "XLF", "XLE", "XLV", "XBI",
  "MSTR", "COIN", "MARA", "RIOT", "IBIT",
];

const cache = new Map();
const TTL = {
  quote: 3000,
  crypto: 8000,
  momentum: 45000,
  gappers: 90000,
  volume: 90000,
};

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data);
  return fn().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

export async function getRealTimeQuote(symbol) {
  const normalized = String(symbol || "AAPL").toUpperCase();
  return cached(`quote:${normalized}`, TTL.quote, async () => {
    const moomooResult = await fetchMoomooQuote(normalized);
    if (moomooResult.ok) return moomooResult;
    return fetchFinnhubQuote(normalized);
  });
}

async function fetchMoomooQuote(symbol) {
  try {
    const host = process.env.MOOMOO_HOST || "127.0.0.1";
    const port = process.env.MOOMOO_PORT || "11111";
    const url = `http://${host}:${port}/api/quote/get_quote`;
    const res = await fetchTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          security_list: [{ market: 1, code: symbol.replace(/^(US\.|NASDAQ:|NYSE:)/i, "") }],
        }),
      },
      3000
    );

    if (!res.ok) throw new Error(`moomoo ${res.status}`);
    const data = await res.json();
    if (data.retType !== 0) throw new Error(data.retMsg);

    const q = data.s2c?.basicQotList?.[0];
    if (!q) throw new Error("no quote");

    const price = +q.curPrice;
    const prevClose = +q.lastClosePrice;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      ok: true,
      symbol,
      price,
      open: +q.openPrice,
      high: +q.highPrice,
      low: +q.lowPrice,
      volume: +q.volume,
      previousClose: prevClose,
      change: +(price - prevClose).toFixed(3),
      changePercent: +changePct.toFixed(3),
      source: "moomoo",
      realtime: true,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return { ok: false, symbol, source: "moomoo", realtime: false };
  }
}

async function fetchFinnhubQuote(symbol) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return { ok: false, symbol, error: "No Finnhub key" };
  try {
    const res = await fetchTimeout(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`, {}, 5000);
    const data = await res.json();
    const price = +data.c;
    const prev = +data.pc;
    const changePercent = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return {
      ok: true,
      symbol,
      price,
      open: +data.o,
      high: +data.h,
      low: +data.l,
      previousClose: prev,
      change: +(price - prev).toFixed(3),
      changePercent: +changePercent.toFixed(3),
      volume: 0,
      source: "finnhub",
      realtime: false,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, symbol, error: err.message };
  }
}

export async function getCryptoTop10() {
  return cached("crypto:top10", TTL.crypto, async () => {
    const results = await Promise.all(
      CRYPTO_TOP10.map((coin) =>
        fetchCryptoQuote(coin).catch(() => ({ ok: false, symbol: coin.symbol, name: coin.name }))
      )
    );
    const sorted = results
      .filter((result) => result.ok)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return {
      ok: true,
      coins: sorted,
      count: sorted.length,
      top_mover: sorted[0] || null,
      market_mood: deriveCryptoMood(sorted),
      timestamp: new Date().toISOString(),
    };
  });
}

async function fetchCryptoQuote(coin) {
  try {
    const sources = [
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${coin.pair}`,
      `https://api1.binance.com/api/v3/ticker/24hr?symbol=${coin.pair}`,
    ];

    let data = null;
    for (const url of sources) {
      try {
        const res = await fetchTimeout(url, { headers: { Accept: "application/json" } }, 5000);
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {
        // try next source
      }
    }

    if (!data?.lastPrice) throw new Error("No Binance data");

    const price = +data.lastPrice;
    const open = +data.openPrice;
    const changePct = +data.priceChangePercent;
    const vol = +data.volume;
    const volUSD = +data.quoteVolume;
    const signal = classifyCryptoSignal(changePct, price, open, volUSD);

    return {
      ok: true,
      symbol: coin.symbol,
      name: coin.name,
      ticker: coin.ticker,
      price,
      open,
      high: +data.highPrice,
      low: +data.lowPrice,
      previousClose: open,
      volume: vol,
      volumeUSD: volUSD,
      change: +data.priceChange,
      changePercent: changePct,
      signal,
      source: "binance",
      realtime: true,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, symbol: coin.symbol, name: coin.name, error: err.message };
  }
}

function classifyCryptoSignal(changePct, price, open, volUSD) {
  void price;
  void open;
  const isUp = changePct > 0;
  const strong = Math.abs(changePct) > 3;
  const highVol = volUSD > 500_000_000;

  if (isUp && strong && highVol) return "STRONG_BUY";
  if (isUp && strong) return "BUY";
  if (isUp && changePct > 1) return "WATCH_LONG";
  if (!isUp && strong && highVol) return "STRONG_SELL";
  if (!isUp && strong) return "SELL";
  if (!isUp && changePct < -1) return "WATCH_SHORT";
  return "NEUTRAL";
}

function deriveCryptoMood(coins) {
  const bullish = coins.filter((coin) => coin.changePercent > 0).length;
  const ratio = coins.length ? bullish / coins.length : 0;
  if (ratio >= 0.7) return "RISK_ON";
  if (ratio <= 0.3) return "RISK_OFF";
  return "MIXED";
}

export async function scoreSignalDualAI(signal) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const gptKey = process.env.OPENAI_API_KEY;
  if (!claudeKey && !gptKey) {
    return { ok: false, error: "No AI keys configured" };
  }

  const prompt = buildWallStreetPrompt(signal);
  const [claudeResult, gptResult] = await Promise.allSettled([
    claudeKey ? callClaude(prompt) : Promise.reject(new Error("no claude key")),
    gptKey ? callGPT(prompt) : Promise.reject(new Error("no gpt key")),
  ]);

  const claudeOk = claudeResult.status === "fulfilled";
  const gptOk = gptResult.status === "fulfilled";
  if (!claudeOk && !gptOk) {
    return { ok: false, error: "Both AIs failed" };
  }

  const claudeScore = claudeOk ? parseAIScore(claudeResult.value) : null;
  const gptScore = gptOk ? parseAIScore(gptResult.value) : null;
  return mergeAIScores(signal, claudeScore, gptScore);
}

function buildWallStreetPrompt(signal) {
  const ind = signal.indicators || {};
  return `
You are a Wall Street quantitative analyst scoring a trade setup.
Be direct, precise, and data-driven. No generic advice.

SIGNAL DATA:
Ticker: ${signal.ticker}
Bias: ${signal.bias || "bullish"}
Entry: ${signal.entry}
Stop: ${signal.stop}
Target 1: ${signal.target1}
Target 2: ${signal.target2}
Confidence: ${signal.confidence}/10
Quality Score: ${signal.final_quality_score || "N/A"}
Trend Label: ${signal.trend_label || "N/A"}
Momentum Reason: ${signal.momentum_reason || "N/A"}

TECHNICAL INDICATORS:
RSI: ${ind.rsi || "N/A"}
EMA 9: ${ind.ema_fast || "N/A"} | EMA 21: ${ind.ema_slow || "N/A"}
EMA Uptrend: ${ind.ema_uptrend ?? "N/A"}
Above VWAP: ${ind.above_vwap ?? "N/A"}
Volume Ratio: ${ind.volume_ratio || "N/A"}x
Volume Spike: ${ind.volume_spike ?? "N/A"}
ATR: ${ind.atr || "N/A"} (${ind.atr_pct || "N/A"}%)
Momentum Score: ${ind.computed_momentum_score || "N/A"}/100

TASK:
Score this setup on 5 dimensions (0-10 each):
1. trend_alignment: Is the EMA/VWAP/RSI combination confirming the bias?
2. entry_quality: Is entry price optimal? Not too far from current price?
3. risk_reward: Is the R:R ratio worth taking?
4. momentum_strength: Is there real momentum or just hope?
5. timing: Is NOW the right time to enter?

Then give:
- final_verdict: TAKE | WATCH | SKIP
- conviction: HIGH | MEDIUM | LOW
- max_loss_ok: true/false (would you risk $50 on this?)
- one_line: A single sentence verdict a trader can act on immediately

Return ONLY valid JSON. No prose outside JSON:
{
  "trend_alignment": 0-10,
  "entry_quality": 0-10,
  "risk_reward": 0-10,
  "momentum_strength": 0-10,
  "timing": 0-10,
  "composite_score": 0-100,
  "final_verdict": "TAKE|WATCH|SKIP",
  "conviction": "HIGH|MEDIUM|LOW",
  "max_loss_ok": true/false,
  "one_line": "string",
  "key_risk": "string",
  "best_case": "string"
}`.trim();
}

function parseAIScore(text) {
  try {
    const clean = String(text || "").replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}

function mergeAIScores(signal, claude, gpt) {
  const both = [claude, gpt].filter(Boolean);
  const one = both[0];

  if (!both.length) return { ok: false, error: "No AI scores parsed" };
  if (both.length === 1) {
    return {
      ok: true,
      ticker: signal.ticker,
      ...one,
      provider: claude ? "claude_only" : "gpt_only",
      agreement: null,
      collab: false,
    };
  }

  const avg = (field) => Math.round((claude[field] + gpt[field]) / 2);
  const composite = Math.round(
    (avg("trend_alignment") * 25 +
      avg("entry_quality") * 20 +
      avg("risk_reward") * 20 +
      avg("momentum_strength") * 20 +
      avg("timing") * 15) / 10
  );

  const verdicts = [claude.final_verdict, gpt.final_verdict];
  const agree = verdicts[0] === verdicts[1];
  const finalVerdict = agree ? verdicts[0] : "WATCH";

  const convictions = [claude.conviction, gpt.conviction];
  const conviction = agree && convictions[0] === convictions[1]
    ? convictions[0]
    : convictions.includes("HIGH") && agree
      ? "HIGH"
      : "MEDIUM";

  return {
    ok: true,
    ticker: signal.ticker,
    collab: true,
    provider: "claude+gpt",
    agreement: agree,
    final_verdict: finalVerdict,
    conviction,
    composite_score: composite,
    max_loss_ok: Boolean(claude.max_loss_ok && gpt.max_loss_ok),
    trend_alignment: avg("trend_alignment"),
    entry_quality: avg("entry_quality"),
    risk_reward: avg("risk_reward"),
    momentum_strength: avg("momentum_strength"),
    timing: avg("timing"),
    claude_verdict: claude.final_verdict,
    gpt_verdict: gpt.final_verdict,
    claude_score: claude.composite_score,
    gpt_score: gpt.composite_score,
    claude_one_line: claude.one_line,
    gpt_one_line: gpt.one_line,
    one_line: agree
      ? claude.one_line
      : `Claude: ${claude.one_line} | GPT: ${gpt.one_line}`,
    key_risk: claude.key_risk || gpt.key_risk,
    best_case: claude.best_case || gpt.best_case,
    agreement_note: agree
      ? `Both AIs say ${finalVerdict} - ${conviction} conviction`
      : `AIs disagree (Claude: ${claude.final_verdict}, GPT: ${gpt.final_verdict}) - defaulting to WATCH`,
    timestamp: new Date().toISOString(),
  };
}

export async function getPreMarketGappers() {
  return cached("gappers", TTL.gappers, async () => {
    const quotes = await Promise.all(MOMENTUM_WATCHLIST.map((symbol) => getRealTimeQuote(symbol).catch(() => null)));
    const gappers = quotes
      .filter((quote) => quote?.ok && Math.abs(quote.changePercent) >= 1.5)
      .map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        changePercent: quote.changePercent,
        direction: quote.changePercent > 0 ? "GAP_UP" : "GAP_DOWN",
        source: quote.source,
      }))
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return {
      ok: true,
      gappers,
      gap_up: gappers.filter((gap) => gap.direction === "GAP_UP"),
      gap_down: gappers.filter((gap) => gap.direction === "GAP_DOWN"),
      count: gappers.length,
      timestamp: new Date().toISOString(),
    };
  });
}

export async function getUnusualVolume() {
  return cached("volume", TTL.volume, async () => {
    const quotes = await Promise.all(MOMENTUM_WATCHLIST.map((symbol) => getRealTimeQuote(symbol).catch(() => null)));
    const withVolume = quotes.filter((quote) => quote?.ok && quote.volume > 0);
    const unusual = withVolume
      .filter((quote) => Math.abs(quote.changePercent) >= 2)
      .map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
        source: quote.source,
        flag: Math.abs(quote.changePercent) >= 4 ? "EXTREME" : "HIGH",
      }))
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return {
      ok: true,
      unusual_volume: unusual,
      count: unusual.length,
      timestamp: new Date().toISOString(),
    };
  });
}

export async function getRankedMomentum() {
  return cached("momentum", TTL.momentum, async () => {
    const stockPromises = MOMENTUM_WATCHLIST.map((symbol) => getRealTimeQuote(symbol).catch(() => null));
    const [stockQuotes, cryptoData] = await Promise.all([
      Promise.all(stockPromises),
      getCryptoTop10().catch(() => ({ coins: [] })),
    ]);

    const stocks = stockQuotes
      .filter((quote) => quote?.ok)
      .map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        changePercent: quote.changePercent,
        assetClass: "equity",
        momentumScore: calcMomentumScore(quote.changePercent),
        signal: quote.changePercent > 2 ? "BULLISH" : quote.changePercent < -2 ? "BEARISH" : "NEUTRAL",
        source: quote.source,
      }));

    const crypto = (cryptoData.coins || []).map((coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      changePercent: coin.changePercent,
      assetClass: "crypto",
      momentumScore: calcMomentumScore(coin.changePercent),
      signal: coin.signal,
      source: coin.source,
    }));

    const all = [...stocks, ...crypto].sort((a, b) => b.momentumScore - a.momentumScore);

    return {
      ok: true,
      ranked: all,
      top_5: all.slice(0, 5),
      bullish: all.filter((item) => ["BULLISH", "STRONG_BUY", "BUY"].includes(item.signal)),
      bearish: all.filter((item) => ["BEARISH", "STRONG_SELL", "SELL"].includes(item.signal)),
      crypto_mood: cryptoData.market_mood || "UNKNOWN",
      timestamp: new Date().toISOString(),
    };
  });
}

function calcMomentumScore(changePct) {
  const abs = Math.abs(Number(changePct) || 0);
  return Math.min(100, Math.round(50 + abs * 8));
}

async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  const res = await fetchTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    30000
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Claude ${res.status}`);
  return data.content?.filter((block) => block.type === "text").map((block) => block.text).join("") || "";
}

async function callGPT(prompt) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetchTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a quantitative trading analyst. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 600,
        temperature: 0.2,
      }),
    },
    30000
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `GPT ${res.status}`);
  return data.choices?.[0]?.message?.content || "";
}

function fetchTimeout(url, options = {}, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

setTimeout(() => {
  getCryptoTop10().catch(() => {});
  getRankedMomentum().catch(() => {});
}, 5000);
