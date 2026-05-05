import net from "node:net";

const OPEND_HOST = process.env.MOOMOO_HOST || "127.0.0.1";
const OPEND_PORT = parseInt(process.env.MOOMOO_PORT || "11111", 10);

const KL_TYPE = {
  "1": 1,
  "5": 5,
  "15": 15,
  "30": 30,
  "60": 60,
  D: 1000,
  W: 2000,
};

const quoteCache = new Map();
const QUOTE_TTL = 3000;
const CANDLE_TTL = 10000;

export async function getMoomooQuote(symbol) {
  const normalized = String(symbol || "AAPL").trim().toUpperCase();
  const cacheKey = `quote:${normalized}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < QUOTE_TTL) {
    return { ...cached.data, from_cache: true };
  }

  try {
    const result = await fetchQuoteHTTP(normalized);
    quoteCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    return fetchFinnhubFallback(normalized, err.message);
  }
}

export async function getMomooBatch(symbols) {
  const list = Array.isArray(symbols) ? symbols : String(symbols || "").split(",");
  const results = await Promise.all(
    list.map((symbol) => getMoomooQuote(String(symbol || "").trim().toUpperCase()))
  );
  return {
    ok: true,
    quotes: results,
    count: results.length,
    timestamp: new Date().toISOString(),
  };
}

export async function getMoomooCandles(symbol, interval = "5") {
  const normalized = String(symbol || "AAPL").trim().toUpperCase();
  const normalizedInterval = String(interval || "5").toUpperCase();
  const cacheKey = `candles:${normalized}:${normalizedInterval}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CANDLE_TTL) {
    return { ...cached.data, from_cache: true };
  }

  try {
    const result = await fetchCandlesHTTP(normalized, normalizedInterval);
    quoteCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    return fetchYahooCandleFallback(normalized, normalizedInterval, err.message);
  }
}

export async function getMoomooStatus() {
  try {
    const quote = await getMoomooQuote("AAPL");
    return {
      ok: quote.ok && quote.source === "moomoo_opend",
      connected: quote.source === "moomoo_opend",
      host: OPEND_HOST,
      port: OPEND_PORT,
      fallback_active: quote.source !== "moomoo_opend",
      test_symbol: "AAPL",
      test_price: quote.price ?? null,
      source: quote.source,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      connected: false,
      error: err.message,
      host: OPEND_HOST,
      port: OPEND_PORT,
    };
  }
}

async function fetchQuoteHTTP(symbol) {
  const moomooSymbol = toMoomooSymbol(symbol);
  const url = `http://${OPEND_HOST}:${OPEND_PORT}/api/quote/get_quote`;
  const body = {
    security_list: [{ market: 1, code: moomooSymbol }],
  };

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    1500
  );

  if (!response.ok) throw new Error(`OpenD HTTP ${response.status}`);

  const data = await response.json();
  if (data.retType !== 0) {
    throw new Error(`OpenD error: ${data.retMsg || "unknown"}`);
  }

  const quote = data.s2c?.basicQotList?.[0];
  if (!quote) throw new Error("No quote data returned");

  const price = Number(quote.curPrice || 0);
  const open = Number(quote.openPrice || 0);
  const high = Number(quote.highPrice || 0);
  const low = Number(quote.lowPrice || 0);
  const prevClose = Number(quote.lastClosePrice || 0);
  const volume = Number(quote.volume || 0);
  const changeAmt = price - prevClose;
  const changePct = prevClose > 0 ? (changeAmt / prevClose) * 100 : 0;

  return {
    ok: true,
    symbol,
    price,
    open,
    high,
    low,
    volume,
    previousClose: prevClose,
    change: Number(changeAmt.toFixed(3)),
    changePercent: Number(changePct.toFixed(3)),
    turnover: Number(quote.turnover || 0),
    amplitude: Number(quote.amplitude || 0),
    source: "moomoo_opend",
    realtime: true,
    timestamp: new Date().toISOString(),
  };
}

async function fetchCandlesHTTP(symbol, interval) {
  const moomooSymbol = toMoomooSymbol(symbol);
  const klType = KL_TYPE[String(interval)] || 5;
  const url = `http://${OPEND_HOST}:${OPEND_PORT}/api/quote/get_kl`;
  const body = {
    security: { market: 1, code: moomooSymbol },
    klType,
    reqNum: 200,
    rehabType: 1,
  };

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    8000
  );

  if (!response.ok) throw new Error(`OpenD candles HTTP ${response.status}`);

  const data = await response.json();
  if (data.retType !== 0) throw new Error(`OpenD candles error: ${data.retMsg}`);

  const klList = data.s2c?.klList || [];
  const candles = klList
    .map((k) => ({
      time: parseTimestamp(k.time) * 1000,
      open: Number(k.openPrice),
      high: Number(k.highPrice),
      low: Number(k.lowPrice),
      close: Number(k.closePrice),
      volume: Number(k.volume),
    }))
    .filter((candle) => candle.close > 0);

  return {
    ok: true,
    symbol,
    interval,
    candles,
    count: candles.length,
    source: "moomoo_opend",
    realtime: true,
    timestamp: new Date().toISOString(),
  };
}

async function fetchFinnhubFallback(symbol, reason) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return { ok: false, symbol, error: "OpenD unreachable and no Finnhub key: " + reason };
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const res = await fetchWithTimeout(url, {}, 5000);
    const data = await res.json();
    return {
      ok: true,
      symbol,
      price: Number(data.c || 0),
      open: Number(data.o || 0),
      high: Number(data.h || 0),
      low: Number(data.l || 0),
      previousClose: Number(data.pc || 0),
      change: Number((data.c - data.pc).toFixed(3)),
      changePercent: Number((((data.c - data.pc) / data.pc) * 100).toFixed(3)),
      volume: 0,
      source: "finnhub_fallback",
      realtime: false,
      fallback_reason: reason,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, symbol, error: "Both OpenD and Finnhub failed: " + err.message };
  }
}

async function fetchYahooCandleFallback(symbol, interval, reason) {
  try {
    const intervalMap = { "1": "1m", "5": "5m", "15": "15m", "30": "30m", "60": "1h", D: "1d" };
    const yahooInterval = intervalMap[String(interval)] || "5m";
    const range = yahooInterval === "1d" ? "1y" : "5d";
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${yahooInterval}&range=${range}&includePrePost=false`;

    const res = await fetchWithTimeout(
      url,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      },
      8000
    );

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("No Yahoo data");

    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const candles = [];
    for (let i = 0; i < ts.length; i += 1) {
      const close = q.close?.[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const open = q.open?.[i];
      if (close == null || high == null) continue;
      candles.push({
        time: ts[i] * 1000,
        open: open || close,
        high,
        low: low || close,
        close,
        volume: q.volume?.[i] || 0,
      });
    }

    return {
      ok: true,
      symbol,
      interval,
      candles,
      count: candles.length,
      source: "yahoo_fallback",
      realtime: false,
      fallback_reason: reason,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, symbol, error: "Both OpenD and Yahoo failed: " + err.message };
  }
}

function toMoomooSymbol(symbol) {
  return String(symbol || "")
    .replace(/^(US\.|NASDAQ:|NYSE:)/i, "")
    .toUpperCase();
}

function parseTimestamp(timeStr) {
  if (!timeStr) return Math.floor(Date.now() / 1000);
  const date = new Date(timeStr.replace(" ", "T") + (timeStr.includes("Z") ? "" : "-04:00"));
  return Math.floor(date.getTime() / 1000);
}

function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

void net;
