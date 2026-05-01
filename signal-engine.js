const ENGINE_CONFIG = {
  candleCount: 50,
  emaFastPeriod: 9,
  emaSlowPeriod: 21,
  rsiPeriod: 14,
  atrPeriod: 14,
  volumeLookback: 20,
  minCandlesRequired: 22,
  maxConcurrent: 4,
  requestDelayMs: 250
};

const YAHOO_RANGE = "2d";
const YAHOO_INTERVAL = "5m";

export async function enrichCandidatesWithIndicators(candidates, finnhubApiKey) {
  if (!candidates?.length) return candidates;

  const results = [];
  for (let index = 0; index < candidates.length; index += ENGINE_CONFIG.maxConcurrent) {
    const batch = candidates.slice(index, index + ENGINE_CONFIG.maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((candidate) => enrichOneCandidate(candidate, finnhubApiKey))
    );
    results.push(...batchResults);
    if (index + ENGINE_CONFIG.maxConcurrent < candidates.length) {
      await sleep(ENGINE_CONFIG.requestDelayMs);
    }
  }
  return results;
}

export function buildSignalPromptInstructions(request) {
  return [
    "You are a trading signal engine reviewing pre-filtered market scanner candidates.",
    "Be concise, practical, and risk-aware.",
    "Do not provide personalized financial advice and do not place trades.",
    "Return strict JSON only. No markdown, no prose outside JSON.",
    `Scanner mode: ${request.modeConfig.label}. Focus: ${request.modeConfig.promptFocus}.`,
    `Default hold window: ${request.modeConfig.holdWindow}. Asset class: ${request.modeConfig.assetClass}.`,
    "IMPORTANT: Each candidate now includes a computed indicators field with real technical data.",
    "You MUST use the indicators field to drive your signal. Do NOT invent indicator values.",
    "confidence rules (hard rules):",
    "  confidence >= 7: ema_uptrend=true AND rsi 40-68 AND above_vwap=true AND volume_spike=true.",
    "  confidence 5-6: at least 3 of those 4 conditions.",
    "  confidence <= 4: data_insufficient=true OR rsi > 75 OR ema_downtrend with bullish bias.",
    "  For futures mode (asset_class=futures): confidence >= 5 is acceptable for a watch signal; confidence >= 6 with RR >= 1.0 qualifies as take.",
    "  If indicators.confidence_cap exists it overrides all other confidence values.",
    "  For bearish bias reverse EMA and VWAP conditions.",
    "entry/stop/target rules:",
    "  Use atr_stop_long, atr_target1_long, atr_target2_long as base for longs.",
    "  Use atr_stop_short, atr_target1_short as base for shorts.",
    "  Adjust up to 15% for chart context but never beyond 2x ATR from the anchor.",
    "  If candle_source is quote_derived cap confidence at indicators.confidence_cap.",
    "setup_score and momentum_score:",
    "  Use computed_momentum_score as starting point for momentum_score.",
    "  setup_score > 75 only if ema_uptrend AND above_vwap AND rsi 45-68 all true.",
    "  setup_score > 85 requires all above PLUS ema_bullish_cross=true AND volume_spike=true.",
    "trend_label must be one of: strong uptrend, breakout, continuation, early trend.",
    "  breakout: ema_bullish_cross=true AND volume_spike=true.",
    "  strong uptrend: ema_uptrend=true AND rsi 55-68 AND above_vwap=true.",
    "  continuation: ema_uptrend=true no fresh cross.",
    "  early trend: rsi_oversold=true OR small ema_gap_pct with uptrend.",
    "Return array of objects with exactly these keys:",
    "ticker, bias, entry, stop, target1, target2, confidence, reason, invalid_if,",
    "buy_trigger, sell_trigger, bull_run_flag, hold_window, setup_score,",
    "momentum_score, trend_label, momentum_reason.",
    "confidence: 1-10. setup_score: 1-100. momentum_score: 0-100.",
    "momentum_reason: plain English citing the actual indicator evidence.",
    "bull_run_flag: true only if ema_uptrend AND above_vwap AND rsi 50-70."
  ];
}

async function enrichOneCandidate(candidate, finnhubApiKey) {
  const symbol = candidate.symbol || candidate.ticker;
  if (!symbol) {
    return { ...candidate, indicators: { data_insufficient: true, reason: "no_symbol" } };
  }

  if (isCryptoSymbol(symbol)) {
    return { ...candidate, indicators: buildCryptoFallbackIndicators(candidate) };
  }

  try {
    const candles = await fetchCandlesYahoo(symbol);
    if (candles && candles.close.length >= ENGINE_CONFIG.minCandlesRequired) {
      const indicators = computeIndicators(candles);
      indicators.candle_source = "yahoo";
      return { ...candidate, indicators };
    }
  } catch {
    // Fall through.
  }

  if (finnhubApiKey) {
    try {
      const candles = await fetchCandlesFinnhub(symbol, finnhubApiKey);
      if (candles && candles.close.length >= ENGINE_CONFIG.minCandlesRequired) {
        const indicators = computeIndicators(candles);
        indicators.candle_source = "finnhub";
        return { ...candidate, indicators };
      }
    } catch {
      // Fall through.
    }
  }

  const quoteFallback = buildQuoteFallbackIndicators(candidate);
  if (quoteFallback) {
    return { ...candidate, indicators: quoteFallback };
  }

  return {
    ...candidate,
    indicators: { data_insufficient: true, reason: "all_sources_failed", confidence_cap: 3 }
  };
}

async function fetchCandlesYahoo(symbol) {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${YAHOO_INTERVAL}&range=${YAHOO_RANGE}&includePrePost=false`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; trading-scanner/1.0)",
      Accept: "application/json"
    }
  });

  if (!response.ok) throw new Error(`Yahoo ${response.status}`);

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo: no result");

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || !timestamps.length) throw new Error("Yahoo: empty quote");

  const close = [];
  const high = [];
  const low = [];
  const open = [];
  const volume = [];
  const ts = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const c = quote.close?.[index];
    const h = quote.high?.[index];
    const l = quote.low?.[index];
    const o = quote.open?.[index];
    if (c == null || h == null || l == null || o == null) continue;
    close.push(c);
    high.push(h);
    low.push(l);
    open.push(o);
    volume.push(quote.volume?.[index] ?? 0);
    ts.push(timestamps[index]);
  }

  if (!close.length) throw new Error("Yahoo: all nulls");

  const limit = ENGINE_CONFIG.candleCount;
  return {
    close: close.slice(-limit),
    high: high.slice(-limit),
    low: low.slice(-limit),
    open: open.slice(-limit),
    volume: volume.slice(-limit),
    timestamp: ts.slice(-limit)
  };
}

async function fetchCandlesFinnhub(symbol, apiKey) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - ENGINE_CONFIG.candleCount * 5 * 60 * 2;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=5&from=${from}&to=${now}&token=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Finnhub ${response.status}`);

  const data = await response.json();
  if (data.s !== "ok" || !Array.isArray(data.c) || !data.c.length) throw new Error("Finnhub: no data");

  const limit = ENGINE_CONFIG.candleCount;
  return {
    close: data.c.slice(-limit),
    high: data.h.slice(-limit),
    low: data.l.slice(-limit),
    open: data.o.slice(-limit),
    volume: data.v.slice(-limit),
    timestamp: data.t.slice(-limit)
  };
}

function computeIndicators(candles) {
  const { close, high, low } = candles;
  const volume = normalizeVolumeSeries(candles.volume);
  const len = close.length;
  const price = close[len - 1];

  const emaFastArr = calcEMA(close, ENGINE_CONFIG.emaFastPeriod);
  const emaSlowArr = calcEMA(close, ENGINE_CONFIG.emaSlowPeriod);
  const emaFastNow = emaFastArr[emaFastArr.length - 1];
  const emaFastPrev = emaFastArr[emaFastArr.length - 2] ?? emaFastNow;
  const emaSlowNow = emaSlowArr[emaSlowArr.length - 1];
  const emaSlowPrev = emaSlowArr[emaSlowArr.length - 2] ?? emaSlowNow;

  const rsiArr = calcRSI(close, ENGINE_CONFIG.rsiPeriod);
  const rsi = rsiArr[rsiArr.length - 1];

  const vwapArr = calcVWAP(high, low, close, volume);
  const vwapNow = vwapArr[vwapArr.length - 1];

  const volSlice = volume.slice(-ENGINE_CONFIG.volumeLookback - 1, -1);
  const avgVol = volSlice.length ? mean(volSlice) : 1;
  const curVol = volume[len - 1];
  const volRatio = avgVol > 0 ? curVol / avgVol : 1;

  const atrArr = calcATR(high, low, close, ENGINE_CONFIG.atrPeriod);
  const atrNow = atrArr[atrArr.length - 1];
  const atrPct = price > 0 ? (atrNow / price) * 100 : 0;

  const emaUp = emaFastNow > emaSlowNow;
  const emaBullishCross = emaFastNow > emaSlowNow && emaFastPrev <= emaSlowPrev;
  const emaBearishCross = emaFastNow < emaSlowNow && emaFastPrev >= emaSlowPrev;
  const emaGapPct = emaSlowNow > 0 ? ((emaFastNow - emaSlowNow) / emaSlowNow) * 100 : 0;
  const aboveVWAP = price > vwapNow;
  const volSpike = volRatio >= 1.4;

  let score = 50;
  if (emaUp) score += 12;
  if (emaBullishCross) score += 10;
  if (rsi > 50 && rsi < 70) score += 10;
  if (rsi <= 35) score += 8;
  if (aboveVWAP) score += 10;
  if (volSpike) score += 8;
  if (!emaUp) score -= 15;
  if (rsi > 72) score -= 12;
  const momentumScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    rsi: r2(rsi),
    ema_fast: r2(emaFastNow),
    ema_slow: r2(emaSlowNow),
    vwap: r2(vwapNow),
    atr: r2(atrNow),
    atr_pct: r2(atrPct),
    volume_ratio: r2(volRatio),
    current_volume: Math.round(curVol),
    avg_volume: Math.round(avgVol),
    ema_uptrend: emaUp,
    ema_downtrend: !emaUp,
    ema_bullish_cross: emaBullishCross,
    ema_bearish_cross: emaBearishCross,
    ema_gap_pct: r2(emaGapPct),
    above_vwap: aboveVWAP,
    below_vwap: !aboveVWAP,
    volume_spike: volSpike,
    rsi_oversold: rsi <= 35,
    rsi_overbought: rsi >= 70,
    rsi_neutral: rsi > 35 && rsi < 70,
    computed_momentum_score: momentumScore,
    atr_stop_long: r2(price - 1.5 * atrNow),
    atr_target1_long: r2(price + 2.0 * atrNow),
    atr_target2_long: r2(price + 3.5 * atrNow),
    atr_stop_short: r2(price + 1.5 * atrNow),
    atr_target1_short: r2(price - 2.0 * atrNow),
    candle_count: len,
    data_insufficient: false
  };
}

function normalizeVolumeSeries(values) {
  if (!Array.isArray(values) || !values.length) return [];

  const normalized = values.map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  });

  const positiveBars = normalized.filter((value) => value > 0);
  const fallback = positiveBars.length ? mean(positiveBars) : 0;

  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] > 0) continue;

    const previousPositive = normalized.slice(0, index).reverse().find((value) => value > 0);
    const nextPositive = normalized.slice(index + 1).find((value) => value > 0);
    normalized[index] = previousPositive || nextPositive || fallback;
  }

  return normalized;
}

function buildQuoteFallbackIndicators(candidate) {
  const price = Number(candidate.current || candidate.price || 0);
  const high = Number(candidate.high || price);
  const low = Number(candidate.low || price);
  const open = Number(candidate.open || price);
  const changePct = Number(candidate.changePercent || candidate.change_percent || 0);

  if (!price || price <= 0) return null;

  const rsiEst = Math.min(80, Math.max(20, 50 + changePct * 4));
  const midpoint = (high + low) / 2;
  const aboveVWAP = price > midpoint;
  const emaUp = changePct > 0 && price >= open;
  const rangeAtr = high > low ? (high - low) : price * 0.01;
  const atrEst = Math.max(rangeAtr, price * 0.005);

  let score = 50;
  if (emaUp) score += 10;
  if (changePct > 1) score += 8;
  if (aboveVWAP) score += 8;
  if (rsiEst > 50 && rsiEst < 70) score += 8;
  if (!emaUp) score -= 12;
  if (rsiEst > 72) score -= 10;

  return {
    rsi: r2(rsiEst),
    ema_fast: r2(price),
    ema_slow: r2(price * 0.999),
    vwap: r2(midpoint),
    atr: r2(atrEst),
    atr_pct: r2((atrEst / price) * 100),
    volume_ratio: 1,
    current_volume: 0,
    avg_volume: 0,
    ema_uptrend: emaUp,
    ema_downtrend: !emaUp,
    ema_bullish_cross: false,
    ema_bearish_cross: false,
    ema_gap_pct: 0,
    above_vwap: aboveVWAP,
    below_vwap: !aboveVWAP,
    volume_spike: false,
    rsi_oversold: rsiEst <= 35,
    rsi_overbought: rsiEst >= 70,
    rsi_neutral: rsiEst > 35 && rsiEst < 70,
    computed_momentum_score: Math.max(0, Math.min(100, Math.round(score))),
    atr_stop_long: r2(price - 1.5 * atrEst),
    atr_target1_long: r2(price + 2.0 * atrEst),
    atr_target2_long: r2(price + 3.5 * atrEst),
    atr_stop_short: r2(price + 1.5 * atrEst),
    atr_target1_short: r2(price - 2.0 * atrEst),
    candle_count: 0,
    data_insufficient: false,
    candle_source: "quote_derived",
    note: "Estimated from daily quote snapshot - candle sources unavailable. Lower accuracy.",
    confidence_cap: 5
  };
}

function buildCryptoFallbackIndicators(candidate) {
  const changePct = Number(candidate.changePercent || candidate.change_percent || 0);
  const intraday = Number(candidate.intraday_position || 0.5);
  return {
    data_insufficient: false,
    candle_source: "quote_derived_crypto",
    rsi: changePct > 3 ? 62 : changePct < -3 ? 38 : 50,
    ema_uptrend: changePct > 0,
    ema_downtrend: changePct < 0,
    above_vwap: intraday > 0.5,
    below_vwap: intraday <= 0.5,
    volume_spike: false,
    volume_ratio: 1,
    computed_momentum_score: Math.min(100, Math.max(0, 50 + changePct * 3)),
    note: "Crypto: quote-derived estimates only.",
    confidence_cap: 5
  };
}

function calcEMA(values, period) {
  if (values.length < period) {
    const seed = mean(values);
    return values.map(() => seed);
  }
  const k = 2 / (period + 1);
  let ema = mean(values.slice(0, period));
  const out = new Array(period).fill(ema);
  for (let index = period; index < values.length; index += 1) {
    ema = values[index] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function calcRSI(closes, period) {
  if (closes.length < period + 2) return closes.map(() => 50);
  let gainAccumulator = 0;
  let lossAccumulator = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff >= 0) gainAccumulator += diff;
    else lossAccumulator -= diff;
  }
  let avgGain = gainAccumulator / period;
  let avgLoss = lossAccumulator / period;
  const out = new Array(period + 1).fill(50);
  for (let index = period + 1; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out.push(100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));
  }
  return out;
}

function calcVWAP(highs, lows, closes, volumes) {
  let cumTPV = 0;
  let cumVol = 0;
  return closes.map((_, index) => {
    const typicalPrice = (highs[index] + lows[index] + closes[index]) / 3;
    cumTPV += typicalPrice * (volumes[index] || 0);
    cumVol += volumes[index] || 0;
    return cumVol > 0 ? cumTPV / cumVol : closes[index];
  });
}

function calcATR(highs, lows, closes, period) {
  const trueRanges = highs.map((high, index) => index === 0
    ? high - lows[index]
    : Math.max(high - lows[index], Math.abs(high - closes[index - 1]), Math.abs(lows[index] - closes[index - 1])));
  if (trueRanges.length < period) return trueRanges.map(() => trueRanges[0] || 0);
  let atr = mean(trueRanges.slice(0, period));
  const out = new Array(period).fill(atr);
  for (let index = period; index < trueRanges.length; index += 1) {
    atr = (atr * (period - 1) + trueRanges[index]) / period;
    out.push(atr);
  }
  return out;
}

function mean(arr) {
  return arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : 0;
}

function r2(value) {
  return Math.round(value * 100) / 100;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCryptoSymbol(symbol) {
  return /USD$/.test(symbol) || ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "LINK", "MATIC", "LTC", "SHIB"].includes(symbol);
}

function toYahooSymbol(symbol) {
  return { "BRK.B": "BRK-B", "BRK.A": "BRK-A" }[symbol] || symbol;
}
