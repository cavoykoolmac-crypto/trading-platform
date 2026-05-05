import { existsSync } from "node:fs";
import { chromium } from "playwright";

const INCITE_URL = "https://app.inciteai.com/chat";
const SESSION_FILE = "./incite-session.json";
const CACHE_TTL_MS = 10 * 60 * 1000;
const SCHEDULE_MS = 15 * 60 * 1000;
const RESPONSE_TIMEOUT = 90_000;
const TYPING_DELAY = 50;

const DEFAULT_PROMPT =
  "Scan the market live right now for the best quick-trade opportunities. " +
  "Return only your top 2-3 bullish setups with exact Entry, Stop, Target 1, and Target 2 prices. " +
  "Format the answer as one ```table-json``` block only with columns: Asset, Entry, Stop, Target 1, Target 2, Reason. " +
  "Use ticker and exchange in Asset when possible, like 'Applied Materials | AMAT | NASDAQ'. " +
  "If there is no clean setup, return one table row that says CASH in Asset and explain why.";

let cache = {
  signals: [],
  raw: "",
  prompt: "",
  fetchedAt: null,
  error: null,
  status: "idle"
};

let scheduleStarted = false;

export async function getInciteSignals(prompt = DEFAULT_PROMPT) {
  const age = cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity;
  if (cache.signals.length && age < CACHE_TTL_MS) {
    return buildResponse(true);
  }
  return refreshInciteSignals(prompt);
}

export async function refreshInciteSignals(prompt = DEFAULT_PROMPT) {
  if (cache.status === "fetching") return buildResponse(false);

  cache.status = "fetching";
  cache.error = null;

  try {
    const result = await scrapeIncite(prompt);
    cache.signals = result.signals;
    cache.raw = result.raw;
    cache.prompt = prompt;
    cache.fetchedAt = Date.now();
    cache.status = "ok";
    console.log(`[Incite Bridge] Parsed ${cache.signals.length} signals`);
  } catch (error) {
    cache.status = "error";
    cache.error = error.message || "Scrape failed";
    console.error("[Incite Bridge] Failed:", cache.error);
  }

  return buildResponse(false);
}

export function startInciteSchedule(prompt = DEFAULT_PROMPT) {
  if (scheduleStarted) return;
  scheduleStarted = true;
  console.log("[Incite Bridge] Auto-refresh every", SCHEDULE_MS / 60000, "minutes");
  setTimeout(() => {
    void refreshInciteSignals(prompt);
  }, 10_000);
  setInterval(() => {
    void refreshInciteSignals(prompt);
  }, SCHEDULE_MS);
}

async function scrapeIncite(prompt) {
  const email = process.env.INCITE_EMAIL;
  const password = process.env.INCITE_PASSWORD;
  const hasSavedSession = existsSync(SESSION_FILE);

  if (!hasSavedSession && (!email || !password)) {
    throw new Error("Provide an Incite session file with node incite-session.js or set INCITE_EMAIL and INCITE_PASSWORD in .env");
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    const context = await browser.newContext({
      ...(hasSavedSession ? { storageState: SESSION_FILE } : {}),
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    console.log("[Incite Bridge] Navigating to", INCITE_URL);
    await page.goto(INCITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await handleLogin(page, email, password, { hasSavedSession });

    console.log("[Incite Bridge] Waiting for chat input...");
    const inputSelector = await waitForChatInput(page);

    console.log("[Incite Bridge] Sending prompt...");
    await page.click(inputSelector);
    await page.type(inputSelector, prompt, { delay: TYPING_DELAY });
    await page.keyboard.press("Enter");

    console.log("[Incite Bridge] Waiting for response...");
    const rawText = await waitForInciteResponse(page);
    if (/sign in to continue|welcome back/i.test(rawText)) {
      throw new Error("Incite returned a sign-in wall instead of chat output. The session is not fully authenticated.");
    }
    const signals = parseInciteResponse(rawText);
    return { signals, raw: rawText };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function handleLogin(page, email, password, options = {}) {
  const { hasSavedSession = false } = options;
  const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
  const passSel = 'input[type="password"], input[name="password"]';
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const blockedBySigninWall = /sign in to continue|welcome back/i.test(bodyText);
  const hasEmailField = await page.locator(emailSel).first().isVisible().catch(() => false);
  const hasPasswordField = await page.locator(passSel).first().isVisible().catch(() => false);
  const chatInputVisible = await page
    .locator('textarea[placeholder*="message" i], textarea[placeholder*="ask" i], div[contenteditable="true"]')
    .first()
    .isVisible()
    .catch(() => false);
  const looksLikeChatUrl = /chat|app/i.test(page.url());

  if (!blockedBySigninWall && !hasEmailField && !hasPasswordField && chatInputVisible && looksLikeChatUrl) {
    console.log("[Incite Bridge] Already logged in");
    return;
  }

  if (hasSavedSession && blockedBySigninWall) {
    throw new Error("Saved Incite session is no longer valid. Re-run node incite-session.js to save a fresh session.");
  }

  try {
    if (!hasEmailField) {
      const openLoginButton = page.locator('button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Log in"), a:has-text("Log in")').first();
      if (await openLoginButton.isVisible().catch(() => false)) {
        await openLoginButton.click().catch(() => {});
      }
    }

    await page.waitForSelector(emailSel, { timeout: 10_000 });
    await page.fill(emailSel, email);

    const passVisible = await page.locator(passSel).isVisible().catch(() => false);
    if (!passVisible) {
      const nextBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")').first();
      await nextBtn.click().catch(() => {});
      await page.waitForSelector(passSel, { timeout: 8_000 });
    }

    await page.fill(passSel, password);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').first();
    await submitBtn.click();
    await page.waitForURL(/chat|dashboard|app/, { timeout: 20_000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    console.log("[Incite Bridge] Login successful");
  } catch (error) {
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), [data-provider="google"]').first();
    const hasGoogle = await googleBtn.isVisible().catch(() => false);
    if (hasGoogle) {
      throw new Error("Incite uses Google SSO. Use your Google credentials here or switch Incite to email login.");
    }
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function waitForChatInput(page) {
  const selectors = [
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="ask" i]',
    'textarea[placeholder*="type" i]',
    'div[contenteditable="true"]',
    "textarea",
    'input[type="text"]'
  ];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8_000 });
      const visible = await page.locator(selector).first().isVisible();
      if (visible) return selector;
    } catch {}
  }

  throw new Error("Could not find chat input. Incite UI may have changed.");
}

async function waitForInciteResponse(page) {
  const start = Date.now();

  await page.waitForFunction(
    () => {
      const messages = document.querySelectorAll(
        '[class*="message"], [class*="response"], [class*="assistant"], [class*="chat"], [data-role="assistant"]'
      );
      return messages.length > 0;
    },
    { timeout: RESPONSE_TIMEOUT }
  );

  let lastText = "";
  let stableFor = 0;
  const CHECK_INTERVAL = 1000;
  const STABLE_THRESHOLD = 3000;

  while (Date.now() - start < RESPONSE_TIMEOUT) {
    await page.waitForTimeout(CHECK_INTERVAL);
    const currentText = await extractAllResponseText(page);

    if (currentText === lastText && currentText.length > 50) {
      stableFor += CHECK_INTERVAL;
      if (stableFor >= STABLE_THRESHOLD) return currentText;
    } else {
      stableFor = 0;
      lastText = currentText;
    }
  }

  return lastText || await extractAllResponseText(page);
}

async function extractAllResponseText(page) {
  return page.evaluate(() => {
    const selectors = [
      '[data-role="assistant"]',
      '[class*="assistant"]',
      '[class*="bot-message"]',
      '[class*="ai-message"]',
      '[class*="response"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const last = elements[elements.length - 1];
        return last.innerText || last.textContent || "";
      }
    }

    const main = document.querySelector("main, [class*='chat'], [class*='messages'], [role='main']");
    return main ? (main.innerText || main.textContent || "") : document.body.innerText || "";
  });
}

function parseInciteResponse(rawText) {
  if (!rawText) return [];

  const signals = [];
  const tableJsonRegex = /```table-json\s*([\s\S]*?)```/g;
  let match;

  while ((match = tableJsonRegex.exec(rawText)) !== null) {
    try {
      const tableData = JSON.parse(match[1].trim());
      if (!Array.isArray(tableData.rows)) continue;
      const cols = (tableData.columns || []).map((column) => (column.key || column.label || "").toLowerCase());
      const hasEntry = cols.some((column) => column.includes("entry"));
      if (!hasEntry) continue;

      for (const row of tableData.rows) {
        const signal = extractSignalFromRow(row, tableData.columns || []);
        if (signal) signals.push(signal);
      }
    } catch {}
  }

  if (!signals.length) {
    const jsonRegex = /```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/g;
    while ((match = jsonRegex.exec(rawText)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of array) {
          if (item.ticker || item.symbol || item.asset) {
            const signal = extractSignalFromObject(item);
            if (signal) signals.push(signal);
          }
        }
      } catch {}
    }
  }

  if (!signals.length) {
    signals.push(...extractSignalsFromText(rawText));
  }

  const seen = new Set();
  return signals.filter((signal) => {
    if (seen.has(signal.ticker)) return false;
    seen.add(signal.ticker);
    return true;
  });
}

function extractSignalFromRow(row, columns) {
  const data = {};
  for (const column of columns) {
    const key = (column.key || column.label || "").toLowerCase();
    data[key] = row[column.key] || row[column.label] || "";
  }
  for (const key of Object.keys(row)) {
    data[key.toLowerCase()] = row[key];
  }

  const assetRaw = data.asset || data.ticker || data.symbol || data.name || "";
  const ticker = extractTicker(assetRaw);
  if (!ticker) return null;

  const exchange = extractExchange(assetRaw) || "NASDAQ";
  const entry = parsePrice(data.entry || data["entry price"] || data.buy || "");
  const stop = parsePrice(data.stop || data["stop loss"] || data.stoploss || data["stop price"] || "");
  const target1 = parsePrice(data["target 1"] || data.target || data.target1 || data.tp || data["take profit"] || "");
  const target2 = parsePrice(data["target 2"] || data.target2 || "");
  if (!entry) return null;

  const rr = entry && stop && target1
    ? (Math.abs(target1 - entry) / Math.abs(entry - stop)).toFixed(1)
    : null;

  return {
    ticker,
    exchange,
    bias: "bullish",
    entry,
    stop,
    target1,
    target2: target2 || (target1 ? +(target1 + (target1 - entry) * 0.75).toFixed(2) : null),
    reward_risk: rr,
    confidence: 8,
    source: "incite",
    final_decision: "take",
    reason: `Incite Pro signal - ${assetRaw}`,
    timing: "Fresh Breakout",
    fetched_at: new Date().toISOString()
  };
}

function extractSignalFromObject(obj) {
  const ticker = extractTicker(obj.ticker || obj.symbol || obj.asset || obj.name || "");
  if (!ticker) return null;

  return {
    ticker,
    exchange: obj.exchange || "NASDAQ",
    bias: String(obj.bias || obj.direction || "bullish").toLowerCase(),
    entry: parsePrice(obj.entry || obj.entryPrice || obj.buy || ""),
    stop: parsePrice(obj.stop || obj.stopLoss || obj.sl || ""),
    target1: parsePrice(obj.target || obj.target1 || obj.tp || obj.takeProfit || ""),
    target2: null,
    confidence: obj.confidence || 8,
    source: "incite",
    final_decision: "take",
    reason: obj.reason || obj.thesis || "Incite Pro signal",
    timing: "Fresh Breakout",
    fetched_at: new Date().toISOString()
  };
}

function extractSignalsFromText(text) {
  const signals = [];
  const tickerPattern = /\b([A-Z]{2,5})\s+(?:NASDAQ|NYSE|AMEX|OTC)\b/g;
  const pricePattern = /\$[\d,]+(?:\.\d{2})?/g;
  let tickerMatch;

  while ((tickerMatch = tickerPattern.exec(text)) !== null) {
    const ticker = tickerMatch[1];
    const startIdx = tickerMatch.index;
    const chunk = text.slice(startIdx, startIdx + 400);
    const prices = [];
    let priceMatch;
    while ((priceMatch = pricePattern.exec(chunk)) !== null) {
      prices.push(parsePrice(priceMatch[0]));
    }
    pricePattern.lastIndex = 0;

    if (prices.length >= 2) {
      signals.push({
        ticker,
        exchange: tickerMatch[0].includes("NYSE") ? "NYSE" : "NASDAQ",
        bias: "bullish",
        entry: prices[0] || null,
        stop: prices[1] || null,
        target1: prices[2] || null,
        target2: null,
        confidence: 7,
        source: "incite",
        final_decision: "take",
        reason: "Incite Pro signal (text extracted)",
        timing: "Fresh Breakout",
        fetched_at: new Date().toISOString()
      });
    }
  }

  return signals;
}

function extractTicker(raw) {
  if (!raw) return null;
  const pipeParts = String(raw).split("|").map((part) => part.trim());
  for (const part of pipeParts) {
    if (/^[A-Z]{1,5}$/.test(part)) return part;
  }
  const match = String(raw).match(/\b([A-Z]{1,5})\b/);
  return match ? match[1] : null;
}

function extractExchange(raw) {
  if (!raw) return null;
  if (raw.includes("NASDAQ")) return "NASDAQ";
  if (raw.includes("NYSE")) return "NYSE";
  if (raw.includes("AMEX")) return "AMEX";
  return null;
}

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[$,\s]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildResponse(fromCache) {
  return {
    ok: cache.status === "ok" || (fromCache && cache.signals.length > 0),
    status: cache.status,
    signals: cache.signals,
    signal_count: cache.signals.length,
    prompt: cache.prompt,
    fetched_at: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    cache_age_seconds: cache.fetchedAt ? Math.round((Date.now() - cache.fetchedAt) / 1000) : null,
    from_cache: fromCache,
    error: cache.error || null,
    raw_preview: cache.raw ? cache.raw.slice(0, 300) + (cache.raw.length > 300 ? "..." : "") : null
  };
}
