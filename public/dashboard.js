const state = {
  view: "dashboard",
  mode: "intraday",
  browserSymbol: "SPY",
  selectedHomeTicker: "",
  sessionId: getOrCreateSessionId(),
  powerOn: localStorage.getItem("dashboard_power") !== "off",
  heartbeatTimer: null,
  inactivityTimer: null,
  idle: false,
  signals: {
    search: "",
    onlyTake: false,
    minConfidence: false,
    minQuality: false,
    hideExpired: true,
    sort: "quality"
  },
  cachedSignals: [],
  chat: {
    messages: []
  },
  chart: {
    ticker: "",
    mode: "",
    interval: "15"
  },
  ui: {
    pendingChartTicker: "",
    pendingChartMode: "",
    bootRefreshTimer: null,
    bootRefreshAttempts: 0,
    emptyAutoScanAt: {},
    isMobile: window.matchMedia("(max-width: 767px)").matches,
    mobileNavOpen: false
  },
  timer: null
};

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
const BOOT_REFRESH_INTERVAL_MS = 2500;
const BOOT_REFRESH_MAX_ATTEMPTS = 12;

const views = {
  dashboard: { title: "Home", eyebrow: "Everything In One Place" },
  buynow: { title: "Buy Now", eyebrow: "Strongest Actionable Setups" },
  movers: { title: "Moving Now", eyebrow: "What Is Moving Right Now?" },
  watchlist: { title: "Watchlist", eyebrow: "Good Setups, Not Ready Yet" },
  browser: { title: "Market Browser", eyebrow: "Research Any Ticker" },
  ai: { title: "Signal Brain", eyebrow: "ChatGPT Status" },
  overview: { title: "Trading Dashboard", eyebrow: "Overview" },
  intraday: { title: "Intraday Signals", eyebrow: "Signals" },
  swing: { title: "Swing Signals", eyebrow: "Signals" },
  futures: { title: "Futures-Style Signals", eyebrow: "Signals" },
  bitcoin: { title: "Bitcoin-Linked Signals", eyebrow: "Signals" },
  crypto: { title: "Live Crypto Signals", eyebrow: "Crypto Buy/Sell" },
  news: { title: "News", eyebrow: "Live Market Context" },
  alerts: { title: "Alerts", eyebrow: "Delivery" },
  execution: { title: "What Can I Trade Right Now?", eyebrow: "Execution" },
  lifecycle: { title: "Lifecycle", eyebrow: "Signal Outcomes" },
  journal: { title: "Journal", eyebrow: "Performance" },
  settings: { title: "Settings", eyebrow: "Configuration" }
};

const SEARCH_TICKER_ALIASES = {
  tesla: "TSLA",
  tsla: "TSLA",
  nvidia: "NVDA",
  nvda: "NVDA",
  apple: "AAPL",
  aapl: "AAPL",
  microsoft: "MSFT",
  msft: "MSFT",
  amazon: "AMZN",
  amzn: "AMZN",
  google: "GOOGL",
  alphabet: "GOOGL",
  googl: "GOOGL",
  meta: "META",
  facebook: "META",
  "meta platforms": "META",
  palantir: "PLTR",
  pltr: "PLTR",
  microstrategy: "MSTR",
  strategy: "MSTR",
  mstr: "MSTR",
  coinbase: "COIN",
  coin: "COIN",
  "iris energy": "IREN",
  iren: "IREN",
  marathon: "MARA",
  mara: "MARA",
  riot: "RIOT",
  "riot platforms": "RIOT",
  cleanspark: "CLSK",
  clsk: "CLSK",
  bitcoin: "BTCUSD",
  btc: "BTCUSD",
  btcusd: "BTCUSD",
  ethereum: "ETHUSD",
  eth: "ETHUSD",
  ethusd: "ETHUSD",
  doge: "DOGEUSD",
  dogecoin: "DOGEUSD",
  dogeusd: "DOGEUSD",
  shiba: "SHIBUSD",
  shib: "SHIBUSD",
  "shiba inu": "SHIBUSD",
  shibusd: "SHIBUSD",
  solana: "SOLUSD",
  sol: "SOLUSD",
  xrp: "XRPUSD",
  ripple: "XRPUSD",
  cardano: "ADAUSD",
  ada: "ADAUSD",
  chainlink: "LINKUSD",
  link: "LINKUSD",
  polygon: "MATICUSD",
  matic: "MATICUSD",
  litecoin: "LTCUSD",
  ltc: "LTCUSD",
  spx: "SPX",
  "s&p 500": "SPX",
  "s and p 500": "SPX",
  sp500: "SPX",
  spy: "SPY",
  qqq: "QQQ"
};

const content = document.querySelector("#content");
const message = document.querySelector("#message");
const lastUpdated = document.querySelector("#last-updated");
const systemHealth = document.querySelector("#system-health");
const mobileHealth = document.querySelector("#mobile-health");
const viewTitle = document.querySelector("#view-title");
const viewEyebrow = document.querySelector("#view-eyebrow");
const chartModal = document.querySelector("#chart-modal");
const chartFrame = document.querySelector("#chart-frame");
const chartTitle = document.querySelector("#chart-title");
const chartClose = document.querySelector("#chart-close");
const chartToolbar = document.querySelector("#chart-toolbar");
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const mobileRefreshButton = document.querySelector("#mobile-refresh-now");
const mobileNavBackdrop = document.querySelector("#mobile-nav-backdrop");
const mobileMedia = window.matchMedia("(max-width: 767px)");

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    void navigateToView(button.dataset.view);
  });
});

document.querySelector("#refresh-now").addEventListener("click", loadView);
mobileRefreshButton?.addEventListener("click", loadView);
document.querySelector("#global-search")?.addEventListener("submit", handleGlobalSearch);
mobileMenuToggle?.addEventListener("click", toggleMobileNav);
mobileNavBackdrop?.addEventListener("click", closeMobileNav);
chartClose?.addEventListener("click", closeChart);
chartToolbar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-interval]");
  if (!button || !state.chart.ticker) return;
  state.chart.interval = button.dataset.chartInterval || "15";
  chartToolbar.querySelectorAll("[data-chart-interval]").forEach((item) => item.classList.toggle("active", item === button));
  void openChart(state.chart.ticker, state.chart.mode, { preserveOpen: true });
});
chartModal?.addEventListener("click", (event) => {
  if (event.target === chartModal) closeChart();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeChart();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startDashboardSession();
    resetInactivityTimer();
  } else {
    sendDashboardHeartbeat();
  }
});
["click", "keydown", "scroll", "pointerdown"].forEach((eventName) => {
  document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});
window.addEventListener("pagehide", () => { void stopDashboardSession({ preferBeacon: true }); });
window.addEventListener("beforeunload", () => { void stopDashboardSession({ preferBeacon: true }); });
mobileMedia.addEventListener("change", syncViewportLayout);
syncViewportLayout();
resetInactivityTimer();
void initializeDashboard();
state.timer = setInterval(loadView, 45000);

async function initializeDashboard() {
  if (state.powerOn) {
    await startDashboardSession();
  }
  await loadView();
  scheduleBootRefresh();
}

function syncViewportLayout() {
  state.ui.isMobile = mobileMedia.matches;
  document.body.classList.toggle("mobile-layout", state.ui.isMobile);
  if (!state.ui.isMobile) closeMobileNav();
}

function toggleMobileNav() {
  state.ui.mobileNavOpen ? closeMobileNav() : openMobileNav();
}

function openMobileNav() {
  state.ui.mobileNavOpen = true;
  document.body.classList.add("mobile-nav-open");
  mobileMenuToggle?.setAttribute("aria-expanded", "true");
  mobileNavBackdrop?.classList.remove("hidden");
}

function closeMobileNav() {
  state.ui.mobileNavOpen = false;
  document.body.classList.remove("mobile-nav-open");
  mobileMenuToggle?.setAttribute("aria-expanded", "false");
  mobileNavBackdrop?.classList.add("hidden");
}

async function loadView() {
  if (!state.powerOn) {
    renderOfflineState();
    lastUpdated.textContent = "System offline";
    updateSystemHealthBadge({ label: "Offline", tone: "bad", detail: "scanner paused" });
    hideMessage();
    return;
  }

  const meta = views[state.view] || views.overview;
  viewTitle.textContent = meta.title;
  viewEyebrow.textContent = meta.eyebrow;
  showMessage("Loading latest dashboard data...");

  try {
    if (state.view === "dashboard") await renderDashboardHome();
    else if (state.view === "buynow") await renderBuyNow();
    else if (state.view === "movers") await renderMovers();
    else if (state.view === "watchlist") await renderWatchlist();
    else if (state.view === "browser") await renderBrowser();
    else if (state.view === "ai") await renderAiBrain();
    else if (state.view === "overview") await renderOverview();
    else if (["intraday", "swing", "futures", "bitcoin", "crypto"].includes(state.view)) await renderSignals(state.view);
    else if (state.view === "news") await renderNews();
    else if (state.view === "alerts") await renderAlerts();
    else if (state.view === "execution") await renderExecution();
    else if (state.view === "lifecycle") await renderLifecycle();
    else if (state.view === "journal") await renderJournal();
    else if (state.view === "settings") await renderSettings();
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    hideMessage();
    if (state.ui.pendingChartTicker && state.view === "browser") {
      const ticker = state.ui.pendingChartTicker;
      const mode = state.ui.pendingChartMode;
      state.ui.pendingChartTicker = "";
      state.ui.pendingChartMode = "";
      await openChart(ticker, mode);
    }
  } catch (error) {
    updateSystemHealthBadge({ label: "Error", tone: "bad", detail: "load failed" });
    showMessage(error.message || "Dashboard failed to load.", true);
  }
}

function getOrCreateSessionId() {
  const existing = sessionStorage.getItem("dashboard_session_id");
  if (existing) return existing;
  const generated = globalThis.crypto?.randomUUID?.() || `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem("dashboard_session_id", generated);
  return generated;
}

async function startDashboardSession() {
  if (!state.powerOn) return;
  try {
    await fetch("/api/dashboard/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSessionPayload()),
      keepalive: true
    });
    if (!state.heartbeatTimer) {
      state.heartbeatTimer = setInterval(sendDashboardHeartbeat, 25_000);
    }
  } catch (error) {
    console.warn("Dashboard session start failed:", error);
  }
}

async function sendDashboardHeartbeat() {
  if (!state.powerOn) return;
  try {
    await fetch("/api/dashboard/session/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSessionPayload()),
      keepalive: true
    });
  } catch (error) {
    console.warn("Dashboard heartbeat failed:", error);
  }
}

async function stopDashboardSession(options = {}) {
  clearBootRefreshTimer();
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  const payload = JSON.stringify(getSessionPayload());
  if (options.preferBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/dashboard/session/stop", new Blob([payload], { type: "application/json" }));
    return;
  }
  try {
    await fetch("/api/dashboard/session/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    });
  } catch {
    // ignore shutdown errors
  }
}

function resetInactivityTimer() {
  if (!state.powerOn) return;
  state.idle = false;
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => {
    state.idle = true;
    setPower(false, "idle");
  }, INACTIVITY_LIMIT_MS);
}

async function setPower(enabled, reason = "manual") {
  state.powerOn = Boolean(enabled);
  state.idle = reason === "idle";
  localStorage.setItem("dashboard_power", state.powerOn ? "on" : "off");
  clearBootRefreshTimer();

  if (state.powerOn) {
    renderBootingState();
    lastUpdated.textContent = "System starting";
    await startDashboardSession();
    resetInactivityTimer();
    if (state.view === "dashboard") await runFreshScan("swing");
    else await loadView();
    scheduleBootRefresh();
    return;
  }

  clearTimeout(state.inactivityTimer);
  closeChart();
  await stopDashboardSession();
  await loadView();
}

function scheduleBootRefresh() {
  clearBootRefreshTimer();
  if (!state.powerOn) return;
  state.ui.bootRefreshAttempts = 0;
  state.ui.bootRefreshTimer = setTimeout(() => {
    void refreshAfterBoot();
  }, BOOT_REFRESH_INTERVAL_MS);
}

function clearBootRefreshTimer() {
  if (state.ui.bootRefreshTimer) {
    clearTimeout(state.ui.bootRefreshTimer);
    state.ui.bootRefreshTimer = null;
  }
  state.ui.bootRefreshAttempts = 0;
}

async function refreshAfterBoot() {
  if (!state.powerOn) {
    clearBootRefreshTimer();
    return;
  }

  state.ui.bootRefreshAttempts += 1;

  try {
    const overview = await getJson("/api/dashboard/overview", { silent: true });
    const totalSignals = Number(overview?.counts?.total_signals || 0);
    const lastScanAt = overview?.auto_scan?.auto_scan_last_run_at || overview?.ai_brain?.last_scan || null;
    const scanRunning = Boolean(overview?.auto_scan?.auto_scan_running);

    if (totalSignals > 0 || lastScanAt || !scanRunning) {
      clearBootRefreshTimer();
      await loadView();
      return;
    }

    if (state.ui.bootRefreshAttempts < BOOT_REFRESH_MAX_ATTEMPTS) {
      showMessage("Live scan is warming up. Pulling in the first results...");
      state.ui.bootRefreshTimer = setTimeout(() => {
        void refreshAfterBoot();
      }, BOOT_REFRESH_INTERVAL_MS);
      return;
    }
  } catch (error) {
    console.warn("Boot refresh failed:", error);
  }

  clearBootRefreshTimer();
}

function renderBootingState() {
  const meta = views[state.view] || views.dashboard;
  viewTitle.textContent = meta.title;
  viewEyebrow.textContent = "System Starting";
  content.innerHTML = `
    <section class="offline-shell">
      <div class="offline-card">
        <p class="eyebrow">Starting Up</p>
        <h3>The trading system is coming online.</h3>
        <p>Live scan, chart context, and ChatGPT signal analysis are starting now. This usually takes a few seconds.</p>
        <div class="offline-points">
          <div><strong>Scanner</strong><span>starting</span></div>
          <div><strong>ChatGPT</strong><span>connecting</span></div>
          <div><strong>Auto-scan</strong><span>resuming</span></div>
          <div><strong>Status</strong><span>online soon</span></div>
        </div>
        <button class="power-switch on" id="power-toggle" type="button" aria-pressed="true">
          <span></span>Power Off
        </button>
      </div>
    </section>
  `;
  document.querySelector("#power-toggle")?.addEventListener("click", () => setPower(false));
}

function renderOfflineState() {
  const meta = views[state.view] || views.dashboard;
  viewTitle.textContent = meta.title;
  viewEyebrow.textContent = "System Offline";
  content.innerHTML = `
    <section class="offline-shell">
      <div class="offline-card">
        <p class="eyebrow">Offline Mode</p>
        <h3>System is offline.</h3>
        <p>No scanning or AI analysis is running right now. Power the system on when you want live data, fresh signals, and chart decisions again.</p>
        <div class="offline-points">
          <div><strong>Scanner</strong><span>off</span></div>
          <div><strong>ChatGPT</strong><span>idle</span></div>
          <div><strong>Auto-scan</strong><span>stopped</span></div>
          <div><strong>API usage</strong><span>saved</span></div>
        </div>
        <button class="power-switch off" id="power-toggle" type="button" aria-pressed="false">
          <span></span>Power On
        </button>
      </div>
    </section>
  `;
  document.querySelector("#power-toggle")?.addEventListener("click", () => setPower(true));
}

function getSessionPayload() {
  return {
    session_id: state.sessionId,
    user_agent: navigator.userAgent
  };
}

function handleGlobalSearch(event) {
  event.preventDefault();
  const input = document.querySelector("#global-search-input");
  const raw = String(input?.value || "").trim();
  if (!raw) {
    showMessage("Type a ticker, company name, or section first.", true);
    return;
  }
  const value = raw.toLowerCase();
  const sectionAliases = {
    home: "dashboard",
    trade: "dashboard",
    trades: "dashboard",
    buy: "buynow",
    "buy now": "buynow",
    sell: "dashboard",
    signal: "dashboard",
    signals: "dashboard",
    movers: "movers",
    moving: "movers",
    watch: "watchlist",
    watchlist: "watchlist",
    search: "browser",
    browser: "browser",
    chart: "browser",
    charts: "browser",
    chat: "ai",
    chatgpt: "ai",
    ai: "ai",
    news: "news",
    posts: "news",
    alert: "alerts",
    alerts: "alerts",
    execute: "execution",
    execution: "execution",
    journal: "journal",
    settings: "settings",
    intraday: "intraday",
    swing: "swing",
    futures: "futures",
    bitcoin: "bitcoin",
    btc: "bitcoin",
    crypto: "crypto"
  };
  const matchedView = sectionAliases[value];
  if (matchedView) {
    setActiveView(matchedView);
    state.selectedHomeTicker = "";
    showMessage(`Opened ${views[matchedView]?.title || "that section"}.`);
  } else {
    const aliasMatch = SEARCH_TICKER_ALIASES[value];
    const resolved = normalizeDisplayTicker(aliasMatch || raw.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 12));
    if (!resolved) {
      showMessage("I could not understand that search yet. Try a ticker like TSLA or a company name like Tesla.", true);
      return;
    }
    state.browserSymbol = resolved;
    state.selectedHomeTicker = resolved;
    setActiveView("browser");
    state.ui.pendingChartTicker = resolved;
    state.ui.pendingChartMode = inferModeFromTicker(resolved);
    showMessage(`Opened Market Browser for ${resolved}.`);
  }
  if (input) input.value = raw;
  void loadView();
}

async function renderDashboardHome() {
  const [overview, execution, alerts, news, latestSignals, lifecycle, journal] = await Promise.all([
    getJson("/api/dashboard/overview"),
    getJson("/api/dashboard/execution"),
    getJson("/api/dashboard/alerts"),
    getJson("/api/dashboard/news"),
    getJson("/api/dashboard/signals?hideExpired=1&sort=quality"),
    getJson("/api/dashboard/lifecycle"),
    getJson("/api/dashboard/journal")
  ]);
  const plans = execution.plans || [];
  const regime = overview.market_regime || {};
  const auto = overview.auto_scan || {};
  const ai = overview.ai_brain || {};
  const session = overview.dashboard_session || {};
  const counts = overview.counts || {};
  const signalRows = dedupeSignalsByTicker(latestSignals.signals || []);
  const rankedPlans = dedupePlansByTicker(execution.plans || []);
  const intertradePlans = (execution.intertrade_plans || []).slice(0, 5);
  const workflow = getHomeWorkflowGroups(signalRows, rankedPlans);
  const standardReadyNow = workflow.readyNow.filter((plan) => plan.buy_now_type !== "intertrade_take");
  const intradaySignals = signalRows.filter((signal) => (signal.signal_mode || signal.mode || "") === "intraday");
  const intradayWorkflow = getSignalsModeGroups("intraday", intradaySignals);
  state.cachedSignals = dedupeSignals(latestSignals.signals || []);
  if (!state.selectedHomeTicker) {
    state.selectedHomeTicker = workflow.readyNow[0]?.ticker || workflow.movingNow[0]?.ticker || workflow.watchlist[0]?.ticker || "";
  }
  updateSystemHealthBadge({
    label: workflow.readyNow.length ? `${workflow.readyNow.length} ready now` : workflow.watchlist.length ? "Wait for setup" : "No clean trade",
    tone: workflow.readyNow.length ? "good" : workflow.watchlist.length ? "neutral" : "bad",
    detail: regime.regime || "market mixed"
  });

  content.innerHTML = `
    ${renderCommandStatusBar({ overview, alerts, executionCount: rankedPlans.length })}
    <section class="trader-hero">
      <div>
        <p class="eyebrow">Trader Command Center</p>
        <h3>Should I trade something right now?</h3>
        <p>${workflow.readyNow.length
          ? "Yes. These are the best entries right now. Confirm the chart, then copy the Webull plan."
          : workflow.watchlist.length
            ? "Wait. Nothing is clean enough yet, but there are good setups worth watching."
            : "No. There is no clean setup right now. Stay patient and wait for the next scan."}</p>
      </div>
      <form class="home-search" id="home-search">
        <input id="home-search-input" type="search" placeholder="Search ticker or company name: NVDA, KRE, BTCUSD, S&P 500">
        <button class="action-btn primary-action" type="submit">Search</button>
      </form>
      <div class="quick-links">
        ${quickSearch("NVDA")} ${quickSearch("KRE")} ${quickSearch("UNG")} ${quickSearch("XLF")} ${quickSearch("BTC")} ${quickSearch("SPX")}
      </div>
    </section>
    ${state.ui.isMobile
      ? `
        ${panel("System Status", renderMobileStatusStack({ overview, alerts, executionCount: rankedPlans.length }))}
        ${panel("Buy Now", standardReadyNow.length
          ? renderTradeSection(standardReadyNow.slice(0, 3), { source: "plan", sectionKind: "ready" })
          : renderTradeNowEmptyState(workflow.watchlist, signalRows))}
        ${panel("Fast Live Breakout Candidates", renderIntertradeSection(intertradePlans, signalRows))}
        ${panel("Intraday Right Now", renderHomeIntradayPanel(intradayWorkflow, intradaySignals))}
        ${panel("Movers", `
          <div class="section-note">Movers are not automatic buys.</div>
          ${renderActionCardGrid(workflow.movingNow.slice(0, 4), "movers")}
        `)}
        ${panel("Watchlist", renderActionCardGrid(workflow.watchlist.slice(0, 4), "watch"))}
        ${renderAdvancedDetails("More Tools", `
          <div class="mobile-quick-actions">
            <button class="action-btn" type="button" data-view-jump="browser">Open Market Browser</button>
            <button class="action-btn" type="button" data-view-jump="execution">Open Execution</button>
            <button class="action-btn" type="button" data-view-jump="alerts">Open Alerts</button>
            <button class="action-btn" type="button" data-view-jump="journal">Open Journal</button>
          </div>
          ${panel("Ignore For Now", renderActionCardGrid(workflow.avoid.slice(0, 6), "skip", true))}
          ${panel("ChatGPT Decision Desk", renderTradingAssistantChat("What can I trade right now on mobile?"))}
        `)}
      `
      : `
        <section class="grid cols-2 dashboard-zones">
          ${panel("What Can I Trade Right Now?", standardReadyNow.length
            ? renderTradeSection(standardReadyNow.slice(0, 5), { source: "plan", sectionKind: "ready" })
            : `${renderTradeNowEmptyState(workflow.watchlist, signalRows)}${workflow.watchlist.length ? `<div class="section-subgrid">${workflow.watchlist.slice(0, 3).map((signal) => renderActionCard(signal, "watch")).join("")}</div>` : ""}`)}
          ${panel("What Is Moving Up Right Now?", `
            <div class="section-note">Movers are not automatic buys. Use them to find charts worth checking.</div>
            ${renderActionCardGrid(workflow.movingNow.slice(0, 6), "movers")}
          `)}
        </section>
        <section class="grid cols-2 dashboard-zones">
          ${panel("Fast Live Breakout Candidates", renderIntertradeSection(intertradePlans, signalRows))}
          ${panel("Intraday Trade Board", renderHomeIntradayPanel(intradayWorkflow, intradaySignals))}
        </section>
        ${panel("Good Ideas, But Not Buys Yet", renderActionCardGrid(workflow.watchlist.slice(0, 6), "watch"))}
        ${panel("ChatGPT Decision Desk", `
          <div class="brain-summary">
            <div class="brain-chip ${ai.connected ? "good" : "bad"}">AI Brain ${ai.connected ? "Online" : "Offline"}</div>
            <div class="brain-chip ${regime.regime === "bullish" ? "good" : regime.regime === "bearish" ? "bad" : "neutral"}">Regime ${escapeHtml(regime.regime || "unknown")}</div>
            <div class="brain-chip neutral">${session.active_dashboard_sessions || 0} live session${session.active_dashboard_sessions === 1 ? "" : "s"}</div>
          </div>
          ${renderTradingAssistantChat("What can I trade right now, what is moving, and what should I avoid?")}
        `)}
        ${panel("Ignore For Now", renderActionCardGrid(workflow.avoid.slice(0, 8), "skip", true))}
        ${renderAdvancedDetails("Advanced Details", renderSignalTable(signalRows.slice(0, 12), { compact: true }))}
      `}
  `;
  maybeAutoRunEmptySectionScan("intraday", intradaySignals);
  document.querySelector("#power-toggle")?.addEventListener("click", () => setPower(!state.powerOn));
  document.querySelector("#run-fresh-scan")?.addEventListener("click", (event) => {
    void runFreshScan("all", { triggerButton: event.currentTarget });
  });
  document.querySelector("#home-search")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.querySelector("#home-search-input")?.value || "";
    const globalInput = document.querySelector("#global-search-input");
    if (globalInput) globalInput.value = value;
    handleGlobalSearch(event);
  });
  bindTradingAssistant();
}

function renderHomeIntradayPanel(groups = {}, intradaySignals = []) {
  const readyNow = groups.readyNow || [];
  const movingNow = groups.movingNow || [];
  const watchOnly = groups.watchOnly || [];
  if (readyNow.length) {
    return `
      <div class="section-note">These are the best same-day setups on the board right now.</div>
      ${renderActionCardGrid(readyNow.slice(0, 4), "watch")}
    `;
  }
  if (movingNow.length || watchOnly.length) {
    const candidates = dedupeSignalsByTicker([...(movingNow || []), ...(watchOnly || [])]).slice(0, 4);
    return `
      <div class="section-note">Nothing is clean enough to chase yet. These are the best intraday names to monitor on the main screen.</div>
      ${renderActionCardGrid(candidates, "watch")}
    `;
  }
  return renderMeaningfulEmptyState("signals", "intraday", { signals: intradaySignals });
}

function renderIntertradeSection(plans = [], fallbackSignals = []) {
  if (plans.length) {
    return `
      <div class="section-note">Top live breakout-continuation names only. Confirm the chart before acting.</div>
      ${renderTradeSection(plans.slice(0, 5), { source: "plan", sectionKind: "ready" })}
    `;
  }
  const fallback = (fallbackSignals || [])
    .filter((signal) => signal.signal_type === "intertrade_take")
    .slice(0, 5);
  if (fallback.length) {
    return `
      <div class="section-note">Momentum is visible, but these are not clean enough to buy yet.</div>
      ${renderActionCardGrid(fallback, "watch")}
    `;
  }
  return noTradeState("No clean live breakout candidate right now.");
}

async function renderBuyNow() {
  const [execution, overview] = await Promise.all([
    getJson("/api/dashboard/execution"),
    getJson("/api/dashboard/overview")
  ]);
  const plans = dedupePlansByTicker(execution.plans || []);
  const intertradePlans = (execution.intertrade_plans || []).slice(0, 5);
  const signalData = await getJson("/api/dashboard/signals?hideExpired=1&sort=quality");
  const signalRows = dedupeSignalsByTicker(signalData.signals || []);
  state.cachedSignals = dedupeSignals(signalData.signals || []);
  const groups = getExecutionGroups(plans, signalRows);
  const standardReadyNow = groups.readyNow.filter((plan) => plan.buy_now_type !== "intertrade_take");
  content.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">Buy Now</p>
        <h3>What can I trade right now?</h3>
        <p>Green does not mean blindly buy. It means this is the best candidate right now. Confirm the chart first.</p>
      </div>
      <div class="rule-box">
        <strong>Trader workflow</strong>
        <span>Start with Ready Now, then check Wait for Pullback, then scan Strong Momentum without treating every mover like a buy.</span>
      </div>
    </section>
    ${panel("Fast Live Breakout Candidates", renderIntertradeSection(intertradePlans, signalRows))}
    ${panel("Ready Now", standardReadyNow.length
      ? renderTradeSection(standardReadyNow.slice(0, 5), { source: "plan", sectionKind: "ready" })
      : renderTradeNowEmptyState(groups.watchOnly, signalRows))}
    ${panel("Wait For Pullback", renderTradeSection(groups.waitForPullback.slice(0, 5), { source: "plan", sectionKind: "pullback" }))}
    ${panel("Strong Momentum", renderActionCardGrid(groups.strongMomentum.slice(0, 10), "movers"))}
    ${panel("Not Ready", renderActionCardGrid(groups.watchOnly.slice(0, 10), "watch"))}
    ${panel("Skip", renderActionCardGrid(groups.skip.slice(0, 10), "skip", true))}
    ${renderAdvancedDetails("Advanced Details", renderSignalTable(signalRows.slice(0, 12), { compact: true }))}
  `;
  updateSystemHealthBadge({
    label: standardReadyNow.length || intertradePlans.length ? `${standardReadyNow.length + intertradePlans.length} ready now` : "No trade now",
    tone: standardReadyNow.length || intertradePlans.length ? "good" : "neutral",
    detail: "buy now"
  });
}

async function renderMovers() {
  const data = await getJson("/api/dashboard/signals?hideExpired=1&sort=quality");
  const signals = dedupeSignalsByTicker(data.signals || []);
  state.cachedSignals = dedupeSignals(data.signals || []);
  const groups = getMoverGroups(signals);

  content.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">Moving Now</p>
        <h3>Discovery first, execution second.</h3>
        <p>These names are moving right now, but not every mover is a buy. Use this page to decide what deserves a chart check.</p>
      </div>
      <div class="rule-box">
        <strong>Important</strong>
        <span>Movers are not automatic buys. If a name is extended, wait for the pullback instead of chasing it.</span>
      </div>
    </section>
    ${panel("Uptrend Now", renderActionCardGrid(groups.uptrendNow.slice(0, 10), "movers"))}
    <section class="grid cols-2">
      ${panel("Near Breakout", renderActionCardGrid(groups.nearBreakout.slice(0, 8), "watch"))}
      ${panel("Pullback Watch", renderActionCardGrid(groups.pullbackWatch.slice(0, 8), "watch"))}
    </section>
    ${panel("Downtrend / Avoid", renderActionCardGrid(groups.downtrendAvoid.slice(0, 8), "skip", true))}
    ${renderAdvancedDetails("Advanced Details", renderSignalTable(signals.slice(0, 12), { compact: true }))}
  `;
  updateSystemHealthBadge({
    label: `${groups.uptrendNow.length} moving up`,
    tone: groups.uptrendNow.length ? "good" : "neutral",
    detail: "movers"
  });
}

async function renderWatchlist() {
  const data = await getJson("/api/dashboard/signals?hideExpired=1&sort=quality");
  const allSignals = dedupeSignalsByTicker(data.signals || []);
  let watchSignals = dedupeSignalsByTicker(allSignals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isReadyNow && !timing.isSkip;
  }));
  if (!watchSignals.length) {
    watchSignals = dedupeSignalsByTicker(allSignals.filter((signal) => signal.final_decision !== "take" && isMovingUpCandidate(signal))).slice(0, 8);
  }
  state.cachedSignals = dedupeSignals(data.signals || []);
  content.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">Watchlist</p>
        <h3>Good ideas, but not buys yet.</h3>
        <p>This is where you wait for price to come to you. A bullish chart can still be a bad trade if the timing is wrong.</p>
      </div>
      <div class="rule-box">
        <strong>Use this page to wait</strong>
        <span>Buy only if price pulls back near entry or confirms the breakout. If it breaks down instead, skip it.</span>
      </div>
    </section>
    ${watchSignals.length
      ? renderActionCardGrid(watchSignals, "watch")
      : renderMeaningfulEmptyState("watchlist", "", { signals: data.signals || [] })}
    ${renderAdvancedDetails("Advanced Details", renderSignalTable(watchSignals.slice(0, 12), { compact: true }))}
  `;
  updateSystemHealthBadge({
    label: `${watchSignals.length} watch`,
    tone: watchSignals.length ? "neutral" : "bad",
    detail: "watchlist"
  });
}

async function renderOverview() {
  const data = await getJson("/api/dashboard/overview");
  const counts = data.counts || {};
  const byDecision = counts.by_decision || {};
  const byMode = counts.by_mode || {};
  const auto = data.auto_scan || {};
  const regime = data.market_regime || {};

  content.innerHTML = `
    <section class="grid cols-4">
      ${metric("Regime", regime.regime || "unknown", `SPY ${fmt(regime.spy_change_pct)}% · QQQ ${fmt(regime.qqq_change_pct)}%`)}
      ${metric("Auto Scan", auto.auto_scan_enabled ? "ON" : "OFF", `Next ${auto.auto_scan_next_run_at || "paused"}`)}
      ${metric("TAKE", byDecision.take || 0, "actionable candidates")}
      ${metric("Signals", counts.total_signals || 0, `Alerts ${counts.alerts || 0} · Sent ${counts.sent_alerts || 0}`)}
    </section>
    <section class="grid cols-2">
      ${panel("Top TAKE Signals", renderSignalTable(data.top_take_signals || [], { compact: true }))}
      ${panel("Latest Sent Alerts", renderSentAlerts(data.latest_sent_alerts || []))}
    </section>
    <section class="panel">
      <div class="panel-header"><h3>Mode Counts</h3></div>
      ${renderModeCounts(byMode)}
    </section>
    <section class="grid cols-2">
      ${panel("Lifecycle Summary", renderObjectTable(data.lifecycle_summary?.by_status || {}))}
      ${panel("Journal Snapshot", renderJournalSummary(data.journal_stats || {}))}
    </section>
  `;
  updateSystemHealthBadge({
    label: byDecision.take ? `${byDecision.take} take` : "Watching market",
    tone: byDecision.take ? "good" : "neutral",
    detail: regime.regime || "unknown"
  });
}

async function renderBrowser() {
  const symbol = encodeURIComponent(state.browserSymbol || "SPY");
  const data = await getJson(`/api/dashboard/ticker?symbol=${symbol}`);
  const quote = data.quote || {};
  const signal = data.signal || {};
  const plan = data.execution_plan || signal.execution_plan || null;
  const decisionTarget = plan || signal;
  const timing = getTimingProfile(decisionTarget);

  content.innerHTML = `
    <section class="beginner-hero">
      <div>
        <p class="eyebrow">Market Browser</p>
        <h3>Search a ticker, open the chart, and get a plain decision.</h3>
        <p>If there is no signal yet, you still get the chart, news, and a clear message that this is research only.</p>
      </div>
      <form class="ticker-search" id="ticker-search">
        <label for="ticker-input">Ticker</label>
        <div>
          <input id="ticker-input" value="${escapeAttr(data.ticker || state.browserSymbol)}" placeholder="AAPL, TSLA, IREN, SPY">
          <button class="action-btn" type="submit">Search</button>
        </div>
      </form>
    </section>
    <section class="grid cols-4">
      ${metric("Ticker", data.ticker, data.source_status?.quote || "")}
      ${metric("Active Price", fmt(quote.active_price ?? quote.current), `${escapeHtml(quote.active_price_label || "regular")} · ${fmt(quote.changePercent)}% today`)}
      ${metric("Pre / After", `${fmt(quote.premarket_price) || "n/a"} / ${fmt(quote.afterhours_price) || "n/a"}`, quote.extended_hours_note || "shown when active")}
      ${metric("High / Low", `${fmt(quote.high)} / ${fmt(quote.low)}`, "today")}
      ${metric("System Decision", signal.final_decision || "none", timing.label || "no current signal")}
    </section>
    <section class="grid cols-2">
      ${panel(`${escapeHtml(data.ticker)} Chart`, `
        <div class="panel-header-actions">${buttonChart("Open full chart", data.ticker, signal.signal_mode || signal.mode || "")}</div>
        ${renderInlineChart(data.ticker)}
      `)}
      ${panel("Decision Box", renderBrowserDecisionBox(data, timing))}
    </section>
    ${panel(`${escapeHtml(data.ticker)} News`, renderNewsCards(data.news || []))}
    ${panel(`${escapeHtml(data.ticker)} Posts & Ideas`, renderSocialLinks(data.social_posts || []))}
    ${renderAdvancedDetails("Advanced Details", signal.ticker ? renderSignalTable([signal], { compact: true }) : noSignalForTicker(data.ticker))}
  `;
  updateSystemHealthBadge({
    label: data.ticker || "Browser",
    tone: timing.tone,
    detail: timing.actionLabel || signal.final_decision || "research"
  });

  document.querySelector("#ticker-search")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.querySelector("#ticker-input")?.value || "SPY";
    const normalized = normalizeDisplayTicker(value);
    if (!normalized) {
      showMessage("Type a valid ticker like SPY, TSLA, or BTCUSD first.", true);
      return;
    }
    state.browserSymbol = normalized;
    state.selectedHomeTicker = normalized;
    state.ui.pendingChartTicker = normalized;
    state.ui.pendingChartMode = inferModeFromTicker(normalized);
    showMessage(`Loaded Market Browser for ${normalized}.`);
    void loadView();
  });
}

async function renderAiBrain() {
  const data = await getJson("/api/ai/status");
  content.innerHTML = `
    <section class="beginner-hero">
      <div>
        <p class="eyebrow">Behind The Scenes</p>
        <h3>ChatGPT is the analysis brain. You are still the trader.</h3>
        <p>The scanner finds candidates, ChatGPT turns them into trade plans, then the system scores them into TAKE, WATCH, or SKIP. Webull execution stays manual.</p>
      </div>
      <div class="rule-box ${data.connected ? "brain-online" : "brain-offline"}">
        <strong>${data.connected ? "AI brain online" : "AI brain offline"}</strong>
        <span>${data.connected ? `Using ${data.model}` : "Add OPENAI_API_KEY to .env and restart the server."}</span>
      </div>
    </section>
    <section class="grid cols-4">
      ${metric("Connection", data.connected ? "ONLINE" : "OFFLINE", data.provider || "OpenAI")}
      ${metric("Model", data.model || "not set", data.key_preview || "")}
      ${metric("Latest Signals", data.latest_signal_count || 0, data.latest_signal_at || "none yet")}
      ${metric("Auto Scan", data.auto_scan?.auto_scan_enabled ? "ON" : "OFF", data.auto_scan?.auto_scan_running ? "running now" : "waiting")}
    </section>
    <section class="grid cols-2">
      ${panel("What ChatGPT Controls", `
        <div class="ai-flow">
          <div><strong>1. Scanner filter</strong><span>Finnhub quote data narrows the market first.</span></div>
          <div><strong>2. ChatGPT analysis</strong><span>OpenAI receives only top candidates and returns strict signal JSON.</span></div>
          <div><strong>3. Decision engine</strong><span>The backend scores risk, quality, expiry, regime, and creates TAKE/WATCH/SKIP.</span></div>
          <div><strong>4. You execute</strong><span>The website shows the plan; you place trades manually in Webull.</span></div>
        </div>
      `)}
      ${panel("AI Safety Boundaries", `
        <div class="ai-flow">
          <div><strong>No broker control</strong><span>ChatGPT cannot place trades.</span></div>
          <div><strong>No hidden orders</strong><span>Everything actionable appears as a visible Webull summary.</span></div>
          <div><strong>No key shown</strong><span>The API key is loaded server-side and masked in the UI.</span></div>
          <div><strong>Manual final check</strong><span>You still verify price, chart, news, and risk before trading.</span></div>
        </div>
      `)}
    </section>
    ${panel("Trading ChatGPT Box", renderTradingAssistantChat("Look at my dashboard. What should I focus on right now?"))}
    <section class="panel">
      <div class="panel-header">
        <h3>Connection Test</h3>
        <button class="action-btn" id="test-ai-brain" type="button">Test ChatGPT</button>
      </div>
      <div id="ai-test-result" class="message hidden"></div>
      ${renderKeyValues({
        ai_brain_enabled: data.ai_brain_enabled,
        manual_execution_only: data.manual_execution_only,
        webull_execution: data.webull_execution,
        latest_signal_at: data.latest_signal_at,
        last_scan_error: data.last_scan_error || "none"
      })}
    </section>
  `;

  document.querySelector("#test-ai-brain")?.addEventListener("click", testAiBrain);
  bindTradingAssistant();
  updateSystemHealthBadge({
    label: data.connected ? "AI live" : "AI offline",
    tone: data.connected ? "good" : "bad",
    detail: data.model || "OpenAI"
  });
}

async function renderSignals(mode) {
  const query = new URLSearchParams({ mode, sort: state.signals.sort });
  if (state.signals.search) query.set("search", state.signals.search);
  if (state.signals.onlyTake) query.set("take", "1");
  if (state.signals.minConfidence) query.set("minConfidence", "7");
  if (state.signals.minQuality) query.set("minQuality", "70");
  if (state.signals.hideExpired) query.set("hideExpired", "1");
  const data = await getJson(`/api/dashboard/signals?${query}`);
  const signals = dedupeSignalsByTicker(data.signals || []);
  state.cachedSignals = dedupeSignals(data.signals || []);
  const sectionEmptyState = renderMeaningfulEmptyState("signals", mode, { signals });
  const signalGroups = getSignalsModeGroups(mode, signals);
  const modeTitle = mode === "intraday" ? "Intraday trade board in plain English." : `${capitalize(mode)} signals in plain English.`;
  const modeDescription = mode === "intraday"
    ? "Start with what is closest to an entry right now, then check movers and watches instead of reading a flat scanner list."
    : "Start with the cards first. The detailed table is still here if you want the extra fields.";

  content.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">${capitalize(mode)}</p>
        <h3>${modeTitle}</h3>
        <p>${modeDescription}</p>
      </div>
      <div class="rule-box">
        <strong>How to read this</strong>
        <span>Green means actionable, yellow means watch, muted red means ignore for now.</span>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <h3>${capitalize(mode)} Board</h3>
        <span class="small">${data.count} signals</span>
      </div>
      ${renderSignalToolbar(mode)}
      ${signals.length
        ? renderSignalsModeLayout(mode, signalGroups)
        : sectionEmptyState}
    </section>
    ${renderAdvancedDetails("Advanced Details", signals.length ? renderSignalTable(signals) : sectionEmptyState)}
  `;
  maybeAutoRunEmptySectionScan(mode, signals);
  bindSignalToolbar();
  updateSystemHealthBadge({
    label: `${capitalize(mode)} ${data.count}`,
    tone: data.count ? "good" : "neutral",
    detail: "signals"
  });
}

function getSignalsModeGroups(mode, signals = []) {
  if (mode === "intraday") {
    const used = new Set();
    const readyNow = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => getTimingProfile(signal).isReadyNow)), used);
    markUsedTickers(used, readyNow);
    const movingNow = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
      const timing = getTimingProfile(signal);
      return !timing.isSkip && isMovingUpCandidate(signal);
    })), used);
    markUsedTickers(used, movingNow);
    const watchOnly = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
      const timing = getTimingProfile(signal);
      return !timing.isReadyNow && !timing.isSkip;
    })), used);
    markUsedTickers(used, watchOnly);
    const skip = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => getTimingProfile(signal).isSkip)), used);
    return {
      readyNow,
      movingNow,
      watchOnly,
      skip
    };
  }

  const used = new Set();
  const primary = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isSkip;
  })), used);
  markUsedTickers(used, primary);
  const skip = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => getTimingProfile(signal).isSkip)), used);
  return {
    primary,
    skip
  };
}

function renderSignalsModeLayout(mode, groups = {}) {
  if (mode === "intraday") {
    return `
      ${panel("Ready Right Now", groups.readyNow?.length
        ? renderActionCardGrid(groups.readyNow.slice(0, 5), "watch")
        : renderTradeNowEmptyState(groups.watchOnly || [], [...(groups.movingNow || []), ...(groups.watchOnly || [])]))}
      ${panel("Moving Now", `
        <div class="section-note">These are the best intraday movers to inspect right now. They are not all instant buys.</div>
        ${renderActionCardGrid((groups.movingNow || []).slice(0, 8), "movers")}
      `)}
      ${panel("Watch For Entry", renderActionCardGrid((groups.watchOnly || []).slice(0, 8), "watch"))}
      ${panel("Avoid For Now", renderActionCardGrid((groups.skip || []).slice(0, 8), "skip", true))}
    `;
  }

  return `
    ${renderActionCardGrid((groups.primary || []).slice(0, 12), mode === "bitcoin" ? "movers" : "watch")}
    ${groups.skip?.length ? panel("Avoid For Now", renderActionCardGrid(groups.skip.slice(0, 8), "skip", true)) : ""}
  `;
}

async function renderAlerts() {
  const data = await getJson("/api/dashboard/alerts");
  const delivery = data.delivery || {};
  const noAlerts = !(data.actionable_alerts || []).length && !(data.current_alerts || []).length;
  content.innerHTML = `
    <section class="grid cols-3">
      ${metric("Telegram", delivery.telegram_enabled ? "ON" : "OFF", "delivery")}
      ${metric("Discord", delivery.discord_enabled ? "ON" : "OFF", "delivery")}
      ${metric("Actionable", (data.actionable_alerts || []).length, "TAKE alerts")}
    </section>
    <section class="panel">
      <div class="panel-header"><h3>Actionable Alerts</h3><button class="action-btn" id="test-alert">Send Test Alert</button></div>
      ${noAlerts ? renderMeaningfulEmptyState("alerts", "", { alerts: data }) : renderAlertsTable(data.actionable_alerts || [])}
    </section>
    ${panel("All Current Alerts", noAlerts ? renderMeaningfulEmptyState("alerts", "", { alerts: data }) : renderAlertsTable(data.current_alerts || []))}
    ${panel("Sent Alerts", renderSentAlerts(data.sent_alerts || []))}
  `;
  document.querySelector("#test-alert")?.addEventListener("click", sendTestAlert);
  updateSystemHealthBadge({
    label: `${(data.actionable_alerts || []).length} alerts`,
    tone: (data.actionable_alerts || []).length ? "good" : "neutral",
    detail: "delivery"
  });
}

async function renderNews() {
  const data = await getJson("/api/dashboard/news");
  const hasHeadlines = (data.company_news || []).length || (data.market_news || []).length;
  content.innerHTML = `
    <section class="beginner-hero">
      <div>
        <p class="eyebrow">News Check</p>
        <h3>Use this before taking a trade.</h3>
        <p>Look for major headlines, sector news, crypto news, earnings, downgrades, or breaking posts around the tickers your system is flagging.</p>
      </div>
      <div class="rule-box">
        <strong>Beginner rule</strong>
        <span>If news contradicts the trade plan or price is moving on unclear headlines, skip the trade.</span>
      </div>
    </section>
    <section class="grid cols-3">
      ${metric("Focus Tickers", (data.focus_tickers || []).length, (data.focus_tickers || []).join(", "))}
      ${metric("Company News", (data.company_news || []).length, data.source_status?.finnhub_company_news || "")}
      ${metric("Market News", (data.market_news || []).length, data.source_status?.finnhub_market_news || "")}
    </section>
    ${panel("Important Stock Headlines", hasHeadlines ? renderNewsCards(data.company_news || []) : renderMeaningfulEmptyState("news", "", { news: data }))}
    ${panel("Market Headlines", hasHeadlines ? renderNewsCards(data.market_news || []) : renderMeaningfulEmptyState("news", "", { news: data }))}
    ${panel("Live Posts & Social Streams", renderSocialLinks(data.social_posts || []))}
  `;
}

async function renderExecution() {
  const data = await getJson("/api/dashboard/execution");
  const signalData = await getJson("/api/dashboard/signals?hideExpired=1&sort=quality");
  const plans = dedupePlansByTicker(data.plans || []);
  const signals = dedupeSignalsByTicker(signalData.signals || []);
  const groups = getExecutionGroups(plans, signals);
  state.cachedSignals = dedupeSignals(signalData.signals || []);
  content.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">Execution</p>
        <h3>What can I trade right now?</h3>
        <p>This page tells you exactly what to do: buy now, wait for the pullback, keep it on watch, or skip it.</p>
      </div>
      <div class="rule-box">
        <strong>Do not chase</strong>
        <span>A TAKE card can still be late. Use the timing label before you do anything.</span>
      </div>
    </section>
    <section class="grid cols-4">
      ${metric("Ready Now", groups.readyNow.length || 0, "max 5 shown first")}
      ${metric("Risk / Trade", `${fmt(data.settings?.risk_pct)}%`, `$${fmt(data.settings?.max_risk_dollars)}`)}
      ${metric("Max Position", `$${fmt(data.settings?.max_position_dollars)}`, "cap")}
      ${metric("Account", `$${fmt(data.settings?.account_size)}`, "configured")}
    </section>
    ${panel("Ready Now", groups.readyNow.length
      ? renderTradeSection(groups.readyNow.slice(0, 5), { source: "plan", sectionKind: "ready" })
      : renderMeaningfulEmptyState("execution", "", { plans, signals }))}
    ${panel("Wait For Pullback", renderTradeSection(groups.waitForPullback.slice(0, 5), { source: "plan", sectionKind: "pullback" }))}
    ${panel("Watch Only", renderTradeSection(groups.watchOnly.slice(0, 8), { source: "plan", sectionKind: "watch" }))}
    ${panel("Skip", renderTradeSection(groups.skip.slice(0, 8), { source: "plan", sectionKind: "skip", collapsed: true }))}
    ${renderAdvancedDetails("Advanced Details", renderSignalTable(signals.slice(0, 12), { compact: true }))}
  `;
  updateSystemHealthBadge({
    label: groups.readyNow.length ? `${groups.readyNow.length} ready now` : "No trade now",
    tone: groups.readyNow.length ? "good" : "neutral",
    detail: "execution"
  });
}

async function renderLifecycle() {
  const data = await getJson("/api/dashboard/lifecycle");
  content.innerHTML = `
    <section class="grid cols-3">
      ${metric("Open", data.summary?.open || 0, "active lifecycle")}
      ${metric("Closed", data.summary?.closed || 0, "completed")}
      ${metric("Total", data.summary?.total || 0, "tracked")}
    </section>
    ${panel("Open Trades", renderLifecycleTable(data.open || []))}
    ${panel("Closed Trades", renderLifecycleTable(data.closed || []))}
    ${panel("Recently Expired", renderLifecycleTable(data.expired || []))}
    ${panel("Skipped", renderLifecycleTable(data.skipped || []))}
  `;
  updateSystemHealthBadge({
    label: `${data.summary?.open || 0} open`,
    tone: (data.summary?.open || 0) ? "good" : "neutral",
    detail: "lifecycle"
  });
}

async function renderJournal() {
  const data = await getJson("/api/dashboard/journal");
  const stats = data.stats || {};
  content.innerHTML = `
    <section class="grid cols-4">
      ${metric("Trades", stats.total_trades || 0, `${stats.closed_trades || 0} closed`)}
      ${metric("Win Rate", `${fmt(stats.win_rate)}%`, `${stats.wins || 0}W / ${stats.losses || 0}L`)}
      ${metric("Avg PnL", `${fmt(stats.avg_pnl_pct)}%`, "per tracked trade")}
      ${metric("T1 / Stop", `${fmt(stats.target1_hit_rate)}% / ${fmt(stats.stop_hit_rate)}%`, "hit rates")}
    </section>
    <section class="grid cols-3">
      ${panel("By Mode", renderGroupStats(stats.by_mode))}
      ${panel("By Bias", renderGroupStats(stats.by_bias))}
      ${panel("By Regime", renderGroupStats(stats.by_regime))}
      ${panel("By Asset", renderGroupStats(stats.by_asset_class))}
      ${panel("By Decision", renderGroupStats(stats.by_final_decision))}
      ${panel("By Lifecycle", renderGroupStats(stats.by_lifecycle_status))}
    </section>
    ${panel("Recent Journal Entries", renderJournalEntries(data.recent_entries || []))}
  `;
  updateSystemHealthBadge({
    label: `${stats.total_trades || 0} logged`,
    tone: "neutral",
    detail: "journal"
  });
}

async function renderSettings() {
  const data = await getJson("/api/dashboard/settings");
  const ai = data.ai_brain || {};
  const execution = data.execution || {};
  const delivery = data.delivery || {};
  const auto = data.auto_scan || {};
  const session = data.dashboard_session || {};
  const universe = data.universe?.modes || {};

  content.innerHTML = `
    <section class="grid cols-3">
      ${panel("AI Brain", renderKeyValues({
        connected: ai.connected,
        provider: ai.provider,
        model: ai.model,
        key_loaded: ai.key_loaded,
        latest_signal_count: ai.latest_signal_count,
        manual_execution_only: ai.manual_execution_only
      }))}
      ${panel("Execution", renderKeyValues(execution))}
      ${panel("Delivery", renderKeyValues(delivery))}
      ${panel("Auto Scan", renderKeyValues(auto))}
      ${panel("Online Mode", renderKeyValues(session))}
    </section>
    <section class="panel">
      <div class="panel-header"><h3>Universe Sizes</h3></div>
      ${renderUniverseSizes(universe)}
    </section>
  `;
  updateSystemHealthBadge({
    label: data.ai_brain?.connected ? "System live" : "AI offline",
    tone: data.ai_brain?.connected ? "good" : "bad",
    detail: "settings"
  });
}

function renderBuyNowContent(plans, auto, options = {}) {
  if (!plans.length) {
    return renderMeaningfulEmptyState(options.section === "dashboard" ? "dashboard" : "buynow", "", {
      auto,
      signals: options.latestSignals || [],
      alerts: options.alerts || null
    });
  }
  return `
    <section class="cards signal-focus-grid">
      ${plans.map(renderBeginnerExecutionCard).join("")}
    </section>
  `;
}

function renderHomeNavigator(data = {}) {
  const journalStats = data.journal?.stats || {};
  const lifecycleSummary = data.lifecycle?.summary || {};
  const actionableAlerts = (data.alerts?.actionable_alerts || []).length;
  const sentAlerts = (data.alerts?.sent_alerts || []).length;
  const items = [
    { view: "buynow", label: "Buy Now", value: data.plans?.length || 0, detail: "actionable setups" },
    { view: "movers", label: "Movers", value: data.takeCount || 0, detail: "best live candidates" },
    { view: "watchlist", label: "Watchlist", value: data.watchCount || 0, detail: "good but not ready" },
    { view: "news", label: "News", value: actionableAlerts || 0, detail: "check headlines first" },
    { view: "alerts", label: "Alerts", value: sentAlerts || actionableAlerts || 0, detail: "delivery and triggers" },
    { view: "execution", label: "Execution", value: data.plans?.length || 0, detail: "Webull plans ready" },
    { view: "lifecycle", label: "Lifecycle", value: lifecycleSummary.open || 0, detail: "open tracked signals" },
    { view: "journal", label: "Journal", value: journalStats.total_trades || 0, detail: "logged trades" },
    { view: "ai", label: "Signal Brain", value: data.ai?.connected ? "ON" : "OFF", detail: data.ai?.model || "OpenAI" },
    { view: "settings", label: "Settings", value: data.delivery?.telegram_enabled || data.delivery?.discord_enabled ? "LIVE" : "LOCAL", detail: "system config" }
  ];

  return `
    <div class="home-nav-grid">
      ${items.map((item) => `
        <button class="home-nav-card" type="button" data-view-jump="${escapeAttr(item.view)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderHomeSnapshot(data = {}) {
  const counts = data.counts || {};
  const byMode = counts.by_mode || {};
  return `
    <div class="home-summary-stack">
      <div class="grid cols-2">
        ${metric("Signals", counts.total_signals || 0, `TAKE ${counts.by_decision?.take || 0} · WATCH ${counts.by_decision?.watch || 0}`)}
        ${metric("Regime", data.regime?.regime || "unknown", `SPY ${fmt(data.regime?.spy_change_pct)}% · QQQ ${fmt(data.regime?.qqq_change_pct)}%`)}
        ${metric("Auto Scan", data.auto?.auto_scan_enabled ? "ON" : "OFF", data.auto?.auto_scan_running ? "running now" : "waiting")}
        ${metric("AI Brain", data.ai?.connected ? "ONLINE" : "OFFLINE", data.ai?.model || "OpenAI")}
      </div>
      ${renderModeCounts(byMode)}
    </div>
  `;
}

function renderHomeExecutionPreview(plans = []) {
  if (!plans.length) return noTradeState("No execution card is ready right now.");
  return `
    <section class="cards">
      ${plans.slice(0, 2).map(renderExecutionCard).join("")}
    </section>
  `;
}

function renderHomeLifecycleJournal(lifecycle = {}, journal = {}) {
  const stats = journal.stats || {};
  const recentEntries = journal.recent_entries || [];
  return `
    <div class="home-summary-stack">
      <div class="grid cols-2">
        ${metric("Open", lifecycle.summary?.open || 0, "lifecycle")}
        ${metric("Closed", lifecycle.summary?.closed || 0, "tracked")}
        ${metric("Trades", stats.total_trades || 0, `${stats.closed_trades || 0} closed`)}
        ${metric("Win Rate", `${fmt(stats.win_rate)}%`, `${stats.wins || 0}W / ${stats.losses || 0}L`)}
      </div>
      ${renderJournalSummary(stats)}
      ${renderHomeJournalPreview(recentEntries)}
      <div class="copy-row">
        <button class="action-btn" type="button" data-view-jump="lifecycle">Open lifecycle</button>
        <button class="action-btn" type="button" data-view-jump="journal">Open journal</button>
      </div>
    </div>
  `;
}

function renderHomeJournalPreview(entries = []) {
  if (!entries.length) return `<div class="empty">No recent journal entries yet.</div>`;
  return `
    <div class="mini-list">
      ${entries.slice(0, 5).map((entry) => `
        <article class="mini-list-item">
          <div>
            <strong>${escapeHtml(entry.ticker || "Trade")}</strong>
            <span>${escapeHtml(entry.mode || "manual")} · ${escapeHtml(entry.status || "open")}</span>
          </div>
          <div>
            <strong>${escapeHtml(entry.outcome || "pending")}</strong>
            <span>${fmt(entry.pnl_pct)}%</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCommandStatusBar({ overview = {}, alerts = {}, executionCount = 0 } = {}) {
  const regime = overview.market_regime || {};
  const auto = overview.auto_scan || {};
  const ai = overview.ai_brain || {};
  const lastUpdatedText = auto.auto_scan_last_run_at
    ? new Date(auto.auto_scan_last_run_at).toLocaleTimeString()
    : overview.createdAt
      ? new Date(overview.createdAt).toLocaleTimeString()
      : "waiting";
  return `
    <section class="command-status-bar">
      ${statusPill("System", state.powerOn ? "Online" : "Offline", state.powerOn ? "good" : "bad")}
      ${statusPill("Auto-scan", auto.auto_scan_enabled ? "On" : "Off", auto.auto_scan_enabled ? "good" : "neutral")}
      ${statusPill("AI Brain", ai.connected ? "Online" : ai.key_loaded ? "Limited" : "Offline", ai.connected ? "good" : ai.key_loaded ? "neutral" : "bad")}
      ${statusPill("Market regime", regime.regime || "unknown", regime.regime === "bullish" ? "good" : regime.regime === "bearish" ? "bad" : "neutral")}
      ${statusPill("Alerts", (alerts.actionable_alerts || []).length || 0, (alerts.actionable_alerts || []).length ? "good" : "neutral")}
      ${statusPill("Ready", executionCount || 0, executionCount ? "good" : "neutral")}
      ${statusPill("Last updated", lastUpdatedText, "neutral")}
      <button class="action-btn primary-action" id="run-fresh-scan" type="button">Run fresh scan</button>
      <button class="power-switch ${state.powerOn ? "on" : "off"}" id="power-toggle" type="button" aria-pressed="${state.powerOn}">
        <span></span>${state.powerOn ? "Power Off" : "Power On"}
      </button>
    </section>
  `;
}

function renderMobileStatusStack({ overview = {}, alerts = {}, executionCount = 0 } = {}) {
  const regime = overview.market_regime || {};
  const auto = overview.auto_scan || {};
  const ai = overview.ai_brain || {};
  return `
    <div class="mobile-status-stack">
      ${statusPill("System", state.powerOn ? "Online" : "Offline", state.powerOn ? "good" : "bad")}
      ${statusPill("Auto-scan", auto.auto_scan_enabled ? "On" : "Off", auto.auto_scan_enabled ? "good" : "neutral")}
      ${statusPill("AI Brain", ai.connected ? "Online" : "Offline", ai.connected ? "good" : "bad")}
      ${statusPill("Regime", regime.regime || "unknown", regime.regime === "bullish" ? "good" : regime.regime === "bearish" ? "bad" : "neutral")}
      ${statusPill("Ready", executionCount || 0, executionCount ? "good" : "neutral")}
      ${statusPill("Alerts", (alerts.actionable_alerts || []).length || 0, (alerts.actionable_alerts || []).length ? "good" : "neutral")}
      <button class="action-btn primary-action" type="button" data-empty-action="scan" data-empty-mode="all">Run fresh scan</button>
    </div>
  `;
}

function statusPill(labelText, value, tone = "neutral") {
  return `
    <article class="status-pod ${tone}">
      <span>${escapeHtml(labelText)}</span>
      <strong>${escapeHtml(value ?? "")}</strong>
    </article>
  `;
}

function renderActionCardGrid(signals, kind = "watch", collapsed = false) {
  if (!signals.length) {
    return renderMeaningfulEmptyState(kind);
  }

  const body = `
    <section class="signal-focus-grid">
      ${signals.map((signal) => renderActionCard(signal, kind)).join("")}
    </section>
  `;

  if (collapsed) {
    return `
      <details class="collapsed-block">
        <summary>Open skip list</summary>
        ${body}
      </details>
    `;
  }

  return body;
}

function renderActionCard(signal, kind = "watch") {
  const timing = getTimingProfile(signal);
  const decision = timing.cardDecision;
  const reason = timing.reason;
  const mode = signal.signal_mode || signal.mode || "";
  const assetTone = getAssetToneClass(signal.asset_class);
  return `
    <article class="action-card ${decision} ${assetTone}">
      <div class="action-card-top">
        <div>
          <p class="card-kicker">${escapeHtml(mode || "signal")} · ${escapeHtml(getAssetLabel(signal.asset_class || "market"))}</p>
          <h3>${escapeHtml(signal.ticker || "")}</h3>
        </div>
        <div class="decision-stack">
          <span class="decision-pill ${escapeAttr(timing.badgeClass)}">${escapeHtml(timing.actionLabel)}</span>
          <span class="mini-pill ${escapeAttr(timing.timingTone)}">${escapeHtml(timing.label)}</span>
        </div>
      </div>
      <div class="action-meta">
        <span>${escapeHtml(signal.trend_label || getTrendLabel(signal))}</span>
        <span>${escapeHtml(getSignalEngineLabel(signal))}</span>
        <span>${escapeHtml(sessionPriceText(signal))}</span>
      </div>
      <div class="hero-numbers">
        <div><span>Current</span><strong>${fmt(signal.active_price ?? signal.price)}</strong></div>
        <div><span>Entry</span><strong>${formatFieldValue(signal.entry)}</strong></div>
        <div><span>Stop</span><strong>${formatFieldValue(signal.stop)}</strong></div>
        <div><span>Target 1 / 2</span><strong>${formatFieldValue(signal.target1)} / ${formatFieldValue(signal.target2)}</strong></div>
      </div>
      <div class="score-row">
        <div><span>What to do</span><strong>${escapeHtml(timing.guidanceLabel)}</strong></div>
        <div><span>Timing</span><strong>${escapeHtml(timing.label)}</strong></div>
        <div><span>${signal.signal_type === "intertrade_take" ? "Intertrade" : "Confidence"}</span><strong>${fmt(signal.signal_type === "intertrade_take" ? signal.intertrade_score : signal.confidence)}</strong></div>
        <div><span>${signal.signal_type === "intertrade_take" ? "Continuation" : "Quality"}</span><strong>${fmt(signal.signal_type === "intertrade_take" ? signal.continuation_score : signal.final_quality_score)}</strong></div>
      </div>
      ${signal.signal_type === "intertrade_take" ? `
        <div class="score-row">
          <div><span>Breakout</span><strong>${fmt(signal.breakout_score)}</strong></div>
          <div><span>Volume</span><strong>${fmt(signal.volume_score)}</strong></div>
          <div><span>Entry timing</span><strong>${fmt(signal.entry_timing_score)}</strong></div>
          <div><span>Risk / reward</span><strong>${fmt(signal.risk_reward_score)}</strong></div>
        </div>
      ` : ""}
      <p class="reason-line">${escapeHtml(reason)}</p>
      <div class="next-step-note">
        <strong>What to do:</strong>
        <span>${escapeHtml(timing.guidance)}</span>
      </div>
      <div class="copy-row">
        ${buttonChart("Chart", signal.ticker, mode)}
        ${buttonCopy("Webull", signal.webull_summary)}
        ${buttonCopy("Ticker", signal.ticker)}
        ${buttonCopy("Signal ID", signal.signal_id)}
      </div>
    </article>
  `;
}

function renderTradeSection(items = [], options = {}) {
  if (!items.length) {
    return options.sectionKind === "skip"
      ? renderMeaningfulEmptyState("skip")
      : noTradeState("No trade right now");
  }
  const body = `
    <section class="cards trader-card-grid">
      ${items.map((item) => renderExecutionCard(item)).join("")}
    </section>
  `;
  if (options.collapsed) {
    return `<details class="collapsed-block"><summary>Open ${items.length} skipped setup${items.length === 1 ? "" : "s"}</summary>${body}</details>`;
  }
  return body;
}

function isMovingUpCandidate(signal) {
  const bias = String(signal.bias || "").toLowerCase();
  const reason = `${signal.reason || ""} ${signal.webull_summary || ""}`.toLowerCase();
  return (
    bias.includes("bull") ||
    bias.includes("long") ||
    signal.bull_run_flag ||
    reason.includes("breakout") ||
    reason.includes("trending up") ||
    reason.includes("continuation") ||
    Number(signal.final_quality_score || 0) >= 65
  );
}

function isBearishSignal(signal) {
  const bias = String(signal.bias || "").toLowerCase();
  return bias.includes("bear") || bias.includes("short") || bias.includes("down");
}

function getTrendLabel(signal) {
  const timing = getTimingProfile(signal);
  if (signal.trend_label) return signal.trend_label;
  if (timing.isReadyNow) return "near entry";
  if (timing.isPullback) return "pullback watch";
  if (timing.isSkip) return "avoid";
  if (isBearishSignal(signal)) return "downtrend";
  return "watching";
}

function getSignalEngineLabel(signal = {}) {
  if (signal.signal_type === "intertrade_take" || signal.buy_now_type === "intertrade_take") return "breakout continuation engine";
  if (signal.signal_type === "momentum_take" || signal.buy_now_type === "momentum_take") return "momentum engine";
  return signal.final_decision || "scanner";
}

function getSignalBadgeLabel(signal, fallbackDecision = "watch") {
  if (signal.signal_type === "intertrade_take" || signal.buy_now_type === "intertrade_take") return "INTERTRADE";
  if (signal.signal_type === "momentum_take" || signal.buy_now_type === "momentum_take") return "MOMENTUM";
  return String(fallbackDecision || signal.final_decision || "watch").toUpperCase();
}

function getSignalBadgeClass(signal, fallbackDecision = "watch") {
  if (signal.signal_type === "intertrade_take" || signal.buy_now_type === "intertrade_take") return "take";
  if (signal.signal_type === "momentum_take" || signal.buy_now_type === "momentum_take") return "momentum";
  return String(fallbackDecision || signal.final_decision || "watch").toLowerCase();
}

function getBuyNowDisplayRank(signal = {}) {
  if (signal.buy_now_type === "take" || signal.final_decision === "take") return 0;
  if (signal.buy_now_type === "intertrade_take" || signal.signal_type === "intertrade_take") return 1;
  if (signal.buy_now_type === "momentum_take" || signal.signal_type === "momentum_take") return 2;
  return 3;
}

function getPlainSignalReason(signal, kind = "watch") {
  const raw = String(
    signal.skip_trade_reason ||
    signal.reason ||
    signal.execution_summary ||
    signal.webull_summary ||
    ""
  ).trim();

  if (raw) return raw;
  if (kind === "skip" || signal.final_decision === "skip") return "Weak quality, poor reward/risk, or this setup is too extended right now.";
  if (kind === "movers") return "This ticker is moving now and deserves a chart check.";
  return "Needs confirmation before it becomes a clean buy.";
}

function getAssetLabel(assetClass = "") {
  const normalized = String(assetClass || "").toLowerCase();
  if (normalized === "crypto") return "crypto";
  if (normalized === "bitcoin_linked") return "bitcoin-linked";
  if (normalized === "futures_proxy") return "futures";
  if (normalized === "index") return "index";
  return normalized || "equity";
}

function getAssetToneClass(assetClass = "") {
  const normalized = String(assetClass || "").toLowerCase();
  if (normalized === "crypto") return "asset-crypto";
  if (normalized === "bitcoin_linked") return "asset-bitcoin";
  if (normalized === "futures_proxy" || normalized === "index") return "asset-futures";
  return "";
}

function formatFieldValue(value) {
  const parsed = parseNumericValue(value);
  if (Number.isFinite(parsed)) return fmt(parsed);
  return escapeHtml(value || "--");
}

function parseNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return NaN;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function getCurrentPrice(item = {}) {
  const candidates = [
    item.active_price,
    item.current_price,
    item.price,
    item.regular_market_price,
    item.quote?.active_price,
    item.quote?.current
  ];
  for (const candidate of candidates) {
    const parsed = parseNumericValue(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

function getTimingProfile(item = {}) {
  const current = getCurrentPrice(item);
  const entry = parseNumericValue(item.entry || item.buy_trigger);
  const expired = Boolean(item.expired_flag);
  const finalDecision = String(item.final_decision || item.action || "watch").toLowerCase();
  const hasMomentumLane = ["momentum_take", "intertrade_take"].includes(item.buy_now_type) || ["momentum_take", "intertrade_take"].includes(item.signal_type);
  const deltaPct = Number.isFinite(current) && Number.isFinite(entry) && entry !== 0
    ? ((current - entry) / entry) * 100
    : NaN;
  const absDelta = Math.abs(deltaPct);
  const momentum = Number(item.momentum_score || 0);
  const bullish = !isBearishSignal(item);
  let label = "Needs confirmation";
  let actionLabel = "WAIT FOR BREAKOUT";
  let badgeClass = "watch";
  let tone = "neutral";
  let guidanceLabel = "Wait";
  let guidance = "Wait for a cleaner entry before doing anything.";

  if (expired) {
    label = "Invalid / Expired";
    actionLabel = "SKIP";
    badgeClass = "skip";
    tone = "bad";
    guidanceLabel = "Skip";
    guidance = "Skip for now. This signal is no longer fresh enough to trust.";
  } else if (finalDecision === "skip" && !hasMomentumLane) {
    label = Number.isFinite(deltaPct) && deltaPct > 1.5 ? "Extended / Late" : "Needs confirmation";
    actionLabel = "SKIP";
    badgeClass = "skip";
    tone = "bad";
    guidanceLabel = "Skip";
    guidance = item.skip_trade_reason || "Skip. Reward/risk is weak or the setup no longer lines up.";
  } else if (bullish && Number.isFinite(deltaPct)) {
    if (deltaPct < -0.35) {
      label = "Below Entry";
      actionLabel = "WAIT FOR BREAKOUT";
      badgeClass = "watch";
      tone = "neutral";
      guidanceLabel = "Wait";
      guidance = `Buy only if price breaks back above ${formatFieldText(entry)}.`;
    } else if ((item.bull_run_flag || momentum >= 75) && absDelta <= 0.8) {
      label = "Fresh Breakout";
      actionLabel = "BUY NOW";
      badgeClass = "take";
      tone = "good";
      guidanceLabel = "Buy now";
      guidance = `Buy only if price is still near ${formatFieldText(entry)}.`;
    } else if (absDelta <= 0.9) {
      label = "Near Entry";
      actionLabel = finalDecision === "take" ? "BUY NOW" : "WAIT FOR BREAKOUT";
      badgeClass = finalDecision === "take" ? "take" : "watch";
      tone = finalDecision === "take" ? "good" : "neutral";
      guidanceLabel = finalDecision === "take" ? "Buy now" : "Wait";
      guidance = finalDecision === "take"
        ? `Buy only if price is still near ${formatFieldText(entry)}.`
        : `Wait for price to prove it can hold near ${formatFieldText(entry)}.`;
    } else if (deltaPct > 1.5) {
      label = "Extended / Late";
      actionLabel = "WAIT FOR PULLBACK";
      badgeClass = "late";
      tone = "warn";
      guidanceLabel = "Wait for pullback";
      guidance = `Do not chase. Wait for a pullback closer to ${formatFieldText(entry)}.`;
    } else {
      label = "Needs confirmation";
      actionLabel = "WAIT FOR BREAKOUT";
      badgeClass = "watch";
      tone = "neutral";
      guidanceLabel = "Wait";
      guidance = `Wait for breakout confirmation above ${formatFieldText(entry)}.`;
    }
  } else if (bullish) {
    label = item.bull_run_flag ? "Fresh Breakout" : "Needs confirmation";
    actionLabel = finalDecision === "take" ? "BUY NOW" : "WAIT FOR BREAKOUT";
    badgeClass = finalDecision === "take" ? "take" : "watch";
    tone = finalDecision === "take" ? "good" : "neutral";
    guidanceLabel = finalDecision === "take" ? "Buy now" : "Wait";
    guidance = finalDecision === "take"
      ? "Buy only if price is still near entry."
      : "Wait for a cleaner trigger before buying.";
  } else {
    label = "Needs confirmation";
    actionLabel = "SKIP";
    badgeClass = "skip";
    tone = "bad";
    guidanceLabel = "Skip";
    guidance = "Skip. This is not a clean bullish setup right now.";
  }

  return {
    label,
    actionLabel,
    badgeClass,
    tone,
    timingTone: badgeClass === "late" ? "late" : badgeClass === "take" ? "good" : badgeClass === "skip" ? "bad" : "neutral",
    guidanceLabel,
    guidance,
    reason: item.momentum_reason || getPlainSignalReason(item, finalDecision),
    isReadyNow: actionLabel === "BUY NOW",
    isPullback: actionLabel === "WAIT FOR PULLBACK",
    isWatch: actionLabel === "WAIT FOR BREAKOUT",
    isSkip: actionLabel === "SKIP",
    cardDecision: badgeClass === "late" ? "late" : badgeClass
  };
}

function formatFieldText(value) {
  if (Number.isFinite(value)) return fmt(value);
  return String(value || "entry");
}

function sortSignalsByQuality(signals = []) {
  return [...signals].sort((a, b) => {
    const rankDelta = getBuyNowDisplayRank(a) - getBuyNowDisplayRank(b);
    if (rankDelta !== 0) return rankDelta;
    const momentumDelta = Number(b.momentum_score || 0) - Number(a.momentum_score || 0);
    if (momentumDelta !== 0) return momentumDelta;
    return Number(b.final_quality_score || b.setup_score || b.confidence || 0) - Number(a.final_quality_score || a.setup_score || a.confidence || 0);
  });
}

function dedupeSignalsByTicker(signals = []) {
  const byTicker = new Map();
  for (const signal of sortSignalsByQuality(signals)) {
    const key = normalizeDisplayTicker(signal.ticker);
    if (!key || byTicker.has(key)) continue;
    byTicker.set(key, signal);
  }
  return [...byTicker.values()];
}

function dedupePlansByTicker(plans = []) {
  const sorted = [...plans].sort((a, b) => {
    const aTiming = getTimingProfile(a);
    const bTiming = getTimingProfile(b);
    const rank = (timing) => timing.isReadyNow ? 0 : timing.isPullback ? 1 : timing.isWatch ? 2 : 3;
    const delta = rank(aTiming) - rank(bTiming);
    if (delta !== 0) return delta;
    const momentumDelta = Number(b.momentum_score || 0) - Number(a.momentum_score || 0);
    if (momentumDelta !== 0) return momentumDelta;
    return Number(b.final_quality_score || 0) - Number(a.final_quality_score || 0);
  });
  const byTicker = new Map();
  for (const plan of sorted) {
    const key = normalizeDisplayTicker(plan.ticker);
    if (!key || byTicker.has(key)) continue;
    byTicker.set(key, plan);
  }
  return [...byTicker.values()];
}

function uniqueTickerKey(item = {}) {
  return normalizeDisplayTicker(item.ticker || item.symbol || "");
}

function excludeUsedTickers(items = [], used = new Set()) {
  return items.filter((item) => {
    const key = uniqueTickerKey(item);
    return key && !used.has(key);
  });
}

function markUsedTickers(used = new Set(), items = []) {
  for (const item of items) {
    const key = uniqueTickerKey(item);
    if (key) used.add(key);
  }
  return used;
}

function getExecutionGroups(plans = [], signals = []) {
  const rawReadyNow = [];
  const rawWaitForPullback = [];
  const rawWatchOnly = [];
  const rawSkip = [];

  for (const plan of plans) {
    const timing = getTimingProfile(plan);
    if (timing.isReadyNow) rawReadyNow.push(plan);
    else if (timing.isPullback) rawWaitForPullback.push(plan);
    else if (timing.isWatch) rawWatchOnly.push(plan);
    else rawSkip.push(plan);
  }

  const used = new Set();
  const readyNow = excludeUsedTickers(dedupePlansByTicker(rawReadyNow), used);
  markUsedTickers(used, readyNow);
  const waitForPullback = excludeUsedTickers(dedupePlansByTicker(rawWaitForPullback), used);
  markUsedTickers(used, waitForPullback);
  const watchOnly = excludeUsedTickers(dedupePlansByTicker(rawWatchOnly), used);
  markUsedTickers(used, watchOnly);
  const skip = excludeUsedTickers(dedupePlansByTicker(rawSkip), used);
  const planTickerSet = markUsedTickers(new Set(), [...readyNow, ...waitForPullback, ...watchOnly]);

  const strongMomentum = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isSkip && (signal.signal_type === "momentum_take" || Number(signal.momentum_score || 0) >= 70 || isMovingUpCandidate(signal));
  })), planTickerSet);

  return {
    readyNow,
    waitForPullback,
    watchOnly,
    skip,
    strongMomentum
  };
}

function getHomeWorkflowGroups(signals = [], plans = []) {
  const executionGroups = getExecutionGroups(plans, signals);
  const used = markUsedTickers(new Set(), executionGroups.readyNow);
  const movingNow = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isSkip && (isMovingUpCandidate(signal) || timing.isPullback || timing.isReadyNow);
  })), used);
  markUsedTickers(used, movingNow);
  const watchlist = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isReadyNow && !timing.isSkip;
  })), used);
  markUsedTickers(used, watchlist);
  const avoid = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => getTimingProfile(signal).isSkip || signal.final_decision === "skip")), used);
  return {
    readyNow: executionGroups.readyNow,
    movingNow,
    watchlist,
    avoid
  };
}

function getMoverGroups(signals = []) {
  const used = new Set();
  const uptrendNow = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return !timing.isSkip && !timing.isPullback && isMovingUpCandidate(signal);
  })), used);
  markUsedTickers(used, uptrendNow);
  const nearBreakout = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => {
    const timing = getTimingProfile(signal);
    return timing.isWatch || String(signal.trend_label || "").includes("breakout");
  })), used);
  markUsedTickers(used, nearBreakout);
  const pullbackWatch = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => getTimingProfile(signal).isPullback)), used);
  markUsedTickers(used, pullbackWatch);
  const downtrendAvoid = excludeUsedTickers(dedupeSignalsByTicker(signals.filter((signal) => isBearishSignal(signal) || getTimingProfile(signal).isSkip)), used);
  return {
    uptrendNow,
    nearBreakout,
    pullbackWatch,
    downtrendAvoid
  };
}

function renderTradeNowEmptyState(watchSignals = [], allSignals = []) {
  const watchTicker = watchSignals[0]?.ticker || getBestFallbackTicker("", { signals: allSignals, anchorTickers: ["SPY", "NVDA"] });
  return `
    <div class="empty-state smart-empty-state">
      <div class="smart-empty-copy">
        <strong>No clean trade right now. Wait for a fresh setup.</strong>
        <p>The system is online, but nothing is clean enough to call a buy right now.</p>
      </div>
      <div class="smart-empty-actions">
        <button class="action-btn primary-action" type="button" data-empty-action="scan" data-empty-mode="all">Run fresh scan</button>
        <button class="action-btn" type="button" data-empty-action="chart" data-empty-ticker="${escapeAttr(watchTicker)}" data-empty-mode-hint="${escapeAttr(inferModeFromTicker(watchTicker))}">Open ${escapeHtml(watchTicker)} chart</button>
        <button class="action-btn" type="button" data-empty-action="view" data-empty-view="watchlist">Open watchlist</button>
      </div>
    </div>
  `;
}

function renderAdvancedDetails(title, body) {
  return `
    <details class="collapsed-block advanced-block">
      <summary>${escapeHtml(title)}</summary>
      ${body}
    </details>
  `;
}

function getEmptyStateText(kind) {
  if (kind === "movers") return "Nothing is standing out as a strong mover right now.";
  if (kind === "skip") return "Nothing ugly enough to call out right now.";
  return "Nothing to show here yet. Wait for the next scan.";
}

function renderMeaningfulEmptyState(kind = "watch", mode = "", options = {}) {
  const sectionConfig = getSectionEmptyStateConfig(kind, mode, options);
  if (sectionConfig) {
    return renderIntentionalEmptyState(sectionConfig);
  }

  const titleMap = {
    movers: "Nothing is moving cleanly right now.",
    skip: "Nothing needs to be ignored here right now.",
    watch: "Nothing useful is ready here yet.",
    signals: "No live signals loaded for this section yet."
  };
  const copyMap = {
    movers: "Run a fresh scan, or open a live chart for a ticker you want to inspect now.",
    skip: "That usually means there is less noise right now. You can run a fresh scan or check Movers instead.",
    watch: "Use a fresh scan, or open a chart and research a ticker directly.",
    signals: "Run a fresh scan for this mode, or open a live chart so you still land somewhere useful."
  };
  const quickTicker = mode === "crypto" ? "BTCUSD" : mode === "bitcoin" ? "MSTR" : "SPX";
  return `
    <div class="empty-state rich-empty-state">
      <strong>${escapeHtml(titleMap[kind] || titleMap.signals)}</strong>
      <p>${escapeHtml(copyMap[kind] || copyMap.signals)}</p>
      <div class="copy-row">
        <button class="action-btn" type="button" data-empty-action="scan" data-empty-mode="${escapeAttr(mode || state.view || "all")}">Run fresh scan</button>
        <button class="action-btn" type="button" data-empty-action="browser" data-empty-ticker="${escapeAttr(quickTicker)}">Open ${escapeHtml(quickTicker)} chart</button>
        <button class="action-btn" type="button" data-empty-action="news">Open news</button>
      </div>
    </div>
  `;
}

function renderIntentionalEmptyState(config) {
  return `
    <div class="empty-state smart-empty-state">
      <div class="smart-empty-copy">
        <strong>${escapeHtml(config.title || "Nothing here right now.")}</strong>
        <p>${escapeHtml(config.description || "Try a fresh scan or inspect a chart.")}</p>
      </div>
      <div class="smart-empty-actions">
        ${renderEmptyActionButton(config.primary, "primary")}
        ${renderEmptyActionButton(config.chart, "secondary")}
        ${renderEmptyActionButton(config.nav, "secondary")}
      </div>
    </div>
  `;
}

function renderEmptyActionButton(action, tone = "secondary") {
  if (!action?.label) return "";
  const classes = tone === "primary" ? "action-btn primary-action" : "action-btn";
  const attrs = [];
  if (action.action) attrs.push(`data-empty-action="${escapeAttr(action.action)}"`);
  if (action.mode) attrs.push(`data-empty-mode="${escapeAttr(action.mode)}"`);
  if (action.ticker) attrs.push(`data-empty-ticker="${escapeAttr(action.ticker)}"`);
  if (action.view) attrs.push(`data-empty-view="${escapeAttr(action.view)}"`);
  if (action.modeHint) attrs.push(`data-empty-mode-hint="${escapeAttr(action.modeHint)}"`);
  return `<button class="${classes}" type="button" ${attrs.join(" ")}>${escapeHtml(action.label)}</button>`;
}

function dedupeSignals(signals = []) {
  const byKey = new Map();
  for (const signal of signals) {
    const key = `${signal.signal_id || ""}:${signal.ticker || ""}:${signal.signal_mode || signal.mode || ""}`;
    if (!byKey.has(key)) byKey.set(key, signal);
  }
  return [...byKey.values()];
}

function getSectionEmptyStateConfig(kind, mode = "", options = {}) {
  const normalizedMode = String(mode || "").toLowerCase();
  const liveSignals = sortSignalsByQuality([
    ...(options.signals || []),
    ...getLiveSignals(normalizedMode || null)
  ]);
  const alerts = options.alerts || {};
  const plans = options.plans || [];
  const news = options.news || {};
  const bestModeView = getBestSignalsView();
  const chartCandidate = getBestFallbackTicker(normalizedMode || inferModeFromSection(kind), {
    signals: liveSignals,
    anchorTickers: getAnchorTickersForSection(kind, normalizedMode)
  });

  if (kind === "dashboard" || kind === "buynow") {
    const alertCount = (alerts.actionable_alerts || []).length;
    return {
      title: "No TAKE setup right now.",
      description: alertCount
        ? "Best current action is to wait, inspect the strongest chart, or review the latest actionable alerts."
        : "Nothing qualifies yet. Run a fresh scan or inspect the strongest current chart instead of forcing a trade.",
      primary: { label: "Run fresh scan", action: "scan", mode: "all" },
      chart: { label: `Open ${chartCandidate} chart`, action: "chart", ticker: chartCandidate, modeHint: inferModeFromTicker(chartCandidate) },
      nav: alertCount
        ? { label: "Open latest alerts", action: "view", view: "alerts" }
        : { label: "Open latest signals", action: "view", view: bestModeView }
    };
  }

  if (kind === "alerts") {
    const topChart = getBestFallbackTicker("", { signals: getLiveSignals(), anchorTickers: ["SPY", "BTCUSD", "MSTR"] });
    return {
      title: "No active alerts right now.",
      description: "Nothing is alert-worthy at the moment. Open the latest signals, run a fresh scan, or inspect the top quality chart.",
      primary: { label: "Open latest signals", action: "view", view: bestModeView },
      chart: { label: `Open ${topChart} chart`, action: "chart", ticker: topChart, modeHint: inferModeFromTicker(topChart) },
      nav: { label: "Run fresh scan", action: "scan", mode: "all" }
    };
  }

  if (kind === "execution") {
    const topWatch = getBestFallbackTicker("", {
      signals: getLiveSignals().filter((signal) => signal.final_decision === "watch"),
      anchorTickers: ["SPY", "QQQ", "BTCUSD"]
    });
    return {
      title: "No TAKE setup right now.",
      description: "Best current action is to wait or review the top WATCH card instead of forcing an execution plan.",
      primary: { label: "Run fresh scan", action: "scan", mode: "all" },
      chart: { label: `Open ${topWatch} chart`, action: "chart", ticker: topWatch, modeHint: inferModeFromTicker(topWatch) },
      nav: { label: "Open latest signals", action: "view", view: bestModeView }
    };
  }

  if (kind === "watchlist") {
    const topWatch = getBestFallbackTicker("", {
      signals: liveSignals.filter((signal) => signal.final_decision === "watch"),
      anchorTickers: ["SPY", "NVDA", "QQQ"]
    });
    return {
      title: "No watchlist setup is close enough yet.",
      description: "Nothing is ready for a patience card right now. Run a fresh scan or inspect the strongest watch candidate.",
      primary: { label: "Run fresh scan", action: "scan", mode: "all" },
      chart: { label: `Open ${topWatch} chart`, action: "chart", ticker: topWatch, modeHint: inferModeFromTicker(topWatch) },
      nav: { label: "Open latest signals", action: "view", view: bestModeView }
    };
  }

  if (kind === "news") {
    const newsTicker = getLatestNewsTicker(news) || getBestFallbackTicker("", { signals: getLiveSignals(), anchorTickers: ["SPY"] });
    return {
      title: "No headlines loaded right now.",
      description: newsTicker
        ? `${newsTicker} is still available to inspect while headlines refresh.`
        : "Jump back into headlines or open Market Browser while the news feed catches up.",
      primary: { label: "Reload latest headlines", action: "view", view: "news" },
      chart: { label: `Open ${newsTicker} chart`, action: "chart", ticker: newsTicker, modeHint: inferModeFromTicker(newsTicker) },
      nav: { label: "Open Market Browser", action: "browser", ticker: newsTicker || "SPY" }
    };
  }

  if (kind === "signals") {
    if (normalizedMode === "intraday") {
      return {
        title: "No intraday setup qualifies yet.",
        description: "Run a fresh intraday scan or inspect SPY and NVDA while the board repopulates.",
        primary: { label: "Run fresh intraday scan", action: "scan", mode: "intraday" },
        chart: { label: "Open SPY chart", action: "chart", ticker: "SPY", modeHint: "intraday" },
        nav: { label: "Inspect NVDA", action: "browser", ticker: "NVDA" }
      };
    }
    if (normalizedMode === "swing") {
      const swingCandidate = getBestFallbackTicker("swing", { signals: liveSignals, anchorTickers: ["SPY"] });
      return {
        title: "No swing setup qualifies yet.",
        description: `Run a fresh swing scan or inspect ${swingCandidate === "SPY" ? "SPY" : `${swingCandidate} and SPY`} while the next setup forms.`,
        primary: { label: "Run fresh swing scan", action: "scan", mode: "swing" },
        chart: { label: "Open SPY chart", action: "chart", ticker: "SPY", modeHint: "swing" },
        nav: { label: `Inspect ${swingCandidate}`, action: "browser", ticker: swingCandidate }
      };
    }
    if (normalizedMode === "futures") {
      const futuresCandidate = getBestFallbackTicker("futures", { signals: liveSignals, anchorTickers: ["QQQ", "SPY"] });
      return {
        title: "No futures-style setup qualifies yet.",
        description: `Run a fresh futures scan or inspect SPX and ${futuresCandidate} for the next clean move.`,
        primary: { label: "Run fresh futures scan", action: "scan", mode: "futures" },
        chart: { label: "Open SPX chart", action: "chart", ticker: "SPX", modeHint: "futures" },
        nav: { label: `Inspect ${futuresCandidate}`, action: "browser", ticker: futuresCandidate }
      };
    }
    if (normalizedMode === "bitcoin") {
      return {
        title: "No bitcoin-linked trade right now.",
        description: "MSTR and BTCUSD are still available to inspect while bitcoin-linked setups reset.",
        primary: { label: "Run fresh bitcoin scan", action: "scan", mode: "bitcoin" },
        chart: { label: "Open MSTR chart", action: "chart", ticker: "MSTR", modeHint: "bitcoin" },
        nav: { label: "Inspect BTCUSD", action: "browser", ticker: "BTCUSD" }
      };
    }
    if (normalizedMode === "crypto") {
      return {
        title: "No crypto trade right now.",
        description: "BTC and ETH are available to inspect while the crypto board waits for a cleaner setup.",
        primary: { label: "Run fresh crypto scan", action: "scan", mode: "crypto" },
        chart: { label: "Open BTCUSD chart", action: "chart", ticker: "BTCUSD", modeHint: "crypto" },
        nav: { label: "Inspect ETHUSD", action: "browser", ticker: "ETHUSD" }
      };
    }
  }

  return null;
}

function getLiveSignals(mode = null) {
  const signals = state.cachedSignals || [];
  const filtered = signals.filter((signal) => !mode || signal.mode === mode || signal.signal_mode === mode);
  return sortSignalsByQuality(filtered);
}

function getBestFallbackTicker(mode = "", options = {}) {
  const signals = sortSignalsByQuality(options.signals || getLiveSignals(mode || null));
  const bestSignal = signals.find((signal) => !mode || signal.mode === mode || signal.signal_mode === mode);
  if (bestSignal?.ticker) return normalizeDisplayTicker(bestSignal.ticker);

  const anchorTicker = (options.anchorTickers || []).map((ticker) => normalizeDisplayTicker(ticker)).find(Boolean);
  if (anchorTicker) return anchorTicker;

  const sectionDefault = getSectionDefaultTicker(mode);
  return sectionDefault;
}

function getSectionDefaultTicker(mode = "") {
  if (mode === "crypto") return "BTCUSD";
  if (mode === "bitcoin") return "MSTR";
  if (mode === "futures") return "SPX";
  if (mode === "intraday" || mode === "swing") return "SPY";
  return "SPY";
}

function getAnchorTickersForSection(kind, mode = "") {
  if (kind === "signals" && mode === "intraday") return ["SPY", "NVDA"];
  if (kind === "signals" && mode === "swing") return ["SPY"];
  if (kind === "signals" && mode === "futures") return ["SPX", "QQQ", "SPY"];
  if (kind === "signals" && mode === "bitcoin") return ["MSTR", "BTCUSD"];
  if (kind === "signals" && mode === "crypto") return ["BTCUSD", "ETHUSD"];
  if (kind === "dashboard" || kind === "buynow" || kind === "execution") return ["SPY", "QQQ", "BTCUSD"];
  return ["SPY"];
}

function getBestSignalsView() {
  const best = getLiveSignals()[0];
  return best?.signal_mode || best?.mode || "overview";
}

function inferModeFromSection(kind) {
  if (["dashboard", "buynow", "execution", "alerts"].includes(kind)) return "";
  if (kind === "news") return "";
  return "";
}

function getLatestNewsTicker(news = {}) {
  const articles = [...(news.company_news || []), ...(news.market_news || [])];
  const articleTicker = articles.map((article) => normalizeDisplayTicker(article.symbol || "")).find(Boolean);
  if (articleTicker) return articleTicker;
  return normalizeDisplayTicker((news.focus_tickers || [])[0] || "");
}

function maybeAutoRunEmptySectionScan(mode, signals = []) {
  if (!["intraday", "swing"].includes(mode) || signals.length || !state.powerOn) return;
  const lastRunAt = Number(state.ui.emptyAutoScanAt[mode] || 0);
  if (Date.now() - lastRunAt < 60_000) return;
  state.ui.emptyAutoScanAt[mode] = Date.now();
  const isIntraday = mode === "intraday";
  showMessage(isIntraday
    ? "No intraday setup qualifies yet. Running a fresh intraday scan..."
    : "No swing setup qualifies yet. Running a fresh swing scan...");
  void runFreshScan(mode);
}

function renderSignalToolbar(mode) {
  return `
    <div class="toolbar">
      <input id="signal-search" placeholder="Search ticker" value="${escapeHtml(state.signals.search)}">
      <label><input id="only-take" type="checkbox" ${state.signals.onlyTake ? "checked" : ""}> only TAKE</label>
      <label><input id="min-confidence" type="checkbox" ${state.signals.minConfidence ? "checked" : ""}> confidence >= 7</label>
      <label><input id="min-quality" type="checkbox" ${state.signals.minQuality ? "checked" : ""}> quality >= 70</label>
      <label><input id="hide-expired" type="checkbox" ${state.signals.hideExpired ? "checked" : ""}> hide expired</label>
      <select id="signal-sort">
        ${option("quality", "Sort quality")}
        ${option("confidence", "Sort confidence")}
        ${option("mode", "Sort mode")}
        ${option("ticker", "Sort ticker")}
      </select>
      <a class="action-btn" href="/scan?mode=${mode}" target="_blank" rel="noreferrer">Legacy Scan</a>
    </div>
  `;
}

function bindSignalToolbar() {
  const update = () => {
    state.signals.search = document.querySelector("#signal-search")?.value || "";
    state.signals.onlyTake = Boolean(document.querySelector("#only-take")?.checked);
    state.signals.minConfidence = Boolean(document.querySelector("#min-confidence")?.checked);
    state.signals.minQuality = Boolean(document.querySelector("#min-quality")?.checked);
    state.signals.hideExpired = Boolean(document.querySelector("#hide-expired")?.checked);
    state.signals.sort = document.querySelector("#signal-sort")?.value || "quality";
    loadView();
  };
  document.querySelector("#signal-search")?.addEventListener("change", update);
  document.querySelector("#signal-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    update();
  });
  document.querySelectorAll(".toolbar input[type='checkbox'], #signal-sort").forEach((item) => item.addEventListener("change", update));
}

function renderSignalTable(signals, options = {}) {
  if (!signals.length) return `<div class="empty">No signals to show.</div>`;
  const columns = options.compact
    ? ["ticker", "mode", "final_decision", "bias", "active_price", "session_price", "entry", "stop", "target1", "confidence", "final_quality_score", "copy"]
    : ["ticker", "mode", "asset", "final_decision", "bias", "bull", "active_price", "session_price", "entry", "sell", "stop", "target1", "target2", "confidence", "quality", "setup", "regime", "sector", "entry_distance", "session", "expired", "mtf", "summary", "copy"];
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${label(column)}</th>`).join("")}</tr></thead>
        <tbody>
          ${signals.map((signal) => renderSignalRow(signal, columns)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSignalRow(signal, columns) {
  const decision = signal.final_decision || "watch";
  const cells = {
    ticker: `${escapeHtml(signal.ticker)} ${buttonChart("Chart", signal.ticker, signal.signal_mode || signal.mode || "")}`,
    mode: signal.signal_mode || signal.mode,
    asset: signal.asset_class,
    final_decision: `<span class="decision ${decision}">${decision}</span>`,
    bias: signal.bias,
    bull: signal.bull_run_flag ? "yes" : "",
    active_price: fmt(signal.active_price ?? signal.price),
    session_price: sessionPriceText(signal),
    entry: signal.entry,
    sell: signal.sell_trigger,
    stop: signal.stop,
    target1: signal.target1,
    target2: signal.target2,
    confidence: signal.confidence,
    quality: signal.final_quality_score,
    final_quality_score: signal.final_quality_score,
    setup: signal.setup_score,
    regime: signal.regime_alignment,
    sector: signal.bitcoin_beta_group ? `${signal.sector_strength || ""} · ${signal.bitcoin_beta_group} · ${signal.bitcoin_alignment || ""}` : signal.sector_strength,
    entry_distance: signal.entry_distance_score,
    session: signal.market_session,
    expired: signal.expired_flag ? "yes" : "",
    mtf: signal.mtf_confirmation,
    summary: signal.webull_summary,
    copy: copyButtons(signal)
  };
  return `<tr class="${decision}-row">${columns.map((column) => `<td>${cells[column] ?? ""}</td>`).join("")}</tr>`;
}

function renderSignalCards(signals) {
  if (!signals.length) return `<div class="empty">No watchlist signals yet. Run a fresh scan or wait for the next online scan.</div>`;
  return `
    <section class="signal-card-grid">
      ${signals.map((signal) => {
        const decision = signal.final_decision || "watch";
        return `
          <article class="signal-card ${decision}">
            <div class="signal-card-top">
              <div>
                <h3>${escapeHtml(signal.ticker || "")}</h3>
                <span>${escapeHtml(signal.signal_mode || signal.mode || "")} · ${escapeHtml(signal.asset_class || "")}</span>
              </div>
              <span class="decision ${decision}">${escapeHtml(decision)}</span>
            </div>
            <div class="signal-score">
              <div><span>Quality</span><strong>${fmt(signal.final_quality_score)}</strong></div>
              <div><span>Confidence</span><strong>${fmt(signal.confidence)}</strong></div>
              <div><span>${escapeHtml(signal.active_price_label || "Price")}</span><strong>${fmt(signal.active_price ?? signal.price)}</strong></div>
            </div>
            <div class="session-price-line">${escapeHtml(sessionPriceText(signal))}</div>
            ${signal.bitcoin_beta_group ? `<div class="session-price-line">BTC link: ${escapeHtml(signal.bitcoin_beta_group)} · ${escapeHtml(signal.bitcoin_alignment || "pulse unknown")}</div>` : ""}
            <p>${escapeHtml(signal.reason || signal.webull_summary || "Waiting for cleaner confirmation.")}</p>
            <div class="copy-row">
              ${buttonChart("Chart", signal.ticker, signal.signal_mode || signal.mode || "")}
              ${buttonCopy("Plan", signal.webull_summary)}
              ${buttonCopy("ID", signal.signal_id)}
            </div>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function renderExecutionCard(plan) {
  const timing = getTimingProfile(plan);
  const assetTone = getAssetToneClass(plan.asset_class);
  const isIntertrade = plan.buy_now_type === "intertrade_take" || plan.signal_type === "intertrade_take";
  return `
    <article class="trade-card take-row ${escapeAttr(timing.cardDecision)} ${assetTone}">
      <div class="card-title">
        <div>
          <p class="card-kicker">${escapeHtml(plan.mode || "")} · ${escapeHtml(getAssetLabel(plan.asset_class || ""))}</p>
          <h3>${escapeHtml(plan.ticker)}</h3>
        </div>
        <div class="decision-stack">
          <span class="decision ${escapeAttr(timing.badgeClass)}">${escapeHtml(timing.actionLabel)}</span>
          <span class="mini-pill ${escapeAttr(timing.timingTone)}">${escapeHtml(timing.label)}</span>
        </div>
      </div>
      <div class="kv">
        <div><span>Current</span><strong>${fmt(plan.active_price ?? plan.current_price)}</strong></div>
        <div><span>Entry</span><strong>${fmt(plan.entry)}</strong></div>
        <div><span>Stop</span><strong>${fmt(plan.stop)}</strong></div>
        <div><span>Target 1</span><strong>${fmt(plan.target1)}</strong></div>
        <div><span>Target 2</span><strong>${fmt(plan.target2)}</strong></div>
        <div><span>Suggested shares</span><strong>${plan.suggested_shares || 0}</strong></div>
        <div><span>Risk dollars</span><strong>$${fmt(plan.estimated_risk_dollars)}</strong></div>
        <div><span>Confidence</span><strong>${fmt(plan.confidence)}</strong></div>
        <div><span>Quality</span><strong>${fmt(plan.final_quality_score)}</strong></div>
      </div>
      <div class="score-row">
        <div><span>${isIntertrade ? "Intertrade" : "Trend"}</span><strong>${isIntertrade ? fmt(plan.intertrade_score) : escapeHtml(plan.trend_label || getTrendLabel(plan))}</strong></div>
        <div><span>${isIntertrade ? "Breakout" : "Momentum"}</span><strong>${isIntertrade ? fmt(plan.breakout_score) : fmt(plan.momentum_score)}</strong></div>
        <div><span>${isIntertrade ? "Continuation" : "Shares"}</span><strong>${isIntertrade ? fmt(plan.continuation_score) : (plan.suggested_shares || 0)}</strong></div>
        <div><span>${isIntertrade ? "Volume" : "RR1 / RR2"}</span><strong>${isIntertrade ? fmt(plan.volume_score) : `${fmt(plan.reward_risk_target1)} / ${fmt(plan.reward_risk_target2)}`}</strong></div>
      </div>
      ${isIntertrade ? `
        <div class="score-row">
          <div><span>Entry timing</span><strong>${fmt(plan.entry_timing_score)}</strong></div>
          <div><span>Risk / reward</span><strong>${fmt(plan.risk_reward_score)}</strong></div>
          <div><span>Shares</span><strong>${plan.suggested_shares || 0}</strong></div>
          <div><span>RR1 / RR2</span><strong>${fmt(plan.reward_risk_target1)} / ${fmt(plan.reward_risk_target2)}</strong></div>
        </div>
      ` : ""}
      <p class="summary-text">${escapeHtml(plan.momentum_reason || plan.execution_summary || plan.summary || "")}</p>
      <div class="next-step-note">
        <strong>What to do:</strong>
        <span>${escapeHtml(timing.guidance)}</span>
      </div>
      <div class="copy-row">
        ${buttonChart("Open chart", plan.ticker, plan.mode || "")}
        ${buttonCopy("Webull", plan.webull_summary)}
        ${buttonCopy("Ticker", plan.ticker)}
        ${buttonCopy("Plan", plan.execution_summary || plan.summary)}
        ${buttonCopy("Signal ID", plan.signal_id)}
      </div>
    </article>
  `;
}

function renderBeginnerExecutionCard(plan) {
  return renderExecutionCard(plan);
}

function renderAlertsTable(alerts) {
  if (!alerts.length) return `<div class="empty">No actionable alerts right now. Wait for a green TAKE signal.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Ticker</th><th>Decision</th><th>Priority</th><th>Quality</th><th>Reasons</th><th>Summary</th><th>Copy</th></tr></thead>
        <tbody>
          ${alerts.map((alert) => {
            const decision = alert.final_decision || "watch";
            return `<tr class="${decision}-row">
              <td>${escapeHtml(alert.ticker)}</td>
              <td><span class="decision ${decision}">${escapeHtml(decision)}</span></td>
              <td>${fmt(alert.priority_score)}</td>
              <td>${fmt(alert.final_quality_score)}</td>
              <td>${escapeHtml((alert.alert_reasons || []).join(", "))}</td>
              <td>${escapeHtml(alert.webull_summary || "")}</td>
              <td>${copyButtons(alert)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSentAlerts(alerts) {
  if (!alerts.length) return `<div class="empty">No sent alerts yet. This is normal until a strong TAKE appears.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Sent</th><th>Ticker</th><th>Decision</th><th>Quality</th><th>Delivery</th><th>Summary</th></tr></thead>
        <tbody>
          ${alerts.map((alert) => `<tr class="${alert.final_decision || "watch"}-row">
            <td>${escapeHtml(alert.sentAt || "")}</td>
            <td>${escapeHtml(alert.ticker || "")}</td>
            <td>${escapeHtml(alert.final_decision || "")}</td>
            <td>${fmt(alert.final_quality_score)}</td>
            <td>${escapeHtml((alert.delivery_results || []).map((item) => `${item.channel}:${item.ok ? "sent" : "skipped"}`).join(", "))}</td>
            <td>${escapeHtml(alert.webull_summary || "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLifecycleTable(records) {
  if (!records.length) return `<div class="empty">Nothing to show yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Signal ID</th><th>Ticker</th><th>Mode</th><th>Status</th><th>Entry</th><th>Stop</th><th>T1</th><th>T2</th><th>Age</th><th>Expires</th><th>Updated</th></tr></thead>
        <tbody>
          ${records.map((item) => `<tr>
            <td>${escapeHtml(item.signal_id || "")}</td>
            <td>${escapeHtml(item.ticker || "")}</td>
            <td>${escapeHtml(item.mode || "")}</td>
            <td>${escapeHtml(item.lifecycle_status || "")}</td>
            <td>${fmt(item.entry)}</td>
            <td>${fmt(item.stop)}</td>
            <td>${fmt(item.target1)}</td>
            <td>${fmt(item.target2)}</td>
            <td>${fmt(item.hold_seconds ?? item.signal_age_seconds)}</td>
            <td>${escapeHtml(item.expires_at || "")}</td>
            <td>${escapeHtml(item.lifecycle_updated_at || "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderJournalEntries(entries) {
  if (!entries.length) return `<div class="empty">No journal entries yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Ticker</th><th>Mode</th><th>Status</th><th>Outcome</th><th>PnL %</th><th>Decision</th><th>Lifecycle</th><th>Notes</th></tr></thead>
        <tbody>
          ${entries.map((entry) => `<tr>
            <td>${escapeHtml(entry.timestamp || "")}</td>
            <td>${escapeHtml(entry.ticker || "")}</td>
            <td>${escapeHtml(entry.mode || "")}</td>
            <td>${escapeHtml(entry.status || "")}</td>
            <td>${escapeHtml(entry.outcome || "")}</td>
            <td>${fmt(entry.pnl_pct)}</td>
            <td>${escapeHtml(entry.final_decision || "")}</td>
            <td>${escapeHtml(entry.lifecycle_status || "")}</td>
            <td>${escapeHtml(entry.notes || "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderModeCounts(byMode) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mode</th><th>Total</th><th>Take</th><th>Watch</th><th>Skip</th></tr></thead>
        <tbody>
          ${Object.entries(byMode || {}).map(([mode, row]) => `<tr>
            <td>${escapeHtml(mode)}</td>
            <td>${row.total || 0}</td>
            <td>${row.take || 0}</td>
            <td>${row.watch || 0}</td>
            <td>${row.skip || 0}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderJournalSummary(stats) {
  return `
    <div class="grid cols-2">
      ${metric("Trades", stats.total_trades || 0, `${stats.closed_trades || 0} closed`)}
      ${metric("Win Rate", `${fmt(stats.win_rate)}%`, `${stats.wins || 0} wins`)}
      ${metric("Avg PnL", `${fmt(stats.avg_pnl_pct)}%`, "journal")}
      ${metric("Expired", `${fmt(stats.expired_rate)}%`, "signals")}
    </div>
  `;
}

function renderGroupStats(group) {
  if (!group || !Object.keys(group).length) return `<div class="empty">No data yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Group</th><th>Total</th><th>Win %</th><th>Avg PnL</th></tr></thead>
        <tbody>
          ${Object.entries(group).map(([key, item]) => `<tr>
            <td>${escapeHtml(key)}</td>
            <td>${item.total_trades || 0}</td>
            <td>${fmt(item.win_rate)}%</td>
            <td>${fmt(item.avg_pnl_pct)}%</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderObjectTable(object) {
  if (!object || !Object.keys(object).length) return `<div class="empty">No data yet.</div>`;
  return `<div class="table-wrap"><table><tbody>${Object.entries(object).map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderNewsPreview(data) {
  const articles = [...(data.company_news || []), ...(data.market_news || [])].slice(0, 5);
  return `
    <div class="news-preview">
      ${renderNewsCards(articles, true)}
      <div class="social-strip">
        ${(data.social_posts || []).slice(0, 6).map((item) => `
          <a href="${escapeAttr(item.x_search_url)}" target="_blank" rel="noreferrer">$${escapeHtml(item.ticker)} posts</a>
        `).join("")}
      </div>
      <button class="action-btn" type="button" data-view-jump="news">Open full news page</button>
    </div>
  `;
}

function renderNewsCards(articles, compact = false) {
  if (!articles.length) return `<div class="empty">No news loaded yet. Check your Finnhub key if this stays empty.</div>`;
  return `
    <div class="news-list ${compact ? "compact" : ""}">
      ${articles.map((article) => `
        <article class="news-card">
          <div>
            <span class="news-symbol">${escapeHtml(article.symbol || article.category || "market")}</span>
            <span class="small">${escapeHtml(article.source || "news")} · ${escapeHtml(formatTime(article.publishedAt || article.datetime))}</span>
          </div>
          <h3>${escapeHtml(article.headline || "Untitled headline")}</h3>
          ${compact ? "" : `<p>${escapeHtml(article.summary || "")}</p>`}
          ${article.url ? `<a href="${escapeAttr(article.url)}" target="_blank" rel="noreferrer">Read source</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderSocialLinks(items) {
  if (!items.length) return `<div class="empty">No ticker post links yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Ticker</th><th>X / Twitter</th><th>Stocktwits</th><th>TradingView Ideas</th><th>Note</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr>
            <td>${escapeHtml(item.ticker)}</td>
            <td><a href="${escapeAttr(item.x_search_url)}" target="_blank" rel="noreferrer">Live $${escapeHtml(item.ticker)} posts</a></td>
            <td><a href="${escapeAttr(item.stocktwits_url)}" target="_blank" rel="noreferrer">Stocktwits</a></td>
            <td><a href="${escapeAttr(item.tradingview_ideas_url)}" target="_blank" rel="noreferrer">Ideas</a></td>
            <td>${escapeHtml(item.note || "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function noTradeState(title = "No trade right now") {
  return `
    <div class="panel no-trade">
      <h3>${escapeHtml(title)}</h3>
      <p>The system is online. It is just not seeing a clean enough setup yet.</p>
      <div class="plain-bullets">
        <span>Do not force a trade.</span>
        <span>Use Movers and Watchlist to see what is getting close.</span>
        <span>Come back after the next scan or refresh.</span>
      </div>
    </div>
  `;
}

function renderBrowserDecisionBox(data, timing) {
  const signal = data.signal || {};
  const plan = data.execution_plan || {};
  const decision = signal.ticker ? signal : plan;
  if (!signal.ticker && !plan.ticker) {
    return `
      <div class="decision-box">
        <div class="decision-box-head">
          <p class="eyebrow">Decision Box</p>
          <h3>No active signal yet</h3>
        </div>
        <p class="summary-text">No active signal yet. Use the chart and news for research only.</p>
        <div class="copy-row">
          ${buttonChart("Open chart", data.ticker, inferModeFromTicker(data.ticker))}
          <button class="action-btn" type="button" data-empty-action="news">Open news</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="decision-box">
      <div class="decision-box-head">
        <p class="eyebrow">Decision Box</p>
        <h3>${escapeHtml(signal.final_decision || plan.final_decision || "research")}</h3>
        <span class="decision ${escapeAttr(timing.badgeClass)}">${escapeHtml(timing.actionLabel)}</span>
      </div>
      <div class="kv">
        <div><span>Timing decision</span><strong>${escapeHtml(timing.label)}</strong></div>
        <div><span>Trend</span><strong>${escapeHtml(signal.trend_label || plan.trend_label || getTrendLabel(decision))}</strong></div>
        <div><span>Entry</span><strong>${formatFieldValue(signal.entry || plan.entry)}</strong></div>
        <div><span>Stop</span><strong>${formatFieldValue(signal.stop || plan.stop)}</strong></div>
        <div><span>Target 1</span><strong>${formatFieldValue(signal.target1 || plan.target1)}</strong></div>
        <div><span>Target 2</span><strong>${formatFieldValue(signal.target2 || plan.target2)}</strong></div>
        <div><span>Confidence</span><strong>${fmt(signal.confidence || plan.confidence)}</strong></div>
        <div><span>Quality</span><strong>${fmt(signal.final_quality_score || plan.final_quality_score)}</strong></div>
      </div>
      <div class="next-step-note">
        <strong>What to do now:</strong>
        <span>${escapeHtml(timing.guidance)}</span>
      </div>
      <p class="summary-text">${escapeHtml(signal.momentum_reason || plan.momentum_reason || signal.webull_summary || plan.webull_summary || "No active signal yet.")}</p>
      <div class="copy-row">
        ${buttonCopy("Webull", plan.webull_summary || signal.webull_summary)}
        ${buttonCopy("Ticker", data.ticker)}
        ${buttonCopy("Signal ID", signal.signal_id || plan.signal_id)}
      </div>
    </div>
  `;
}

function noSignalForTicker(ticker) {
  return `
    <div class="panel no-trade">
      <h3>No current signal for ${escapeHtml(ticker)}</h3>
      <p>The scanner has not produced a TAKE/WATCH/SKIP signal for this ticker yet. Use the chart and news for research only.</p>
      <div class="copy-row">
        <button class="action-btn" type="button" data-empty-action="chart" data-empty-ticker="${escapeAttr(ticker)}">Open chart</button>
        <button class="action-btn" type="button" data-empty-action="news">Open news</button>
      </div>
    </div>
  `;
}

function noExecutionForTicker(ticker) {
  return `
    <div class="panel no-trade">
      <h3>No Webull plan for ${escapeHtml(ticker)}</h3>
      <p>Only TAKE signals that pass the quality rules get an execution card. Do not force this trade.</p>
      <div class="copy-row">
        <button class="action-btn" type="button" data-empty-action="chart" data-empty-ticker="${escapeAttr(ticker)}">Open chart</button>
        <button class="action-btn" type="button" data-empty-action="dashboard">Back to dashboard</button>
      </div>
    </div>
  `;
}

function renderTradingAssistantChat(placeholder = "Ask about a ticker, signal, entry, stop, target, or what to skip.") {
  const messages = state.chat.messages.length
    ? state.chat.messages.map((item) => `
        <div class="chat-message ${escapeAttr(item.role)}">
          <strong>${item.role === "user" ? "You" : "ChatGPT"}</strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
      `).join("")
    : `<div class="chat-empty">Ask things like “What can I trade now?”, “Analyze IREN”, “Is this BTC move clean?”, or “Explain this TAKE signal like I’m new.”</div>`;

  return `
    <div class="chatbox">
      <div class="chat-log" id="chat-log">${messages}</div>
      <form class="chat-form" id="trading-chat-form">
        <input id="trading-chat-input" type="text" placeholder="${escapeAttr(placeholder)}">
        <button class="action-btn primary-action" type="submit">Ask</button>
      </form>
      <div class="quick-links">
        ${quickPrompt("What can I trade now?")}
        ${quickPrompt("What should I skip?")}
        ${quickPrompt("Any Bitcoin-linked setups?")}
      </div>
      <p class="chat-note">ChatGPT uses your live dashboard context. It does not place trades.</p>
    </div>
  `;
}

function bindTradingAssistant() {
  document.querySelector("#trading-chat-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector("#trading-chat-input");
    await sendTradingChat(input?.value || "");
    if (input) input.value = "";
  });
}

async function sendTradingChat(text) {
  if (!state.powerOn) {
    showMessage("Power the system on before using the trading chat box.", true);
    return;
  }
  const message = String(text || "").trim();
  if (!message) return;
  state.chat.messages.push({ role: "user", text: message });
  state.chat.messages.push({ role: "assistant", text: "Thinking through your live signals..." });
  await loadView();

  const tickerMatch = message.toUpperCase().match(/\b[A-Z]{1,5}\b/);
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        ticker: tickerMatch ? tickerMatch[0] : state.browserSymbol
      })
    });
    const data = await response.json();
    state.chat.messages.pop();
    state.chat.messages.push({
      role: "assistant",
      text: data.ok ? data.answer : data.error || "ChatGPT could not answer right now."
    });
  } catch (error) {
    state.chat.messages.pop();
    state.chat.messages.push({ role: "assistant", text: error.message || "Chat failed." });
  }
  await loadView();
}

function quickPrompt(text) {
  return `<button class="quick-chip" type="button" data-quick-chat="${escapeAttr(text)}">${escapeHtml(text)}</button>`;
}

function quickSearch(ticker) {
  const normalizedTicker = normalizeDisplayTicker(ticker);
  const active = normalizedTicker && normalizedTicker === normalizeDisplayTicker(state.selectedHomeTicker || state.browserSymbol);
  return `<button class="quick-chip ${active ? "active" : ""}" type="button" data-quick-search="${escapeAttr(ticker)}">${escapeHtml(ticker)}</button>`;
}

function renderKeyValues(object) {
  return `<div class="kv">${Object.entries(object || {}).slice(0, 12).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(simpleValue(value))}</strong></div>`).join("")}</div>`;
}

function renderUniverseSizes(universe) {
  return `<div class="grid cols-4">${Object.entries(universe || {}).map(([mode, item]) => metric(mode, item.count || 0, item.label || "")).join("")}</div>`;
}

function viewPill(labelText, view) {
  return `<button class="mode-pill ${state.view === view ? "active" : ""}" type="button" data-view-jump="${escapeAttr(view)}">${escapeHtml(labelText)}</button>`;
}

function statusTile(labelText, value, subtext = "", tone = "neutral") {
  return `
    <article class="status-tile ${tone}">
      <span>${escapeHtml(labelText)}</span>
      <strong>${escapeHtml(value ?? "")}</strong>
      <small>${escapeHtml(subtext ?? "")}</small>
    </article>
  `;
}

function sessionPriceText(item = {}) {
  const label = item.active_price_label || item.market_session || "price";
  const extended = item.extended_hours_price;
  if (extended !== null && extended !== undefined && extended !== "") {
    return `${label}: ${fmt(extended)}`;
  }
  if (label === "24/7 live") return `24/7 live: ${fmt(item.active_price ?? item.price ?? item.current_price)}`;
  return `regular: ${fmt(item.regular_market_price ?? item.active_price ?? item.price ?? item.current_price)}`;
}

function metric(labelText, value, subtext = "") {
  return `<article class="panel metric"><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value ?? "")}</strong><span>${escapeHtml(subtext ?? "")}</span></article>`;
}

function panel(title, body) {
  return `<section class="panel"><div class="panel-header"><h3>${escapeHtml(title)}</h3></div>${body}</section>`;
}

function copyButtons(item) {
  return `<div class="copy-row">
    ${buttonChart("Chart", item.ticker, item.signal_mode || item.mode || "")}
    ${buttonCopy("Ticker", item.ticker)}
    ${buttonCopy("Plan", item.webull_summary)}
    ${buttonCopy("Exec", item.execution_summary || item.execution_plan?.summary)}
    ${buttonCopy("ID", item.signal_id)}
  </div>`;
}

function buttonCopy(labelText, value) {
  const copyValue = String(value ?? "").trim();
  if (!copyValue) return renderStaticAction(labelText);
  return `<button class="copy-btn" type="button" data-copy="${escapeAttr(copyValue)}">${escapeHtml(labelText)}</button>`;
}

function buttonChart(labelText, ticker, mode = "") {
  const cleanTicker = normalizeDisplayTicker(ticker);
  if (!cleanTicker) return renderStaticAction(labelText);
  const modeHint = mode || inferModeFromTicker(cleanTicker);
  return `<button class="copy-btn chart-btn" type="button" data-chart="${escapeAttr(cleanTicker)}" data-chart-mode="${escapeAttr(modeHint)}">${escapeHtml(labelText)}</button>`;
}

document.addEventListener("click", async (event) => {
  const quickChat = event.target.closest("[data-quick-chat]");
  if (quickChat) {
    await sendTradingChat(quickChat.dataset.quickChat || "");
    return;
  }

  const quickSearchButton = event.target.closest("[data-quick-search]");
  if (quickSearchButton) {
    const resolvedTicker = normalizeDisplayTicker(quickSearchButton.dataset.quickSearch || "");
    state.selectedHomeTicker = resolvedTicker;
    const input = document.querySelector("#global-search-input");
    if (input) input.value = quickSearchButton.dataset.quickSearch || "";
    state.browserSymbol = resolvedTicker || "SPY";
    setActiveView("browser");
    state.ui.pendingChartTicker = state.browserSymbol;
    state.ui.pendingChartMode = inferModeFromTicker(state.browserSymbol);
    showMessage(`Opened Market Browser for ${state.browserSymbol}.`);
    await loadView();
    return;
  }

  const jumpButton = event.target.closest("[data-view-jump]");
  if (jumpButton) {
    await navigateToView(jumpButton.dataset.viewJump);
    return;
  }

  const workflowButton = event.target.closest("[data-workflow-action]");
  if (workflowButton) {
    await handleWorkflowAction(workflowButton.dataset.workflowAction || "");
    return;
  }

  const emptyActionButton = event.target.closest("[data-empty-action]");
  if (emptyActionButton) {
    await handleEmptyAction(emptyActionButton);
    return;
  }

  const chartButton = event.target.closest("[data-chart]");
  if (chartButton) {
    await openChart(chartButton.dataset.chart || "", chartButton.dataset.chartMode || "");
    return;
  }

  const button = event.target.closest("[data-copy]");
  if (!button) return;
  await copyToClipboard(button, button.dataset.copy || "", button.dataset.copyLabel || button.textContent || "value");
});

async function handleWorkflowAction(action) {
  if (!state.powerOn) {
    showMessage("Power the system on first.", true);
    return;
  }
  if (action === "scan-market") {
    await runFreshScan("all");
    return;
  }
  if (action === "see-decisions") {
    await navigateToView("buynow");
    content.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "verify-chart-news") {
    const execution = await getJson("/api/dashboard/execution");
    const bestPlan = (execution.plans || [])[0];
    if (bestPlan?.ticker) {
      state.browserSymbol = bestPlan.ticker;
      setActiveView("browser");
      await loadView();
      await openChart(bestPlan.ticker, bestPlan.mode || "");
      return;
    }
    await navigateToView("news");
    showMessage("No active buy-now ticker yet, so I opened the news board instead.");
    return;
  }
  if (action === "copy-best-plan") {
    const execution = await getJson("/api/dashboard/execution");
    const bestPlan = (execution.plans || [])[0];
    if (!bestPlan?.webull_summary) {
      showMessage("No active Webull plan is available right now.", true);
      return;
    }
    await copyToClipboard(null, bestPlan.webull_summary, `Webull plan for ${bestPlan.ticker}`);
  }
}

async function handleEmptyAction(button) {
  const action = button.dataset.emptyAction || "";
  if (action === "scan") {
    const mode = button.dataset.emptyMode || state.view || "all";
    await runFreshScan(mode, { triggerButton: button });
    return;
  }
  if (action === "view") {
    const view = button.dataset.emptyView || "dashboard";
    await navigateToView(view);
    return;
  }
  if (action === "browser") {
    const ticker = normalizeDisplayTicker(button.dataset.emptyTicker || "SPX");
    const modeHint = button.dataset.emptyModeHint || inferModeFromTicker(ticker);
    state.browserSymbol = ticker;
    setActiveView("browser");
    state.ui.pendingChartTicker = ticker;
    state.ui.pendingChartMode = modeHint;
    showMessage(`Opened Market Browser for ${ticker}.`);
    await loadView();
    return;
  }
  if (action === "chart") {
    const ticker = normalizeDisplayTicker(button.dataset.emptyTicker || state.browserSymbol || "SPX");
    const modeHint = button.dataset.emptyModeHint || inferModeFromTicker(ticker);
    await openChart(ticker, modeHint);
    return;
  }
  if (action === "news") {
    await navigateToView("news");
    return;
  }
  if (action === "dashboard") {
    await navigateToView("dashboard");
  }
}

function setActiveView(view) {
  state.view = view || "dashboard";
  if (["intraday", "swing", "futures", "bitcoin", "crypto"].includes(state.view)) {
    state.mode = state.view;
  }
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
}

async function navigateToView(view) {
  closeChart();
  closeMobileNav();
  setActiveView(view);
  await loadView();
}

function inferModeFromTicker(ticker) {
  const clean = normalizeDisplayTicker(ticker);
  if (!clean) return "";
  if (["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD", "ADAUSD", "AVAXUSD", "LINKUSD", "MATICUSD", "LTCUSD", "SHIBUSD"].includes(clean)) return "crypto";
  if (["MSTR", "COIN", "IREN", "MARA", "RIOT", "CLSK", "IBIT", "GBTC", "FBTC", "BITO", "BITX", "MSTU", "MSBT"].includes(clean)) return "bitcoin";
  if (clean === "SPX") return "intraday";
  return "";
}

function updateSystemHealthBadge(status = {}) {
  if (!systemHealth) return;
  const tone = status.tone || "neutral";
  const label = status.label || "Checking";
  const detail = status.detail ? ` · ${status.detail}` : "";
  systemHealth.textContent = `${label}${detail}`;
  systemHealth.className = `health-badge ${tone}`;
  if (mobileHealth) {
    mobileHealth.textContent = label;
    mobileHealth.className = `mobile-health-pill ${tone}`;
  }
}

function renderInlineChart(ticker) {
  const cleanTicker = normalizeDisplayTicker(ticker);
  if (!cleanTicker) {
    return `<div class="inline-chart chart-empty">Select a ticker to load a live chart.</div>`;
  }
  const symbol = getTradingViewSymbol(cleanTicker);
  const src = getTradingViewEmbedUrl(symbol, "220", state.chart.interval || "15");
  return `
    <div class="inline-chart">
      <iframe title="${escapeAttr(cleanTicker)} live chart" src="${escapeAttr(src)}" loading="lazy"></iframe>
    </div>
  `;
}

async function openChart(ticker, mode = "", options = {}) {
  const cleanTicker = normalizeDisplayTicker(ticker);
  if (!cleanTicker) {
    showMessage("That chart is not available yet.", true);
    closeChart();
    return;
  }
  state.chart.ticker = cleanTicker;
  state.chart.mode = mode || inferModeFromTicker(cleanTicker) || "";
  chartTitle.textContent = `${cleanTicker} Signal Chart`;
  chartFrame.innerHTML = `<div class="chart-loading">Loading ${escapeHtml(cleanTicker)} chart and overlay...</div>`;
  chartModal.classList.remove("hidden");

  try {
    const params = new URLSearchParams({ ticker: cleanTicker });
    if (mode) params.set("mode", mode);
    const data = await getJson(`/api/chart-signal?${params.toString()}`);
    chartFrame.innerHTML = renderChartSurface(data);
  } catch (error) {
    chartFrame.innerHTML = `
      <div class="chart-error-state">
        <strong>Chart unavailable</strong>
        <p>${escapeHtml(error.message || "Could not load this chart.")}</p>
      </div>
    `;
    showMessage(`Could not load the ${cleanTicker} chart right now.`, true);
  }
  if (!options.preserveOpen) chartModal.classList.remove("hidden");
}

function closeChart() {
  chartModal?.classList.add("hidden");
  if (chartFrame) chartFrame.innerHTML = "";
}

function getTradingViewEmbedUrl(symbol, height = "640", interval = "15") {
  const params = new URLSearchParams({
    symbol,
    interval,
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "#0b0e14",
    enable_publishing: "false",
    hide_top_toolbar: "false",
    hide_legend: "false",
    save_image: "false",
    calendar: "false",
    allow_symbol_change: "true",
    autosize: "true",
    height
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

function getTradingViewSymbol(ticker) {
  const clean = normalizeDisplayTicker(ticker);
  const cryptoMap = {
    BTCUSD: "BINANCE:BTCUSDT",
    ETHUSD: "BINANCE:ETHUSDT",
    SOLUSD: "BINANCE:SOLUSDT",
    XRPUSD: "BINANCE:XRPUSDT",
    DOGEUSD: "BINANCE:DOGEUSDT",
    ADAUSD: "BINANCE:ADAUSDT",
    AVAXUSD: "BINANCE:AVAXUSDT",
    LINKUSD: "BINANCE:LINKUSDT",
    MATICUSD: "BINANCE:MATICUSDT",
    LTCUSD: "BINANCE:LTCUSDT",
    SHIBUSD: "BINANCE:SHIBUSDT",
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    SHIB: "BINANCE:SHIBUSDT"
  };
  if (cryptoMap[clean]) return cryptoMap[clean];

  const exchangeMap = {
    SPX: "SP",
    SPY: "AMEX", QQQ: "NASDAQ", IWM: "AMEX", DIA: "AMEX", RSP: "AMEX", MDY: "AMEX",
    XLK: "AMEX", XLC: "AMEX", XLY: "AMEX", XLP: "AMEX", XLF: "AMEX", XLE: "AMEX", XLV: "AMEX", XLI: "AMEX", XLB: "AMEX", XLU: "AMEX", XLRE: "AMEX",
    SMH: "NASDAQ", SOXX: "NASDAQ", KRE: "AMEX", XBI: "AMEX", IBB: "NASDAQ", XRT: "AMEX", IYT: "AMEX", TAN: "AMEX", ICLN: "NASDAQ",
    GLD: "AMEX", SLV: "AMEX", USO: "AMEX", UNG: "AMEX", DBA: "AMEX", TLT: "NASDAQ", IEF: "NASDAQ", SHY: "NASDAQ", HYG: "AMEX", LQD: "AMEX",
    EFA: "AMEX", EEM: "AMEX", EWJ: "AMEX", EWZ: "AMEX", INDA: "AMEX", FXI: "AMEX", KWEB: "AMEX",
    XOM: "NYSE", CVX: "NYSE", SLB: "NYSE", OXY: "NYSE", HAL: "NYSE", COP: "NYSE", FCX: "NYSE", NEM: "NYSE", VALE: "NYSE", RIO: "NYSE",
    JPM: "NYSE", BAC: "NYSE", WFC: "NYSE", GS: "NYSE", MS: "NYSE", C: "NYSE", SCHW: "NYSE", AXP: "NYSE", V: "NYSE", MA: "NYSE",
    UNH: "NYSE", LLY: "NYSE", JNJ: "NYSE", ABBV: "NYSE", PFE: "NYSE", MRK: "NYSE", TMO: "NYSE", BA: "NYSE", CAT: "NYSE", DE: "NYSE", GE: "NYSE", LMT: "NYSE", RTX: "NYSE", NOC: "NYSE", UPS: "NYSE", FDX: "NYSE",
    SHOP: "NYSE", SNOW: "NYSE", ORCL: "NYSE", SAP: "NYSE", TSM: "NYSE", ASML: "NASDAQ", SQ: "NYSE", UBER: "NYSE", DIS: "NYSE", NKE: "NYSE", WMT: "NYSE", TGT: "NYSE", HD: "NYSE", LOW: "NYSE", MCD: "NYSE", SBUX: "NASDAQ", BABA: "NYSE", JD: "NASDAQ", PDD: "NASDAQ", NIO: "NYSE", LI: "NASDAQ", TM: "NYSE",
    MSTR: "NASDAQ", COIN: "NASDAQ", GLXY: "NASDAQ", SQ: "NYSE", HOOD: "NASDAQ", PYPL: "NASDAQ", IREN: "NASDAQ", MARA: "NASDAQ", RIOT: "NASDAQ", CLSK: "NASDAQ", CIFR: "NASDAQ", WULF: "NASDAQ", BTDR: "NASDAQ", FUFU: "NASDAQ", HUT: "NASDAQ", BITF: "NASDAQ", BTBT: "NASDAQ", HIVE: "NASDAQ", CORZ: "NASDAQ", CAN: "NASDAQ", SDIG: "NASDAQ",
    IBIT: "NASDAQ", FBTC: "AMEX", GBTC: "AMEX", BITO: "AMEX", ARKB: "AMEX", BITB: "AMEX", HODL: "AMEX", BRRR: "NASDAQ", EZBC: "AMEX", BTCW: "AMEX", BITX: "AMEX", BITU: "AMEX", MSTU: "NASDAQ", MSTX: "NASDAQ", MSBT: "NASDAQ", MSTY: "AMEX",
    BLOK: "AMEX", BKCH: "NASDAQ", BITQ: "AMEX", WGMI: "NASDAQ"
  };
  const exchange = exchangeMap[clean] || "NASDAQ";
  return `${exchange}:${clean}`;
}

function normalizeDisplayTicker(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  const aliases = {
    BTC: "BTCUSD",
    ETH: "ETHUSD",
    SOL: "SOLUSD",
    XRP: "XRPUSD",
    DOGE: "DOGEUSD",
    ADA: "ADAUSD",
    AVAX: "AVAXUSD",
    LINK: "LINKUSD",
    MATIC: "MATICUSD",
    LTC: "LTCUSD",
    SHIB: "SHIBUSD"
  };
  return aliases[clean] || clean;
}

function renderChartSurface(data) {
  const ticker = data.ticker || state.chart.ticker;
  const interval = state.chart.interval || "15";
  const symbol = getTradingViewSymbol(ticker);
  const src = getTradingViewEmbedUrl(symbol, "640", interval);
  const overlay = renderChartOverlay(data);
  const panel = renderChartSignalPanel(data);
  if (chartToolbar) {
    chartToolbar.querySelectorAll("[data-chart-interval]").forEach((button) => {
      button.classList.toggle("active", button.dataset.chartInterval === interval);
    });
  }

  return `
    <div class="chart-surface">
      <div class="chart-stage">
        <div class="chart-viewer">
          <iframe title="${escapeAttr(ticker)} live moving chart" src="${escapeAttr(src)}" loading="lazy" allowfullscreen></iframe>
          ${overlay}
        </div>
        <div class="chart-legend">${renderChartLegend(data.legend || [])}</div>
      </div>
      <aside class="chart-signal-panel">
        ${panel}
      </aside>
    </div>
  `;
}

function renderChartOverlay(data) {
  const levels = Array.isArray(data.levels) ? data.levels : [];
  const range = data.chart_range || {};
  const min = Number(range.min);
  const max = Number(range.max);
  if (!levels.length || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return `<div class="chart-overlay chart-overlay-empty">No active signal overlay for this ticker.</div>`;
  }

  const lines = levels.map((level) => {
    const top = Math.max(2, Math.min(98, ((max - Number(level.price)) / (max - min)) * 100));
    return `
      <div class="overlay-line ${escapeAttr(level.tone || level.key)}" style="top:${top}%">
        <span>${escapeHtml(level.label)} ${fmt(level.price)}</span>
      </div>
    `;
  }).join("");

  const badges = [];
  if (data.signal?.final_decision) badges.push(`<span class="overlay-badge ${escapeAttr(data.signal.final_decision)}">${escapeHtml(data.signal.final_decision)}</span>`);
  if (data.signal?.bull_run_flag) badges.push(`<span class="overlay-badge bull">Bull Run</span>`);
  if (data.signal?.expired_flag) badges.push(`<span class="overlay-badge expired">Expired</span>`);
  if (data.signal?.bias) badges.push(`<span class="overlay-badge bias">${escapeHtml(data.signal.bias)}</span>`);

  return `
    <div class="chart-overlay">
      <div class="overlay-badges">${badges.join("")}</div>
      ${lines}
    </div>
  `;
}

function renderChartLegend(items) {
  if (!items.length) return `<span class="small">No overlay legend yet.</span>`;
  return items.map((item) => `<span class="legend-item ${escapeAttr(item.key)}">${escapeHtml(item.label)}</span>`).join("");
}

function renderChartSignalPanel(data) {
  const signal = data.signal;
  if (!signal) {
    return `
      <div class="chart-panel-empty">
        <h3>${escapeHtml(data.ticker || "")}</h3>
        <p>No active signal yet.</p>
        <p class="small">The chart is still live. Use it for research, but there is no current trade plan drawn right now.</p>
      </div>
    `;
  }
  const timing = getTimingProfile(data.execution_plan || signal);

  return `
    <div class="chart-panel-head">
      <p class="eyebrow">Decision Box</p>
      <h3>${escapeHtml(signal.ticker)}</h3>
      <span class="decision ${escapeAttr(timing.badgeClass)}">${escapeHtml(timing.actionLabel)}</span>
    </div>
    <div class="chart-panel-grid">
      <div><span>System decision</span><strong>${escapeHtml(signal.final_decision || "-")}</strong></div>
      <div><span>Timing</span><strong>${escapeHtml(timing.label)}</strong></div>
      <div><span>Mode</span><strong>${escapeHtml(signal.mode || data.mode || "")}</strong></div>
      <div><span>Asset</span><strong>${escapeHtml(getAssetLabel(signal.asset_class || data.asset_class || ""))}</strong></div>
      <div><span>Entry</span><strong>${formatFieldValue(signal.entry)}</strong></div>
      <div><span>Stop</span><strong>${formatFieldValue(signal.stop)}</strong></div>
      <div><span>Target 1</span><strong>${formatFieldValue(signal.target1)}</strong></div>
      <div><span>Target 2</span><strong>${formatFieldValue(signal.target2)}</strong></div>
      <div><span>Trend</span><strong>${escapeHtml(signal.trend_label || "-")}</strong></div>
      <div><span>Momentum</span><strong>${fmt(signal.momentum_score)}</strong></div>
      <div><span>Confidence</span><strong>${fmt(signal.confidence)}</strong></div>
      <div><span>Quality</span><strong>${fmt(signal.final_quality_score)}</strong></div>
    </div>
    <div class="next-step-note">
      <strong>What to do now:</strong>
      <span>${escapeHtml(timing.guidance)}</span>
    </div>
    <p class="chart-summary">${escapeHtml(signal.momentum_reason || signal.webull_summary || "")}</p>
    <div class="copy-row">
      ${buttonChart("Open chart", signal.ticker, signal.mode || data.mode || "")}
      ${buttonCopy("Webull", signal.webull_summary)}
      ${buttonCopy("Ticker", signal.ticker)}
      ${buttonCopy("Signal ID", signal.signal_id)}
    </div>
  `;
}

async function sendTestAlert() {
  showMessage("Sending test alert...");
  try {
    const response = await fetch("/alerts/test", { method: "POST" });
    if (!response.ok) throw new Error("Test alert failed.");
    await loadView();
    showMessage("Test alert sent successfully.");
  } catch (error) {
    showMessage(error.message || "Test alert failed.", true);
  }
}

async function runFreshScan(mode = "all", options = {}) {
  if (!state.powerOn) {
    showMessage("Power the system on before running a live scan.", true);
    return;
  }
  const scanMode = typeof mode === "string" ? mode : "all";
  const triggerButton = options.triggerButton || null;
  const releaseBusy = setButtonBusy(triggerButton, `Scanning ${scanMode}...`);
  showMessage(`Running a fresh ${scanMode} scan. This can take a moment because it calls live market data and ChatGPT...`);
  try {
    const response = await fetch("/scan/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode: scanMode })
    });

    if (!response.ok) throw new Error("Fresh scan failed.");
    await response.json();
    await loadView();
    showMessage(`Fresh ${scanMode} scan finished.`);
  } catch (error) {
    showMessage(error.message || `Fresh ${scanMode} scan failed.`, true);
  } finally {
    releaseBusy();
  }
}

async function testAiBrain() {
  if (!state.powerOn) {
    showMessage("Power the system on before testing ChatGPT.", true);
    return;
  }
  const result = document.querySelector("#ai-test-result");
  if (result) {
    result.textContent = "Testing ChatGPT connection...";
    result.classList.remove("hidden", "error");
  }

  const response = await fetch("/api/ai/test", { method: "POST" });
  if (!response.ok) throw new Error("AI brain test failed.");
  const data = await response.json();

  if (result) {
    result.textContent = data.test_ok
      ? `Connected: ${data.test_response || "AI brain online"}`
      : `Not connected: ${data.test_error || "OpenAI test failed."}`;
    result.classList.toggle("error", !data.test_ok);
    result.classList.remove("hidden");
  }
}

async function getJson(path, options = {}) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  const data = await response.json();
  return data;
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
  message.classList.remove("hidden");
}

function hideMessage() {
  message.classList.add("hidden");
}

function renderStaticAction(labelText) {
  return `<span class="static-action" aria-hidden="true">${escapeHtml(labelText)}</span>`;
}

function setButtonBusy(button, pendingText = "Working...") {
  if (!button || typeof button !== "object") return () => {};
  const originalText = button.textContent;
  button.disabled = true;
  button.dataset.busy = "true";
  button.textContent = pendingText;
  return () => {
    button.disabled = false;
    button.removeAttribute("data-busy");
    button.textContent = originalText;
  };
}

async function copyToClipboard(button, value, label = "value") {
  const text = String(value ?? "").trim();
  if (!text) {
    showMessage(`No ${label.toLowerCase()} is available to copy yet.`, true);
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const releaseBusy = setButtonBusy(button, "Copied");
      window.setTimeout(releaseBusy, 900);
    }
    showMessage(`Copied ${label}.`);
    return true;
  } catch (error) {
    showMessage(error.message || `Could not copy ${label.toLowerCase()}.`, true);
    return false;
  }
}

function fmt(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value === null || value === undefined ? "" : String(value);
  return Math.abs(number) >= 100 ? number.toFixed(2) : number.toFixed(3).replace(/\.?0+$/, "");
}

function label(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function option(value, labelText) {
  return `<option value="${value}" ${state.signals.sort === value ? "selected" : ""}>${labelText}</option>`;
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(Number(value) > 10_000_000_000 ? Number(value) : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function simpleValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
