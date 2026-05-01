const briefingCache = { data: null, cachedAt: 0 };
const BRIEFING_TTL_MS = 30 * 60 * 1000;

export async function shouldITakeThis(payload, state, openaiKey, finnhubKey) {
  const ticker = String(payload.ticker || payload.symbol || "").toUpperCase();
  const signalId = String(payload.signal_id || "");

  if (!ticker && !signalId) {
    return { ok: false, error: "Provide ticker or signal_id." };
  }

  const signal = findSignalInState(state, signalId, ticker);
  if (!signal) {
    return { ok: false, error: `No active signal found for ${ticker || signalId}. Run a scan first.` };
  }

  const livePrice = await fetchLivePrice(signal.ticker, finnhubKey);
  const entryNum = parseFloat(signal.entry) || null;
  const distanceFromEntry = entryNum && livePrice
    ? (((livePrice - entryNum) / entryNum) * 100).toFixed(2)
    : null;

  const context = {
    ticker: signal.ticker,
    live_price: livePrice,
    entry: signal.entry,
    stop: signal.stop,
    target1: signal.target1,
    target2: signal.target2,
    bias: signal.bias,
    final_decision: signal.final_decision,
    confidence: signal.confidence,
    final_quality_score: signal.final_quality_score,
    setup_score: signal.setup_score,
    momentum_score: signal.momentum_score,
    trend_label: signal.trend_label,
    momentum_reason: signal.momentum_reason,
    bull_run_flag: signal.bull_run_flag,
    expired_flag: signal.expired_flag,
    distance_from_entry_pct: distanceFromEntry,
    buy_trigger: signal.buy_trigger,
    sell_trigger: signal.sell_trigger,
    invalid_if: signal.invalid_if,
    market_regime: state.marketRegime,
    indicators: signal.indicators || null,
    recent_news: signal.injected_news || [],
    account_size: Number(process.env.EXECUTION_ACCOUNT_SIZE || 10000),
    risk_pct: Number(process.env.EXECUTION_RISK_PCT || 0.5)
  };

  const instructions = [
    "You are a direct, plain-English trading decision assistant.",
    "The trader is looking at a live signal right now and wants to know: BUY NOW, WAIT, or SKIP.",
    "Give a single clear verdict first (one of: BUY NOW / WAIT / SKIP), then 3-5 bullet reasons.",
    "BUY NOW: live price within 0.5% of entry, confidence >= 7, quality >= 70, not expired, trend aligned.",
    "WAIT: signal is valid but price has moved away from entry, or one key condition is weak - tell them exactly what to watch for.",
    "SKIP: confidence < 5, expired, or indicators show the setup has broken down.",
    "Always include: (1) what price to enter at, (2) where to put the stop, (3) first target, (4) how many dollars at risk based on account size and risk %.",
    "Keep it under 150 words. Be direct. Do not hedge with generic disclaimers.",
    "If indicators field is present, use ema_uptrend, rsi, above_vwap, and volume_spike to validate the verdict.",
    "If recent_news field has headlines, mention if any news event changes the trade risk."
  ].join(" ");

  try {
    const result = await callOpenAIRaw(openaiKey, instructions, JSON.stringify(context, null, 2), 400);
    return {
      ok: true,
      ticker: signal.ticker,
      verdict: result,
      live_price: livePrice,
      entry: signal.entry,
      stop: signal.stop,
      target1: signal.target1,
      distance_from_entry_pct: distanceFromEntry,
      signal_id: signal.signal_id,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, error: error.message || "Trade check failed." };
  }
}

export async function getExitAdvice(payload, state, openaiKey) {
  const ticker = String(payload.ticker || payload.symbol || "").toUpperCase();
  const entryPrice = Number(payload.entry_price || payload.actual_entry || 0);
  const shares = Number(payload.shares || 0);
  const stopPrice = Number(payload.stop || 0);
  const target1 = Number(payload.target1 || 0);
  const target2 = Number(payload.target2 || 0);
  const bias = String(payload.bias || "bullish").toLowerCase();

  if (!ticker || !entryPrice) {
    return { ok: false, error: "Provide ticker and entry_price." };
  }

  const signal = findSignalInState(state, "", ticker);
  const livePrice = await fetchLivePrice(ticker, process.env.FINNHUB_API_KEY);
  if (!livePrice) {
    return { ok: false, error: `Could not fetch live price for ${ticker}.` };
  }

  const pnlPct = ((livePrice - entryPrice) / entryPrice * 100 * (bias === "bearish" ? -1 : 1)).toFixed(2);
  const dollarPnl = shares > 0 ? ((livePrice - entryPrice) * shares * (bias === "bearish" ? -1 : 1)).toFixed(2) : null;
  const distanceToStop = stopPrice ? (Math.abs(livePrice - stopPrice) / entryPrice * 100).toFixed(2) : null;
  const distanceToTarget1 = target1 ? (Math.abs(livePrice - target1) / entryPrice * 100).toFixed(2) : null;
  const distanceToTarget2 = target2 ? (Math.abs(livePrice - target2) / entryPrice * 100).toFixed(2) : null;

  const context = {
    ticker,
    bias,
    entry_price: entryPrice,
    live_price: livePrice,
    shares,
    stop_price: stopPrice || signal?.stop || null,
    target1: target1 || signal?.target1 || null,
    target2: target2 || signal?.target2 || null,
    pnl_pct: Number(pnlPct),
    dollar_pnl: dollarPnl ? Number(dollarPnl) : null,
    distance_to_stop_pct: distanceToStop ? Number(distanceToStop) : null,
    distance_to_target1_pct: distanceToTarget1 ? Number(distanceToTarget1) : null,
    distance_to_target2_pct: distanceToTarget2 ? Number(distanceToTarget2) : null,
    market_regime: state.marketRegime,
    signal_expired: signal?.expired_flag || false,
    current_indicators: signal?.indicators || null
  };

  const instructions = [
    "You are an exit advisor for a manual day trader who is currently in a position.",
    "Give a single clear verdict first: HOLD / SCALE OUT / EXIT NOW.",
    "HOLD: PnL positive, not near stop, momentum still in your favor.",
    "SCALE OUT: price is near target1 or up 1.5%+ - recommend selling half and moving stop to breakeven.",
    "EXIT NOW: price approaching stop, down more than 1%, or momentum broken (if indicators show ema_downtrend or below_vwap when long).",
    "Include: exact price to exit at, why, and what the dollar impact is if shares > 0.",
    "Also say what to watch for the next 5 minutes before making the final call.",
    "Keep it under 120 words. Be direct like a trading coach, not a financial advisor."
  ].join(" ");

  try {
    const result = await callOpenAIRaw(openaiKey, instructions, JSON.stringify(context, null, 2), 350);
    return {
      ok: true,
      ticker,
      verdict: result,
      live_price: livePrice,
      entry_price: entryPrice,
      pnl_pct: Number(pnlPct),
      dollar_pnl: dollarPnl ? Number(dollarPnl) : null,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, error: error.message || "Exit check failed." };
  }
}

export async function getMorningBriefing(state, openaiKey, finnhubKey) {
  const now = Date.now();
  if (briefingCache.data && now - briefingCache.cachedAt < BRIEFING_TTL_MS) {
    return { ...briefingCache.data, cache: { hit: true, ageSeconds: Math.round((now - briefingCache.cachedAt) / 1000) } };
  }

  const signals = [...(state.lastSignals?.values() || [])];
  const takeSignals = signals
    .filter((signal) => signal.final_decision === "take" && !signal.expired_flag)
    .sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0))
    .slice(0, 6);
  const watchSignals = signals
    .filter((signal) => signal.final_decision === "watch")
    .slice(0, 4);

  const [spyQuote, qqqQuote] = await Promise.all([
    fetchLivePrice("SPY", finnhubKey),
    fetchLivePrice("QQQ", finnhubKey)
  ]);

  const context = {
    date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    time_et: new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" }),
    market_regime: state.marketRegime,
    spy_live: spyQuote,
    qqq_live: qqqQuote,
    top_take_signals: takeSignals.map(summarizeSignalForBriefing),
    watch_signals: watchSignals.map(summarizeSignalForBriefing),
    journal_stats: calculateBasicJournalStats(state.journal || []),
    open_positions: (state.journal || []).filter((entry) => entry.status === "open").length
  };

  const instructions = [
    "You are a pre-market trading coach delivering a morning briefing for a manual day trader.",
    "Structure your response with these exact sections:",
    "1. MARKET MOOD (2 sentences: what the regime is and what it means for today)",
    "2. TOP SETUPS (list up to 3 tickers worth watching with entry/stop/target and one reason each)",
    "3. WHAT TO AVOID (1-2 things: overbought names, weak regime sectors, or risky conditions today)",
    "4. FOCUS (one sentence: the single most important thing to remember when trading today)",
    "Keep total response under 200 words. Plain English. No generic disclaimers.",
    "Use the journal stats to personalize: if win rate is below 50%, warn about overtrading.",
    "If no clean take signals exist, say so clearly and recommend staying in cash."
  ].join(" ");

  try {
    const result = await callOpenAIRaw(openaiKey, instructions, JSON.stringify(context, null, 2), 500);
    const data = {
      ok: true,
      briefing: result,
      market_regime: state.marketRegime,
      top_setups: takeSignals.map((signal) => ({
        ticker: signal.ticker,
        entry: signal.entry,
        stop: signal.stop,
        target1: signal.target1,
        confidence: signal.confidence
      })),
      createdAt: new Date().toISOString(),
      cache: { hit: false, ageSeconds: 0 }
    };
    briefingCache.data = data;
    briefingCache.cachedAt = now;
    return data;
  } catch (error) {
    return { ok: false, error: error.message || "Morning briefing failed." };
  }
}

export async function injectNewsIntoCandidate(candidate, finnhubKey) {
  const symbol = candidate.symbol || candidate.ticker;
  if (!symbol || !finnhubKey || isCryptoOrEtf(symbol)) return;

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 3 * 24 * 60 * 60;
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${tsToDate(from)}&to=${tsToDate(to)}&token=${finnhubKey}`;
    const response = await fetch(url);
    if (!response.ok) return;
    const articles = await response.json();

    if (Array.isArray(articles) && articles.length) {
      candidate.injected_news = articles.slice(0, 3).map((article) => ({
        headline: article.headline || "",
        source: article.source || "",
        datetime: article.datetime ? new Date(article.datetime * 1000).toISOString() : null
      }));
    }
  } catch {
    // Non-critical.
  }
}

export async function gradeTrade(payload, state, openaiKey) {
  const signalId = String(payload.signal_id || "");
  const ticker = String(payload.ticker || "").toUpperCase();
  const outcome = String(payload.outcome || "unknown");
  const actualEntry = Number(payload.actual_entry || 0);
  const actualExit = Number(payload.actual_exit || 0);
  const bias = String(payload.bias || "bullish");

  if (!signalId && !ticker) {
    return { ok: false, error: "Provide signal_id or ticker." };
  }

  const journalEntry = (state.journal || []).find((entry) => entry.signal_id === signalId || entry.ticker === ticker);
  const signal = findSignalInState(state, signalId, ticker);
  const pnlPct = actualEntry && actualExit
    ? ((actualExit - actualEntry) / actualEntry * 100 * (bias === "bearish" ? -1 : 1)).toFixed(2)
    : journalEntry?.pnl_pct || null;

  const context = {
    ticker: ticker || journalEntry?.ticker,
    outcome,
    bias,
    actual_entry: actualEntry || journalEntry?.actual_entry,
    actual_exit: actualExit || journalEntry?.actual_exit,
    pnl_pct: pnlPct,
    signal_entry: signal?.entry || journalEntry?.entry,
    signal_stop: signal?.stop || journalEntry?.stop,
    signal_target1: signal?.target1 || journalEntry?.target1,
    signal_confidence: signal?.confidence || journalEntry?.confidence,
    signal_quality: signal?.final_quality_score || journalEntry?.final_quality_score,
    signal_trend_label: signal?.trend_label || null,
    indicators_at_entry: signal?.indicators || null,
    lifecycle_status: journalEntry?.lifecycle_status,
    hold_seconds: journalEntry?.hold_seconds
  };

  const instructions = [
    "You are a trading coach grading a completed trade.",
    "Give a letter grade (A, B, C, D, or F) based on: did the trader follow signal rules, was entry near the signal entry, was the stop respected, was the outcome consistent with the setup quality.",
    "Format response as:",
    "GRADE: [letter]",
    "VERDICT: [one sentence why]",
    "LESSON: [one specific, actionable thing to do differently or keep doing]",
    "A = followed rules perfectly. B = mostly right. C = sloppy but managed risk. D = broke rules. F = ignored stop or chased far from entry.",
    "If indicators_at_entry shows the setup was already weak (rsi overbought, ema_downtrend), mention that.",
    "Keep total response under 100 words."
  ].join(" ");

  try {
    const result = await callOpenAIRaw(openaiKey, instructions, JSON.stringify(context, null, 2), 250);
    return {
      ok: true,
      ticker: context.ticker,
      outcome,
      pnl_pct: pnlPct ? Number(pnlPct) : null,
      grade: result,
      signal_id: signalId,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, error: error.message || "Trade grade failed." };
  }
}

async function callOpenAIRaw(apiKey, instructions, input, maxTokens = 500) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions,
      input,
      max_output_tokens: maxTokens
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed with ${response.status}`);
  }

  const content = data.output || data.choices?.[0]?.message?.content || "";
  if (Array.isArray(content)) {
    return content.map((block) => block.text || "").join("").trim();
  }
  if (typeof content === "string") return content.trim();
  return JSON.stringify(content);
}

async function fetchLivePrice(symbol, finnhubKey) {
  if (!finnhubKey || !symbol) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.c || null;
  } catch {
    return null;
  }
}

function findSignalInState(state, signalId, ticker) {
  const signals = [...(state.lastSignals?.values() || [])];
  if (signalId) {
    return signals.find((signal) => signal.signal_id === signalId) || null;
  }
  if (ticker) {
    return signals
      .filter((signal) => signal.ticker === ticker)
      .sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0))[0] || null;
  }
  return null;
}

function summarizeSignalForBriefing(signal) {
  return {
    ticker: signal.ticker,
    bias: signal.bias,
    entry: signal.entry,
    stop: signal.stop,
    target1: signal.target1,
    confidence: signal.confidence,
    quality: signal.final_quality_score,
    trend: signal.trend_label,
    reason: signal.momentum_reason,
    bull_run: signal.bull_run_flag
  };
}

function calculateBasicJournalStats(journal) {
  if (!journal?.length) return { total: 0, win_rate: 0, avg_pnl: 0 };
  const closed = journal.filter((entry) => ["win", "loss", "breakeven"].includes(entry.outcome));
  const wins = closed.filter((entry) => entry.outcome === "win").length;
  const pnls = journal.map((entry) => Number(entry.pnl_pct)).filter(Number.isFinite);
  return {
    total: journal.length,
    closed: closed.length,
    win_rate: closed.length ? Number((wins / closed.length * 100).toFixed(1)) : 0,
    avg_pnl: pnls.length ? Number((pnls.reduce((sum, value) => sum + value, 0) / pnls.length).toFixed(2)) : 0
  };
}

function isCryptoOrEtf(symbol) {
  const etfs = new Set(["SPY", "QQQ", "IWM", "DIA", "RSP", "MDY", "XLK", "XLF", "XLE", "XLV", "XLI", "XLB", "XLU", "XLRE", "XLC", "XLY", "XLP", "SMH", "SOXX", "KRE", "XBI", "IBB", "TLT", "HYG", "GLD", "SLV", "USO", "UNG", "EFA", "EEM", "IBIT", "GBTC", "FBTC", "BITO", "ARKB", "BLOK", "BKCH", "BITQ", "WGMI"]);
  return etfs.has(symbol) || /USD$/.test(symbol);
}

function tsToDate(unixTs) {
  return new Date(unixTs * 1000).toISOString().slice(0, 10);
}
