import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";

await loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ENABLE_DESKTOP_NOTIFICATIONS = parseBoolean(process.env.ENABLE_DESKTOP_NOTIFICATIONS);
const EXECUTION_ACCOUNT_SIZE = Number(process.env.EXECUTION_ACCOUNT_SIZE || 10000);
const EXECUTION_RISK_PCT = Number(process.env.EXECUTION_RISK_PCT || 0.5);
const EXECUTION_MAX_POSITION_PCT = Number(process.env.EXECUTION_MAX_POSITION_PCT || 20);
const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const STORE_DIR = new URL("./data/", import.meta.url);
const STORE_FILE = new URL("./data/events.json", import.meta.url);
const JOURNAL_FILE = new URL("./data/journal.json", import.meta.url);
const PUBLIC_DIR = new URL("./public/", import.meta.url);
const INDEX_SYMBOLS = {
  SPX: {
    providerSymbol: "^SPX",
    fallbackSymbol: "SPY",
    displayName: "S&P 500 Index",
    assetClass: "index"
  }
};
const INTRADAY_UNIVERSE = [
  "SPX", "SPY", "QQQ", "IWM", "DIA", "RSP", "MDY", "EFA", "EEM", "FXI", "EWJ",
  "XLK", "XLC", "XLY", "XLP", "XLF", "XLE", "XLV", "XLI", "XLB", "XLU",
  "XLRE", "SMH", "SOXX", "KRE", "XBI", "IBB", "XRT", "IYT", "TAN", "ICLN",
  "GLD", "SLV", "USO", "UNG", "TLT", "HYG", "UUP", "AAPL", "MSFT", "NVDA",
  "AMD", "TSLA", "META", "AMZN", "GOOGL", "NFLX", "CRM", "PLTR", "SMCI", "AVGO",
  "MRVL", "MU", "INTC", "ARM", "ORCL", "ADBE", "NOW", "SHOP", "SNOW", "CRWD",
  "XOM", "CVX", "SLB", "OXY", "HAL", "COP", "JPM", "BAC", "WFC", "GS",
  "MS", "C", "SCHW", "AXP", "V", "MA", "UNH", "LLY", "JNJ", "ABBV",
  "PFE", "MRK", "TMO", "ISRG", "BA", "CAT", "DE", "GE", "LMT", "RTX",
  "NOC", "UPS", "FDX", "COIN", "HOOD", "RIVN", "LCID", "F", "GM", "UBER",
  "DIS", "NKE", "COST", "WMT", "TGT", "HD", "LOW", "MCD", "SBUX", "BABA",
  "JD", "PDD", "NIO", "LI", "TSM", "ASML", "SAP", "TM", "VALE", "RIO"
];
const SWING_UNIVERSE = [
  "SPX", "SPY", "QQQ", "IWM", "DIA", "RSP", "MDY", "EFA", "EEM", "EWJ", "EWZ",
  "INDA", "FXI", "KWEB", "XLK", "XLC", "XLY", "XLP", "XLF", "XLE", "XLV",
  "XLI", "XLB", "XLU", "XLRE", "SMH", "SOXX", "KRE", "XBI", "IBB", "IYR",
  "GLD", "SLV", "USO", "UNG", "DBA", "TLT", "IEF", "HYG", "LQD", "UUP",
  "AAPL", "MSFT", "NVDA", "AMD", "AVGO", "MRVL", "MU", "INTC", "ARM", "TSM",
  "ASML", "META", "AMZN", "GOOGL", "NFLX", "ORCL", "CRM", "ADBE", "NOW", "SHOP",
  "SNOW", "CRWD", "PANW", "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "FCX",
  "NEM", "VALE", "RIO", "JPM", "BAC", "WFC", "GS", "MS", "SCHW", "AXP",
  "V", "MA", "UNH", "LLY", "JNJ", "ABBV", "MRK", "TMO", "ISRG", "BA",
  "CAT", "DE", "GE", "LMT", "RTX", "NOC", "UPS", "FDX", "COST", "WMT",
  "TGT", "HD", "LOW", "MCD", "SBUX", "PEP", "KO", "PG", "UBER", "DIS",
  "NKE", "F", "GM", "RIVN", "LCID", "COIN", "HOOD", "PLTR", "BABA", "PDD"
];
const FUTURES_PROXY_UNIVERSE = [
  "SPX", "SPY", "QQQ", "IWM", "DIA", "RSP", "MDY", "EFA", "EEM", "FXI", "EWJ",
  "SMH", "SOXX", "XLK", "XLC", "XLY", "XLP", "XLF", "XLE", "XLV", "XLI",
  "XLB", "XLU", "XLRE", "KRE", "XBI", "IYT", "GLD", "SLV", "USO", "UNG",
  "DBA", "TLT", "IEF", "SHY", "HYG", "LQD", "UUP", "FXE", "FXY", "FXB",
  "XOM", "CVX", "OXY", "COP", "FCX", "NEM", "JPM", "GS", "AAPL", "MSFT",
  "NVDA", "AMD", "TSLA", "AMZN", "META", "GOOGL"
];
const BITCOIN_LINKED_UNIVERSE = [
  "MSTR", "COIN", "GLXY", "SQ", "HOOD", "PYPL",
  "IREN", "MARA", "RIOT", "CLSK", "CIFR", "WULF", "BTDR", "FUFU", "HUT", "BITF", "BTBT", "HIVE", "CORZ", "CAN", "SDIG",
  "IBIT", "GBTC", "FBTC", "BITO", "ARKB", "BITB", "HODL", "BRRR", "EZBC", "BTCW",
  "MSTU", "MSTX", "MSBT", "BITX", "BITU", "MSTY",
  "BLOK", "BKCH", "BITQ", "WGMI"
];
const BITCOIN_LINKED_PROFILES = {
  MSTR: ["direct_proxy", "high_beta_btc_treasury"], COIN: ["exchange", "crypto_activity"], GLXY: ["crypto_financials", "institutional_crypto"], SQ: ["payments", "btc_services"], HOOD: ["brokerage", "crypto_activity"], PYPL: ["payments", "crypto_services"],
  IREN: ["miner", "high_beta"], MARA: ["miner", "high_beta"], RIOT: ["miner", "high_beta"], CLSK: ["miner", "high_beta"], CIFR: ["miner", "high_beta"], WULF: ["miner", "high_beta"], BTDR: ["miner", "high_beta"], FUFU: ["miner", "high_beta"], HUT: ["miner", "high_beta"], BITF: ["miner", "high_beta"], BTBT: ["miner", "high_beta"], HIVE: ["miner", "high_beta"], CORZ: ["miner", "high_beta"], CAN: ["miner_equipment", "high_beta"], SDIG: ["miner", "high_beta"],
  IBIT: ["spot_etf", "btc_tracking"], GBTC: ["spot_etf", "btc_tracking"], FBTC: ["spot_etf", "btc_tracking"], BITO: ["futures_etf", "btc_tracking"], ARKB: ["spot_etf", "btc_tracking"], BITB: ["spot_etf", "btc_tracking"], HODL: ["spot_etf", "btc_tracking"], BRRR: ["spot_etf", "btc_tracking"], EZBC: ["spot_etf", "btc_tracking"], BTCW: ["spot_etf", "btc_tracking"],
  MSTU: ["leveraged_mstr", "very_high_beta"], MSTX: ["leveraged_mstr", "very_high_beta"], MSBT: ["leveraged_mstr", "very_high_beta"], BITX: ["leveraged_btc", "very_high_beta"], BITU: ["leveraged_btc", "very_high_beta"], MSTY: ["mstr_income", "btc_sensitive"],
  BLOK: ["blockchain_etf", "crypto_equities"], BKCH: ["blockchain_etf", "crypto_equities"], BITQ: ["blockchain_etf", "crypto_equities"], WGMI: ["miner_etf", "high_beta"]
};
const CRYPTO_UNIVERSE = ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD", "ADAUSD", "AVAXUSD", "LINKUSD", "MATICUSD", "LTCUSD", "SHIBUSD"];
const CRYPTO_SYMBOLS = {
  BTCUSD: { pair: "BTCUSDT", label: "Bitcoin" },
  ETHUSD: { pair: "ETHUSDT", label: "Ethereum" },
  SOLUSD: { pair: "SOLUSDT", label: "Solana" },
  XRPUSD: { pair: "XRPUSDT", label: "XRP" },
  DOGEUSD: { pair: "DOGEUSDT", label: "Dogecoin" },
  ADAUSD: { pair: "ADAUSDT", label: "Cardano" },
  AVAXUSD: { pair: "AVAXUSDT", label: "Avalanche" },
  LINKUSD: { pair: "LINKUSDT", label: "Chainlink" },
  MATICUSD: { pair: "MATICUSDT", label: "Polygon" },
  LTCUSD: { pair: "LTCUSDT", label: "Litecoin" },
  SHIBUSD: { pair: "SHIBUSDT", label: "Shiba Inu" },
  BTC: { alias: "BTCUSD" },
  ETH: { alias: "ETHUSD" },
  SOL: { alias: "SOLUSD" },
  XRP: { alias: "XRPUSD" },
  DOGE: { alias: "DOGEUSD" },
  ADA: { alias: "ADAUSD" },
  AVAX: { alias: "AVAXUSD" },
  LINK: { alias: "LINKUSD" },
  MATIC: { alias: "MATICUSD" },
  LTC: { alias: "LTCUSD" },
  SHIB: { alias: "SHIBUSD" }
};
const SEARCH_ALIASES = {
  SPX: ["spx", "s&p 500", "sp500", "spy index", "s and p 500"],
  SPY: ["spy", "spdr s&p 500 etf", "spdr sp500"],
  QQQ: ["qqq", "nasdaq 100 etf", "invesco qqq", "nasdaq"],
  IWM: ["iwm", "russell 2000 etf", "russell 2000"],
  DIA: ["dia", "dow etf", "dow jones etf", "dow"],
  TSLA: ["tesla", "tesla inc"],
  NVDA: ["nvidia", "nvidia corp"],
  AAPL: ["apple", "apple inc"],
  MSFT: ["microsoft", "microsoft corp"],
  AMZN: ["amazon", "amazon.com"],
  GOOGL: ["google", "alphabet", "alphabet inc"],
  META: ["meta", "facebook", "meta platforms"],
  NFLX: ["netflix"],
  AMD: ["amd", "advanced micro devices"],
  SMCI: ["super micro", "supermicro"],
  PLTR: ["palantir"],
  COIN: ["coinbase", "coinbase global"],
  HOOD: ["robinhood"],
  MSTR: ["microstrategy", "strategy", "micro strategy"],
  SQ: ["block", "square", "block inc"],
  IREN: ["iris energy"],
  MARA: ["mara", "marathon", "marathon digital"],
  RIOT: ["riot", "riot platforms"],
  CLSK: ["cleanspark", "clean spark"],
  IBIT: ["ibit", "ishares bitcoin trust", "blackrock bitcoin etf"],
  GBTC: ["gbtc", "grayscale bitcoin trust"],
  FBTC: ["fbtc", "fidelity bitcoin etf"],
  BITO: ["bito", "proshares bitcoin strategy"],
  BITX: ["bitx", "2x bitcoin etf"],
  MSTU: ["mstu", "2x mstr etf"],
  MSBT: ["msbt", "mstr leveraged etf"],
  BTCUSD: ["bitcoin", "btc", "btcusd"],
  ETHUSD: ["ethereum", "eth", "ethusd"],
  SOLUSD: ["solana", "sol", "solusd"],
  XRPUSD: ["xrp", "xrpusd", "ripple"],
  DOGEUSD: ["doge", "dogecoin", "dogeusd"],
  ADAUSD: ["cardano", "ada", "adausd"],
  AVAXUSD: ["avax", "avalanche", "avaxusd"],
  LINKUSD: ["chainlink", "link", "linkusd"],
  MATICUSD: ["matic", "polygon", "maticusd", "polygon matic"],
  LTCUSD: ["litecoin", "ltc", "ltcusd"],
  SHIBUSD: ["shiba", "shiba inu", "shib", "shibusd"]
};
const DEFAULT_SCAN_UNIVERSE = INTRADAY_UNIVERSE;
const SCAN_MODES = {
  intraday: {
    label: "Intraday Bull Run",
    universe: INTRADAY_UNIVERSE,
    assetClass: "equity",
    holdWindow: "intraday",
    promptFocus: "intraday momentum, bull-run continuation, buy trigger, sell trigger, and fast invalidation"
  },
  swing: {
    label: "Swing 1-5 Days",
    universe: SWING_UNIVERSE,
    assetClass: "equity",
    holdWindow: "1-5 business days, 1-7 calendar days max",
    promptFocus: "1 to 5 business day swing trade setup, with a 1 to 7 calendar day maximum hold window, entry zone, invalidation, targets, and patience around pullback risk"
  },
  futures: {
    label: "Futures Bull-Run Proxy",
    universe: FUTURES_PROXY_UNIVERSE,
    assetClass: "futures_proxy",
    holdWindow: "intraday to 2 days",
    promptFocus: "futures-style bull-run detection using liquid ETF/proxy instruments, early momentum expansion, breakout continuation, clear buy trigger, sell trigger, and fast invalidation"
  },
  bitcoin: {
    label: "Bitcoin-Linked Movers",
    universe: BITCOIN_LINKED_UNIVERSE,
    assetClass: "bitcoin_linked",
    holdWindow: "intraday to 3 days",
    promptFocus: "Bitcoin-linked momentum from BTC price swings, crypto activity/news, miner volatility, spot ETF tracking, leveraged ETF risk, and clean buy/sell triggers. Separate BTC beta groups: direct proxies, miners, spot ETFs, leveraged ETFs, and crypto infrastructure."
  },
  crypto: {
    label: "Live Crypto",
    universe: CRYPTO_UNIVERSE,
    assetClass: "crypto",
    holdWindow: "intraday to 3 days",
    promptFocus: "live crypto momentum in Bitcoin, Ethereum, Dogecoin, and Shiba Inu, with bull-run detection, buy trigger, sell trigger, stop, targets, and volatility risk"
  },
  all: {
    label: "Diversified All Modes",
    universe: [...new Set([...INTRADAY_UNIVERSE, ...SWING_UNIVERSE, ...FUTURES_PROXY_UNIVERSE, ...BITCOIN_LINKED_UNIVERSE, ...CRYPTO_UNIVERSE])],
    assetClass: "mixed",
    holdWindow: "intraday to 5 days",
    promptFocus: "diversified best opportunities across intraday, swing, futures-proxy, bitcoin-linked, and crypto setups"
  }
};
const ROTATING_SCAN_BATCH_SIZE = 20;
const FINNHUB_REQUEST_BATCH_SIZE = 5;
const SCAN_BATCH_DELAY_MS = 750;
const FINNHUB_REQUEST_DELAY_MS = 125;
const AI_CANDIDATE_LIMIT = 10;
const SCAN_CACHE_TTL_MS = 60_000;
const NEWS_CACHE_TTL_MS = 300_000;
const NEWS_SYMBOL_LIMIT = 8;
const NEWS_PER_SYMBOL_LIMIT = 4;
const MARKET_NEWS_LIMIT = 20;
const AUTO_SCAN_INTERVAL_MS = Number(process.env.AUTO_SCAN_INTERVAL_MS || 180_000);
const DASHBOARD_SESSION_TIMEOUT_MS = Number(process.env.DASHBOARD_SESSION_TIMEOUT_MS || 75_000);
const DASHBOARD_SESSION_SWEEP_MS = 15_000;
const AUTO_SCAN_MODE_SEQUENCE = ["swing", "all"];
const MARKET_COVERAGE = [
  "US large-cap indexes",
  "US small/mid-cap indexes",
  "international developed markets",
  "emerging markets",
  "China/Asia ADRs and ETFs",
  "technology and semiconductors",
  "communications",
  "consumer discretionary",
  "consumer staples",
  "financials and regional banks",
  "energy",
  "healthcare and biotech",
  "industrials, defense, and transports",
  "materials and metals",
  "utilities and real estate",
  "retail and housing",
  "clean energy",
  "commodities",
  "bonds and credit",
  "currency proxies",
  "Bitcoin-linked stocks, miners, spot ETFs, leveraged BTC/MSTR ETFs, and blockchain ETFs"
];
const SECTOR_ETFS = {
  technology: "XLK",
  semiconductors: "SMH",
  communications: "XLC",
  consumer_discretionary: "XLY",
  consumer_staples: "XLP",
  financials: "XLF",
  energy: "XLE",
  healthcare: "XLV",
  industrials: "XLI",
  materials: "XLB",
  utilities: "XLU",
  real_estate: "XLRE",
  regional_banks: "KRE",
  biotech: "XBI",
  retail: "XRT",
  transports: "IYT",
  clean_energy: "ICLN",
  commodities: "GLD",
  bonds: "TLT",
  international: "EFA",
  emerging_markets: "EEM",
  bitcoin: "IBIT"
};
const SYMBOL_SECTORS = {
  SPX: "index",
  AAPL: "technology", MSFT: "technology", ORCL: "technology", ADBE: "technology", NOW: "technology", CRM: "technology", SHOP: "technology", SNOW: "technology", CRWD: "technology", PANW: "technology", SAP: "technology",
  NVDA: "semiconductors", AMD: "semiconductors", AVGO: "semiconductors", MRVL: "semiconductors", MU: "semiconductors", INTC: "semiconductors", ARM: "semiconductors", SMCI: "semiconductors", TSM: "semiconductors", ASML: "semiconductors",
  META: "communications", GOOGL: "communications", NFLX: "communications", DIS: "communications", ROKU: "communications",
  TSLA: "consumer_discretionary", AMZN: "consumer_discretionary", HD: "consumer_discretionary", LOW: "consumer_discretionary", MCD: "consumer_discretionary", SBUX: "consumer_discretionary", NKE: "consumer_discretionary", UBER: "consumer_discretionary", F: "consumer_discretionary", GM: "consumer_discretionary", RIVN: "consumer_discretionary", LCID: "consumer_discretionary", TM: "consumer_discretionary",
  COST: "consumer_staples", WMT: "consumer_staples", TGT: "consumer_staples", PEP: "consumer_staples", KO: "consumer_staples", PG: "consumer_staples",
  JPM: "financials", BAC: "financials", WFC: "financials", GS: "financials", MS: "financials", C: "financials", SCHW: "financials", AXP: "financials", V: "financials", MA: "financials", HOOD: "financials", PYPL: "financials",
  XOM: "energy", CVX: "energy", SLB: "energy", OXY: "energy", HAL: "energy", COP: "energy",
  UNH: "healthcare", LLY: "healthcare", JNJ: "healthcare", ABBV: "healthcare", PFE: "healthcare", MRK: "healthcare", TMO: "healthcare", ISRG: "healthcare",
  BA: "industrials", CAT: "industrials", DE: "industrials", GE: "industrials", LMT: "industrials", RTX: "industrials", NOC: "industrials", UPS: "industrials", FDX: "industrials",
  FCX: "materials", NEM: "materials", VALE: "materials", RIO: "materials",
  BABA: "emerging_markets", JD: "emerging_markets", PDD: "emerging_markets", NIO: "emerging_markets", LI: "emerging_markets",
  MSTR: "bitcoin", COIN: "bitcoin", GLXY: "bitcoin", SQ: "bitcoin", HOOD: "bitcoin", PYPL: "bitcoin",
  IREN: "bitcoin", MARA: "bitcoin", RIOT: "bitcoin", CLSK: "bitcoin", CIFR: "bitcoin", WULF: "bitcoin", BTDR: "bitcoin", FUFU: "bitcoin", HUT: "bitcoin", BITF: "bitcoin", BTBT: "bitcoin", HIVE: "bitcoin", CORZ: "bitcoin", CAN: "bitcoin", SDIG: "bitcoin",
  IBIT: "bitcoin", GBTC: "bitcoin", FBTC: "bitcoin", BITO: "bitcoin", ARKB: "bitcoin", BITB: "bitcoin", HODL: "bitcoin", BRRR: "bitcoin", EZBC: "bitcoin", BTCW: "bitcoin",
  MSTU: "bitcoin", MSTX: "bitcoin", MSBT: "bitcoin", BITX: "bitcoin", BITU: "bitcoin", MSTY: "bitcoin",
  BLOK: "bitcoin", BKCH: "bitcoin", BITQ: "bitcoin", WGMI: "bitcoin",
  BTCUSD: "crypto", ETHUSD: "crypto", SOLUSD: "crypto", XRPUSD: "crypto", DOGEUSD: "crypto", ADAUSD: "crypto", AVAXUSD: "crypto", LINKUSD: "crypto", MATICUSD: "crypto", LTCUSD: "crypto", SHIBUSD: "crypto",
  BTC: "crypto", ETH: "crypto", SOL: "crypto", XRP: "crypto", DOGE: "crypto", ADA: "crypto", AVAX: "crypto", LINK: "crypto", MATIC: "crypto", LTC: "crypto", SHIB: "crypto"
};
const FINAL_QUALITY_ALERT_MIN = 70;
const SIGNAL_STALE_MS = 15 * 60 * 1000;
const DECISION_TAKE_QUALITY_MIN = 75;
const DECISION_TAKE_RR1_MIN = 1.5;
const MOMENTUM_CANDLE_LIMIT = 40;
const MOMENTUM_EMA_SHORT = 9;
const MOMENTUM_EMA_MEDIUM = 20;
const MOMENTUM_MIN_SCORE = 60;
const MOMENTUM_MIN_CONFIDENCE = 5;
const MOMENTUM_MAX_ENTRY_DISTANCE_PCT = 2.25;
const MOMENTUM_MAX_STOP_PCT = 2;
const MOMENTUM_POSITION_SCALE = 0.7;

const state = {
  events: await loadEvents(),
  journal: await loadJournal(),
  scans: new Map(),
  news: new Map(),
  lastSignals: new Map(),
  latestAlerts: new Map(),
  sentAlertMap: new Map(),
  latestSentAlerts: [],
  lifecycle: new Map(),
  latestMarketMap: new Map(),
  latestMarketByMode: new Map(),
  marketRegime: {
    regime: "unknown",
    spy_change_pct: null,
    qqq_change_pct: null,
    score: 0,
    updatedAt: null
  },
  nextBatchIndex: 0,
  nextBatchIndexByMode: new Map(),
  lastScanSummary: null,
  lastScanSummaryByMode: new Map(),
  autoScan: {
    enabled: false,
    intervalMs: AUTO_SCAN_INTERVAL_MS,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
    runCount: 0,
    nextModeIndex: 0,
    lastMode: null,
    lastError: null,
    lastSkippedAt: null
  },
  dashboardSessions: new Map(),
  dashboardSessionSweeper: null
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, status: "running" }, { headOnly: req.method === "HEAD" });
    }

    if (!isDashboardRequestAuthorized(req, url)) {
      return sendDashboardAuthChallenge(res);
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/") {
      return sendHtml(res, renderTradingPlatform(), { headOnly: req.method === "HEAD" });
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/public/")) {
      return sendStaticFile(res, url.pathname, { headOnly: req.method === "HEAD" });
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/overview") {
      return sendJson(res, 200, getDashboardOverview());
    }

    if (req.method === "POST" && url.pathname === "/api/dashboard/session/start") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, await startDashboardSession(parsePayload(rawBody)));
    }

    if (req.method === "POST" && url.pathname === "/api/dashboard/session/heartbeat") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, heartbeatDashboardSession(parsePayload(rawBody)));
    }

    if (req.method === "POST" && url.pathname === "/api/dashboard/session/stop") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, stopDashboardSession(parsePayload(rawBody)));
    }

    if (req.method === "GET" && url.pathname === "/api/ai/status") {
      return sendJson(res, 200, getAiBrainStatus());
    }

    if (req.method === "POST" && url.pathname === "/api/ai/test") {
      return sendJson(res, 200, await testAiBrain());
    }

    if (req.method === "POST" && url.pathname === "/api/ai/chat") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, await tradingAssistantChat(parsePayload(rawBody)));
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/signals") {
      return sendJson(res, 200, getDashboardSignals(getOptionalMode(url), url.searchParams));
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/alerts") {
      return sendJson(res, 200, getDashboardAlerts());
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/news") {
      return sendJson(res, 200, await getDashboardNews(getOptionalMode(url), shouldRefreshScan(url)));
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/ticker") {
      return sendJson(res, 200, await getDashboardTicker(url.searchParams.get("symbol"), shouldRefreshScan(url)));
    }

    if (req.method === "GET" && url.pathname === "/api/chart-signal") {
      return sendJson(res, 200, await getChartSignal(url.searchParams.get("ticker"), getOptionalMode(url), shouldRefreshScan(url)));
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/execution") {
      return sendJson(res, 200, getDashboardExecution(getOptionalMode(url)));
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/lifecycle") {
      return sendJson(res, 200, getDashboardLifecycle());
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/journal") {
      return sendJson(res, 200, getDashboardJournal());
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/settings") {
      return sendJson(res, 200, getDashboardSettings());
    }

    if (req.method === "GET" && url.pathname === "/latest") {
      return sendJson(res, 200, {
        count: state.events.length,
        latest: state.events[0] || null,
        events: state.events.slice(0, 20)
      });
    }

    if (req.method === "GET" && url.pathname === "/scan") {
      const request = getScanRequest(url.searchParams.get("symbols"), shouldRefreshScan(url), getScanMode(url));
      const scan = await getMarketScan(request, shouldRefreshScan(url));
      const news = await getLatestNews(parseNewsSymbols(url.searchParams.get("newsSymbols"), scan.mode), false);
      return sendHtml(res, renderScan(scan, news));
    }

    if (req.method === "GET" && url.pathname === "/scan.json") {
      const request = getScanRequest(url.searchParams.get("symbols"), shouldRefreshScan(url), getScanMode(url));
      return sendJson(res, 200, await getMarketScan(request, shouldRefreshScan(url)));
    }

    if (req.method === "GET" && url.pathname === "/scan/latest.json") {
      return sendJson(res, 200, getLatestScan());
    }

    if (req.method === "GET" && url.pathname === "/market/latest.json") {
      return sendJson(res, 200, getLatestMarket());
    }

    if (req.method === "GET" && url.pathname === "/regime.json") {
      return sendJson(res, 200, {
        ok: true,
        createdAt: new Date().toISOString(),
        market_regime: state.marketRegime
      });
    }

    if (req.method === "GET" && url.pathname === "/signals/latest.json") {
      return sendJson(res, 200, getLatestSignals(getOptionalMode(url)));
    }

    if (req.method === "GET" && url.pathname === "/signals/intraday.json") {
      return sendJson(res, 200, getLatestSignals("intraday"));
    }

    if (req.method === "GET" && url.pathname === "/signals/swing.json") {
      return sendJson(res, 200, getLatestSignals("swing"));
    }

    if (req.method === "GET" && url.pathname === "/signals/futures.json") {
      return sendJson(res, 200, getLatestSignals("futures"));
    }

    if (req.method === "GET" && url.pathname === "/signals/crypto.json") {
      return sendJson(res, 200, getLatestSignals("crypto"));
    }

    if (req.method === "GET" && url.pathname === "/signals/take.json") {
      return sendJson(res, 200, getSignalsByDecision("take"));
    }

    if (req.method === "GET" && url.pathname === "/signals/watch.json") {
      return sendJson(res, 200, getSignalsByDecision("watch"));
    }

    if (req.method === "GET" && url.pathname === "/signals/skip.json") {
      return sendJson(res, 200, getSignalsByDecision("skip"));
    }

    if (req.method === "GET" && url.pathname === "/decisions/latest.json") {
      return sendJson(res, 200, getLatestDecisions(getOptionalMode(url)));
    }

    if (req.method === "GET" && url.pathname === "/universe.json") {
      return sendJson(res, 200, getUniverseSummary());
    }

    if (req.method === "GET" && url.pathname === "/alerts/latest.json") {
      return sendJson(res, 200, getLatestAlerts(getOptionalMode(url)));
    }

    if (req.method === "GET" && url.pathname === "/alerts/intraday.json") {
      return sendJson(res, 200, getLatestAlerts("intraday"));
    }

    if (req.method === "GET" && url.pathname === "/alerts/swing.json") {
      return sendJson(res, 200, getLatestAlerts("swing"));
    }

    if (req.method === "GET" && url.pathname === "/alerts/futures.json") {
      return sendJson(res, 200, getLatestAlerts("futures"));
    }

    if (req.method === "GET" && url.pathname === "/alerts/crypto.json") {
      return sendJson(res, 200, getLatestAlerts("crypto"));
    }

    if (req.method === "GET" && url.pathname === "/alerts/sent.json") {
      return sendJson(res, 200, getSentAlerts());
    }

    if (req.method === "GET" && url.pathname === "/execution/plan.json") {
      return sendJson(res, 200, getExecutionPlans(getOptionalMode(url)));
    }

    if (req.method === "GET" && url.pathname === "/execution/settings.json") {
      return sendJson(res, 200, {
        ok: true,
        createdAt: new Date().toISOString(),
        settings: getExecutionSettings()
      });
    }

    if (req.method === "GET" && url.pathname === "/lifecycle/latest.json") {
      return sendJson(res, 200, getLifecycle("latest"));
    }

    if (req.method === "GET" && url.pathname === "/lifecycle/open.json") {
      return sendJson(res, 200, getLifecycle("open"));
    }

    if (req.method === "GET" && url.pathname === "/lifecycle/closed.json") {
      return sendJson(res, 200, getLifecycle("closed"));
    }

    if (req.method === "POST" && url.pathname === "/alerts/test") {
      return sendJson(res, 200, await sendTestAlert());
    }

    if (req.method === "GET" && url.pathname === "/journal.json") {
      return sendJson(res, 200, getJournal());
    }

    if (req.method === "GET" && url.pathname === "/journal/stats.json") {
      return sendJson(res, 200, getJournalStats());
    }

    if (req.method === "POST" && url.pathname === "/journal/add") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, await addJournalEntry(parsePayload(rawBody)));
    }

    if (req.method === "POST" && url.pathname === "/journal/update") {
      const rawBody = await readBody(req);
      return sendJson(res, 200, await updateJournalEntry(parsePayload(rawBody)));
    }

    if (req.method === "GET" && url.pathname === "/news/latest.json") {
      const symbols = parseNewsSymbols(url.searchParams.get("symbols"), getOptionalMode(url));
      return sendJson(res, 200, await getLatestNews(symbols, shouldRefreshScan(url)));
    }

    if (req.method === "GET" && url.pathname === "/auto-scan/status.json") {
      return sendJson(res, 200, getAutoScanStatus());
    }

    if (req.method === "POST" && url.pathname === "/auto-scan/start") {
      startAutoScan();
      if (wantsHtml(req)) return redirect(res, "/scan");
      return sendJson(res, 200, getAutoScanStatus());
    }

    if (req.method === "POST" && url.pathname === "/auto-scan/stop") {
      stopAutoScan();
      if (wantsHtml(req)) return redirect(res, "/scan");
      return sendJson(res, 200, getAutoScanStatus());
    }

    if (req.method === "POST" && url.pathname === "/auto-scan/run-now") {
      const result = await runAutoScanNow("manual");
      if (wantsHtml(req)) return redirect(res, "/scan");
      return sendJson(res, 200, {
        status: getAutoScanStatus(),
        result
      });
    }

    if (req.method === "POST" && url.pathname === "/scan/run") {
      const rawBody = await readBody(req);
      const payload = parsePayload(rawBody);
      const request = getScanRequest(Array.isArray(payload.symbols) ? payload.symbols.join(",") : payload.symbols, true, normalizeMode(payload.mode));
      return sendJson(res, 200, await getMarketScan(request, true));
    }

    if (req.method === "POST" && url.pathname === "/webhook/tradingview") {
      if (!isAuthorized(req, url)) {
        return sendJson(res, 401, { ok: false, error: "Unauthorized webhook token." });
      }

      const rawBody = await readBody(req);
      const payload = normalizePayload(parsePayload(rawBody));
      console.log("TradingView alert received:", payload);
      const event = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: "queued",
        payload,
        rawBody,
        analysis: null,
        error: null
      };

      state.events.unshift(event);
      state.events = state.events.slice(0, 100);
      await saveEvents();

      sendJson(res, 202, { ok: true, id: event.id, status: event.status });
      void analyzeEvent(event);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found." });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Unexpected error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`TradingView ChatGPT bridge listening on http://${HOST}:${PORT}`);
  if (!WEBHOOK_SECRET) {
    console.warn("WEBHOOK_SECRET is not set. Set it before exposing this server publicly.");
  }
  startDashboardSessionSweeper();
});

async function loadDotEnv() {
  const envFile = new URL("./.env", import.meta.url);
  if (!existsSync(envFile)) return;

  const content = await readFile(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function analyzeEvent(event) {
  event.status = "analyzing";
  await saveEvents();

  try {
    const data = await callOpenAI({
      instructions: [
        "You are a trading-analysis assistant receiving TradingView alert webhooks.",
        "Be concise, practical, and risk-aware.",
        "Do not claim certainty, do not provide personalized financial advice, and do not place trades.",
        "Return a compact trade-plan style analysis with: signal summary, directional bias, entry trigger to watch, invalidation/stop area, target ideas, risk notes, and confidence.",
        "If the payload lacks enough context for a real trade plan, say exactly what extra chart context is missing."
      ].join(" "),
      input: JSON.stringify(event.payload, null, 2),
      maxOutputTokens: 700,
      errorLabel: "OpenAI alert analysis"
    });
    event.status = "complete";
    event.analysis = extractResponseText(data);
  } catch (error) {
    event.status = "error";
    event.error = error.message || "Analysis failed.";
  }

  await saveEvents();
}

async function getMarketScan(request, refresh = false) {
  const cacheKey = request.cacheKey;
  const cached = state.scans.get(cacheKey);
  const now = Date.now();

  if (!refresh && cached && now - cached.cachedAt < SCAN_CACHE_TTL_MS) {
    return {
      ...cached.scan,
      cache: {
        hit: true,
        ageSeconds: Math.round((now - cached.cachedAt) / 1000),
        ttlSeconds: Math.round(SCAN_CACHE_TTL_MS / 1000)
      }
    };
  }

  const scan = await runMarketScan(request);
  const cachedScan = {
    ...scan,
    cache: {
      hit: false,
      ageSeconds: 0,
      ttlSeconds: Math.round(SCAN_CACHE_TTL_MS / 1000)
    }
  };
  state.scans.set(cacheKey, {
    cachedAt: now,
    scan: cachedScan
  });
  return cachedScan;
}

function startAutoScan() {
  if (state.autoScan.timer) {
    state.autoScan.enabled = true;
    state.autoScan.nextRunAt ||= new Date(Date.now() + state.autoScan.intervalMs).toISOString();
    return;
  }

  state.autoScan.enabled = true;
  state.autoScan.nextRunAt = new Date(Date.now() + state.autoScan.intervalMs).toISOString();
  state.autoScan.timer = setInterval(() => {
    void runAutoScanNow("timer");
  }, state.autoScan.intervalMs);
}

function stopAutoScan() {
  if (state.autoScan.timer) {
    clearInterval(state.autoScan.timer);
  }

  state.autoScan.enabled = false;
  state.autoScan.timer = null;
  state.autoScan.nextRunAt = null;
}

async function startDashboardSession(payload = {}) {
  const sessionId = normalizeSessionId(payload.session_id || payload.sessionId || randomUUID());
  const now = new Date().toISOString();

  state.dashboardSessions.set(sessionId, {
    session_id: sessionId,
    started_at: state.dashboardSessions.get(sessionId)?.started_at || now,
    last_seen_at: now,
    user_agent: String(payload.user_agent || "").slice(0, 180)
  });

  startDashboardSessionSweeper();
  startAutoScan();

  maybeKickoffSwingScan("website-open");

  return {
    ok: true,
    session_id: sessionId,
    online_mode: true,
    message: "Dashboard session active. Auto-scan runs only while the website is open.",
    auto_scan: getAutoScanStatus()
  };
}

function heartbeatDashboardSession(payload = {}) {
  const sessionId = normalizeSessionId(payload.session_id || payload.sessionId);
  if (!sessionId) {
    return {
      ok: false,
      error: "session_id is required.",
      auto_scan: getAutoScanStatus()
    };
  }

  const existing = state.dashboardSessions.get(sessionId);
  const now = new Date().toISOString();
  state.dashboardSessions.set(sessionId, {
    session_id: sessionId,
    started_at: existing?.started_at || now,
    last_seen_at: now,
    user_agent: existing?.user_agent || String(payload.user_agent || "").slice(0, 180)
  });

  if (!state.autoScan.enabled) startAutoScan();
  maybeKickoffSwingScan("website-heartbeat");

  return {
    ok: true,
    session_id: sessionId,
    online_mode: true,
    auto_scan: getAutoScanStatus()
  };
}

function maybeKickoffSwingScan(source = "website-online") {
  const lastRunMs = Date.parse(state.autoScan.lastRunAt || "");
  const shouldRunSwingKickoff = !state.autoScan.running && (!lastRunMs || Date.now() - lastRunMs > SCAN_CACHE_TTL_MS);
  if (shouldRunSwingKickoff) {
    void runAutoScanNow(source, "swing");
  }
}

function stopDashboardSession(payload = {}) {
  const sessionId = normalizeSessionId(payload.session_id || payload.sessionId);
  if (sessionId) state.dashboardSessions.delete(sessionId);
  cleanupDashboardSessions();
  const stillOnline = hasActiveDashboardSessions();

  if (!stillOnline) {
    stopAutoScan();
  }

  return {
    ok: true,
    session_id: sessionId || null,
    online_mode: stillOnline,
    auto_scan: getAutoScanStatus()
  };
}

function startDashboardSessionSweeper() {
  if (state.dashboardSessionSweeper) return;
  state.dashboardSessionSweeper = setInterval(() => {
    cleanupDashboardSessions();
    if (!hasActiveDashboardSessions() && state.autoScan.enabled) {
      stopAutoScan();
    }
  }, DASHBOARD_SESSION_SWEEP_MS);
}

function cleanupDashboardSessions() {
  const now = Date.now();
  for (const [sessionId, session] of state.dashboardSessions.entries()) {
    const lastSeen = Date.parse(session.last_seen_at || "");
    if (!lastSeen || now - lastSeen > DASHBOARD_SESSION_TIMEOUT_MS) {
      state.dashboardSessions.delete(sessionId);
    }
  }
}

function hasActiveDashboardSessions() {
  cleanupDashboardSessions();
  return state.dashboardSessions.size > 0;
}

function getDashboardSessionStatus() {
  cleanupDashboardSessions();
  return {
    online_mode: true,
    active_dashboard_sessions: state.dashboardSessions.size,
    session_timeout_ms: DASHBOARD_SESSION_TIMEOUT_MS,
    auto_scan_runs_only_when_website_open: true,
    sessions: [...state.dashboardSessions.values()].map((session) => ({
      session_id: session.session_id,
      started_at: session.started_at,
      last_seen_at: session.last_seen_at
    }))
  };
}

function normalizeSessionId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function getNextAutoScanMode() {
  const index = state.autoScan.nextModeIndex % AUTO_SCAN_MODE_SEQUENCE.length;
  const mode = AUTO_SCAN_MODE_SEQUENCE[index] || "swing";
  state.autoScan.nextModeIndex = (state.autoScan.nextModeIndex + 1) % AUTO_SCAN_MODE_SEQUENCE.length;
  return normalizeMode(mode);
}

async function runAutoScanNow(source = "manual", requestedMode = null) {
  if (state.autoScan.running) {
    state.autoScan.lastSkippedAt = new Date().toISOString();
    return {
      ok: false,
      skipped: true,
      reason: "Auto-scan is already running.",
      source
    };
  }

  state.autoScan.running = true;
  state.autoScan.lastError = null;

  try {
    const mode = requestedMode ? normalizeMode(requestedMode) : getNextAutoScanMode();
    const request = getScanRequest(null, true, mode);
    const scan = await getMarketScan(request, true);
    state.autoScan.runCount += 1;
    state.autoScan.lastMode = mode;
    state.autoScan.lastRunAt = scan.createdAt;
    state.autoScan.nextRunAt = state.autoScan.enabled
      ? new Date(Date.now() + state.autoScan.intervalMs).toISOString()
      : null;

    return {
      ok: true,
      skipped: false,
      source,
      mode,
      batchNumber: scan.batchNumber,
      batchTotal: scan.batchTotal,
      scannedCount: scan.scannedCount,
      marketCount: scan.marketCount,
      signalCount: scan.signals?.length || 0,
      error: scan.error
    };
  } catch (error) {
    state.autoScan.lastError = error.message || "Auto-scan failed.";
    state.autoScan.nextRunAt = state.autoScan.enabled
      ? new Date(Date.now() + state.autoScan.intervalMs).toISOString()
      : null;

    return {
      ok: false,
      skipped: false,
      source,
      error: state.autoScan.lastError
    };
  } finally {
    state.autoScan.running = false;
  }
}

function getAutoScanStatus() {
  cleanupDashboardSessions();
  return {
    ok: true,
    auto_scan_enabled: state.autoScan.enabled,
    auto_scan_running: state.autoScan.running,
    auto_scan_interval_ms: state.autoScan.intervalMs,
    auto_scan_last_run_at: state.autoScan.lastRunAt,
    auto_scan_next_run_at: state.autoScan.nextRunAt,
    auto_scan_run_count: state.autoScan.runCount,
    auto_scan_last_mode: state.autoScan.lastMode,
    auto_scan_mode_sequence: AUTO_SCAN_MODE_SEQUENCE,
    swing_scan_priority: true,
    auto_scan_last_error: state.autoScan.lastError,
    auto_scan_last_skipped_at: state.autoScan.lastSkippedAt,
    current_batch_index: getNextBatchIndexForMode("all"),
    current_batch_number: getNextBatchIndexForMode("all") + 1,
    batch_size: ROTATING_SCAN_BATCH_SIZE,
    batch_total: Math.ceil(SCAN_MODES.all.universe.length / ROTATING_SCAN_BATCH_SIZE),
    universe_size: SCAN_MODES.all.universe.length,
    auto_scan_mode: "all",
    online_mode: true,
    active_dashboard_sessions: state.dashboardSessions.size,
    runs_only_when_website_open: true,
    session_timeout_ms: DASHBOARD_SESSION_TIMEOUT_MS
  };
}

function getUniverseSummary() {
  const modes = Object.fromEntries(
    Object.entries(SCAN_MODES).map(([mode, config]) => [
      mode,
      {
        label: config.label,
        asset_class: config.assetClass,
        hold_window: config.holdWindow,
        count: config.universe.length,
        symbols: config.universe
      }
    ])
  );

  return {
    ok: true,
    batch_size: ROTATING_SCAN_BATCH_SIZE,
    market_coverage: MARKET_COVERAGE,
    bitcoin_linked_groups: {
      direct_proxy: ["MSTR", "COIN", "GLXY", "SQ", "HOOD", "PYPL"],
      miners: ["IREN", "MARA", "RIOT", "CLSK", "CIFR", "WULF", "BTDR", "FUFU", "HUT", "BITF", "BTBT", "HIVE", "CORZ", "CAN", "SDIG"],
      spot_and_futures_etfs: ["IBIT", "GBTC", "FBTC", "BITO", "ARKB", "BITB", "HODL", "BRRR", "EZBC", "BTCW"],
      leveraged_and_synthetic: ["MSTU", "MSTX", "MSBT", "BITX", "BITU", "MSTY"],
      blockchain_etfs: ["BLOK", "BKCH", "BITQ", "WGMI"]
    },
    modes
  };
}

async function runMarketScan(request) {
  const configuredFinnhub = isConfiguredKey(FINNHUB_API_KEY, "your_finnhub_key_here");
  const configuredOpenAI = isConfiguredKey(OPENAI_API_KEY, "your_openai_api_key_here");
  const createdAt = new Date().toISOString();
  const symbols = request.symbols;

  if (!configuredFinnhub) {
    return {
      ok: false,
      createdAt,
      symbols,
      mode: request.mode,
      modeLabel: request.modeConfig.label,
      assetClass: request.modeConfig.assetClass,
      holdWindow: request.modeConfig.holdWindow,
      universeSize: request.universeSize,
      batchNumber: request.batchNumber,
      batchTotal: request.batchTotal,
      batchStart: request.batchStart,
      batchEnd: request.batchEnd,
      rotating: request.rotating,
      scannedCount: symbols.length,
      marketCount: state.latestMarketMap.size,
      topCount: 0,
      quotes: [],
      market: getMarketRows(),
      rankedCandidates: [],
      signals: [],
      error: "FINNHUB_API_KEY is not set. Add it to .env, then restart npm start."
    };
  }

  const quotes = await fetchFinnhubQuotesBatched(symbols);
  advanceRotatingBatch(request);
  updateMarketMap(quotes, createdAt, request);
  state.marketRegime = calculateMarketRegime();
  const market = getMarketRows(request.mode);
  const rankedCandidates = (await enrichRankedCandidatesForMode(
    rankScanCandidates(market, request.mode).slice(0, AI_CANDIDATE_LIMIT),
    request
  ));

  const scan = {
    ok: true,
    createdAt,
    symbols,
    mode: request.mode,
    modeLabel: request.modeConfig.label,
    assetClass: request.modeConfig.assetClass,
    holdWindow: request.modeConfig.holdWindow,
    universeSize: request.universeSize,
    batchNumber: request.batchNumber,
    batchTotal: request.batchTotal,
    batchStart: request.batchStart,
    batchEnd: request.batchEnd,
    rotating: request.rotating,
    scannedCount: symbols.length,
    marketCount: market.length,
    topCount: rankedCandidates.length,
    quotes,
    market,
    rankedCandidates,
    signals: [],
    market_regime: state.marketRegime,
    error: null
  };
  state.lastScanSummary = summarizeScan(scan);
  state.lastScanSummaryByMode.set(request.mode, state.lastScanSummary);

  if (!configuredOpenAI) {
    scan.error = "OPENAI_API_KEY is not set, so scanner candidates loaded without AI signals.";
    return scan;
  }

  if (!rankedCandidates.length) {
    scan.error = "No candidates passed the scanner filters.";
    return scan;
  }

  try {
    const strictSignals = await analyzeScanWithOpenAI(rankedCandidates, request);
    const momentumSignals = buildMomentumSignals(rankedCandidates, strictSignals, request);
    scan.signals = annotateSignalChanges(mergeSignalsByVariant([...strictSignals, ...momentumSignals]), request);
    await updateSignalLifecycles(scan.signals);
    await deliverEligibleAlerts(scan.signals);
    state.lastScanSummary = summarizeScan(scan);
    state.lastScanSummaryByMode.set(request.mode, state.lastScanSummary);
  } catch (error) {
    scan.error = error.message || "OpenAI scan analysis failed.";
  }

  return scan;
}

function getLatestScan() {
  let latest = null;

  for (const entry of state.scans.values()) {
    if (!latest || entry.cachedAt > latest.cachedAt) {
      latest = entry;
    }
  }

  if (!latest) {
    return {
      ok: false,
      error: "No scan has been run yet. Open /scan or /scan.json first."
    };
  }

  return {
    ...latest.scan,
    cache: {
      ...latest.scan.cache,
      hit: true,
      ageSeconds: Math.round((Date.now() - latest.cachedAt) / 1000)
    }
  };
}

async function fetchFinnhubQuotesBatched(symbols) {
  const quotes = [];

  for (let index = 0; index < symbols.length; index += FINNHUB_REQUEST_BATCH_SIZE) {
    const batch = symbols.slice(index, index + FINNHUB_REQUEST_BATCH_SIZE);
    const batchQuotes = [];

    for (const symbol of batch) {
      batchQuotes.push(await fetchFinnhubQuote(symbol));
      await sleep(FINNHUB_REQUEST_DELAY_MS);
    }

    quotes.push(...batchQuotes);

    if (index + FINNHUB_REQUEST_BATCH_SIZE < symbols.length) {
      await sleep(SCAN_BATCH_DELAY_MS);
    }
  }

  return quotes;
}

async function getTickerQuote(symbol, refresh = false) {
  const ticker = normalizeMarketTicker(symbol);
  const existing = state.latestMarketMap.get(ticker);
  const cachedAt = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

  if (!refresh && existing?.ok && cachedAt && Date.now() - cachedAt < SCAN_CACHE_TTL_MS) {
    return {
      ...existing,
      cache: {
        hit: true,
        ageSeconds: Math.round((Date.now() - cachedAt) / 1000)
      }
    };
  }

  if (!CRYPTO_SYMBOLS[ticker] && !isConfiguredKey(FINNHUB_API_KEY, "your_finnhub_key_here")) {
    return {
      ok: false,
      symbol: ticker,
      error: "FINNHUB_API_KEY is not set. Add it to .env, then restart npm start."
    };
  }

  const quote = await fetchFinnhubQuote(ticker);
  if (quote?.ok) {
    const updated = { ...quote, updatedAt: new Date().toISOString() };
    state.latestMarketMap.set(ticker, updated);
    return {
      ...updated,
      cache: {
        hit: false,
        ageSeconds: 0
      }
    };
  }

  return quote;
}

async function fetchFinnhubQuote(symbol) {
  const normalizedSymbol = normalizeMarketTicker(symbol);
  if (CRYPTO_SYMBOLS[normalizedSymbol]) {
    return fetchCryptoQuote(normalizedSymbol);
  }

  if (INDEX_SYMBOLS[normalizedSymbol]) {
    return fetchIndexQuote(normalizedSymbol);
  }

  return fetchFinnhubEquityQuote(normalizedSymbol);
}

async function fetchIndexQuote(symbol) {
  const config = INDEX_SYMBOLS[symbol];
  const primary = await fetchFinnhubEquityQuote(config.providerSymbol, symbol, {
    displayName: config.displayName,
    sourceSymbol: config.providerSymbol,
    assetClass: config.assetClass
  });

  if (primary.ok && Number(primary.current) > 0) return primary;

  const fallback = await fetchFinnhubEquityQuote(config.fallbackSymbol, symbol, {
    displayName: `${config.displayName} proxy via ${config.fallbackSymbol}`,
    sourceSymbol: config.fallbackSymbol,
    assetClass: config.assetClass,
    proxy: true,
    proxy_symbol: config.fallbackSymbol
  });

  return fallback.ok
    ? fallback
    : {
        ok: false,
        symbol,
        displayName: config.displayName,
        error: primary.error || fallback.error || "Index quote failed."
      };
}

async function fetchFinnhubEquityQuote(providerSymbol, displaySymbol = providerSymbol, extras = {}) {
  const endpoint = new URL("https://finnhub.io/api/v1/quote");
  endpoint.searchParams.set("symbol", providerSymbol);
  endpoint.searchParams.set("token", FINNHUB_API_KEY);

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Finnhub request failed with ${response.status}`);
    }

    return {
      ...addSessionPriceFields({
      ok: true,
      symbol: displaySymbol,
      current: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t ? new Date(data.t * 1000).toISOString() : null,
      ...extras
      })
    };
  } catch (error) {
    return {
      ...addSessionPriceFields({
      ok: false,
      symbol: displaySymbol,
      sourceSymbol: providerSymbol,
      error: error.message || "Finnhub quote failed.",
      ...extras
      })
    };
  }
}

async function fetchCryptoQuote(symbol) {
  const config = CRYPTO_SYMBOLS[symbol];
  const endpoint = new URL("https://api.binance.us/api/v3/ticker/24hr");
  endpoint.searchParams.set("symbol", config.pair);

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.msg || `Crypto quote request failed with ${response.status}`);
    }

    const current = Number(data.lastPrice);
    const open = Number(data.openPrice);
    const high = Number(data.highPrice);
    const low = Number(data.lowPrice);
    const change = Number(data.priceChange);
    const changePercent = Number(data.priceChangePercent);

    return {
      ...addSessionPriceFields({
      ok: true,
      symbol,
      displayName: config.label,
      source: "binance.us",
      cryptoPair: config.pair,
      current,
      change,
      changePercent,
      high,
      low,
      open,
      previousClose: open,
      timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      ...addSessionPriceFields({
      ok: false,
      symbol,
      source: "binance.us",
      error: error.message || "Crypto quote failed."
      })
    };
  }
}

function addSessionPriceFields(quote) {
  const assetClass = quote.assetClass || inferAssetClass(quote.symbol);
  const mode = inferSourceMode(quote.symbol);
  const session = getMarketSession(mode, assetClass);
  const current = Number(quote.current);
  const previousClose = Number(quote.previousClose);
  const cryptoLike = assetClass === "crypto";
  const regularMarketPrice = session.session_type === "regular" || cryptoLike
    ? current
    : Number.isFinite(previousClose) ? previousClose : null;
  const premarketPrice = session.session_type === "premarket" && Number.isFinite(current) ? current : null;
  const afterhoursPrice = session.session_type === "afterhours" && Number.isFinite(current) ? current : null;
  const extendedHoursPrice = premarketPrice ?? afterhoursPrice;
  const activePriceLabel = cryptoLike
    ? "24/7 live"
    : session.session_type === "premarket"
      ? "premarket"
      : session.session_type === "afterhours"
        ? "afterhours"
        : session.session_type === "regular"
          ? "regular"
          : "latest";

  return {
    ...quote,
    active_price: Number.isFinite(current) ? current : null,
    active_price_label: activePriceLabel,
    regular_market_price: Number.isFinite(regularMarketPrice) ? regularMarketPrice : null,
    premarket_price: premarketPrice,
    afterhours_price: afterhoursPrice,
    extended_hours_price: Number.isFinite(extendedHoursPrice) ? extendedHoursPrice : null,
    extended_hours_session: extendedHoursPrice === premarketPrice && premarketPrice !== null
      ? "premarket"
      : extendedHoursPrice === afterhoursPrice && afterhoursPrice !== null
        ? "afterhours"
        : null,
    extended_hours_note: cryptoLike
      ? "Crypto trades 24/7."
      : "Premarket/afterhours price is shown when the active quote is in that session.",
    market_session: session.session_type,
    session_open_flag: session.session_open_flag
  };
}

async function analyzeScanWithOpenAI(rankedQuotes, request) {
  const data = await callOpenAI({
    instructions: [
      "You are a trading signal engine reviewing pre-filtered market scanner candidates.",
      "Be concise, practical, and risk-aware.",
      "Do not provide personalized financial advice and do not place trades.",
      "Return strict JSON only. No markdown, no prose outside JSON.",
      `Scanner mode: ${request.modeConfig.label}. Focus: ${request.modeConfig.promptFocus}.`,
      `Default hold window: ${request.modeConfig.holdWindow}. Asset class: ${request.modeConfig.assetClass}.`,
      "Also detect obvious bull runs or strong upward trends even if the setup is not perfect. Prefer clear, visible momentum over perfect but rare setups.",
      "Return an array of objects with exactly these keys: ticker, bias, entry, stop, target1, target2, confidence, reason, invalid_if, buy_trigger, sell_trigger, bull_run_flag, hold_window, setup_score, momentum_score, trend_label, momentum_reason.",
      "The ticker value must exactly match the candidate symbol provided. For crypto, use the dashboard symbols like BTCUSD, ETHUSD, SOLUSD, XRPUSD, DOGEUSD, ADAUSD, AVAXUSD, LINKUSD, MATICUSD, LTCUSD, or SHIBUSD, not exchange pair names like BTCUSDT.",
      "confidence must be a number from 1 to 10.",
      "setup_score must be a number from 1 to 100.",
      "momentum_score must be a number from 0 to 100.",
      "trend_label must be one of: strong uptrend, breakout, continuation, early trend.",
      "momentum_reason must be short plain English explaining why momentum is visible.",
      "bull_run_flag must be true only for strong upside momentum or clean continuation setups.",
      "For bitcoin-linked candidates, use bitcoin_pulse, bitcoin_profile, bitcoin_news_headlines, and bitcoin_activity_links to judge whether the ticker is moving with BTC swings, crypto activity, or news. Miners and leveraged ETFs can move faster than BTC; spot ETFs should track BTC more closely.",
      "For bitcoin-linked downside momentum, use bearish/watch/skip language with a sell_trigger; do not force bullish signals when BTC pulse is weak or breaking down.",
      "If a candidate lacks enough context, still return a cautious signal and mention missing context in reason or invalid_if."
    ].join(" "),
    input: JSON.stringify(rankedQuotes, null, 2),
    maxOutputTokens: 1400,
    errorLabel: "OpenAI scan analysis"
  });

  return parseJsonSignals(extractResponseText(data), rankedQuotes, request);
}

async function callOpenAI({ instructions, input, maxOutputTokens = 700, errorLabel = "OpenAI request" }) {
  if (!isConfiguredKey(OPENAI_API_KEY, "your_openai_api_key_here")) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env, then restart npm start.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions,
      input,
      max_output_tokens: maxOutputTokens
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `${errorLabel} failed with ${response.status}`);
  }

  return data;
}

function isAuthorized(req, url) {
  if (!WEBHOOK_SECRET) return true;
  const headerToken = req.headers["x-webhook-token"];
  const queryToken = url.searchParams.get("token");
  return headerToken === WEBHOOK_SECRET || queryToken === WEBHOOK_SECRET;
}

function isDashboardAuthEnabled() {
  return Boolean(DASHBOARD_USERNAME && DASHBOARD_PASSWORD);
}

function isDashboardRequestAuthorized(req, url) {
  if (!isDashboardAuthEnabled()) return true;
  if (url.pathname === "/health") return true;

  const credentials = parseBasicAuthHeader(req.headers.authorization);
  if (!credentials) return false;
  return credentials.username === DASHBOARD_USERNAME && credentials.password === DASHBOARD_PASSWORD;
}

function parseBasicAuthHeader(headerValue) {
  const header = String(headerValue || "");
  if (!header.startsWith("Basic ")) return null;
  const encoded = header.slice(6).trim();
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function parsePayload(rawBody) {
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return { message: rawBody };
  }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { message: String(payload ?? "") };
  }

  const symbol = payload.symbol || payload.ticker;
  const action = payload.action || payload.strategy_order_action;
  const signal = payload.signal || action;

  return {
    ...payload,
    ...(symbol ? { symbol, ticker: payload.ticker || symbol } : {}),
    ...(action ? { action } : {}),
    ...(signal ? { signal } : {})
  };
}

function isConfiguredKey(value, placeholder) {
  return Boolean(value && value.trim() && value.trim() !== placeholder);
}

function getScanRequest(value, refresh = false, mode = "intraday") {
  const normalizedMode = normalizeMode(mode);
  const modeConfig = SCAN_MODES[normalizedMode];
  if (value) {
    const symbols = parseSymbols(value, 160);
    return {
      symbols,
      mode: normalizedMode,
      modeConfig,
      refresh,
      universeSize: symbols.length,
      batchNumber: 1,
      batchTotal: 1,
      batchStart: 1,
      batchEnd: symbols.length,
      rotating: false,
      cacheKey: `custom:${normalizedMode}:${symbols.join(",")}`
    };
  }

  const universe = modeConfig.universe;
  const batchTotal = Math.ceil(universe.length / ROTATING_SCAN_BATCH_SIZE);
  const latestBatchIndex = state.lastScanSummaryByMode.get(normalizedMode)?.batchIndex;
  const nextBatchIndex = getNextBatchIndexForMode(normalizedMode);
  const batchIndex = refresh || latestBatchIndex === undefined
    ? nextBatchIndex % batchTotal
    : latestBatchIndex % batchTotal;
  const batchStartIndex = batchIndex * ROTATING_SCAN_BATCH_SIZE;
  const batchEndIndex = Math.min(batchStartIndex + ROTATING_SCAN_BATCH_SIZE, universe.length);
  const symbols = universe.slice(batchStartIndex, batchEndIndex);
  return {
    symbols,
    mode: normalizedMode,
    modeConfig,
    refresh,
    universeSize: universe.length,
    batchIndex,
    batchNumber: batchIndex + 1,
    batchTotal,
    batchStart: batchStartIndex + 1,
    batchEnd: batchEndIndex,
    rotating: true,
    cacheKey: `default:${normalizedMode}:batch:${batchIndex + 1}`
  };
}

function getScanMode(url) {
  return normalizeMode(url.searchParams.get("mode"));
}

function getOptionalMode(url) {
  const mode = url.searchParams.get("mode");
  return mode ? normalizeMode(mode) : null;
}

function normalizeMode(mode) {
  const value = String(mode || "intraday").toLowerCase();
  return SCAN_MODES[value] ? value : "intraday";
}

function normalizeMarketTicker(value) {
  const raw = String(value || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  if (!raw) return "";
  const crypto = CRYPTO_SYMBOLS[raw];
  if (crypto?.alias) return crypto.alias;
  return raw;
}

function parseSymbols(value, limit = 160) {
  if (!value) return DEFAULT_SCAN_UNIVERSE;

  const symbols = value
    .split(",")
    .map((symbol) => normalizeMarketTicker(symbol.trim()))
    .filter(Boolean)
    .slice(0, limit);

  return symbols.length ? [...new Set(symbols)] : DEFAULT_SCAN_UNIVERSE;
}

function updateMarketMap(quotes, scannedAt, request) {
  const modeMap = getModeMarketMap(request.mode);
  for (const quote of quotes) {
    if (!quote.ok) continue;
    const enriched = {
      ...quote,
      mode: request.mode,
      asset_class: request.modeConfig.assetClass,
      hold_window: request.modeConfig.holdWindow,
      scannedAt
    };
    state.latestMarketMap.set(getModeTickerKey(request.mode, quote.symbol), enriched);
    modeMap.set(quote.symbol, enriched);
  }
}

function advanceRotatingBatch(request) {
  if (!request.rotating) return;
  const batchTotal = Math.ceil(request.modeConfig.universe.length / ROTATING_SCAN_BATCH_SIZE);
  const nextIndex = (request.batchIndex + 1) % batchTotal;
  state.nextBatchIndexByMode.set(request.mode, nextIndex);
  if (request.mode === "intraday") state.nextBatchIndex = nextIndex;
}

function getMarketRows(mode = null) {
  const rows = mode ? [...getModeMarketMap(mode).values()] : [...state.latestMarketMap.values()];
  return rows.sort((a, b) => {
    const aScore = Number(a.changePercent || 0);
    const bScore = Number(b.changePercent || 0);
    return bScore - aScore;
  });
}

function getModeMarketMap(mode) {
  const normalizedMode = normalizeMode(mode);
  if (!state.latestMarketByMode.has(normalizedMode)) {
    state.latestMarketByMode.set(normalizedMode, new Map());
  }
  return state.latestMarketByMode.get(normalizedMode);
}

function getNextBatchIndexForMode(mode) {
  return state.nextBatchIndexByMode.get(normalizeMode(mode)) || 0;
}

function calculateMarketRegime() {
  const spy = findLatestQuote("SPY");
  const qqq = findLatestQuote("QQQ");
  const spyChange = Number(spy?.changePercent);
  const qqqChange = Number(qqq?.changePercent);
  const validChanges = [spyChange, qqqChange].filter(Number.isFinite);

  if (!validChanges.length) {
    return {
      regime: "unknown",
      spy_change_pct: null,
      qqq_change_pct: null,
      score: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const average = validChanges.reduce((sum, value) => sum + value, 0) / validChanges.length;
  const bothPositive = validChanges.every((value) => value > 0.15);
  const bothNegative = validChanges.every((value) => value < -0.15);
  const regime = bothPositive && average >= 0.35
    ? "bullish"
    : bothNegative && average <= -0.35
      ? "bearish"
      : "mixed";

  return {
    regime,
    spy_change_pct: Number.isFinite(spyChange) ? Number(spyChange.toFixed(3)) : null,
    qqq_change_pct: Number.isFinite(qqqChange) ? Number(qqqChange.toFixed(3)) : null,
    score: Number(average.toFixed(3)),
    updatedAt: new Date().toISOString()
  };
}

function findLatestQuote(symbol) {
  const direct = [...state.latestMarketByMode.values()]
    .map((modeMap) => modeMap.get(symbol))
    .find(Boolean);
  if (direct) return direct;

  return [...state.latestMarketMap.values()].find((quote) => quote.symbol === symbol) || null;
}

function getLatestMarket() {
  const market = getMarketRows();
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    universeSize: SCAN_MODES.all.universe.length,
    marketCount: market.length,
    market_regime: state.marketRegime,
    lastScan: state.lastScanSummary,
    market
  };
}

function getLatestSignals(mode = null) {
  const signals = [...state.lastSignals.entries()]
    .map(([, signal]) => signal)
    .filter((signal) => !mode || signal.mode === mode || signal.signal_mode === mode)
    .sort((a, b) => Number(b.final_quality_score || b.setup_score || b.confidence || 0) - Number(a.final_quality_score || a.setup_score || a.confidence || 0));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    market_regime: state.marketRegime,
    count: signals.length,
    signals
  };
}

function getLatestAlerts(mode = null) {
  const alerts = [...state.latestAlerts.values()]
    .filter((alert) => !mode || alert.mode === mode || alert.signal_mode === mode)
    .sort((a, b) => Number(b.final_quality_score || b.priority_score || 0) - Number(a.final_quality_score || a.priority_score || 0));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    market_regime: state.marketRegime,
    count: alerts.length,
    alerts
  };
}

function getSentAlerts() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    delivery: getDeliveryStatus(),
    count: state.latestSentAlerts.length,
    alerts: state.latestSentAlerts
  };
}

function getExecutionPlans(mode = null) {
  const signals = getLatestSignals(mode).signals;
  const plans = signals
    .map((signal) => ({
      ...(signal.execution_plan || buildExecutionPlan(signal)),
      webull_summary: signal.webull_summary,
      execution_summary: signal.execution_summary || signal.execution_plan?.summary,
      skip_trade_flag: signal.skip_trade_flag,
      skip_trade_reason: (signal.decision_reasons || signal.execution_plan?.skip_reasons || []).join(", ")
    }))
    .sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    settings: getExecutionSettings(),
    count: plans.length,
    plans
  };
}

function getLifecycle(filter = "latest") {
  const records = [...state.lifecycle.values()]
    .filter((record) => {
      if (filter === "open") return !["closed", "target2_hit", "stopped", "expired", "skipped"].includes(record.lifecycle_status);
      if (filter === "closed") return ["closed", "target2_hit", "stopped", "expired"].includes(record.lifecycle_status);
      return true;
    })
    .sort((a, b) => String(b.lifecycle_updated_at || "").localeCompare(String(a.lifecycle_updated_at || "")));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    filter,
    summary: getLifecycleSummary(),
    count: records.length,
    lifecycle: records
  };
}

function getLifecycleSummary() {
  const records = [...state.lifecycle.values()];
  const counts = {};
  for (const record of records) {
    counts[record.lifecycle_status] = (counts[record.lifecycle_status] || 0) + 1;
  }
  return {
    total: records.length,
    open: records.filter((record) => !["closed", "target2_hit", "stopped", "expired", "skipped"].includes(record.lifecycle_status)).length,
    closed: records.filter((record) => ["closed", "target2_hit", "stopped", "expired"].includes(record.lifecycle_status)).length,
    by_status: counts
  };
}

function getLatestDecisions(mode = null) {
  const signals = getLatestSignals(mode).signals;
  const decisions = signals
    .map((signal) => ({
      signal_id: signal.signal_id,
      ticker: signal.ticker,
      mode: signal.signal_mode || signal.mode,
      asset_class: signal.asset_class,
      bias: signal.bias,
      final_decision: signal.final_decision,
      decision_reasons: signal.decision_reasons || [],
      confidence: signal.confidence,
      final_quality_score: signal.final_quality_score,
      reward_to_risk_1: signal.reward_to_risk_1,
      reward_to_risk_2: signal.reward_to_risk_2,
      entry_distance_pct: signal.entry_distance_pct,
      signal_age_seconds: signal.signal_age_seconds,
      expired_flag: signal.expired_flag,
      market_session: signal.market_session,
      mtf_confirmation: signal.mtf_confirmation,
      webull_summary: signal.webull_summary,
      execution_plan: signal.execution_plan
    }))
    .sort((a, b) => decisionRank(a.final_decision) - decisionRank(b.final_decision) || Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    market_session: getMarketSession(),
    count: decisions.length,
    decisions
  };
}

function getSignalsByDecision(decision) {
  const normalized = String(decision || "").toLowerCase();
  const signals = getLatestSignals().signals.filter((signal) => signal.final_decision === normalized);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    decision: normalized,
    count: signals.length,
    signals
  };
}

function decisionRank(decision) {
  return { take: 0, watch: 1, skip: 2 }[decision] ?? 3;
}

function getAiBrainStatus(extra = {}) {
  const configuredOpenAI = isConfiguredKey(OPENAI_API_KEY, "your_openai_api_key_here");
  const latestSignals = getLatestSignals().signals;
  const latestSignalTime = latestSignals
    .map((signal) => signal.seenAt || signal.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    ok: true,
    ai_brain_enabled: configuredOpenAI,
    connected: configuredOpenAI,
    provider: "OpenAI",
    model: OPENAI_MODEL,
    key_loaded: configuredOpenAI,
    key_preview: configuredOpenAI ? maskSecret(OPENAI_API_KEY) : null,
    role: "ChatGPT analyzes top scanner candidates, returns strict trade-signal JSON, and the backend converts that into TAKE/WATCH/SKIP decisions, execution plans, alerts, lifecycle, and journal tracking.",
    controls_trading: false,
    manual_execution_only: true,
    webull_execution: "manual",
    latest_signal_count: latestSignals.length,
    latest_signal_at: latestSignalTime,
    last_scan: state.lastScanSummary,
    last_scan_error: state.lastScanSummary?.error || state.autoScan.lastError || null,
    auto_scan: getAutoScanStatus(),
    dashboard_session: getDashboardSessionStatus(),
    ...extra
  };
}

async function testAiBrain() {
  const configuredOpenAI = isConfiguredKey(OPENAI_API_KEY, "your_openai_api_key_here");

  if (!configuredOpenAI) {
    return getAiBrainStatus({
      test_ok: false,
      test_error: "OPENAI_API_KEY is not set. Add it to .env, then restart npm start."
    });
  }

  try {
    const data = await callOpenAI({
      instructions: "Reply with exactly: AI brain online",
      input: "Connection test for local trading dashboard.",
      maxOutputTokens: 20,
      errorLabel: "OpenAI brain test"
    });

    return getAiBrainStatus({
      test_ok: true,
      test_response: extractResponseText(data),
      tested_at: new Date().toISOString()
    });
  } catch (error) {
    return getAiBrainStatus({
      test_ok: false,
      test_error: error.message || "OpenAI test failed.",
      tested_at: new Date().toISOString()
    });
  }
}

async function tradingAssistantChat(payload = {}) {
  const configuredOpenAI = isConfiguredKey(OPENAI_API_KEY, "your_openai_api_key_here");
  const message = String(payload.message || "").trim().slice(0, 1600);
  const ticker = normalizeSignalTicker(payload.ticker || "");

  if (!configuredOpenAI) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not set. Add it to .env, then restart npm start."
    };
  }

  if (!message) {
    return {
      ok: false,
      error: "Ask a trading question first."
    };
  }

  const matchingTicker = ticker ? await getDashboardTicker(ticker, false) : null;
  const context = {
    now: new Date().toISOString(),
    market_regime: state.marketRegime,
    top_take_signals: getLatestSignals().signals.filter(isActionableTake).slice(0, 8),
    top_watch_signals: getLatestSignals().signals.filter((signal) => signal.final_decision === "watch").slice(0, 8),
    execution_plans: getDashboardExecution().plans.slice(0, 8),
    alerts: getLatestAlerts().alerts.slice(0, 8),
    ticker_context: matchingTicker,
    user_question: message
  };

  const data = await callOpenAI({
    instructions: [
      "You are the trading assistant inside a local manual-execution dashboard.",
      "Answer in plain English for a beginner trader.",
      "Use only the provided dashboard context. If the answer needs missing data, say what is missing.",
      "Do not claim certainty, do not guarantee profit, and do not place trades.",
      "Focus on: TAKE/WATCH/SKIP, entry, stop, targets, risk, whether price is near entry, BTC linkage, market regime, news risk, and what to check in Webull.",
      "Keep answers short and actionable. Use bullets when helpful.",
      "If the user asks what to trade, prioritize final_decision=take, confidence>=7, final_quality_score>=70, and not expired. If none exist, say no clean trade right now."
    ].join(" "),
    input: JSON.stringify(context, null, 2),
    maxOutputTokens: 700,
    errorLabel: "Trading assistant chat"
  });

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    answer: extractResponseText(data),
    model: OPENAI_MODEL,
    ticker: ticker || null
  };
}

function getDashboardOverview() {
  const signals = getLatestSignals().signals;
  const counts = getSignalCountsByModeAndDecision(signals);
  const takeSignals = signals
    .filter((signal) => isActionableTake(signal))
    .sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0))
    .slice(0, 5);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    market_regime: state.marketRegime,
    ai_brain: getAiBrainStatus(),
    auto_scan: getAutoScanStatus(),
    dashboard_session: getDashboardSessionStatus(),
    delivery: getDeliveryStatus(),
    counts,
    latest_sent_alerts: state.latestSentAlerts.slice(0, 8),
    top_take_signals: takeSignals,
    lifecycle_summary: getLifecycleSummary(),
    journal_stats: calculateJournalStats(state.journal)
  };
}

function getDashboardSignals(mode = null, params = new URLSearchParams()) {
  let signals = getLatestSignals(mode).signals;
  const search = String(params.get("search") || "").trim().toUpperCase();
  const decision = String(params.get("decision") || "").trim().toLowerCase();
  const onlyTake = ["1", "true", "yes"].includes(String(params.get("take") || "").toLowerCase());
  const hideExpired = ["1", "true", "yes"].includes(String(params.get("hideExpired") || "").toLowerCase());
  const minConfidence = Number(params.get("minConfidence"));
  const minQuality = Number(params.get("minQuality"));
  const sort = String(params.get("sort") || "quality").toLowerCase();

  if (search) signals = signals.filter((signal) => String(signal.ticker || "").includes(search));
  if (decision) signals = signals.filter((signal) => signal.final_decision === decision);
  if (onlyTake) signals = signals.filter((signal) => signal.final_decision === "take");
  if (hideExpired) signals = signals.filter((signal) => !signal.expired_flag);
  if (Number.isFinite(minConfidence)) signals = signals.filter((signal) => Number(signal.confidence || 0) >= minConfidence);
  if (Number.isFinite(minQuality)) signals = signals.filter((signal) => Number(signal.final_quality_score || 0) >= minQuality);

  signals = sortSignalsForDashboard(signals, sort);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    mode: mode || "all",
    count: signals.length,
    signals
  };
}

function getDashboardAlerts() {
  const current = getLatestAlerts().alerts;
  const sent = getSentAlerts();
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    delivery: getDeliveryStatus(),
    current_alerts: current,
    actionable_alerts: current.filter((alert) => alert.final_decision === "take" && !alert.expired_flag),
    sent_alerts: sent.alerts
  };
}

async function getDashboardNews(mode = null, refresh = false) {
  const symbols = parseNewsSymbols(null, mode);
  const companyNews = await getLatestNews(symbols, refresh);
  const marketNews = await getMarketNews(refresh);
  const focusTickers = symbols.slice(0, NEWS_SYMBOL_LIMIT);

  return {
    ok: companyNews.ok || marketNews.ok,
    createdAt: new Date().toISOString(),
    mode: mode || "all",
    focus_tickers: focusTickers,
    company_news: companyNews.articles || [],
    market_news: marketNews.articles || [],
    social_posts: buildSocialPostLinks(focusTickers),
    source_status: {
      finnhub_company_news: companyNews.ok ? "ok" : companyNews.error || "unavailable",
      finnhub_market_news: marketNews.ok ? "ok" : marketNews.error || "unavailable",
      x_tweets: "links only - X/Twitter API is not configured",
      stocktwits: "links only"
    },
    cache: {
      company: companyNews.cache || null,
      market: marketNews.cache || null
    }
  };
}

async function getDashboardTicker(symbol, refresh = false) {
  const ticker = normalizeMarketTicker(String(symbol || "SPY").slice(0, 12)) || "SPY";
  const quote = await getTickerQuote(ticker, refresh);
  const news = await getLatestNews([ticker], refresh);
  const matchingSignals = getLatestSignals().signals
    .filter((signal) => signal.ticker === ticker)
    .sort((a, b) => {
      const buyNowDelta = buyNowSortScore(
        { buy_now_type: getBuyNowType(a), momentum_score: a.momentum_score, final_quality_score: a.final_quality_score },
        { buy_now_type: getBuyNowType(b), momentum_score: b.momentum_score, final_quality_score: b.final_quality_score }
      );
      if (buyNowDelta !== 0) return buyNowDelta;
      return decisionRank(a.final_decision) - decisionRank(b.final_decision) || Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0);
    });
  const matchingAlerts = getLatestAlerts().alerts
    .filter((alert) => alert.ticker === ticker)
    .sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0));
  const matchingPlan = getBestExecutionPlanForTicker(getExecutionPlans().plans, ticker);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    ticker,
    quote,
    signal: matchingSignals[0] || null,
    signals: matchingSignals,
    alert: matchingAlerts[0] || null,
    execution_plan: matchingPlan,
    news: news.articles || [],
    social_posts: buildSocialPostLinks([ticker]),
    market_regime: state.marketRegime,
    source_status: {
      quote: quote?.ok ? "ok" : quote?.error || "unavailable",
      news: news.ok ? "ok" : news.error || "unavailable"
    }
  };
}

async function getChartSignal(tickerValue, mode = null, refresh = false) {
  const ticker = normalizeMarketTicker(tickerValue || "SPY") || "SPY";
  const quote = await getTickerQuote(ticker, refresh);
  const signals = getLatestSignals(mode).signals
    .filter((signal) => signal.ticker === ticker)
    .sort((a, b) => {
      const buyNowDelta = buyNowSortScore(
        { buy_now_type: getBuyNowType(a), momentum_score: a.momentum_score, final_quality_score: a.final_quality_score },
        { buy_now_type: getBuyNowType(b), momentum_score: b.momentum_score, final_quality_score: b.final_quality_score }
      );
      if (buyNowDelta !== 0) return buyNowDelta;
      return decisionRank(a.final_decision) - decisionRank(b.final_decision) || Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0);
    });
  const signal = signals[0] || null;
  const executionPlan = getBestExecutionPlanForTicker(getExecutionPlans(mode).plans, ticker);
  const levels = buildChartOverlayLevels(signal, quote);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    ticker,
    mode: signal?.signal_mode || signal?.mode || mode || inferSourceMode(ticker),
    asset_class: signal?.asset_class || inferAssetClass(ticker),
    quote,
    has_signal: Boolean(signal),
    signal_message: signal ? "Active signal overlay loaded." : "No active signal overlay for this ticker.",
    signal: signal
      ? {
          ticker: signal.ticker,
          mode: signal.signal_mode || signal.mode,
          asset_class: signal.asset_class,
          signal_type: signal.signal_type || "strict_take",
          final_decision: signal.final_decision,
          bias: signal.bias,
          bull_run_flag: signal.bull_run_flag,
          expired_flag: signal.expired_flag,
          invalid_flag: signal.signal_stale_flag || signal.expired_flag,
          entry: signal.entry,
          stop: signal.stop,
          target1: signal.target1,
          target2: signal.target2,
          sell_trigger: signal.sell_trigger,
          confidence: signal.confidence,
          momentum_score: signal.momentum_score,
          trend_label: signal.trend_label,
          momentum_reason: signal.momentum_reason,
          final_quality_score: signal.final_quality_score,
          webull_summary: signal.webull_summary
        }
      : null,
    execution_plan: executionPlan,
    levels,
    chart_range: getChartOverlayRange(quote, levels),
    legend: [
      { key: "entry", label: "Entry", color: "green" },
      { key: "stop", label: "Stop", color: "red" },
      { key: "target1", label: "Target 1", color: "yellow" },
      { key: "target2", label: "Target 2", color: "blue" },
      { key: "sell_trigger", label: "Sell trigger", color: "orange" }
    ]
  };
}

function getDashboardExecution(mode = null) {
  const plans = getExecutionPlans(mode).plans
    .filter((plan) => Boolean(plan.buy_now_type))
    .filter((plan) => plan.suggested_shares > 0)
    .sort((a, b) => buyNowSortScore(a, b));

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    settings: getExecutionSettings(),
    count: plans.length,
    plans
  };
}

function getDashboardLifecycle() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    summary: getLifecycleSummary(),
    open: getLifecycle("open").lifecycle,
    closed: getLifecycle("closed").lifecycle,
    expired: [...state.lifecycle.values()]
      .filter((record) => record.lifecycle_status === "expired")
      .sort((a, b) => String(b.lifecycle_updated_at || "").localeCompare(String(a.lifecycle_updated_at || ""))),
    skipped: [...state.lifecycle.values()]
      .filter((record) => record.lifecycle_status === "skipped")
      .sort((a, b) => String(b.lifecycle_updated_at || "").localeCompare(String(a.lifecycle_updated_at || "")))
  };
}

function getDashboardJournal() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    stats: calculateJournalStats(state.journal),
    recent_entries: [...state.journal]
      .sort((a, b) => String(b.updatedAt || b.timestamp || "").localeCompare(String(a.updatedAt || a.timestamp || "")))
      .slice(0, 50)
  };
}

function getDashboardSettings() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    ai_brain: getAiBrainStatus(),
    execution: getExecutionSettings(),
    delivery: getDeliveryStatus(),
    auto_scan: getAutoScanStatus(),
    dashboard_session: getDashboardSessionStatus(),
    universe: getUniverseSummary()
  };
}

function getSignalCountsByModeAndDecision(signals) {
  const modes = Object.keys(SCAN_MODES);
  const byMode = Object.fromEntries(modes.map((mode) => [mode, { total: 0, take: 0, watch: 0, skip: 0 }]));
  const byDecision = { take: 0, watch: 0, skip: 0 };

  for (const signal of signals) {
    const mode = signal.signal_mode || signal.mode || "intraday";
    const decision = signal.final_decision || "watch";
    if (!byMode[mode]) byMode[mode] = { total: 0, take: 0, watch: 0, skip: 0 };
    byMode[mode].total += 1;
    byMode[mode][decision] = (byMode[mode][decision] || 0) + 1;
    byDecision[decision] = (byDecision[decision] || 0) + 1;
  }

  return {
    total_signals: signals.length,
    by_mode: byMode,
    by_decision: byDecision,
    alerts: getLatestAlerts().count,
    sent_alerts: state.latestSentAlerts.length
  };
}

function maskSecret(value) {
  const text = String(value || "");
  if (text.length <= 12) return "configured";
  return `${text.slice(0, 7)}...${text.slice(-4)}`;
}

function isActionableTake(signal) {
  return signal.final_decision === "take" &&
    Number(signal.confidence || 0) >= 7 &&
    Number(signal.final_quality_score || 0) >= FINAL_QUALITY_ALERT_MIN &&
    !signal.expired_flag;
}

function sortSignalsForDashboard(signals, sort) {
  const copy = [...signals];
  if (sort === "confidence") return copy.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  if (sort === "mode") return copy.sort((a, b) => String(a.signal_mode || a.mode).localeCompare(String(b.signal_mode || b.mode)));
  if (sort === "ticker") return copy.sort((a, b) => String(a.ticker || "").localeCompare(String(b.ticker || "")));
  return copy.sort((a, b) => Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0));
}

async function updateSignalLifecycles(signals) {
  let changed = false;

  for (const signal of signals) {
    const lifecycle = evaluateSignalLifecycle(signal);
    signal.lifecycle_status = lifecycle.lifecycle_status;
    signal.lifecycle_updated_at = lifecycle.lifecycle_updated_at;
    signal.lifecycle = lifecycle;
    state.lifecycle.set(signal.signal_id, lifecycle);
    state.lastSignals.set(getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type), { ...signal });
    const alertKey = getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type);
    if (state.latestAlerts.has(alertKey)) {
      state.latestAlerts.set(alertKey, {
        ...state.latestAlerts.get(alertKey),
        lifecycle_status: lifecycle.lifecycle_status,
        lifecycle_updated_at: lifecycle.lifecycle_updated_at,
        lifecycle
      });
    }

    if (shouldSyncLifecycleToJournal(lifecycle)) {
      upsertJournalFromLifecycle(lifecycle);
      changed = true;
    }
  }

  if (changed) await saveJournal();
}

function evaluateSignalLifecycle(signal) {
  const previous = state.lifecycle.get(signal.signal_id);
  const now = new Date().toISOString();
  const current = Number(signal.price);
  const entry = parseFirstNumber(signal.entry || signal.buy_trigger);
  const stop = parseFirstNumber(signal.stop || signal.sell_trigger);
  const target1 = parseFirstNumber(signal.target1);
  const target2 = parseFirstNumber(signal.target2);
  const bearish = ["bearish", "short", "sell"].includes(String(signal.bias || "").toLowerCase());
  const expired = Boolean(signal.expired_flag || (signal.expires_at && Date.now() > Date.parse(signal.expires_at)));
  const priorStatus = previous?.lifecycle_status || (signal.final_decision === "skip" ? "skipped" : "new");
  let status = priorStatus;
  let actualEntry = previous?.actual_entry ?? null;
  let actualExit = previous?.actual_exit ?? null;
  let enteredAt = previous?.entered_at || null;
  let closedAt = previous?.closed_at || null;
  const transitions = [...(previous?.transitions || [])];

  const terminal = ["closed", "target2_hit", "stopped", "expired", "skipped"].includes(priorStatus);
  if (!terminal) {
    if (signal.final_decision === "skip") {
      status = "skipped";
    } else if (!actualEntry && expired) {
      status = "expired";
      closedAt = now;
    } else if (Number.isFinite(current) && Number.isFinite(entry) && isPriceReached(current, entry, bearish ? "down" : "up")) {
      status = "entered";
      actualEntry = entry;
      enteredAt = enteredAt || now;
    }

    if (actualEntry && Number.isFinite(current)) {
      if (Number.isFinite(stop) && isPriceReached(current, stop, bearish ? "up" : "down")) {
        status = "stopped";
        actualExit = stop;
        closedAt = now;
      } else if (Number.isFinite(target2) && isPriceReached(current, target2, bearish ? "down" : "up")) {
        status = "target2_hit";
        actualExit = target2;
        closedAt = now;
      } else if (Number.isFinite(target1) && isPriceReached(current, target1, bearish ? "down" : "up")) {
        status = previous?.lifecycle_status === "target1_hit" ? "target1_hit" : "target1_hit";
      }
    }
  }

  if (status !== priorStatus) {
    transitions.push({ from: priorStatus, to: status, at: now, price: Number.isFinite(current) ? current : null });
  }

  const pnlPct = calculatePnlPct(actualEntry, actualExit, signal.bias);
  const outcome = status === "stopped"
    ? "loss"
    : ["target1_hit", "target2_hit"].includes(status)
      ? "win"
      : status === "expired" || status === "skipped"
        ? "unknown"
        : normalizeOutcome(null, pnlPct);

  return {
    signal_id: signal.signal_id,
    ticker: signal.ticker,
    mode: signal.signal_mode || signal.mode,
    asset_class: signal.asset_class,
    bias: signal.bias,
    lifecycle_status: status,
    lifecycle_updated_at: status !== priorStatus ? now : previous?.lifecycle_updated_at || now,
    created_at: previous?.created_at || signal.seenAt || now,
    entered_at: enteredAt,
    closed_at: closedAt,
    hold_seconds: enteredAt ? Math.max(0, Math.round(((closedAt ? Date.parse(closedAt) : Date.now()) - Date.parse(enteredAt)) / 1000)) : null,
    current_price: Number.isFinite(current) ? current : null,
    entry: Number.isFinite(entry) ? entry : null,
    stop: Number.isFinite(stop) ? stop : null,
    target1: Number.isFinite(target1) ? target1 : null,
    target2: Number.isFinite(target2) ? target2 : null,
    actual_entry: actualEntry,
    actual_exit: actualExit,
    pnl_pct: pnlPct,
    outcome,
    final_decision: signal.final_decision,
    confidence: signal.confidence,
    final_quality_score: signal.final_quality_score,
    regime: signal.market_regime,
    sector_strength: signal.sector_strength,
    expires_at: signal.expires_at,
    expired_flag: expired,
    webull_summary: signal.webull_summary,
    transitions
  };
}

function isPriceReached(current, level, direction) {
  return direction === "down" ? current <= level : current >= level;
}

function shouldSyncLifecycleToJournal(lifecycle) {
  return ["entered", "target1_hit", "target2_hit", "stopped", "expired", "closed"].includes(lifecycle.lifecycle_status);
}

function upsertJournalFromLifecycle(lifecycle) {
  const index = state.journal.findIndex((entry) => entry.signal_id === lifecycle.signal_id);
  const existing = index >= 0 ? state.journal[index] : {};
  const closed = ["target2_hit", "stopped", "expired", "closed", "skipped"].includes(lifecycle.lifecycle_status);
  const notes = [
    existing.notes,
    `Lifecycle ${lifecycle.lifecycle_status} at ${lifecycle.lifecycle_updated_at}`
  ].filter(Boolean).join(" | ");
  const entry = normalizeJournalEntry({
    ...existing,
    signal_id: lifecycle.signal_id,
    timestamp: existing.timestamp || lifecycle.created_at,
    ticker: lifecycle.ticker,
    mode: lifecycle.mode,
    asset_class: lifecycle.asset_class,
    bias: lifecycle.bias,
    entry: lifecycle.entry ?? existing.entry,
    stop: lifecycle.stop ?? existing.stop,
    target1: lifecycle.target1 ?? existing.target1,
    target2: lifecycle.target2 ?? existing.target2,
    confidence: lifecycle.confidence,
    final_quality_score: lifecycle.final_quality_score,
    final_decision: lifecycle.final_decision,
    regime: lifecycle.regime,
    sector_strength: lifecycle.sector_strength,
    webull_summary: lifecycle.webull_summary,
    status: closed ? "closed" : "open",
    execution_status: lifecycle.actual_entry ? "entered" : lifecycle.lifecycle_status === "expired" ? "missed" : "not_taken",
    actual_entry: lifecycle.actual_entry,
    actual_exit: lifecycle.actual_exit,
    pnl_pct: lifecycle.pnl_pct,
    outcome: lifecycle.outcome,
    lifecycle_status: lifecycle.lifecycle_status,
    lifecycle_updated_at: lifecycle.lifecycle_updated_at,
    hold_seconds: lifecycle.hold_seconds,
    notes
  });

  if (index >= 0) state.journal[index] = entry;
  else state.journal.unshift(entry);
}

function getJournal() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    file: "data/journal.json",
    count: state.journal.length,
    stats: calculateJournalStats(state.journal),
    entries: [...state.journal].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
  };
}

async function addJournalEntry(payload) {
  const sourceSignal = findSignalForJournal(payload);
  const entry = normalizeJournalEntry({
    ...(sourceSignal || {}),
    ...payload,
    signal_id: payload.signal_id || sourceSignal?.signal_id || randomUUID()
  });

  const existingIndex = state.journal.findIndex((item) => item.signal_id === entry.signal_id);
  if (existingIndex >= 0) {
    state.journal[existingIndex] = {
      ...state.journal[existingIndex],
      ...entry,
      updatedAt: new Date().toISOString()
    };
  } else {
    state.journal.unshift(entry);
  }

  await saveJournal();
  return {
    ok: true,
    action: existingIndex >= 0 ? "updated" : "added",
    entry
  };
}

async function updateJournalEntry(payload) {
  const signalId = String(payload.signal_id || payload.id || "").trim();
  if (!signalId) {
    return { ok: false, error: "signal_id is required." };
  }

  const index = state.journal.findIndex((entry) => entry.signal_id === signalId);
  if (index < 0) {
    return { ok: false, error: `No journal entry found for ${signalId}.` };
  }

  const updated = normalizeJournalEntry({
    ...state.journal[index],
    ...payload,
    signal_id: signalId,
    updatedAt: new Date().toISOString()
  });

  state.journal[index] = updated;
  await saveJournal();
  return {
    ok: true,
    action: "updated",
    entry: updated
  };
}

function getJournalStats() {
  return {
    ok: true,
    createdAt: new Date().toISOString(),
    file: "data/journal.json",
    ...calculateJournalStats(state.journal)
  };
}

function calculateJournalStats(entries) {
  const closed = entries.filter((entry) => entry.status === "closed" || ["win", "loss", "breakeven"].includes(entry.outcome));
  const wins = entries.filter((entry) => entry.outcome === "win").length;
  const losses = entries.filter((entry) => entry.outcome === "loss").length;
  const breakeven = entries.filter((entry) => entry.outcome === "breakeven").length;
  const pnlValues = entries.map((entry) => Number(entry.pnl_pct)).filter(Number.isFinite);
  const holdValues = entries.map((entry) => Number(entry.hold_seconds)).filter(Number.isFinite);

  return {
    total_trades: entries.length,
    closed_trades: closed.length,
    wins,
    losses,
    breakeven,
    win_rate: wins + losses > 0 ? Number((wins / (wins + losses) * 100).toFixed(2)) : 0,
    avg_pnl_pct: pnlValues.length ? Number((pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length).toFixed(3)) : 0,
    target1_hit_rate: rateForLifecycle(entries, "target1_hit"),
    target2_hit_rate: rateForLifecycle(entries, "target2_hit"),
    stop_hit_rate: rateForLifecycle(entries, "stopped"),
    expired_rate: rateForLifecycle(entries, "expired"),
    average_hold_seconds: holdValues.length ? Math.round(holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length) : 0,
    by_mode: groupJournalStats(entries, "mode"),
    by_bias: groupJournalStats(entries, "bias"),
    by_regime: groupJournalStats(entries, "regime"),
    by_asset_class: groupJournalStats(entries, "asset_class"),
    by_final_decision: groupJournalStats(entries, "final_decision"),
    by_lifecycle_status: groupJournalStats(entries, "lifecycle_status")
  };
}

function rateForLifecycle(entries, status) {
  if (!entries.length) return 0;
  const count = entries.filter((entry) => entry.lifecycle_status === status).length;
  return Number((count / entries.length * 100).toFixed(2));
}

function groupJournalStats(entries, field) {
  const groups = {};

  for (const entry of entries) {
    const key = String(entry[field] || "unknown");
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  return Object.fromEntries(
    Object.entries(groups).map(([key, values]) => {
      const wins = values.filter((entry) => entry.outcome === "win").length;
      const losses = values.filter((entry) => entry.outcome === "loss").length;
      const breakeven = values.filter((entry) => entry.outcome === "breakeven").length;
      const pnlValues = values.map((entry) => Number(entry.pnl_pct)).filter(Number.isFinite);
      return [key, {
        total_trades: values.length,
        wins,
        losses,
        breakeven,
        win_rate: wins + losses > 0 ? Number((wins / (wins + losses) * 100).toFixed(2)) : 0,
        avg_pnl_pct: pnlValues.length ? Number((pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length).toFixed(3)) : 0
      }];
    })
  );
}

function normalizeJournalEntry(entry) {
  const timestamp = entry.timestamp || entry.createdAt || entry.seenAt || new Date().toISOString();
  const actualEntry = numberOrNull(entry.actual_entry);
  const actualExit = numberOrNull(entry.actual_exit);
  const pnlPct = numberOrNull(entry.pnl_pct) ?? calculatePnlPct(actualEntry, actualExit, entry.bias);
  const outcome = normalizeOutcome(entry.outcome, pnlPct);

  return {
    signal_id: String(entry.signal_id || randomUUID()),
    timestamp,
    ticker: String(entry.ticker || entry.symbol || "").toUpperCase(),
    mode: String(entry.signal_mode || entry.mode || "unknown"),
    asset_class: String(entry.asset_class || "unknown"),
    bias: String(entry.bias || "unknown"),
    entry: String(entry.entry || ""),
    stop: String(entry.stop || ""),
    target1: String(entry.target1 || ""),
    target2: String(entry.target2 || ""),
    confidence: numberOrNull(entry.confidence),
    setup_score: numberOrNull(entry.setup_score),
    final_quality_score: numberOrNull(entry.final_quality_score),
    final_decision: String(entry.final_decision || "unknown"),
    regime: String(entry.regime || entry.market_regime || "unknown"),
    sector_strength: String(entry.sector_strength || "unknown"),
    webull_summary: String(entry.webull_summary || entry.ready_to_trade || ""),
    status: normalizeChoice(entry.status, ["open", "closed", "skipped"], "open"),
    execution_status: normalizeChoice(entry.execution_status, ["entered", "missed", "not_taken"], "not_taken"),
    actual_entry: actualEntry,
    actual_exit: actualExit,
    pnl_pct: pnlPct,
    outcome,
    lifecycle_status: String(entry.lifecycle_status || "new"),
    lifecycle_updated_at: entry.lifecycle_updated_at || null,
    hold_seconds: numberOrNull(entry.hold_seconds),
    notes: String(entry.notes || ""),
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

function findSignalForJournal(payload) {
  const signalId = String(payload.signal_id || "").trim();
  if (signalId) {
    const signal = [...state.lastSignals.values()].find((item) => item.signal_id === signalId);
    if (signal) return signal;

    const alert = [...state.latestAlerts.values()].find((item) => item.signal_id === signalId);
    if (alert) return alert;

    const sent = state.latestSentAlerts.find((item) => item.signal_id === signalId);
    if (sent) return sent;
  }

  const ticker = String(payload.ticker || payload.symbol || "").toUpperCase();
  if (!ticker) return null;
  return [...state.lastSignals.values()].find((item) => item.ticker === ticker) || null;
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeOutcome(value, pnlPct) {
  const normalized = String(value || "").toLowerCase();
  if (["win", "loss", "breakeven", "unknown"].includes(normalized)) return normalized;
  if (!Number.isFinite(pnlPct)) return "unknown";
  if (pnlPct > 0.05) return "win";
  if (pnlPct < -0.05) return "loss";
  return "breakeven";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculatePnlPct(actualEntry, actualExit, bias) {
  if (!Number.isFinite(actualEntry) || !Number.isFinite(actualExit) || actualEntry <= 0) return null;
  const bearish = ["bearish", "short", "sell"].includes(String(bias || "").toLowerCase());
  const raw = bearish
    ? (actualEntry - actualExit) / actualEntry * 100
    : (actualExit - actualEntry) / actualEntry * 100;
  return Number(raw.toFixed(3));
}

async function getLatestNews(symbols, refresh = false) {
  const configuredFinnhub = isConfiguredKey(FINNHUB_API_KEY, "your_finnhub_key_here");
  const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].slice(0, NEWS_SYMBOL_LIMIT);
  const cacheKey = normalizedSymbols.join(",");
  const cached = state.news.get(cacheKey);
  const now = Date.now();

  if (!refresh && cached && now - cached.cachedAt < NEWS_CACHE_TTL_MS) {
    return {
      ...cached.news,
      cache: {
        hit: true,
        ageSeconds: Math.round((now - cached.cachedAt) / 1000),
        ttlSeconds: Math.round(NEWS_CACHE_TTL_MS / 1000)
      }
    };
  }

  if (!configuredFinnhub) {
    return {
      ok: false,
      createdAt: new Date().toISOString(),
      symbols: normalizedSymbols,
      articles: [],
      bySymbol: {},
      error: "FINNHUB_API_KEY is not set. Add it to .env, then restart npm start."
    };
  }

  const bySymbol = {};
  const articles = [];
  const { from, to } = getNewsDateRange();

  for (const symbol of normalizedSymbols) {
    const symbolArticles = await fetchFinnhubCompanyNews(symbol, from, to);
    bySymbol[symbol] = symbolArticles;
    articles.push(...symbolArticles.map((article) => ({ ...article, symbol })));
    await sleep(FINNHUB_REQUEST_DELAY_MS);
  }

  const news = {
    ok: true,
    createdAt: new Date().toISOString(),
    symbols: normalizedSymbols,
    from,
    to,
    count: articles.length,
    articles: articles
      .sort((a, b) => Number(b.datetime || 0) - Number(a.datetime || 0))
      .slice(0, NEWS_SYMBOL_LIMIT * NEWS_PER_SYMBOL_LIMIT),
    bySymbol,
    error: null,
    cache: {
      hit: false,
      ageSeconds: 0,
      ttlSeconds: Math.round(NEWS_CACHE_TTL_MS / 1000)
    }
  };

  state.news.set(cacheKey, {
    cachedAt: now,
    news
  });

  return news;
}

async function getMarketNews(refresh = false) {
  const configuredFinnhub = isConfiguredKey(FINNHUB_API_KEY, "your_finnhub_key_here");
  const cacheKey = "__market_news__";
  const cached = state.news.get(cacheKey);
  const now = Date.now();

  if (!refresh && cached && now - cached.cachedAt < NEWS_CACHE_TTL_MS) {
    return {
      ...cached.news,
      cache: {
        hit: true,
        ageSeconds: Math.round((now - cached.cachedAt) / 1000),
        ttlSeconds: Math.round(NEWS_CACHE_TTL_MS / 1000)
      }
    };
  }

  if (!configuredFinnhub) {
    return {
      ok: false,
      createdAt: new Date().toISOString(),
      articles: [],
      error: "FINNHUB_API_KEY is not set. Add it to .env, then restart npm start."
    };
  }

  const endpoint = new URL("https://finnhub.io/api/v1/news");
  endpoint.searchParams.set("category", "general");
  endpoint.searchParams.set("token", FINNHUB_API_KEY);

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Finnhub market news request failed with ${response.status}`);
    }

    const news = {
      ok: true,
      createdAt: new Date().toISOString(),
      count: Array.isArray(data) ? data.length : 0,
      articles: (Array.isArray(data) ? data : [])
        .slice(0, MARKET_NEWS_LIMIT)
        .map((article) => ({
          headline: article.headline || "",
          summary: article.summary || "",
          source: article.source || "",
          url: article.url || "",
          image: article.image || "",
          category: article.category || "market",
          datetime: article.datetime || null,
          publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : null
        })),
      error: null,
      cache: {
        hit: false,
        ageSeconds: 0,
        ttlSeconds: Math.round(NEWS_CACHE_TTL_MS / 1000)
      }
    };

    state.news.set(cacheKey, {
      cachedAt: now,
      news
    });

    return news;
  } catch (error) {
    return {
      ok: false,
      createdAt: new Date().toISOString(),
      articles: [],
      error: error.message || "Finnhub market news request failed."
    };
  }
}

async function fetchFinnhubCompanyNews(symbol, from, to) {
  const endpoint = new URL("https://finnhub.io/api/v1/company-news");
  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("from", from);
  endpoint.searchParams.set("to", to);
  endpoint.searchParams.set("token", FINNHUB_API_KEY);

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Finnhub news request failed with ${response.status}`);
    }

    return (Array.isArray(data) ? data : [])
      .slice(0, NEWS_PER_SYMBOL_LIMIT)
      .map((article) => ({
        headline: article.headline || "",
        summary: article.summary || "",
        source: article.source || "",
        url: article.url || "",
        image: article.image || "",
        category: article.category || "",
        datetime: article.datetime || null,
        publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : null
      }));
  } catch (error) {
    return [{
      headline: `News fetch failed for ${symbol}`,
      summary: error.message || "Finnhub news request failed.",
      source: "system",
      url: "",
      image: "",
      category: "error",
      datetime: null,
      publishedAt: null
    }];
  }
}

function buildSocialPostLinks(symbols) {
  return symbols.map((symbol) => {
    const ticker = String(symbol || "").toUpperCase();
    return {
      ticker,
      x_search_url: `https://x.com/search?q=%24${encodeURIComponent(ticker)}%20stock&src=typed_query&f=live`,
      stocktwits_url: `https://stocktwits.com/symbol/${encodeURIComponent(ticker)}`,
      tradingview_ideas_url: `https://www.tradingview.com/symbols/${encodeURIComponent(ticker)}/ideas/`,
      note: "Open these for live posts. Direct tweet import needs an X API key."
    };
  });
}

function parseNewsSymbols(value, mode = null) {
  if (value) return parseSymbols(value, NEWS_SYMBOL_LIMIT);

  const alerts = getLatestAlerts(mode).alerts.map((alert) => alert.ticker);
  const signals = getLatestSignals(mode).signals.map((signal) => signal.ticker);
  const market = getMarketRows(mode).map((quote) => quote.symbol);
  const fallback = mode === "bitcoin"
    ? ["MSTR", "COIN", "IREN", "MARA", "CLSK", "IBIT", "BITX", "MSTU"]
    : ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "META"];

  return [...new Set([...alerts, ...signals, ...market, ...fallback])]
    .filter(Boolean)
    .slice(0, NEWS_SYMBOL_LIMIT);
}

function getNewsDateRange() {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(toDate.getDate() - 7);
  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate)
  };
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function summarizeScan(scan) {
  return {
    createdAt: scan.createdAt,
    batchIndex: scan.batchNumber ? scan.batchNumber - 1 : 0,
    mode: scan.mode,
    scannedCount: scan.scannedCount,
    universeSize: scan.universeSize,
    batchNumber: scan.batchNumber,
    batchTotal: scan.batchTotal,
    marketCount: scan.marketCount,
    topCount: scan.topCount,
    signalCount: scan.signals?.length || 0
  };
}

function shouldRefreshScan(url) {
  return ["1", "true", "yes"].includes(String(url.searchParams.get("refresh") || "").toLowerCase());
}

function rankScanCandidates(quotes, mode = "intraday") {
  const cryptoMode = mode === "crypto";
  const futuresMode = mode === "futures";
  const bitcoinMode = mode === "bitcoin";
  return quotes
    .filter((quote) => {
      if (!quote.ok) return false;
      if (!Number.isFinite(Number(quote.current))) return false;
      if (!cryptoMode && Number(quote.current) < 5) return false;
      if (!Number.isFinite(Number(quote.changePercent))) return false;
      if (!cryptoMode && !bitcoinMode && Number(quote.changePercent) <= 0) return false;
      return true;
    })
    .map((quote) => {
      const current = Number(quote.current);
      const high = Number(quote.high);
      const low = Number(quote.low);
      const changePercent = Number(quote.changePercent);
      const directionalMove = cryptoMode || bitcoinMode ? Math.abs(changePercent) : changePercent;
      const dayRange = high - low;
      const rangePosition = dayRange > 0 ? (current - low) / dayRange : 0;
      const nearHighBonus = rangePosition >= 0.75 ? 2 : rangePosition >= 0.6 ? 1 : 0;
      const profile = getBitcoinLinkedProfile(quote.symbol);
      const bitcoinBetaBonus = bitcoinMode && profile.beta === "very_high" ? 2 : bitcoinMode && profile.beta === "high" ? 1.25 : 0.5;
      const modeMultiplier = mode === "swing" ? 2.3 : futuresMode ? 3.5 : cryptoMode ? 3.2 : bitcoinMode ? 3.4 : 3;
      const rangeMultiplier = mode === "swing" ? 1.2 : futuresMode ? 2.8 : cryptoMode ? 2.5 : bitcoinMode ? 2.7 : 2;
      const bullRunBonus = (futuresMode || cryptoMode || bitcoinMode) && changePercent >= 1.5 && rangePosition >= 0.65 ? 3 : 0;
      const cryptoTrendPenalty = cryptoMode && changePercent < 0 ? -1 : 0;
      const bitcoinBreakdownBonus = bitcoinMode && Math.abs(changePercent) >= 2 && rangePosition <= 0.35 ? 1.5 : 0;
      const score = directionalMove * modeMultiplier + rangePosition * rangeMultiplier + nearHighBonus + bullRunBonus + cryptoTrendPenalty + (bitcoinMode ? bitcoinBetaBonus + bitcoinBreakdownBonus : 0);

      return {
        ...quote,
        bitcoin_profile: bitcoinMode ? profile : null,
        bullRunSetupScore: Number(bullRunBonus.toFixed(3)),
        rangePosition: Number(rangePosition.toFixed(3)),
        score: Number(score.toFixed(3))
      };
    })
    .sort((a, b) => b.score - a.score);
}

async function enrichRankedCandidatesForMode(candidates, request) {
  const momentumMap = await getMomentumContextMap(candidates, request);
  const enrichedCandidates = candidates.map((candidate) => ({
    ...candidate,
    momentum_context: momentumMap.get(candidate.symbol) || null
  }));

  const hasBitcoinLinked = enrichedCandidates.some((candidate) => {
    const ticker = candidate.symbol;
    return request.mode === "bitcoin" || request.mode === "crypto" || BITCOIN_LINKED_UNIVERSE.includes(ticker) || CRYPTO_UNIVERSE.includes(ticker);
  });

  if (!hasBitcoinLinked) return enrichedCandidates;

  const bitcoinPulse = await getBitcoinPulseContext(Boolean(request.refresh));
  const newsSymbols = enrichedCandidates
    .map((candidate) => candidate.symbol)
    .filter((symbol) => BITCOIN_LINKED_UNIVERSE.includes(symbol))
    .slice(0, NEWS_SYMBOL_LIMIT);
  const news = newsSymbols.length ? await getLatestNews(newsSymbols, false) : null;
  const marketNews = request.mode === "bitcoin" ? await getMarketNews(false) : null;
  const marketCryptoHeadlines = (marketNews?.articles || [])
    .filter((article) => /bitcoin|btc|crypto|coinbase|microstrategy|miner|mining|etf/i.test(`${article.headline || ""} ${article.summary || ""}`))
    .slice(0, 5)
    .map((article) => ({
      headline: article.headline,
      source: article.source,
      publishedAt: article.publishedAt || null
    }));

  return enrichedCandidates.map((candidate) => {
    const ticker = candidate.symbol;
    const bitcoinLinked = BITCOIN_LINKED_UNIVERSE.includes(ticker);
    const cryptoLinked = CRYPTO_UNIVERSE.includes(ticker);
    if (!bitcoinLinked && !cryptoLinked) return candidate;

    const symbolHeadlines = (news?.bySymbol?.[ticker] || [])
      .slice(0, 3)
      .map((article) => ({
        headline: article.headline,
        source: article.source,
        publishedAt: article.publishedAt || null
      }));

    return {
      ...candidate,
      bitcoin_profile: bitcoinLinked ? getBitcoinLinkedProfile(ticker) : { group: "crypto", beta: "native", tags: ["crypto", "24_7"] },
      bitcoin_pulse: bitcoinPulse,
      bitcoin_news_headlines: [...symbolHeadlines, ...marketCryptoHeadlines].slice(0, 5),
      bitcoin_activity_links: buildSocialPostLinks([ticker, "BTC"]).slice(0, 2),
      bitcoin_signal_note: "Use BTC price direction, BTC news/activity, and this ticker's BTC beta group before deciding buy, watch, sell, or skip."
    };
  });
}

async function getMomentumContextMap(candidates, request) {
  const entries = await Promise.all(candidates.map(async (candidate) => {
    const context = await getMomentumContextForCandidate(candidate, request.mode);
    return [candidate.symbol, context];
  }));
  return new Map(entries);
}

async function getMomentumContextForCandidate(candidate, mode) {
  try {
    const normalized = normalizeMarketTicker(candidate.symbol);
    const candles = CRYPTO_SYMBOLS[normalized]
      ? await fetchCryptoCandles(normalized, mode)
      : await fetchFinnhubCandles(normalized, mode);
    const candleContext = analyzeMomentumCandles(candles, normalized);
    if (candleContext?.ok) return candleContext;
  } catch {
    // Fall through to quote-based momentum context.
  }
  return analyzeMomentumQuote(candidate);
}

async function getMomentumContext(symbol, mode) {
  try {
    const normalized = normalizeMarketTicker(symbol);
    const candles = CRYPTO_SYMBOLS[normalized]
      ? await fetchCryptoCandles(normalized, mode)
      : await fetchFinnhubCandles(normalized, mode);
    return analyzeMomentumCandles(candles, normalized);
  } catch (error) {
    return {
      ok: false,
      symbol,
      error: error.message || "Momentum context unavailable."
    };
  }
}

function analyzeMomentumQuote(candidate = {}) {
  const price = Number(candidate.current || candidate.active_price);
  const open = Number(candidate.open || candidate.previousClose || price);
  const high = Number(candidate.high || price);
  const low = Number(candidate.low || price);
  const previousClose = Number(candidate.previousClose || open);
  const dayRange = high - low;
  const rangePosition = dayRange > 0 ? (price - low) / dayRange : 0.5;
  const recentChange = getPctChange(price, previousClose || open);
  const intradayChange = getPctChange(price, open || previousClose);
  const bullishStack = price > open && price > previousClose;
  const higherHighs = price >= high * 0.996;
  const higherLows = low >= previousClose * 0.985;
  const breakingRecentHigh = rangePosition >= 0.84;
  const continuationCandle = intradayChange > 0.35 && rangePosition >= 0.7;
  const entryDistancePct = dayRange > 0 ? ((high - price) / price) * 100 : 0.4;
  let score = 0;
  if (bullishStack) score += 28;
  if (recentChange > 0.75) score += 16;
  if (intradayChange > 0.25) score += 12;
  if (rangePosition >= 0.75) score += 14;
  if (rangePosition >= 0.9) score += 8;
  if (higherHighs) score += 8;
  if (higherLows) score += 6;
  if (continuationCandle) score += 5;
  if (entryDistancePct <= MOMENTUM_MAX_ENTRY_DISTANCE_PCT) score += 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ok: true,
    symbol: candidate.symbol,
    price,
    ema9: roundNumber(Math.max(open, previousClose), 4),
    ema20: roundNumber(previousClose, 4),
    recent_high: roundNumber(high, 4),
    recent_low: roundNumber(low, 4),
    recent_change_1: roundNumber(intradayChange, 3),
    recent_change_4: roundNumber(recentChange, 3),
    recent_change_day: roundNumber(recentChange, 3),
    volume_ratio: 1,
    entry_distance_pct: roundNumber(Math.max(0.1, entryDistancePct), 3),
    higher_highs: higherHighs,
    higher_lows: higherLows,
    breaking_recent_high: breakingRecentHigh,
    continuation_candle: continuationCandle,
    bullish_stack: bullishStack,
    momentum_score: score,
    trend_label: breakingRecentHigh ? "breakout" : continuationCandle ? "continuation" : bullishStack ? "strong uptrend" : "early trend",
    momentum_reason: `${candidate.symbol} is trading above the open and prior close, holding near the high of day, and showing visible upward pressure.`
  };
}

async function fetchFinnhubCandles(symbol, mode) {
  const resolution = getMomentumResolution(mode, false);
  const to = Math.floor(Date.now() / 1000);
  const secondsPerBar = resolution === "D" ? 24 * 60 * 60 : Number(resolution) * 60;
  const from = to - secondsPerBar * (MOMENTUM_CANDLE_LIMIT + 5);
  const endpoint = new URL("https://finnhub.io/api/v1/stock/candle");
  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("resolution", resolution);
  endpoint.searchParams.set("from", String(from));
  endpoint.searchParams.set("to", String(to));
  endpoint.searchParams.set("token", FINNHUB_API_KEY);
  const response = await fetch(endpoint);
  const data = await response.json();
  if (!response.ok || data?.s !== "ok" || !Array.isArray(data?.c)) {
    throw new Error(data?.error || `Finnhub candle request failed for ${symbol}.`);
  }
  return data.c.map((close, index) => ({
    close: Number(close),
    open: Number(data.o?.[index]),
    high: Number(data.h?.[index]),
    low: Number(data.l?.[index]),
    volume: Number(data.v?.[index]),
    timestamp: Number(data.t?.[index] || 0) * 1000
  })).filter((row) => Number.isFinite(row.close));
}

async function fetchCryptoCandles(symbol, mode) {
  const config = CRYPTO_SYMBOLS[symbol];
  const interval = getMomentumResolution(mode, true);
  const endpoint = new URL("https://api.binance.us/api/v3/klines");
  endpoint.searchParams.set("symbol", config.pair);
  endpoint.searchParams.set("interval", interval);
  endpoint.searchParams.set("limit", String(MOMENTUM_CANDLE_LIMIT + 5));
  const response = await fetch(endpoint);
  const data = await response.json();
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.msg || `Crypto candle request failed for ${symbol}.`);
  }
  return data.map((row) => ({
    timestamp: Number(row[0] || 0),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5])
  })).filter((row) => Number.isFinite(row.close));
}

function getMomentumResolution(mode, crypto = false) {
  if (mode === "swing") return crypto ? "4h" : "240";
  if (mode === "futures") return crypto ? "1h" : "60";
  if (mode === "bitcoin") return crypto ? "1h" : "60";
  if (mode === "crypto") return crypto ? "1h" : "60";
  return crypto ? "15m" : "15";
}

function analyzeMomentumCandles(candles, symbol = "") {
  const rows = Array.isArray(candles) ? candles.filter((row) => Number.isFinite(row.close)) : [];
  if (rows.length < MOMENTUM_EMA_MEDIUM + 2) {
    return {
      ok: false,
      symbol,
      error: "Not enough candle data for momentum analysis."
    };
  }

  const closes = rows.map((row) => Number(row.close));
  const volumes = rows.map((row) => Number(row.volume || 0));
  const ema9 = computeEma(closes, MOMENTUM_EMA_SHORT);
  const ema20 = computeEma(closes, MOMENTUM_EMA_MEDIUM);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const price = Number(latest.close);
  const shortEma = ema9.at(-1);
  const mediumEma = ema20.at(-1);
  const prevShortEma = ema9.at(-2);
  const prevMediumEma = ema20.at(-2);
  const recentHigh = Math.max(...rows.slice(-6, -1).map((row) => Number(row.high || row.close)));
  const recentLow = Math.min(...rows.slice(-6, -1).map((row) => Number(row.low || row.close)));
  const higherHigh = Number(latest.high || latest.close) > Number(previous.high || previous.close);
  const higherLow = Number(latest.low || latest.close) > Number(previous.low || previous.close);
  const momentum1 = getPctChange(closes.at(-1), closes.at(-2));
  const momentum4 = getPctChange(closes.at(-1), closes.at(Math.max(0, closes.length - 5)));
  const momentumDay = getPctChange(closes.at(-1), closes.at(0));
  const averageVolume = average(volumes.slice(-20, -1));
  const volumeRatio = averageVolume > 0 ? Number((Number(latest.volume || 0) / averageVolume).toFixed(2)) : 1;
  const entryDistancePct = shortEma > 0 ? Math.abs(price - shortEma) / shortEma * 100 : 0;
  const breakingRecentHigh = price >= recentHigh;
  const continuationCandle = price > Number(latest.open || price) && price > Number(previous.close || price);
  const bullishStack = price > shortEma && shortEma > mediumEma;

  let score = 0;
  if (price > shortEma) score += 20;
  if (shortEma > mediumEma) score += 18;
  if (Number.isFinite(prevShortEma) && Number.isFinite(prevMediumEma) && shortEma >= prevShortEma && mediumEma >= prevMediumEma) score += 8;
  if (momentum1 > 0) score += 10;
  if (momentum4 > 0.5) score += 12;
  if (momentumDay > 1) score += 8;
  if (higherHigh && higherLow) score += 10;
  if (breakingRecentHigh) score += 8;
  if (continuationCandle) score += 6;
  if (volumeRatio >= 1.15) score += 8;
  if (entryDistancePct <= MOMENTUM_MAX_ENTRY_DISTANCE_PCT) score += 8;
  else score -= Math.min(18, Math.round((entryDistancePct - MOMENTUM_MAX_ENTRY_DISTANCE_PCT) * 6));
  score = Math.max(0, Math.min(100, Math.round(score)));

  const trendLabel = breakingRecentHigh
    ? "breakout"
    : bullishStack && momentum4 > 1
      ? "strong uptrend"
      : continuationCandle
        ? "continuation"
        : "early trend";
  const momentumReason = [
    bullishStack ? "price above EMA9 and EMA20" : "trend is mixed",
    higherHigh && higherLow ? "higher highs and higher lows" : "trend structure still forming",
    volumeRatio >= 1.15 ? "activity is expanding" : "volume is steady",
    breakingRecentHigh ? "breaking recent highs" : "not extended yet"
  ].join(", ");

  return {
    ok: true,
    symbol,
    price,
    ema9: roundNumber(shortEma, 4),
    ema20: roundNumber(mediumEma, 4),
    recent_high: roundNumber(recentHigh, 4),
    recent_low: roundNumber(recentLow, 4),
    recent_change_1: roundNumber(momentum1, 3),
    recent_change_4: roundNumber(momentum4, 3),
    recent_change_day: roundNumber(momentumDay, 3),
    volume_ratio: roundNumber(volumeRatio, 3),
    entry_distance_pct: roundNumber(entryDistancePct, 3),
    higher_highs: higherHigh,
    higher_lows: higherLow,
    breaking_recent_high: breakingRecentHigh,
    continuation_candle: continuationCandle,
    bullish_stack: bullishStack,
    momentum_score: score,
    trend_label: trendLabel,
    momentum_reason: momentumReason
  };
}

async function getBitcoinPulseContext(refresh = false) {
  const btcQuote = await getTickerQuote("BTC", refresh);
  const ethQuote = await getTickerQuote("ETH", false);
  const btcChange = Number(btcQuote?.changePercent);
  const btcCurrent = Number(btcQuote?.current);
  const btcHigh = Number(btcQuote?.high);
  const btcLow = Number(btcQuote?.low);
  const btcRange = btcHigh - btcLow;
  const btcRangePosition = btcRange > 0 && Number.isFinite(btcCurrent)
    ? (btcCurrent - btcLow) / btcRange
    : null;
  const ibit = findLatestQuote("IBIT");
  const mstr = findLatestQuote("MSTR");
  const coin = findLatestQuote("COIN");

  return {
    ok: Boolean(btcQuote?.ok),
    btc_price: Number.isFinite(btcCurrent) ? btcCurrent : null,
    btc_change_pct_24h: Number.isFinite(btcChange) ? Number(btcChange.toFixed(3)) : null,
    btc_range_position_24h: Number.isFinite(btcRangePosition) ? Number(btcRangePosition.toFixed(3)) : null,
    btc_pulse: getBitcoinPulseLabel(btcChange, btcRangePosition),
    eth_change_pct_24h: Number.isFinite(Number(ethQuote?.changePercent)) ? Number(Number(ethQuote.changePercent).toFixed(3)) : null,
    ibit_change_pct: Number.isFinite(Number(ibit?.changePercent)) ? Number(Number(ibit.changePercent).toFixed(3)) : null,
    mstr_change_pct: Number.isFinite(Number(mstr?.changePercent)) ? Number(Number(mstr.changePercent).toFixed(3)) : null,
    coin_change_pct: Number.isFinite(Number(coin?.changePercent)) ? Number(Number(coin.changePercent).toFixed(3)) : null,
    source: btcQuote?.source || "binance.us",
    updatedAt: new Date().toISOString()
  };
}

function getBitcoinPulseLabel(changePct, rangePosition) {
  if (!Number.isFinite(changePct)) return "unknown";
  if (changePct >= 3 && Number(rangePosition) >= 0.65) return "btc_bull_run";
  if (changePct >= 1.25) return "btc_positive_momentum";
  if (changePct <= -3 && Number(rangePosition) <= 0.35) return "btc_breakdown";
  if (changePct <= -1.25) return "btc_negative_momentum";
  return "btc_chop";
}

function getBitcoinLinkedProfile(symbol) {
  const ticker = String(symbol || "").toUpperCase();
  const tags = BITCOIN_LINKED_PROFILES[ticker] || ["bitcoin_sensitive"];
  const group = tags[0] || "bitcoin_sensitive";
  const beta = tags.includes("very_high_beta")
    ? "very_high"
    : tags.includes("high_beta")
      ? "high"
      : tags.includes("btc_tracking")
        ? "tracking"
        : "medium";

  return {
    group,
    beta,
    tags,
    tracks: "Bitcoin swings, crypto risk appetite, and crypto-related news/activity"
  };
}

function parseJsonSignals(text, candidates, request) {
  const parsed = safeJsonParse(text) || safeJsonParse(extractJsonBlock(text));
  const rawSignals = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.signals) ? parsed.signals : [];
  const candidateBySymbol = new Map(candidates.map((candidate) => [candidate.symbol, candidate]));

  const signals = rawSignals
    .filter((signal) => signal && typeof signal === "object")
    .map((signal) => normalizeSignal(signal, candidateBySymbol, request))
    .filter(Boolean);

  if (signals.length) return signals;

  return candidates.map((candidate) => ({
    ticker: candidate.symbol,
    signal_id: createSignalId(request.mode, candidate.symbol, request.createdAt || new Date().toISOString(), "fallback"),
    bias: "watch",
    entry: `Research continuation above ${formatNumber(candidate.current)}`,
    stop: `Below day low ${formatNumber(candidate.low)}`,
    target1: `Retest day high ${formatNumber(candidate.high)}`,
    target2: "Next resistance after confirmation",
    confidence: 3,
    reason: "OpenAI did not return parseable JSON, so this fallback uses scanner ranking only.",
    invalid_if: "Momentum fades or price loses the current intraday range.",
    mode: request.mode,
    signal_mode: request.mode === "all" ? inferSourceMode(candidate.symbol) : request.mode,
    asset_class: request.modeConfig.assetClass,
    bull_run_flag: false,
    buy_trigger: `Research continuation above ${formatNumber(candidate.current)}`,
    sell_trigger: `Exit if price loses ${formatNumber(candidate.low)}`,
    hold_window: request.modeConfig.holdWindow,
    setup_score: Math.round(candidate.score || 1),
    webull_summary: `${candidate.symbol} | watch | ENTRY ${formatNumber(candidate.current)} | STOP ${formatNumber(candidate.low)} | TARGET1 ${formatNumber(candidate.high)} | TARGET2 next resistance | CONFIDENCE 3/10`
  }));
}

function mergeSignalsByVariant(signals = []) {
  const byKey = new Map();
  for (const signal of signals) {
    const key = getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type || "strict_take");
    const current = byKey.get(key);
    if (!current || Number(signal.momentum_score || signal.final_quality_score || signal.confidence || 0) > Number(current.momentum_score || current.final_quality_score || current.confidence || 0)) {
      byKey.set(key, signal);
    }
  }
  return [...byKey.values()];
}

function normalizeSignal(signal, candidateBySymbol, request) {
  const ticker = normalizeSignalTicker(signal.ticker || signal.symbol || "");
  if (!ticker) return null;

  const candidate = candidateBySymbol.get(ticker);
  const confidence = Number(signal.confidence);
  const setupScore = Number(signal.setup_score);
  const bullRunFlag = Boolean(signal.bull_run_flag) || isBullRunCandidate(candidate, signal, confidence);

  const sourceMode = request.mode === "all" ? inferSourceMode(ticker) : request.mode;
  const assetClass = request.mode === "all" ? inferAssetClass(ticker) : request.modeConfig.assetClass;
  const normalized = {
    signal_id: createSignalId(request.mode, ticker, request.createdAt || new Date().toISOString(), `${signal.bias || "watch"}:${signal.entry || ""}`),
    ticker,
    mode: request.mode,
    signal_mode: sourceMode,
    asset_class: assetClass,
    price: candidate?.current ?? null,
    active_price: candidate?.active_price ?? candidate?.current ?? null,
    active_price_label: candidate?.active_price_label ?? "",
    regular_market_price: candidate?.regular_market_price ?? null,
    premarket_price: candidate?.premarket_price ?? null,
    afterhours_price: candidate?.afterhours_price ?? null,
    extended_hours_price: candidate?.extended_hours_price ?? null,
    extended_hours_session: candidate?.extended_hours_session ?? null,
    extended_hours_note: candidate?.extended_hours_note ?? "",
    change_pct: candidate?.changePercent ?? null,
    score: candidate?.score ?? null,
    bitcoin_profile: candidate?.bitcoin_profile ?? null,
    bitcoin_pulse: candidate?.bitcoin_pulse ?? null,
    bitcoin_news_headlines: candidate?.bitcoin_news_headlines ?? [],
    bitcoin_activity_links: candidate?.bitcoin_activity_links ?? [],
    bitcoin_signal_note: candidate?.bitcoin_signal_note ?? "",
    bias: String(signal.bias || "watch"),
    signal_type: String(signal.signal_type || "strict_take"),
    entry: String(signal.entry || ""),
    stop: String(signal.stop || ""),
    target1: String(signal.target1 || ""),
    target2: String(signal.target2 || ""),
    confidence: Number.isFinite(confidence) ? Math.max(1, Math.min(10, confidence)) : 1,
    bull_run_flag: bullRunFlag,
    buy_trigger: String(signal.buy_trigger || signal.entry || ""),
    sell_trigger: String(signal.sell_trigger || signal.invalid_if || signal.stop || ""),
    hold_window: String(signal.hold_window || request.modeConfig.holdWindow),
    setup_score: Number.isFinite(setupScore) ? Math.max(1, Math.min(100, setupScore)) : getSetupScore(candidate, confidence, bullRunFlag),
    momentum_score: Number.isFinite(Number(signal.momentum_score)) ? Math.max(0, Math.min(100, Math.round(Number(signal.momentum_score)))) : Number(candidate?.momentum_context?.momentum_score || 0),
    trend_label: String(signal.trend_label || candidate?.momentum_context?.trend_label || ""),
    momentum_reason: String(signal.momentum_reason || candidate?.momentum_context?.momentum_reason || ""),
    reason: String(signal.reason || ""),
    invalid_if: String(signal.invalid_if || "")
  };
  return {
    ...normalized,
    ready_to_trade: formatWebullSummary(normalized),
    webull_summary: formatWebullSummary(normalized)
  };
}

function normalizeSignalTicker(value) {
  const raw = normalizeMarketTicker(value);
  if (!raw) return "";
  if (CRYPTO_SYMBOLS[raw]) return CRYPTO_SYMBOLS[raw].alias || raw;
  if (raw.endsWith("USDT")) {
    const base = raw.slice(0, -4);
    if (CRYPTO_SYMBOLS[base]) return CRYPTO_SYMBOLS[base].alias || base;
  }
  if (raw.endsWith("USD")) {
    const base = raw.slice(0, -3);
    if (CRYPTO_SYMBOLS[base]) return CRYPTO_SYMBOLS[base].alias || base;
  }
  return raw;
}

function buildMomentumSignals(candidates, strictSignals, request) {
  const strictByTicker = new Map(strictSignals.map((signal) => [signal.ticker, signal]));

  return candidates
    .map((candidate) => createMomentumSignal(candidate, strictByTicker.get(candidate.symbol), request))
    .filter(Boolean);
}

function createMomentumSignal(candidate, strictSignal, request) {
  const ticker = candidate?.symbol;
  const context = candidate?.momentum_context;
  if (!ticker || !context?.ok) return null;
  if (!context.bullish_stack) return null;
  if (!context.higher_highs || !context.higher_lows) return null;
  if (Number(context.momentum_score || 0) < MOMENTUM_MIN_SCORE) return null;
  if (Number(context.entry_distance_pct || 100) > MOMENTUM_MAX_ENTRY_DISTANCE_PCT) return null;

  const strictTake = strictSignal?.final_decision === "take";
  const price = Number(candidate.current || context.price || 0);
  if (!Number.isFinite(price) || price <= 0) return null;

  const entryPrice = Math.max(
    Number(context.ema9 || price * 0.998),
    Number(context.price || price)
  );
  const stopAnchor = Number(context.ema20 || candidate.low || price * 0.985);
  const stopPrice = Math.min(entryPrice * (1 - MOMENTUM_MAX_STOP_PCT / 100), stopAnchor);
  if (!Number.isFinite(stopPrice) || stopPrice <= 0 || stopPrice >= entryPrice) return null;

  const risk = entryPrice - stopPrice;
  const target1 = entryPrice + risk * 1.5;
  const target2 = entryPrice + risk * 2.4;
  const scoreFloor = strictTake ? 70 : 60;
  const setupScore = Math.max(scoreFloor, Math.min(100, Math.round((Number(context.momentum_score || 0) * 0.6) + (Number(candidate.score || 0) * 6))));
  const confidence = Math.max(MOMENTUM_MIN_CONFIDENCE, Math.min(8, Math.round((Number(context.momentum_score || 0) / 12) + (strictTake ? 1 : 0))));
  const reason = context.trend_label === "breakout"
    ? "Breaking highs with momentum."
    : context.trend_label === "continuation"
      ? "Strong uptrend, continuation move."
      : context.trend_label === "strong uptrend"
        ? "Bull run forming with strong trend structure."
        : "Bull run forming, early entry.";

  return {
    signal_id: createSignalId(request.mode, ticker, request.createdAt || new Date().toISOString(), `momentum:${context.trend_label}:${entryPrice}`),
    ticker,
    mode: request.mode,
    signal_mode: request.mode === "all" ? inferSourceMode(ticker) : request.mode,
    asset_class: request.mode === "all" ? inferAssetClass(ticker) : request.modeConfig.assetClass,
    price: candidate.current ?? null,
    active_price: candidate.active_price ?? candidate.current ?? null,
    active_price_label: candidate.active_price_label ?? "",
    regular_market_price: candidate.regular_market_price ?? null,
    premarket_price: candidate.premarket_price ?? null,
    afterhours_price: candidate.afterhours_price ?? null,
    extended_hours_price: candidate.extended_hours_price ?? null,
    extended_hours_session: candidate.extended_hours_session ?? null,
    extended_hours_note: candidate.extended_hours_note ?? "",
    change_pct: candidate.changePercent ?? null,
    score: candidate.score ?? null,
    rangePosition: candidate.rangePosition ?? null,
    bitcoin_profile: candidate.bitcoin_profile ?? null,
    bitcoin_pulse: candidate.bitcoin_pulse ?? null,
    bitcoin_news_headlines: candidate.bitcoin_news_headlines ?? [],
    bitcoin_activity_links: candidate.bitcoin_activity_links ?? [],
    bitcoin_signal_note: candidate.bitcoin_signal_note ?? "",
    signal_type: "momentum_take",
    bias: "bullish",
    entry: formatNumber(entryPrice),
    stop: formatNumber(stopPrice),
    target1: formatNumber(target1),
    target2: formatNumber(target2),
    confidence,
    bull_run_flag: true,
    buy_trigger: `Buy while ${ticker} holds above ${formatNumber(entryPrice)} with momentum.`,
    sell_trigger: `Exit if ${ticker} loses ${formatNumber(stopPrice)}.`,
    hold_window: String(strictSignal?.hold_window || request.modeConfig.holdWindow),
    setup_score: setupScore,
    momentum_score: Number(context.momentum_score || 0),
    trend_label: context.trend_label,
    momentum_reason: reason,
    reason: reason,
    invalid_if: `Momentum fails and price loses ${formatNumber(stopPrice)}.`,
    momentum_engine: {
      ema9: context.ema9,
      ema20: context.ema20,
      recent_change_1: context.recent_change_1,
      recent_change_4: context.recent_change_4,
      recent_change_day: context.recent_change_day,
      volume_ratio: context.volume_ratio,
      entry_distance_pct: context.entry_distance_pct
    }
  };
}

function inferSourceMode(ticker) {
  if (CRYPTO_UNIVERSE.includes(normalizeMarketTicker(ticker)) || CRYPTO_SYMBOLS[normalizeMarketTicker(ticker)]) return "crypto";
  if (INDEX_SYMBOLS[ticker]) return "futures";
  if (BITCOIN_LINKED_UNIVERSE.includes(ticker)) return "bitcoin";
  if (FUTURES_PROXY_UNIVERSE.includes(ticker)) return "futures";
  if (SWING_UNIVERSE.includes(ticker) && !INTRADAY_UNIVERSE.includes(ticker)) return "swing";
  return "intraday";
}

function inferAssetClass(ticker) {
  if (CRYPTO_UNIVERSE.includes(normalizeMarketTicker(ticker)) || CRYPTO_SYMBOLS[normalizeMarketTicker(ticker)]) return "crypto";
  if (INDEX_SYMBOLS[ticker]) return "index";
  if (BITCOIN_LINKED_UNIVERSE.includes(ticker)) return "bitcoin_linked";
  return FUTURES_PROXY_UNIVERSE.includes(ticker) ? "futures_proxy" : "equity";
}

function annotateSignalChanges(signals, request) {
  return signals.map((signal) => {
    const stateKey = getSignalVariantKey(request.mode, signal.ticker, signal.signal_type);
    const previous = state.lastSignals.get(stateKey);
    const status = previous ? "repeat" : "new";
    const biasChanged = Boolean(previous && previous.bias !== signal.bias);
    const confidenceDelta = previous ? signal.confidence - previous.confidence : 0;
    const baseSignal = {
      ...signal,
      status,
      bias_changed: biasChanged,
      confidence_delta: confidenceDelta
    };
    const qualitySignal = addQualityScores(baseSignal);
    const alertReasons = getAlertReasons(qualitySignal);
    const priorityScore = getPriorityScore(qualitySignal, alertReasons);
    const finalQualitySignal = addQualityScores({
      ...qualitySignal,
      priority_score: priorityScore
    });
    const finalAlertReasons = getAlertReasons(finalQualitySignal);
    const annotated = {
      ...finalQualitySignal,
      signal_id: finalQualitySignal.signal_id || createSignalId(request.mode, signal.ticker, new Date().toISOString(), finalQualitySignal.entry || ""),
      priority_score: priorityScore,
      alert_reasons: finalAlertReasons,
      alert: finalAlertReasons.length > 0,
      seenAt: new Date().toISOString()
    };

    state.lastSignals.set(stateKey, {
      ...annotated
    });

    rememberAlert(annotated);

    return annotated;
  });
}

function getModeTickerKey(mode, ticker) {
  return `${mode}:${ticker}`;
}

function getSignalVariantKey(mode, ticker, signalType = "strict_take") {
  return `${mode}:${ticker}:${signalType || "strict_take"}`;
}

function createSignalId(mode, ticker, timestamp, seed = "") {
  const bucket = new Date(timestamp || Date.now()).toISOString().slice(0, 16);
  const raw = `${mode}:${ticker}:${bucket}:${seed}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `sig_${mode}_${ticker}_${bucket.replace(/\D/g, "")}_${hash.toString(16)}`;
}

function formatWebullSummary(signal) {
  const signalLabel = signal.signal_type === "momentum_take"
    ? "MOMENTUM"
    : String(signal.final_decision || "watch").toUpperCase();
  return `${signal.ticker} | ${signal.signal_mode || signal.mode || "signal"} | ${signalLabel} | ${signal.bias} | ENTRY ${signal.entry} | STOP ${signal.stop} | T1 ${signal.target1} | T2 ${signal.target2} | SELL ${signal.sell_trigger || signal.stop} | CONF ${signal.confidence}/10`;
}

function addQualityScores(signal) {
  const regime = state.marketRegime || {};
  const sector = getSymbolSector(signal.ticker);
  const sectorStrength = getSectorStrengthScore(sector);
  const entryDistanceScore = getEntryDistanceScore(signal);
  const participationScore = getParticipationScore(signal);
  const regimeAlignment = getRegimeAlignment(signal, regime);
  const finalQualityScore = getFinalQualityScore({
    signal,
    regimeAlignment,
    sectorStrength,
    entryDistanceScore,
    participationScore
  });

  const signalTiming = getSignalTiming(signal);
  const session = getMarketSession(signal.signal_mode || signal.mode, signal.asset_class);
  const mtf = getMtfConfirmation(signal, regime, session);
  const enriched = {
    ...signal,
    market_regime: regime.regime || "unknown",
    regime_alignment: regimeAlignment.label,
    regime_alignment_score: regimeAlignment.score,
    bitcoin_alignment: signal.bitcoin_pulse?.btc_pulse || "",
    bitcoin_beta_group: signal.bitcoin_profile?.group || "",
    bitcoin_beta_level: signal.bitcoin_profile?.beta || "",
    sector,
    sector_proxy: SECTOR_ETFS[sector] || "",
    sector_strength: sectorStrength.label,
    sector_strength_score: sectorStrength.score,
    entry_distance_pct: entryDistanceScore.distancePct,
    entry_distance_score: entryDistanceScore.score,
    participation_score: participationScore,
    momentum_score: Number(signal.momentum_score || 0),
    trend_label: signal.trend_label || "",
    momentum_reason: signal.momentum_reason || "",
    final_quality_score: finalQualityScore,
    signal_age_seconds: signalTiming.ageSeconds,
    signal_stale_flag: signalTiming.stale,
    expires_at: signalTiming.expiresAt,
    expired_flag: signalTiming.expired,
    market_session: session.session_type,
    session_open_flag: session.session_open_flag,
    mtf_confirmation: mtf.confirmation,
    mtf_reason: mtf.reason,
    stale_after: new Date(Date.now() + SIGNAL_STALE_MS).toISOString()
  };
  const executionPlan = buildExecutionPlan(enriched);
  const decision = getFinalDecision(enriched, executionPlan);
  const decided = {
    ...enriched,
    final_decision: decision.final_decision,
    decision_reasons: decision.decision_reasons,
    skip_trade_flag: decision.skip_trade_flag,
    reward_to_risk_1: executionPlan.reward_risk_target1,
    reward_to_risk_2: executionPlan.reward_risk_target2
  };
  const finalExecutionPlan = {
    ...executionPlan,
    final_decision: decision.final_decision,
    decision_reasons: decision.decision_reasons,
    action: decision.final_decision === "take" ? "take" : decision.final_decision,
    summary: formatExecutionSummary({ ...decided }, executionPlan, decision)
  };

  return {
    ...decided,
    execution_plan: finalExecutionPlan,
    execution_summary: finalExecutionPlan.summary,
    ready_to_trade: formatWebullSummary(decided),
    webull_summary: formatWebullSummary(decided)
  };
}

function getExecutionSettings() {
  const accountSize = Number.isFinite(EXECUTION_ACCOUNT_SIZE) && EXECUTION_ACCOUNT_SIZE > 0 ? EXECUTION_ACCOUNT_SIZE : 10000;
  const riskPct = Number.isFinite(EXECUTION_RISK_PCT) && EXECUTION_RISK_PCT > 0 ? EXECUTION_RISK_PCT : 0.5;
  const maxPositionPct = Number.isFinite(EXECUTION_MAX_POSITION_PCT) && EXECUTION_MAX_POSITION_PCT > 0 ? EXECUTION_MAX_POSITION_PCT : 20;

  return {
    account_size: accountSize,
    risk_pct: riskPct,
    max_position_pct: maxPositionPct,
    max_risk_dollars: Number((accountSize * riskPct / 100).toFixed(2)),
    max_position_dollars: Number((accountSize * maxPositionPct / 100).toFixed(2))
  };
}

function buildExecutionPlan(signal) {
  const settings = getExecutionSettings();
  const current = Number(signal.price);
  const entry = parseFirstNumber(signal.entry || signal.buy_trigger);
  const stop = parseFirstNumber(signal.stop || signal.sell_trigger);
  const target1 = parseFirstNumber(signal.target1);
  const target2 = parseFirstNumber(signal.target2);
  const bearish = ["bearish", "short", "sell"].includes(String(signal.bias || "").toLowerCase());
  const buyNowType = getBuyNowType(signal);
  const riskPerShare = Number.isFinite(entry) && Number.isFinite(stop)
    ? Math.abs(entry - stop)
    : NaN;
  const maxRiskShares = riskPerShare > 0 ? Math.floor(settings.max_risk_dollars / riskPerShare) : 0;
  const maxPositionShares = Number.isFinite(entry) && entry > 0
    ? Math.floor(settings.max_position_dollars / entry)
    : 0;
  const rawShares = Math.max(0, Math.min(maxRiskShares || 0, maxPositionShares || 0));
  const suggestedShares = buyNowType === "momentum_take"
    ? Math.max(0, Math.floor(rawShares * MOMENTUM_POSITION_SCALE))
    : rawShares;
  const estimatedPositionDollars = Number.isFinite(entry)
    ? Number((suggestedShares * entry).toFixed(2))
    : 0;
  const estimatedRiskDollars = Number.isFinite(riskPerShare)
    ? Number((suggestedShares * riskPerShare).toFixed(2))
    : 0;
  const reward1 = Number.isFinite(target1) && Number.isFinite(entry)
    ? Math.abs(target1 - entry)
    : NaN;
  const reward2 = Number.isFinite(target2) && Number.isFinite(entry)
    ? Math.abs(target2 - entry)
    : NaN;
  const rr1 = riskPerShare > 0 && Number.isFinite(reward1) ? Number((reward1 / riskPerShare).toFixed(2)) : null;
  const rr2 = riskPerShare > 0 && Number.isFinite(reward2) ? Number((reward2 / riskPerShare).toFixed(2)) : null;
  const entryDistancePct = Number(signal.entry_distance_pct);
  const quality = Number(signal.final_quality_score || 0);
  const confidence = Number(signal.confidence || 0);
  const skipReasons = getExecutionSkipReasons({
    signal,
    entry,
    stop,
    riskPerShare,
    suggestedShares,
    rr1,
    entryDistancePct,
    quality,
    confidence
  });
  const action = skipReasons.length ? "skip" : quality >= 80 && confidence >= 8 ? "take_candidate" : "watch";
  const orderSide = bearish ? "sell short" : "buy";
  const entryText = Number.isFinite(entry) ? formatNumber(entry) : String(signal.entry || "");
  const stopText = Number.isFinite(stop) ? formatNumber(stop) : String(signal.stop || "");
  const summary = skipReasons.length
    ? `${signal.ticker} | SKIP | ${skipReasons.join("; ")}`
    : `${signal.ticker} | ${action.toUpperCase()} | ${orderSide.toUpperCase()} ${suggestedShares} @ ${entryText} | STOP ${stopText} | RISK $${estimatedRiskDollars} | RR1 ${rr1 ?? "n/a"} | QUALITY ${quality}`;

  return {
    signal_id: signal.signal_id,
    ticker: signal.ticker,
    mode: signal.signal_mode || signal.mode,
    bias: signal.bias,
    action,
    skip_reasons: skipReasons,
    account_size: settings.account_size,
    risk_pct: settings.risk_pct,
    max_risk_dollars: settings.max_risk_dollars,
    max_position_dollars: settings.max_position_dollars,
    entry: Number.isFinite(entry) ? entry : null,
    stop: Number.isFinite(stop) ? stop : null,
    target1: Number.isFinite(target1) ? target1 : null,
    target2: Number.isFinite(target2) ? target2 : null,
    current_price: Number.isFinite(current) ? current : null,
    active_price: signal.active_price ?? (Number.isFinite(current) ? current : null),
    active_price_label: signal.active_price_label || "",
    regular_market_price: signal.regular_market_price ?? null,
    premarket_price: signal.premarket_price ?? null,
    afterhours_price: signal.afterhours_price ?? null,
    extended_hours_price: signal.extended_hours_price ?? null,
    extended_hours_session: signal.extended_hours_session ?? null,
    risk_per_share: Number.isFinite(riskPerShare) ? Number(riskPerShare.toFixed(4)) : null,
    suggested_shares: suggestedShares,
    estimated_position_dollars: estimatedPositionDollars,
    estimated_risk_dollars: estimatedRiskDollars,
    reward_risk_target1: rr1,
    reward_risk_target2: rr2,
    final_quality_score: quality,
    confidence,
    final_decision: signal.final_decision || action,
    buy_now_type: buyNowType,
    signal_type: signal.signal_type || "strict_take",
    momentum_score: Number(signal.momentum_score || 0),
    trend_label: signal.trend_label || "",
    momentum_reason: signal.momentum_reason || "",
    bitcoin_profile: signal.bitcoin_profile || null,
    bitcoin_pulse: signal.bitcoin_pulse || null,
    bitcoin_alignment: signal.bitcoin_alignment || "",
    bitcoin_beta_group: signal.bitcoin_beta_group || "",
    bitcoin_beta_level: signal.bitcoin_beta_level || "",
    bitcoin_news_headlines: signal.bitcoin_news_headlines || [],
    entry_distance_pct: Number.isFinite(entryDistancePct) ? entryDistancePct : null,
    summary
  };
}

function formatExecutionSummary(signal, plan, decision) {
  if (decision.final_decision === "skip") {
    return `${signal.ticker} | SKIP | ${decision.decision_reasons.join("; ")}`;
  }

  const bearish = ["bearish", "short", "sell"].includes(String(signal.bias || "").toLowerCase());
  const side = bearish ? "SELL SHORT" : "BUY";
  const entryText = plan.entry !== null ? formatNumber(plan.entry) : String(signal.entry || "");
  const stopText = plan.stop !== null ? formatNumber(plan.stop) : String(signal.stop || "");
  const banner = plan.buy_now_type === "momentum_take" ? "MOMENTUM" : decision.final_decision.toUpperCase();

  return `${signal.ticker} | ${banner} | ${side} ${plan.suggested_shares} @ ${entryText} | STOP ${stopText} | RISK $${plan.estimated_risk_dollars} | RR1 ${plan.reward_risk_target1 ?? "n/a"} | QUALITY ${signal.final_quality_score}`;
}

function getFinalDecision(signal, executionPlan) {
  const quality = Number(signal.final_quality_score || 0);
  const confidence = Number(signal.confidence || 0);
  const rr1 = Number(executionPlan.reward_risk_target1);
  const rr2 = Number(executionPlan.reward_risk_target2);
  const entryClose = Number(signal.entry_distance_pct) <= 1;
  const skipReasons = getDecisionSkipReasons(signal, executionPlan);
  const watchReasons = [];

  if (skipReasons.length) {
    return {
      final_decision: "skip",
      skip_trade_flag: true,
      decision_reasons: skipReasons
    };
  }

  if (
    quality >= DECISION_TAKE_QUALITY_MIN &&
    confidence >= 7 &&
    Number.isFinite(rr1) &&
    rr1 >= DECISION_TAKE_RR1_MIN &&
    entryClose
  ) {
    return {
      final_decision: "take",
      skip_trade_flag: false,
      decision_reasons: ["quality/confidence/risk aligned"]
    };
  }

  if (quality >= 60) watchReasons.push("quality decent");
  if (!entryClose) watchReasons.push("wait for entry proximity");
  if (confidence >= 5 && confidence < 7) watchReasons.push("medium confidence");
  if (Number.isFinite(rr1) && rr1 < DECISION_TAKE_RR1_MIN) watchReasons.push("needs better reward/risk");
  if (Number.isFinite(rr2) && rr2 >= DECISION_TAKE_RR1_MIN) watchReasons.push("target2 has acceptable reward/risk");
  if (signal.bull_run_flag) watchReasons.push("bull-run candidate");

  return {
    final_decision: "watch",
    skip_trade_flag: false,
    decision_reasons: watchReasons.length ? [...new Set(watchReasons)] : ["not enough confirmation for TAKE"]
  };
}

function getBuyNowType(signal) {
  if (signal.signal_type === "momentum_take") {
    if (signal.expired_flag || signal.signal_stale_flag) return null;
    if (Number(signal.confidence || 0) < MOMENTUM_MIN_CONFIDENCE) return null;
    if (Number(signal.final_quality_score || 0) < 60) return null;
    if (Number(signal.momentum_score || 0) < MOMENTUM_MIN_SCORE) return null;
    const entryDistancePct = signal.entry_distance_pct === null || signal.entry_distance_pct === undefined
      ? 100
      : Number(signal.entry_distance_pct);
    if (!Number.isFinite(entryDistancePct) || entryDistancePct > MOMENTUM_MAX_ENTRY_DISTANCE_PCT) return null;
    if (signal.regime_alignment === "against_regime") return null;
    return "momentum_take";
  }
  if (signal.final_decision === "take") return "take";
  return null;
}

function buyNowSortScore(a, b) {
  const rankA = a.buy_now_type === "take" ? 0 : a.buy_now_type === "momentum_take" ? 1 : 2;
  const rankB = b.buy_now_type === "take" ? 0 : b.buy_now_type === "momentum_take" ? 1 : 2;
  if (rankA !== rankB) return rankA - rankB;
  if (rankA === 1 || rankB === 1) {
    const momentumDelta = Number(b.momentum_score || 0) - Number(a.momentum_score || 0);
    if (momentumDelta !== 0) return momentumDelta;
  }
  return Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0);
}

function getBestExecutionPlanForTicker(plans = [], ticker = "") {
  return plans
    .filter((plan) => plan.ticker === ticker)
    .sort((a, b) => {
      const buyNowDelta = buyNowSortScore(a, b);
      if (buyNowDelta !== 0) return buyNowDelta;
      return decisionRank(a.final_decision) - decisionRank(b.final_decision) || Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0);
    })[0] || null;
}

function getDecisionSkipReasons(signal, executionPlan) {
  const reasons = [];
  const quality = Number(signal.final_quality_score || 0);
  const confidence = Number(signal.confidence || 0);
  const rr1 = Number(executionPlan.reward_risk_target1);
  const rr2 = Number(executionPlan.reward_risk_target2);
  const neutralBias = ["neutral", "watch", "hold"].includes(String(signal.bias || "").toLowerCase());

  if (signal.expired_flag) reasons.push("expired signal");
  if (signal.signal_stale_flag) reasons.push("stale signal");
  if (neutralBias) reasons.push("neutral/watch signal");
  if (quality < 55) reasons.push("poor setup quality");
  if (confidence < 5) reasons.push("low confidence");
  if (executionPlan.stop === null) reasons.push("no usable stop");
  if (executionPlan.risk_per_share === null || Number(executionPlan.risk_per_share) <= 0) reasons.push("bad risk model");
  if (executionPlan.suggested_shares <= 0) reasons.push("position size is zero");
  if (Number.isFinite(rr1) && rr1 < 1 && (!Number.isFinite(rr2) || rr2 < 1.25)) reasons.push("bad reward/risk");
  if (signal.regime_alignment === "against_regime") reasons.push("against regime");
  if (!signal.session_open_flag && !["futures_proxy", "bitcoin_linked"].includes(signal.asset_class) && quality < 80) reasons.push("off-session equity signal");
  if (signal.mtf_confirmation === "weak" && quality < 70) reasons.push("weak multi-timeframe proxy");

  return [...new Set(reasons)];
}

function getExecutionSkipReasons({ signal, entry, stop, riskPerShare, suggestedShares, rr1, entryDistancePct, quality, confidence }) {
  const reasons = [];
  const neutralBias = ["neutral", "watch", "hold"].includes(String(signal.bias || "").toLowerCase());

  if (neutralBias) reasons.push("neutral/watch signal");
  if (quality < FINAL_QUALITY_ALERT_MIN) reasons.push(`quality below ${FINAL_QUALITY_ALERT_MIN}`);
  if (confidence < 7) reasons.push("confidence below 7");
  if (!Number.isFinite(entry)) reasons.push("no numeric entry");
  if (!Number.isFinite(stop)) reasons.push("no numeric stop");
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) reasons.push("invalid risk per share");
  if (Number.isFinite(entryDistancePct) && entryDistancePct > 1) reasons.push("entry too far from current price");
  if (rr1 !== null && rr1 < 1) reasons.push("target1 reward/risk below 1");
  if (suggestedShares <= 0) reasons.push("position size is zero under risk settings");
  if (signal.regime_alignment === "against_regime") reasons.push("against market regime");

  return [...new Set(reasons)];
}

function getSignalTiming(signal) {
  const mode = signal.signal_mode || signal.mode || "intraday";
  const created = Date.parse(signal.seenAt || signal.createdAt || new Date().toISOString());
  const now = Date.now();
  const ageSeconds = Math.max(0, Math.round((now - created) / 1000));
  const ttlMs = getSignalTtlMs(mode);
  const expiresAt = new Date(created + ttlMs).toISOString();

  return {
    ageSeconds,
    expiresAt,
    stale: ageSeconds * 1000 > Math.min(ttlMs, SIGNAL_STALE_MS),
    expired: now > created + ttlMs
  };
}

function getSignalTtlMs(mode) {
  if (mode === "swing") return 5 * 24 * 60 * 60 * 1000;
  if (mode === "futures") return 2 * 60 * 60 * 1000;
  if (mode === "bitcoin") return 2 * 60 * 60 * 1000;
  if (mode === "crypto") return 2 * 60 * 60 * 1000;
  return 30 * 60 * 1000;
}

function getMarketSession(mode = "intraday", assetClass = "equity") {
  const now = new Date();
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(now);
  const parts = Object.fromEntries(eastern.map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = parts.weekday;
  const weekdayOpen = !["Sat", "Sun"].includes(weekday);
  let sessionType = "overnight";

  if (weekdayOpen && minutes >= 4 * 60 && minutes < 9 * 60 + 30) sessionType = "premarket";
  if (weekdayOpen && minutes >= 9 * 60 + 30 && minutes < 16 * 60) sessionType = "regular";
  if (weekdayOpen && minutes >= 16 * 60 && minutes < 20 * 60) sessionType = "afterhours";

  const futuresLike = mode === "futures" || assetClass === "futures_proxy";
  const cryptoLike = mode === "crypto" || assetClass === "crypto";
  const bitcoinLike = mode === "bitcoin" || assetClass === "bitcoin_linked" || cryptoLike;
  const sessionOpenFlag = futuresLike
    ? !((weekday === "Fri" && minutes >= 17 * 60) || weekday === "Sat" || (weekday === "Sun" && minutes < 18 * 60))
    : cryptoLike
      ? true
      : bitcoinLike
        ? ["premarket", "regular", "afterhours"].includes(sessionType)
      : sessionType === "regular";

  return {
    session_type: sessionType,
    session_open_flag: sessionOpenFlag,
    eastern_time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
    weekday
  };
}

function getMtfConfirmation(signal, regime, session) {
  const rangePosition = Number(signal.rangePosition ?? signal.range_position ?? 0);
  const changePct = Number(signal.change_pct || 0);
  const aligned = signal.regime_alignment === "aligned" || regime.regime === "mixed";
  const bullish = ["bullish", "buy", "long"].includes(String(signal.bias || "").toLowerCase());
  const bearish = ["bearish", "sell", "short"].includes(String(signal.bias || "").toLowerCase());

  if ((bullish && aligned && (rangePosition >= 0.6 || changePct >= 1)) || (bearish && aligned && changePct <= -1)) {
    return {
      confirmation: "confirmed",
      reason: "mode/regime/range proxy aligned"
    };
  }

  if (session.session_type !== "regular" && !["futures_proxy", "bitcoin_linked"].includes(signal.asset_class)) {
    return {
      confirmation: "weak",
      reason: "equity signal is outside regular session"
    };
  }

  if (signal.regime_alignment === "against_regime") {
    return {
      confirmation: "weak",
      reason: "signal is against regime"
    };
  }

  return {
    confirmation: "partial",
    reason: "needs stronger range or regime confirmation"
  };
}

function getSymbolSector(ticker) {
  if (SYMBOL_SECTORS[ticker]) return SYMBOL_SECTORS[ticker];
  const sectorEntry = Object.entries(SECTOR_ETFS).find(([, proxy]) => proxy === ticker);
  if (sectorEntry) return sectorEntry[0];
  if (["SPX", "SPY", "QQQ", "IWM", "DIA", "RSP", "MDY"].includes(ticker)) return "index";
  if (["EFA", "EEM", "EWJ", "EWZ", "INDA", "FXI", "KWEB"].includes(ticker)) return "international";
  if (["GLD", "SLV", "USO", "UNG", "DBA"].includes(ticker)) return "commodities";
  if (["TLT", "IEF", "SHY", "HYG", "LQD"].includes(ticker)) return "bonds";
  return "other";
}

function getSectorStrengthScore(sector) {
  const proxy = SECTOR_ETFS[sector];
  const quote = proxy ? findLatestQuote(proxy) : null;
  const change = Number(quote?.changePercent);
  const score = Number.isFinite(change)
    ? Math.max(0, Math.min(100, 50 + change * 12))
    : 50;
  const label = score >= 65 ? "strong" : score <= 40 ? "weak" : "neutral";

  return {
    label,
    score: Math.round(score),
    proxy: proxy || "",
    proxy_change_pct: Number.isFinite(change) ? Number(change.toFixed(3)) : null
  };
}

function getEntryDistanceScore(signal) {
  const current = Number(signal.price);
  const entry = parseFirstNumber(signal.entry || signal.buy_trigger);
  if (!Number.isFinite(current) || !Number.isFinite(entry) || current <= 0) {
    return { score: 35, distancePct: null };
  }

  const distancePct = Math.abs(entry - current) / current * 100;
  const score = Math.max(0, Math.min(100, 100 - distancePct * 35));
  return {
    score: Math.round(score),
    distancePct: Number(distancePct.toFixed(2))
  };
}

function getParticipationScore(signal) {
  const changePercent = Math.max(0, Number(signal.change_pct || 0));
  const scannerScore = Math.max(0, Number(signal.score || 0));
  const score = changePercent * 10 + scannerScore * 4 + (signal.bull_run_flag ? 10 : 0);
  return Math.max(1, Math.min(100, Math.round(score)));
}

function getRegimeAlignment(signal, regime) {
  const marketRegime = regime?.regime || "unknown";
  const bias = String(signal.bias || "").toLowerCase();
  const bullish = ["bullish", "buy", "long"].includes(bias);
  const bearish = ["bearish", "sell", "short"].includes(bias);
  const bitcoinLike = signal.asset_class === "bitcoin_linked" || signal.asset_class === "crypto" || signal.signal_mode === "bitcoin" || signal.signal_mode === "crypto";

  if (bitcoinLike) {
    const pulse = String(signal.bitcoin_pulse?.btc_pulse || "").toLowerCase();
    const btcPositive = pulse.includes("bull") || pulse.includes("positive");
    const btcNegative = pulse.includes("breakdown") || pulse.includes("negative");
    if ((bullish && btcPositive) || (bearish && btcNegative)) return { label: "aligned", score: 100 };
    if ((bullish && btcNegative) || (bearish && btcPositive)) return { label: "against_regime", score: 25 };
    return { label: "neutral", score: 55 };
  }

  if (marketRegime === "unknown" || marketRegime === "mixed" || (!bullish && !bearish)) {
    return { label: "neutral", score: 50 };
  }

  if ((marketRegime === "bullish" && bullish) || (marketRegime === "bearish" && bearish)) {
    return { label: "aligned", score: 100 };
  }

  return { label: "against_regime", score: 20 };
}

function getFinalQualityScore({ signal, regimeAlignment, sectorStrength, entryDistanceScore, participationScore }) {
  const setup = Math.max(0, Math.min(100, Number(signal.setup_score || 0)));
  const confidence = Math.max(0, Math.min(100, Number(signal.confidence || 0) * 10));
  const priority = Math.max(0, Math.min(100, Number(signal.priority_score || 0) * 5));
  const momentum = Math.max(0, Math.min(100, Number(signal.momentum_score || 0)));
  const score =
    setup * 0.22 +
    confidence * 0.21 +
    priority * 0.12 +
    regimeAlignment.score * 0.14 +
    sectorStrength.score * 0.09 +
    entryDistanceScore.score * 0.07 +
    participationScore * 0.03 +
    momentum * 0.12;

  return Math.round(Math.max(1, Math.min(100, score)));
}

function isBullRunCandidate(candidate, signal, confidence) {
  const changePercent = Number(candidate?.changePercent || 0);
  const rangePosition = Number(candidate?.rangePosition || 0);
  const bias = String(signal?.bias || "").toLowerCase();
  return confidence >= 7 && changePercent >= 2 && rangePosition >= 0.6 && ["bullish", "buy", "long"].includes(bias);
}

function getSetupScore(candidate, confidence, bullRunFlag) {
  const changePercent = Math.max(0, Number(candidate?.changePercent || 0));
  const rangePosition = Math.max(0, Number(candidate?.rangePosition || 0));
  const score = confidence * 8 + Math.min(changePercent, 10) * 3 + rangePosition * 10 + (bullRunFlag ? 12 : 0);
  return Math.max(1, Math.min(100, Math.round(score)));
}

function getPriorityScore(signal, alertReasons) {
  const confidence = Number(signal.confidence || 0);
  const changePercent = Math.max(0, Number(signal.change_pct || 0));
  const biasBonus = ["bullish", "buy", "long"].includes(String(signal.bias || "").toLowerCase()) ? 1.5 : 0;
  const bullRunBonus = signal.bull_run_flag ? 2.5 : 0;
  const setupBonus = Math.max(0, Number(signal.setup_score || 0)) / 20;
  const regimePenalty = signal.regime_alignment === "against_regime" ? -2.5 : signal.regime_alignment === "aligned" ? 1 : 0;
  const sectorBonus = Number(signal.sector_strength_score || 50) >= 65 ? 0.8 : Number(signal.sector_strength_score || 50) <= 40 ? -0.8 : 0;
  const entryBonus = Number(signal.entry_distance_score || 0) >= 75 ? 1 : Number(signal.entry_distance_score || 0) <= 35 ? -1 : 0;
  const newBonus = signal.status === "new" ? 1.25 : 0;
  const biasChangeBonus = signal.bias_changed ? 2 : 0;
  const confidenceDeltaBonus = Math.max(0, Number(signal.confidence_delta || 0)) * 0.8;
  const alertBonus = alertReasons.length * 0.6;
  const score = confidence * 1.5 + Math.min(changePercent, 10) * 0.9 + biasBonus + bullRunBonus + setupBonus + regimePenalty + sectorBonus + entryBonus + newBonus + biasChangeBonus + confidenceDeltaBonus + alertBonus;

  return Number(score.toFixed(2));
}

function getAlertReasons(signal) {
  if (signal.signal_type === "momentum_take") return [];
  const reasons = [];
  const confidence = Number(signal.confidence || 0);
  const confidenceDelta = Number(signal.confidence_delta || 0);
  const finalQuality = Number(signal.final_quality_score || 0);
  const neutralBias = ["neutral", "watch", "hold"].includes(String(signal.bias || "").toLowerCase());

  if (confidence >= 7) reasons.push("confidence >= 7");
  if (finalQuality >= FINAL_QUALITY_ALERT_MIN) reasons.push(`quality >= ${FINAL_QUALITY_ALERT_MIN}`);
  if (signal.bull_run_flag) reasons.push("bull-run candidate");
  if (signal.bias_changed) reasons.push("bias changed");
  if (confidenceDelta >= 2) reasons.push("confidence increased by 2+");
  if (signal.status === "new" && (confidence >= 5 || finalQuality >= 55)) reasons.push("new top signal");
  if (isEntryCloseToCurrentPrice(signal)) reasons.push("entry close to current price");
  if (neutralBias && finalQuality < 65 && confidence < 7) {
    return reasons.filter((reason) => ["bias changed", "confidence increased by 2+"].includes(reason));
  }

  return reasons;
}

function isDeliverableAlert(signal) {
  return Boolean(
    signal.alert &&
    Number(signal.final_quality_score || 0) >= FINAL_QUALITY_ALERT_MIN &&
    signal.final_decision === "take" &&
    !signal.expired_flag &&
    Number(signal.confidence || 0) >= 7 &&
    isEntryCloseToCurrentPrice(signal) &&
    !isSignalStale(signal)
  );
}

function isSignalStale(signal) {
  const seenAt = Date.parse(signal.seenAt || signal.createdAt || Date.now());
  return Date.now() - seenAt > SIGNAL_STALE_MS;
}

function isEntryCloseToCurrentPrice(signal) {
  const current = Number(signal.price);
  const entry = parseFirstNumber(signal.entry);
  if (!Number.isFinite(current) || !Number.isFinite(entry) || current <= 0) return false;
  return Math.abs(entry - current) / current <= 0.01;
}

function parseFirstNumber(value) {
  const match = String(value || "").replaceAll(",", "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function computeEma(values, period) {
  const numeric = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!numeric.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [];
  let ema = numeric[0];
  for (const value of numeric) {
    ema = (value - ema) * multiplier + ema;
    result.push(ema);
  }
  return result;
}

function getPctChange(current, previous) {
  const a = Number(current);
  const b = Number(previous);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / b) * 100;
}

function average(values = []) {
  const numeric = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function roundNumber(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(digits));
}

function buildChartOverlayLevels(signal, quote) {
  if (!signal) return [];
  const rawLevels = [
    { key: "entry", label: "Entry", tone: "entry", price: parseFirstNumber(signal.entry) },
    { key: "stop", label: "Stop", tone: "stop", price: parseFirstNumber(signal.stop) },
    { key: "target1", label: "Target 1", tone: "target1", price: parseFirstNumber(signal.target1) },
    { key: "target2", label: "Target 2", tone: "target2", price: parseFirstNumber(signal.target2) },
    { key: "sell_trigger", label: "Sell Trigger", tone: "sell", price: parseFirstNumber(signal.sell_trigger) }
  ];

  return rawLevels
    .filter((item) => Number.isFinite(item.price))
    .map((item) => ({
      ...item,
      price: Number(item.price.toFixed(6)),
      current_delta_pct: Number.isFinite(Number(quote?.current)) && Number(quote.current) > 0
        ? Number((((item.price - Number(quote.current)) / Number(quote.current)) * 100).toFixed(2))
        : null
    }));
}

function getChartOverlayRange(quote, levels = []) {
  const values = [
    Number(quote?.low),
    Number(quote?.high),
    Number(quote?.current),
    ...levels.map((level) => Number(level.price))
  ].filter(Number.isFinite);

  if (!values.length) {
    return { min: 0, max: 1, span: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.000001, max - min);
  const padding = span * 0.12;

  return {
    min: Number((min - padding).toFixed(6)),
    max: Number((max + padding).toFixed(6)),
    span: Number((span + padding * 2).toFixed(6))
  };
}

function rememberAlert(signal) {
  if (!signal.alert) return;

  const alertKey = getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type);
  const previous = state.latestAlerts.get(alertKey);
  const signature = [
    signal.signal_id,
    signal.bias,
    signal.entry,
    signal.stop,
    signal.target1,
    signal.target2,
    signal.confidence,
    signal.priority_score,
    signal.final_quality_score,
    signal.final_decision,
    signal.alert_reasons.join("|"),
    signal.mode
  ].join("::");

  if (previous?.signature === signature) return;

  state.latestAlerts.set(getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type), {
    ticker: signal.ticker,
    signal_id: signal.signal_id,
    mode: signal.mode,
    signal_mode: signal.signal_mode,
    asset_class: signal.asset_class,
    bias: signal.bias,
    entry: signal.entry,
    stop: signal.stop,
    target1: signal.target1,
    target2: signal.target2,
    confidence: signal.confidence,
    priority_score: signal.priority_score,
    final_quality_score: signal.final_quality_score,
    final_decision: signal.final_decision,
    decision_reasons: signal.decision_reasons,
    signal_age_seconds: signal.signal_age_seconds,
    signal_stale_flag: signal.signal_stale_flag,
    expires_at: signal.expires_at,
    expired_flag: signal.expired_flag,
    market_session: signal.market_session,
    session_open_flag: signal.session_open_flag,
    mtf_confirmation: signal.mtf_confirmation,
    mtf_reason: signal.mtf_reason,
    market_regime: signal.market_regime,
    regime_alignment: signal.regime_alignment,
    regime_alignment_score: signal.regime_alignment_score,
    sector: signal.sector,
    sector_proxy: signal.sector_proxy,
    sector_strength: signal.sector_strength,
    sector_strength_score: signal.sector_strength_score,
    entry_distance_pct: signal.entry_distance_pct,
    entry_distance_score: signal.entry_distance_score,
    participation_score: signal.participation_score,
    execution_plan: signal.execution_plan,
    execution_summary: signal.execution_summary,
    setup_score: signal.setup_score,
    bull_run_flag: signal.bull_run_flag,
    buy_trigger: signal.buy_trigger,
    sell_trigger: signal.sell_trigger,
    hold_window: signal.hold_window,
    alert_reasons: signal.alert_reasons,
    webull_summary: signal.webull_summary || signal.ready_to_trade,
    price: signal.price,
    active_price: signal.active_price,
    active_price_label: signal.active_price_label,
    regular_market_price: signal.regular_market_price,
    premarket_price: signal.premarket_price,
    afterhours_price: signal.afterhours_price,
    extended_hours_price: signal.extended_hours_price,
    extended_hours_session: signal.extended_hours_session,
    change_pct: signal.change_pct,
    status: signal.status,
    bias_changed: signal.bias_changed,
    confidence_delta: signal.confidence_delta,
    seenAt: signal.seenAt,
    createdAt: new Date().toISOString(),
    signature
  });
}

async function deliverEligibleAlerts(signals) {
  const results = [];

  for (const signal of signals) {
    if (!isDeliverableAlert(signal)) continue;

    const signature = getDeliverySignature(signal);
    const key = getSignalVariantKey(signal.mode || "intraday", signal.ticker, signal.signal_type);
    if (state.sentAlertMap.get(key)?.signature === signature) continue;

    const payload = buildDeliveryPayload(signal);
    const deliveryResults = await sendAlertPayload(payload);
    if (!deliveryResults.some((result) => result.ok)) continue;

    const sent = {
      ...payload,
      delivery_results: deliveryResults,
      signature,
      sentAt: new Date().toISOString()
    };

    state.sentAlertMap.set(key, sent);
    state.latestSentAlerts.unshift(sent);
    state.latestSentAlerts = state.latestSentAlerts.slice(0, 50);
    markLifecycleAlerted(signal);
    results.push(sent);
  }

  return results;
}

function markLifecycleAlerted(signal) {
  const previous = state.lifecycle.get(signal.signal_id);
  if (previous && previous.lifecycle_status !== "new") return;
  const now = new Date().toISOString();
  state.lifecycle.set(signal.signal_id, {
    ...(previous || {}),
    signal_id: signal.signal_id,
    ticker: signal.ticker,
    mode: signal.signal_mode || signal.mode,
    asset_class: signal.asset_class,
    bias: signal.bias,
    lifecycle_status: "alerted",
    lifecycle_updated_at: now,
    created_at: previous?.created_at || signal.seenAt || now,
    current_price: signal.price,
    final_decision: signal.final_decision,
    confidence: signal.confidence,
    final_quality_score: signal.final_quality_score,
    webull_summary: signal.webull_summary,
    transitions: [...(previous?.transitions || []), { from: previous?.lifecycle_status || "new", to: "alerted", at: now, price: signal.price ?? null }]
  });
}

function getDeliverySignature(signal) {
  return [
    signal.ticker,
    signal.mode,
    signal.signal_mode,
    signal.bias,
    signal.entry,
    signal.stop,
    signal.target1,
    signal.target2,
    signal.confidence,
    signal.priority_score,
    signal.final_quality_score,
    signal.final_decision,
    signal.sell_trigger,
    signal.alert_reasons.join("|")
  ].join("::");
}

function buildDeliveryPayload(signal) {
  return {
    ticker: signal.ticker,
    signal_id: signal.signal_id,
    mode: signal.mode,
    signal_mode: signal.signal_mode || signal.mode,
    asset_class: signal.asset_class,
    bias: signal.bias,
    bull_run_flag: signal.bull_run_flag,
    entry: signal.entry,
    sell_trigger: signal.sell_trigger,
    stop: signal.stop,
    target1: signal.target1,
    target2: signal.target2,
    confidence: signal.confidence,
    priority_score: signal.priority_score,
    final_quality_score: signal.final_quality_score,
    final_decision: signal.final_decision,
    decision_reasons: signal.decision_reasons,
    signal_age_seconds: signal.signal_age_seconds,
    signal_stale_flag: signal.signal_stale_flag,
    expires_at: signal.expires_at,
    expired_flag: signal.expired_flag,
    market_session: signal.market_session,
    session_open_flag: signal.session_open_flag,
    mtf_confirmation: signal.mtf_confirmation,
    mtf_reason: signal.mtf_reason,
    market_regime: signal.market_regime,
    regime_alignment: signal.regime_alignment,
    sector: signal.sector,
    sector_strength: signal.sector_strength,
    entry_distance_pct: signal.entry_distance_pct,
    entry_distance_score: signal.entry_distance_score,
    participation_score: signal.participation_score,
    execution_plan: signal.execution_plan,
    execution_summary: signal.execution_summary,
    alert_reasons: signal.alert_reasons,
    webull_summary: signal.webull_summary || signal.ready_to_trade,
    price: signal.price,
    active_price: signal.active_price,
    active_price_label: signal.active_price_label,
    regular_market_price: signal.regular_market_price,
    premarket_price: signal.premarket_price,
    afterhours_price: signal.afterhours_price,
    extended_hours_price: signal.extended_hours_price,
    extended_hours_session: signal.extended_hours_session,
    change_pct: signal.change_pct
  };
}

async function sendAlertPayload(payload) {
  const results = [];
  const message = formatDeliveryMessage(payload);

  if (isTelegramEnabled()) {
    results.push(await sendTelegramAlert(message));
  }

  if (isDiscordEnabled()) {
    results.push(await sendDiscordAlert(message, payload));
  }

  if (ENABLE_DESKTOP_NOTIFICATIONS) {
    results.push({
      channel: "desktop",
      ok: false,
      skipped: true,
      error: "Desktop notifications are configured as a placeholder only in this Node server."
    });
  }

  if (ALERT_EMAIL_TO) {
    results.push({
      channel: "email",
      ok: false,
      skipped: true,
      to: ALERT_EMAIL_TO,
      error: "Email delivery is a placeholder. Configure Telegram or Discord for live alerts."
    });
  }

  if (!results.length) {
    results.push({
      channel: "none",
      ok: false,
      skipped: true,
      error: "No alert delivery channel is configured."
    });
  }

  return results;
}

async function sendTelegramAlert(message) {
  const endpoint = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true
      })
    });
    const data = await response.json().catch(() => ({}));

    return {
      channel: "telegram",
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : data?.description || data?.error || "Telegram request failed."
    };
  } catch (error) {
    return {
      channel: "telegram",
      ok: false,
      error: error.message || "Telegram request failed."
    };
  }
}

async function sendDiscordAlert(message, payload) {
  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        username: "Trading Signal Engine",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `${payload.ticker} ${payload.bias} signal`,
          description: payload.webull_summary,
          color: payload.bull_run_flag ? 3066993 : 3447003,
          fields: [
            { name: "Mode", value: String(payload.signal_mode || payload.mode), inline: true },
            { name: "Confidence", value: `${payload.confidence}/10`, inline: true },
            { name: "Priority", value: String(payload.priority_score), inline: true }
          ]
        }]
      })
    });

    return {
      channel: "discord",
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : await response.text().catch(() => "Discord request failed.")
    };
  } catch (error) {
    return {
      channel: "discord",
      ok: false,
      error: error.message || "Discord request failed."
    };
  }
}

function formatDeliveryMessage(alert) {
  return [
    `TRADE ALERT: ${alert.ticker}`,
    `Mode: ${alert.signal_mode || alert.mode} | Asset: ${alert.asset_class}`,
    `Bias: ${alert.bias} | Bull run: ${alert.bull_run_flag ? "yes" : "no"}`,
    `Entry: ${alert.entry}`,
    `Sell trigger: ${alert.sell_trigger}`,
    `Stop: ${alert.stop}`,
    `Targets: ${alert.target1} / ${alert.target2}`,
    `Confidence: ${alert.confidence}/10 | Priority: ${alert.priority_score} | Quality: ${alert.final_quality_score}`,
    `Regime: ${alert.market_regime || "unknown"} / ${alert.regime_alignment || "neutral"} | Sector: ${alert.sector || "other"} ${alert.sector_strength || ""}`,
    `Execution: ${alert.execution_summary || alert.execution_plan?.summary || "n/a"}`,
    `Reasons: ${(alert.alert_reasons || []).join(", ")}`,
    `Webull: ${alert.webull_summary}`
  ].join("\n");
}

async function sendTestAlert() {
  const payload = {
    ticker: "TEST",
    mode: "test",
    signal_mode: "test",
    asset_class: "test",
    bias: "test",
    bull_run_flag: false,
    entry: "No trade - delivery test only",
    sell_trigger: "No trade - delivery test only",
    stop: "No trade - delivery test only",
    target1: "No trade - delivery test only",
    target2: "No trade - delivery test only",
    confidence: 10,
    priority_score: 10,
    final_quality_score: 100,
    market_regime: state.marketRegime.regime || "test",
    regime_alignment: "test",
    sector: "test",
    sector_strength: "test",
    entry_distance_score: 100,
    participation_score: 100,
    alert_reasons: ["delivery test"],
    webull_summary: "TEST | delivery test only | do not trade"
  };

  const deliveryResults = await sendAlertPayload(payload);
  const sent = {
    ...payload,
    delivery_results: deliveryResults,
    sentAt: new Date().toISOString()
  };
  state.latestSentAlerts.unshift(sent);
  state.latestSentAlerts = state.latestSentAlerts.slice(0, 50);

  return {
    ok: deliveryResults.some((result) => result.ok) || deliveryResults.every((result) => result.skipped),
    delivery: getDeliveryStatus(),
    result: sent
  };
}

function getDeliveryStatus() {
  return {
    telegram_enabled: isTelegramEnabled(),
    discord_enabled: isDiscordEnabled(),
    email_placeholder_configured: Boolean(ALERT_EMAIL_TO),
    desktop_notifications_enabled: ENABLE_DESKTOP_NOTIFICATIONS,
    delivery_rules: {
      priority_score_min: 7,
      final_quality_score_min: FINAL_QUALITY_ALERT_MIN,
      confidence_min: 7,
      entry_must_be_close_to_current_price: true,
      signal_stale_after_ms: SIGNAL_STALE_MS,
      duplicate_suppression: true
    },
    sent_alert_count: state.latestSentAlerts.length
  };
}

function isTelegramEnabled() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

function isDiscordEnabled() {
  return Boolean(DISCORD_WEBHOOK_URL);
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonBlock(value) {
  const text = String(value || "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim() || JSON.stringify(data, null, 2);
}

async function loadEvents() {
  if (!existsSync(STORE_FILE)) return [];
  try {
    return JSON.parse(await readFile(STORE_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function loadJournal() {
  if (!existsSync(JOURNAL_FILE)) return [];
  try {
    const value = JSON.parse(await readFile(JOURNAL_FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function saveEvents() {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(state.events, null, 2));
}

async function saveJournal() {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(JOURNAL_FILE, JSON.stringify(state.journal, null, 2));
}

function sendJson(res, status, value, options = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(options.headOnly ? "" : JSON.stringify(value, null, 2));
}

function sendDashboardAuthChallenge(res) {
  res.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "WWW-Authenticate": 'Basic realm="Trading Dashboard"'
  });
  res.end(JSON.stringify({
    ok: false,
    error: "Authentication required."
  }, null, 2));
}

function sendHtml(res, html, options = {}) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0"
  });
  res.end(options.headOnly ? "" : html);
}

async function sendStaticFile(res, pathname, options = {}) {
  const relativePath = pathname.replace(/^\/public\//, "");
  if (!relativePath || relativePath.includes("..")) {
    return sendJson(res, 404, { ok: false, error: "Not found." });
  }

  const fileUrl = new URL(relativePath, PUBLIC_DIR);
  try {
    const body = await readFile(fileUrl);
    const contentType = getContentType(relativePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    });
    res.end(options.headOnly ? "" : body);
  } catch {
    sendJson(res, 404, { ok: false, error: "Not found." });
  }
}

function getContentType(pathname) {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function wantsHtml(req) {
  return String(req.headers.accept || "").includes("text/html");
}

function renderDashboard() {
  const rows = state.events
    .slice(0, 20)
    .map((event) => {
      const symbol = escapeHtml(event.payload?.symbol || event.payload?.ticker || "Unknown");
      const signal = escapeHtml(event.payload?.signal || event.payload?.action || event.payload?.message || "");
      const analysis = escapeHtml(event.analysis || event.error || "Waiting for analysis...");
      return `
        <article class="event">
          <header>
            <strong>${symbol}</strong>
            <span>${escapeHtml(event.status)}</span>
          </header>
          <p class="signal">${signal}</p>
          <pre>${analysis}</pre>
          <time>${escapeHtml(event.createdAt)}</time>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TradingView ChatGPT Bridge</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #15171a;
    }
    body {
      margin: 0;
      padding: 28px;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 17px;
      letter-spacing: 0;
    }
    .muted {
      margin: 0 0 22px;
      color: #606873;
    }
    .event {
      background: #ffffff;
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    header span {
      border: 1px solid #b9c0ca;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      color: #3f4650;
    }
    .signal {
      color: #3d4652;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
      margin: 12px 0;
    }
    time {
      color: #6c7480;
      font-size: 12px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        background: #111418;
        color: #f0f2f4;
      }
      .muted, .signal, time {
        color: #aab3bf;
      }
      .event {
        background: #191e24;
        border-color: #303844;
      }
      header span {
        color: #c7d0dc;
        border-color: #46505e;
      }
    }
  </style>
  <script>
    setTimeout(() => location.reload(), 6000);
  </script>
</head>
<body>
  <main>
    <h1>TradingView ChatGPT Bridge</h1>
    <p class="muted">Latest TradingView alerts and ChatGPT analyses. This page refreshes every 6 seconds.</p>
    ${rows || "<p>No alerts received yet.</p>"}
  </main>
</body>
</html>`;
}

function renderTradingPlatform() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trading Command Center</title>
  <link rel="stylesheet" href="/public/dashboard.css">
</head>
<body>
  <div id="app" class="app-shell">
    <aside class="sidebar">
      <div>
        <p class="eyebrow">Local Trading Engine</p>
        <h1>Trading Home</h1>
      </div>
      <nav class="nav-list" aria-label="Dashboard sections">
        <button data-view="dashboard" class="active">Home</button>
        <button data-view="buynow">Buy Now</button>
        <button data-view="movers">Movers</button>
        <button data-view="watchlist">Watchlist</button>
        <button data-view="browser">Market Browser</button>
        <button data-view="execution">Execution</button>
        <button data-view="intraday">Intraday</button>
        <button data-view="swing">Swing</button>
        <button data-view="futures">Futures</button>
        <button data-view="bitcoin">Bitcoin</button>
        <button data-view="crypto">Crypto</button>
        <button data-view="alerts">Alerts</button>
        <button data-view="lifecycle">Lifecycle</button>
        <button data-view="journal">Journal</button>
        <button data-view="news">News</button>
        <button data-view="ai">Signal Brain</button>
        <button data-view="settings">Settings</button>
      </nav>
      <div class="side-note">
        <strong>Beginner rule</strong>
        <span>Only consider green TAKE cards. Execute manually in Webull. Never chase price.</span>
      </div>
    </aside>
    <main>
      <header class="topbar">
        <div>
          <p class="eyebrow" id="view-eyebrow">Everything In One Place</p>
          <h2 id="view-title">Home</h2>
        </div>
        <form class="global-search" id="global-search" role="search">
          <input id="global-search-input" type="search" autocomplete="off" placeholder="Search company, ticker, or section: Tesla, TSLA, Bitcoin, SPX, news">
          <button type="submit">Search</button>
        </form>
        <div class="status-strip">
          <span id="system-health" class="health-badge neutral">Checking system</span>
          <span id="last-updated">Loading...</span>
          <button id="refresh-now" type="button">Refresh</button>
        </div>
      </header>
      <section id="message" class="message hidden"></section>
      <section id="content" class="content-grid" aria-live="polite"></section>
    </main>
  </div>
  <div id="chart-modal" class="chart-modal hidden" role="dialog" aria-modal="true" aria-label="Live ticker chart">
    <div class="chart-shell">
      <div class="chart-header">
        <div>
          <p class="eyebrow">Live Moving Chart</p>
          <h3 id="chart-title">Ticker Chart</h3>
        </div>
        <div class="chart-toolbar" id="chart-toolbar">
          <button type="button" data-chart-interval="5">5m</button>
          <button type="button" data-chart-interval="15" class="active">15m</button>
          <button type="button" data-chart-interval="60">1h</button>
          <button type="button" data-chart-interval="D">1D</button>
          <button id="chart-close" type="button">Close</button>
        </div>
      </div>
      <div id="chart-frame" class="chart-frame"></div>
      <p class="chart-note">Chart data is provided by TradingView. Use the signal plan first, then verify price action before opening Webull.</p>
    </div>
  </div>
  <script src="/public/dashboard.js" type="module"></script>
</body>
</html>`;
}

function renderScan(scan, news = null) {
  const autoScan = getAutoScanStatus();
  const delivery = getDeliveryStatus();
  const universe = getUniverseSummary();
  const journalStats = calculateJournalStats(state.journal);
  const lifecycleSummary = getLifecycleSummary();
  const openLifecycleRows = renderLifecycleRows(getLifecycle("open").lifecycle.slice(0, 8));
  const closedLifecycleRows = renderLifecycleRows(getLifecycle("closed").lifecycle.slice(0, 8));
  const expiredLifecycleRows = renderLifecycleRows([...state.lifecycle.values()].filter((item) => item.lifecycle_status === "expired").slice(0, 8));
  const displayMode = scan.mode === "all" ? null : scan.mode;
  const topAlerts = getLatestAlerts(displayMode).alerts.slice(0, 10);
  const signalByTicker = new Map((scan.signals || []).map((signal) => [signal.ticker, signal]));
  const latestSignals = getLatestSignals(displayMode).signals.slice(0, 20);
  const latestExecutionPlans = getExecutionPlans(displayMode).plans.slice(0, 12);
  const latestSentAlerts = state.latestSentAlerts.slice(0, 10);
  const modeCounts = Object.fromEntries(
    Object.keys(SCAN_MODES).map((mode) => [
      mode,
      {
        universe: SCAN_MODES[mode].universe.length,
        signals: getLatestSignals(mode).count,
        alerts: getLatestAlerts(mode).count
      }
    ])
  );
  const regime = state.marketRegime || {};
  const candidateRows = (scan.rankedCandidates || [])
    .map((candidate) => {
      const signal = signalByTicker.get(candidate.symbol) || {};
      return `
        <tr>
          <td>${escapeHtml(candidate.symbol)}</td>
          <td>${escapeHtml(signal.mode || scan.mode || "")}</td>
          <td>${escapeHtml(formatNumber(candidate.current))}</td>
          <td>${escapeHtml(formatNumber(candidate.changePercent))}%</td>
          <td>${escapeHtml(signal.bias || "pending")}</td>
          <td>${escapeHtml(signal.final_decision || "")}</td>
          <td>${escapeHtml(signal.bull_run_flag ? "yes" : "")}</td>
          <td>${escapeHtml(signal.entry || "")}</td>
          <td>${escapeHtml(signal.buy_trigger || "")}</td>
          <td>${escapeHtml(signal.sell_trigger || "")}</td>
          <td>${escapeHtml(signal.stop || "")}</td>
          <td>${escapeHtml(signal.target1 || "")}</td>
          <td>${escapeHtml(signal.target2 || "")}</td>
          <td>${escapeHtml(signal.confidence || "")}</td>
          <td>${escapeHtml(signal.setup_score || "")}</td>
          <td>${escapeHtml(signal.hold_window || "")}</td>
          <td>${escapeHtml(signal.priority_score || "")}</td>
          <td>${escapeHtml(signal.regime_alignment || "")}</td>
          <td>${escapeHtml(signal.sector_strength || "")}</td>
          <td>${escapeHtml(signal.entry_distance_score || "")}</td>
          <td>${escapeHtml(signal.final_quality_score || "")}</td>
          <td>${escapeHtml(signal.signal_age_seconds ?? "")}</td>
          <td>${escapeHtml(signal.expired_flag ? "yes" : "")}</td>
          <td>${escapeHtml(signal.market_session || "")}</td>
          <td>${escapeHtml(signal.mtf_confirmation || "")}</td>
          <td>${escapeHtml(signal.ready_to_trade || "")}</td>
          <td>${escapeHtml([...(signal.alert_reasons || []), signal.status, signal.bias_changed ? "bias changed" : "", signal.reason].filter(Boolean).join(" · "))}</td>
        </tr>
      `;
    })
    .join("");
  const alertRows = topAlerts
    .map((alert) => `
      <tr class="alert-row">
        <td>${escapeHtml(alert.ticker)}</td>
        <td>${escapeHtml(alert.mode || "")}</td>
        <td>${escapeHtml(alert.bias)}</td>
        <td>${escapeHtml(alert.final_decision || "")}</td>
        <td>${escapeHtml(alert.bull_run_flag ? "yes" : "")}</td>
        <td>${escapeHtml(alert.buy_trigger || alert.entry)}</td>
        <td>${escapeHtml(alert.sell_trigger || alert.stop)}</td>
        <td>${escapeHtml(alert.entry)}</td>
        <td>${escapeHtml(alert.stop)}</td>
        <td>${escapeHtml(alert.target1)}</td>
        <td>${escapeHtml(alert.target2)}</td>
        <td>${escapeHtml(alert.confidence)}</td>
        <td>${escapeHtml(alert.setup_score || "")}</td>
        <td>${escapeHtml(alert.priority_score)}</td>
        <td>${escapeHtml(alert.regime_alignment || "")}</td>
        <td>${escapeHtml(alert.sector_strength || "")}</td>
        <td>${escapeHtml(alert.entry_distance_score || "")}</td>
        <td>${escapeHtml(alert.final_quality_score || "")}</td>
        <td>${escapeHtml(alert.signal_age_seconds ?? "")}</td>
        <td>${escapeHtml(alert.expired_flag ? "yes" : "")}</td>
        <td>${escapeHtml(alert.market_session || "")}</td>
        <td>${escapeHtml(alert.mtf_confirmation || "")}</td>
        <td>${escapeHtml(alert.alert_reasons.join(", "))}</td>
        <td>${escapeHtml(alert.webull_summary)}</td>
      </tr>
    `)
    .join("");
  const latestSignalRows = latestSignals
    .map((signal) => `
      <tr>
        <td>${escapeHtml(signal.ticker)}</td>
        <td>${escapeHtml(signal.mode || "")}</td>
        <td>${escapeHtml(formatNumber(signal.price))}</td>
        <td>${escapeHtml(formatNumber(signal.change_pct))}%</td>
        <td>${escapeHtml(signal.bias)}</td>
        <td>${escapeHtml(signal.final_decision || "")}</td>
        <td>${escapeHtml(signal.bull_run_flag ? "yes" : "")}</td>
        <td>${escapeHtml(signal.entry)}</td>
        <td>${escapeHtml(signal.buy_trigger || "")}</td>
        <td>${escapeHtml(signal.sell_trigger || "")}</td>
        <td>${escapeHtml(signal.stop)}</td>
        <td>${escapeHtml(signal.target1)}</td>
        <td>${escapeHtml(signal.target2)}</td>
        <td>${escapeHtml(signal.confidence)}</td>
        <td>${escapeHtml(signal.setup_score || "")}</td>
        <td>${escapeHtml(signal.hold_window || "")}</td>
        <td>${escapeHtml(signal.priority_score || "")}</td>
        <td>${escapeHtml(signal.regime_alignment || "")}</td>
        <td>${escapeHtml(signal.sector_strength || "")}</td>
        <td>${escapeHtml(signal.entry_distance_score || "")}</td>
        <td>${escapeHtml(signal.final_quality_score || "")}</td>
        <td>${escapeHtml(signal.signal_age_seconds ?? "")}</td>
        <td>${escapeHtml(signal.expired_flag ? "yes" : "")}</td>
        <td>${escapeHtml(signal.market_session || "")}</td>
        <td>${escapeHtml(signal.mtf_confirmation || "")}</td>
        <td>${escapeHtml(signal.ready_to_trade || "")}</td>
      </tr>
    `)
    .join("");
  const sentAlertRows = latestSentAlerts
    .map((alert) => `
      <tr class="alert-row">
        <td>${escapeHtml(alert.sentAt || "")}</td>
        <td>${escapeHtml(alert.ticker)}</td>
        <td>${escapeHtml(alert.signal_mode || alert.mode || "")}</td>
        <td>${escapeHtml(alert.bias)}</td>
        <td>${escapeHtml(alert.confidence)}</td>
        <td>${escapeHtml(alert.priority_score)}</td>
        <td>${escapeHtml(alert.final_quality_score || "")}</td>
        <td>${escapeHtml((alert.delivery_results || []).map((result) => `${result.channel}:${result.ok ? "sent" : "skipped"}`).join(", "))}</td>
        <td>${escapeHtml(alert.webull_summary)}</td>
      </tr>
    `)
    .join("");
  const executionRows = latestExecutionPlans
    .map((plan) => `
      <tr class="${plan.action === "skip" ? "" : "alert-row"}">
        <td>${escapeHtml(plan.ticker)}</td>
        <td>${escapeHtml(plan.mode || "")}</td>
        <td>${escapeHtml(plan.bias || "")}</td>
        <td>${escapeHtml(plan.final_decision || plan.action)}</td>
        <td>${escapeHtml(plan.action)}</td>
        <td>${escapeHtml(plan.suggested_shares)}</td>
        <td>${escapeHtml(plan.entry ?? "")}</td>
        <td>${escapeHtml(plan.stop ?? "")}</td>
        <td>${escapeHtml(plan.estimated_risk_dollars)}</td>
        <td>${escapeHtml(plan.estimated_position_dollars)}</td>
        <td>${escapeHtml(plan.reward_risk_target1 ?? "")}</td>
        <td>${escapeHtml(plan.final_quality_score)}</td>
        <td>${escapeHtml(plan.skip_reasons.join(", "))}</td>
        <td>${escapeHtml(plan.summary)}</td>
      </tr>
    `)
    .join("");
  const journalModeRows = renderJournalGroupRows(journalStats.by_mode);
  const journalBiasRows = renderJournalGroupRows(journalStats.by_bias);
  const journalRegimeRows = renderJournalGroupRows(journalStats.by_regime);
  const newsRows = (news?.articles || [])
    .slice(0, 16)
    .map((article) => `
      <article class="news-item">
        <div>
          <strong>${escapeHtml(article.symbol || "")}</strong>
          <span>${escapeHtml(article.source || "news")}</span>
          <time>${escapeHtml(article.publishedAt || "")}</time>
        </div>
        <a href="${escapeHtml(article.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(article.headline || "Untitled headline")}</a>
        <p>${escapeHtml(article.summary || "")}</p>
      </article>
    `)
    .join("");
  const autoScanStatus = autoScan.auto_scan_enabled ? "ON" : "OFF";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Market Scanner</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #15171a;
    }
    body {
      margin: 0;
      padding: 28px;
    }
    main {
      max-width: 1360px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .muted {
      margin: 0 0 22px;
      color: #606873;
    }
    .panel {
      background: #ffffff;
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid #e3e7ed;
      padding: 8px;
      vertical-align: top;
    }
    th {
      white-space: nowrap;
    }
    td {
      min-width: 80px;
    }
    td:nth-child(5),
    td:nth-child(6),
    td:nth-child(7),
    td:nth-child(8),
    td:nth-child(10),
    td:nth-child(11) {
      min-width: 150px;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
      margin: 0;
    }
    .error {
      color: #a33b2f;
      font-weight: 650;
    }
    .alert-row {
      background: #fff7d6;
    }
    .alert-row td:first-child {
      font-weight: 750;
    }
    .news-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .journal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .news-item {
      border: 1px solid #e3e7ed;
      border-radius: 8px;
      padding: 12px;
    }
    .news-item div {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: #606873;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .news-item a {
      color: inherit;
      font-weight: 700;
      text-decoration: none;
    }
    .news-item p {
      margin: 8px 0 0;
      color: #3d4652;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 16px;
    }
    button, .link-button {
      appearance: none;
      border: 1px solid #b9c0ca;
      background: #ffffff;
      color: #15171a;
      border-radius: 6px;
      padding: 7px 10px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        background: #111418;
        color: #f0f2f4;
      }
      .muted {
        color: #aab3bf;
      }
      .panel {
        background: #191e24;
        border-color: #303844;
      }
      th, td {
        border-color: #303844;
      }
      .error {
        color: #ff9a8b;
      }
      .alert-row {
        background: #2b2415;
      }
      .news-item {
        border-color: #303844;
      }
      .news-item div, .news-item p {
        color: #aab3bf;
      }
      button, .link-button {
        background: #191e24;
        border-color: #46505e;
        color: #f0f2f4;
      }
    }
  </style>
  <script>
    setTimeout(() => location.reload(), 60000);
  </script>
</head>
<body>
  <main>
    <h1>Market Scanner</h1>
    <p class="muted">
      Scan time: ${escapeHtml(scan.createdAt)} ·
      Mode: ${escapeHtml(scan.modeLabel || scan.mode || "intraday")} ·
      Batch: ${escapeHtml(scan.batchNumber || 1)} / ${escapeHtml(scan.batchTotal || 1)} ·
      Universe: ${escapeHtml(scan.universeSize ?? scan.symbols.length)} ·
      Scanned: ${escapeHtml(scan.scannedCount ?? scan.symbols.length)} ·
      Market state: ${escapeHtml(scan.marketCount ?? 0)} ·
      Top list: ${escapeHtml(scan.topCount ?? 0)} ·
      Cache: ${escapeHtml(scan.cache?.hit ? `hit, ${scan.cache.ageSeconds}s old` : "fresh")}
    </p>
    <p class="muted">
      Market regime: ${escapeHtml(regime.regime || "unknown")} ·
      SPY: ${escapeHtml(regime.spy_change_pct ?? "n/a")}% ·
      QQQ: ${escapeHtml(regime.qqq_change_pct ?? "n/a")}% ·
      Score: ${escapeHtml(regime.score ?? 0)} ·
      Updated: ${escapeHtml(regime.updatedAt || "not calculated")}
    </p>
    <p class="muted">
      Auto-scan: ${escapeHtml(autoScanStatus)} ·
      Last run: ${escapeHtml(autoScan.auto_scan_last_run_at || "never")} ·
      Next run: ${escapeHtml(autoScan.auto_scan_next_run_at || "paused")} ·
      Run count: ${escapeHtml(autoScan.auto_scan_run_count)} ·
      Current batch: ${escapeHtml(autoScan.current_batch_number)} / ${escapeHtml(autoScan.batch_total)}
    </p>
    <p class="muted">
      Delivery: Telegram ${escapeHtml(delivery.telegram_enabled ? "ON" : "OFF")} ·
      Discord ${escapeHtml(delivery.discord_enabled ? "ON" : "OFF")} ·
      Sent alerts: ${escapeHtml(delivery.sent_alert_count)} ·
      Rules: quality >= ${escapeHtml(delivery.delivery_rules.final_quality_score_min)}, confidence >= ${escapeHtml(delivery.delivery_rules.confidence_min)}, entry near price
    </p>
    <p class="muted">
      Counts:
      Intraday ${escapeHtml(modeCounts.intraday.signals)} signals / ${escapeHtml(modeCounts.intraday.alerts)} alerts / ${escapeHtml(modeCounts.intraday.universe)} symbols ·
      Swing ${escapeHtml(modeCounts.swing.signals)} / ${escapeHtml(modeCounts.swing.alerts)} / ${escapeHtml(modeCounts.swing.universe)} ·
      Futures ${escapeHtml(modeCounts.futures.signals)} / ${escapeHtml(modeCounts.futures.alerts)} / ${escapeHtml(modeCounts.futures.universe)} ·
      All universe ${escapeHtml(universe.modes.all.count)}
    </p>
    <p class="muted">
      <a class="link-button" href="/scan?mode=intraday">Intraday</a>
      <a class="link-button" href="/scan?mode=swing">Swing</a>
      <a class="link-button" href="/scan?mode=futures">Futures</a>
      <a class="link-button" href="/scan?mode=bitcoin">Bitcoin</a>
      <a class="link-button" href="/scan?mode=crypto">Crypto</a>
      <a class="link-button" href="/scan?mode=all">All</a>
      <a class="link-button" href="/scan?mode=${escapeHtml(scan.mode || "intraday")}&refresh=1">Run fresh scan</a>
      <a class="link-button" href="/scan.json?mode=${escapeHtml(scan.mode || "intraday")}">JSON</a>
      <a class="link-button" href="/scan/latest.json">Latest cached JSON</a>
      <a class="link-button" href="/universe.json">Universe</a>
      <a class="link-button" href="/regime.json">Regime</a>
      <a class="link-button" href="/alerts/sent.json">Sent Alerts</a>
      <a class="link-button" href="/auto-scan/status.json">Auto status</a>
    </p>
    <div class="actions">
      <form method="post" action="/auto-scan/run-now"><button type="submit">Run Now</button></form>
      <form method="post" action="/auto-scan/start"><button type="submit">Start Auto-Scan</button></form>
      <form method="post" action="/auto-scan/stop"><button type="submit">Stop Auto-Scan</button></form>
      <form method="post" action="/alerts/test"><button type="submit">Test Delivery</button></form>
    </div>
    ${scan.error ? `<section class="panel"><p class="error">${escapeHtml(scan.error)}</p></section>` : ""}
    <section class="panel">
      <h2>Lifecycle Summary</h2>
      <p class="muted">
        Total: ${escapeHtml(lifecycleSummary.total)} ·
        Open: ${escapeHtml(lifecycleSummary.open)} ·
        Closed: ${escapeHtml(lifecycleSummary.closed)} ·
        Status: ${escapeHtml(Object.entries(lifecycleSummary.by_status).map(([key, value]) => `${key} ${value}`).join(", ") || "none")}
      </p>
      <p class="muted">
        <a class="link-button" href="/lifecycle/latest.json">Lifecycle</a>
        <a class="link-button" href="/lifecycle/open.json">Open</a>
        <a class="link-button" href="/lifecycle/closed.json">Closed</a>
      </p>
      <div class="journal-grid">
        <table>
          <thead><tr><th>Open Trades</th><th>Status</th><th>Price</th><th>PnL %</th><th>Updated</th></tr></thead>
          <tbody>${openLifecycleRows || `<tr><td colspan="5">No open lifecycle records.</td></tr>`}</tbody>
        </table>
        <table>
          <thead><tr><th>Closed Trades</th><th>Status</th><th>Price</th><th>PnL %</th><th>Updated</th></tr></thead>
          <tbody>${closedLifecycleRows || `<tr><td colspan="5">No closed lifecycle records.</td></tr>`}</tbody>
        </table>
        <table>
          <thead><tr><th>Recently Expired</th><th>Status</th><th>Price</th><th>PnL %</th><th>Updated</th></tr></thead>
          <tbody>${expiredLifecycleRows || `<tr><td colspan="5">No expired lifecycle records.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h2>Journal Performance</h2>
      <p class="muted">
        Total: ${escapeHtml(journalStats.total_trades)} ·
        Closed: ${escapeHtml(journalStats.closed_trades)} ·
        Wins: ${escapeHtml(journalStats.wins)} ·
        Losses: ${escapeHtml(journalStats.losses)} ·
        Breakeven: ${escapeHtml(journalStats.breakeven)} ·
        Win rate: ${escapeHtml(journalStats.win_rate)}% ·
        Avg PnL: ${escapeHtml(journalStats.avg_pnl_pct)}%
      </p>
      <p class="muted">
        <a class="link-button" href="/journal.json">Journal</a>
        <a class="link-button" href="/journal/stats.json">Journal Stats</a>
      </p>
      <div class="journal-grid">
        <table>
          <thead><tr><th>Mode</th><th>Total</th><th>Win %</th><th>Avg PnL</th></tr></thead>
          <tbody>${journalModeRows || `<tr><td colspan="4">No mode data yet.</td></tr>`}</tbody>
        </table>
        <table>
          <thead><tr><th>Bias</th><th>Total</th><th>Win %</th><th>Avg PnL</th></tr></thead>
          <tbody>${journalBiasRows || `<tr><td colspan="4">No bias data yet.</td></tr>`}</tbody>
        </table>
        <table>
          <thead><tr><th>Regime</th><th>Total</th><th>Win %</th><th>Avg PnL</th></tr></thead>
          <tbody>${journalRegimeRows || `<tr><td colspan="4">No regime data yet.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h2>Execution Plans</h2>
      <p class="muted">
        Account: $${escapeHtml(getExecutionSettings().account_size)} ·
        Risk: ${escapeHtml(getExecutionSettings().risk_pct)}% ·
        Max risk: $${escapeHtml(getExecutionSettings().max_risk_dollars)} ·
        Max position: $${escapeHtml(getExecutionSettings().max_position_dollars)}
        <a class="link-button" href="/execution/plan.json">Execution JSON</a>
        <a class="link-button" href="/execution/settings.json">Settings</a>
      </p>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Mode</th>
            <th>Bias</th>
            <th>Decision</th>
            <th>Action</th>
            <th>Shares</th>
            <th>Entry</th>
            <th>Stop</th>
            <th>Risk $</th>
            <th>Position $</th>
            <th>RR1</th>
            <th>Quality</th>
            <th>Skip Reasons</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          ${executionRows || `<tr><td colspan="13">No execution plans yet.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Live Stock News</h2>
      <p class="muted">
        Symbols: ${escapeHtml((news?.symbols || []).join(", "))} ·
        Cache: ${escapeHtml(news?.cache?.hit ? `hit, ${news.cache.ageSeconds}s old` : "fresh")}
        ${news?.error ? ` · ${escapeHtml(news.error)}` : ""}
      </p>
      <div class="news-grid">
        ${newsRows || "<p>No news loaded yet.</p>"}
      </div>
    </section>
    <section class="panel">
      <h2>Latest Sent Alerts</h2>
      <table>
        <thead>
          <tr>
            <th>Sent</th>
            <th>Ticker</th>
            <th>Mode</th>
            <th>Bias</th>
            <th>Confidence</th>
            <th>Priority</th>
            <th>Quality</th>
            <th>Delivery</th>
            <th>Webull Summary</th>
          </tr>
        </thead>
        <tbody>
          ${sentAlertRows || `<tr><td colspan="9">No delivered alerts yet.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Top Alerts</h2>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Mode</th>
            <th>Bias</th>
            <th>Decision</th>
            <th>Bull Run</th>
            <th>Buy Trigger</th>
            <th>Sell Trigger</th>
            <th>Entry</th>
            <th>Stop</th>
            <th>Target 1</th>
            <th>Target 2</th>
            <th>Confidence</th>
            <th>Setup</th>
            <th>Priority</th>
            <th>Regime</th>
            <th>Sector</th>
            <th>Entry Dist</th>
            <th>Quality</th>
            <th>Age</th>
            <th>Expired</th>
            <th>Session</th>
            <th>MTF</th>
            <th>Alert Reasons</th>
            <th>Webull Summary</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows || `<tr><td colspan="24">No priority alerts yet.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Current Top Candidates</h2>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Mode</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Bias</th>
            <th>Decision</th>
            <th>Bull Run</th>
            <th>Entry</th>
            <th>Buy Trigger</th>
            <th>Sell Trigger</th>
            <th>Stop</th>
            <th>Target 1</th>
            <th>Target 2</th>
            <th>Confidence</th>
            <th>Setup</th>
            <th>Hold</th>
            <th>Priority</th>
            <th>Regime</th>
            <th>Sector</th>
            <th>Entry Dist</th>
            <th>Quality</th>
            <th>Age</th>
            <th>Expired</th>
            <th>Session</th>
            <th>MTF</th>
            <th>Ready To Trade</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${candidateRows || `<tr><td colspan="27">No candidates passed the scanner filters.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Latest AI Signals</h2>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Mode</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Bias</th>
            <th>Decision</th>
            <th>Bull Run</th>
            <th>Entry</th>
            <th>Buy Trigger</th>
            <th>Sell Trigger</th>
            <th>Stop</th>
            <th>Target 1</th>
            <th>Target 2</th>
            <th>Confidence</th>
            <th>Setup</th>
            <th>Hold</th>
            <th>Priority</th>
            <th>Regime</th>
            <th>Sector</th>
            <th>Entry Dist</th>
            <th>Quality</th>
            <th>Age</th>
            <th>Expired</th>
            <th>Session</th>
            <th>MTF</th>
            <th>Ready To Trade</th>
          </tr>
        </thead>
        <tbody>
          ${latestSignalRows || `<tr><td colspan="26">No AI signals yet.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <pre>${escapeHtml(JSON.stringify({ rankedCandidates: scan.rankedCandidates || [], signals: scan.signals || [] }, null, 2))}</pre>
    </section>
  </main>
</body>
</html>`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toFixed(Math.abs(number) >= 100 ? 2 : 4);
}

function renderJournalGroupRows(group) {
  return Object.entries(group || {})
    .sort(([, a], [, b]) => Number(b.total_trades || 0) - Number(a.total_trades || 0))
    .slice(0, 8)
    .map(([name, stats]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(stats.total_trades)}</td>
        <td>${escapeHtml(stats.win_rate)}%</td>
        <td>${escapeHtml(stats.avg_pnl_pct)}%</td>
      </tr>
    `)
    .join("");
}

function renderLifecycleRows(records) {
  return records
    .map((record) => `
      <tr>
        <td>${escapeHtml(record.ticker)} ${escapeHtml(record.mode || "")}</td>
        <td>${escapeHtml(record.lifecycle_status)}</td>
        <td>${escapeHtml(formatNumber(record.current_price))}</td>
        <td>${escapeHtml(record.pnl_pct ?? "")}</td>
        <td>${escapeHtml(record.lifecycle_updated_at || "")}</td>
      </tr>
    `)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
