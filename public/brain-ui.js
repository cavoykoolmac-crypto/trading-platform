(function () {
  "use strict";

  const css = `
    #brain-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.78);
      z-index: 9999;
      align-items: center;
      justify-content: center;
    }
    #brain-overlay.active { display: flex; }
    #brain-modal {
      background: #0f1117;
      border: 1px solid #2a2d3a;
      border-radius: 10px;
      width: min(560px, 94vw);
      max-height: 80vh;
      overflow-y: auto;
      padding: 24px;
      position: relative;
      font-family: inherit;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    }
    #brain-modal h3 {
      margin: 0 0 14px;
      font-size: 15px;
      color: #e2e8f0;
      letter-spacing: 0.03em;
    }
    #brain-modal .brain-ticker-badge {
      display: inline-block;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 5px;
      padding: 2px 10px;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 14px;
    }
    #brain-modal .brain-verdict {
      font-size: 13.5px;
      line-height: 1.7;
      color: #cbd5e1;
      white-space: pre-wrap;
      background: #1a1f2e;
      border-radius: 7px;
      padding: 14px 16px;
      border-left: 3px solid #38bdf8;
    }
    #brain-modal .brain-verdict.verdict-buy { border-left-color: #22c55e; }
    #brain-modal .brain-verdict.verdict-skip { border-left-color: #ef4444; }
    #brain-modal .brain-verdict.verdict-wait { border-left-color: #f59e0b; }
    #brain-modal .brain-verdict.verdict-hold { border-left-color: #38bdf8; }
    #brain-modal .brain-verdict.verdict-exit { border-left-color: #ef4444; }
    #brain-modal .brain-verdict.verdict-scale { border-left-color: #f59e0b; }
    #brain-modal .brain-meta {
      margin-top: 10px;
      font-size: 11px;
      color: #64748b;
    }
    #brain-modal .brain-loading {
      color: #64748b;
      font-size: 13px;
      padding: 20px 0;
      text-align: center;
      animation: brain-pulse 1.2s ease-in-out infinite;
    }
    @keyframes brain-pulse { 0%,100% { opacity:0.4 } 50% { opacity:1 } }
    #brain-modal .brain-error {
      color: #f87171;
      font-size: 13px;
      padding: 12px;
      background: #1f0e0e;
      border-radius: 6px;
    }
    #brain-modal-close {
      position: absolute;
      top: 14px;
      right: 16px;
      background: none;
      border: none;
      color: #64748b;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    #brain-modal-close:hover { color: #e2e8f0; background: #1e293b; }
    .brain-exit-form { margin-bottom: 14px; }
    .brain-exit-form label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .brain-exit-form input {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 5px;
      color: #e2e8f0;
      font-size: 13px;
      padding: 7px 10px;
      margin-bottom: 8px;
      box-sizing: border-box;
      outline: none;
    }
    .brain-exit-form input:focus { border-color: #38bdf8; }
    .brain-exit-form button {
      background: #1d4ed8;
      color: #fff;
      border: none;
      border-radius: 5px;
      padding: 8px 18px;
      font-size: 13px;
      cursor: pointer;
      width: 100%;
      font-weight: 600;
    }
    .brain-exit-form button:hover { background: #2563eb; }
    #brain-briefing-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid #312e81;
      border-radius: 9px;
      padding: 16px 20px;
      margin-bottom: 18px;
      position: relative;
    }
    #brain-briefing-banner h4 {
      margin: 0 0 10px;
      font-size: 12px;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    #brain-briefing-text {
      font-size: 13px;
      color: #c7d2fe;
      line-height: 1.65;
      white-space: pre-wrap;
    }
    #brain-briefing-banner .briefing-loading {
      color: #4f46e5;
      font-size: 12px;
      animation: brain-pulse 1.2s infinite;
    }
    #brain-briefing-dismiss {
      position: absolute;
      top: 10px;
      right: 12px;
      background: none;
      border: none;
      color: #4f46e5;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 5px;
    }
    #brain-briefing-dismiss:hover { color: #818cf8; }
    .brain-take-btn {
      background: #14532d;
      color: #86efac;
      border: 1px solid #166534;
      border-radius: 4px;
      padding: 3px 9px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
      white-space: nowrap;
    }
    .brain-take-btn:hover { background: #166534; }
    .brain-grade-btn {
      background: #1e1b4b;
      color: #a5b4fc;
      border: 1px solid #312e81;
      border-radius: 4px;
      padding: 3px 9px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .brain-grade-btn:hover { background: #312e81; }
    #brain-exit-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 28px;
      padding: 12px 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(124,58,237,0.5);
      z-index: 9000;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: transform 0.15s;
    }
    #brain-exit-fab:hover { transform: scale(1.04); background: #6d28d9; }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const overlayEl = document.createElement("div");
  overlayEl.id = "brain-overlay";
  overlayEl.innerHTML = `
    <div id="brain-modal">
      <button id="brain-modal-close" title="Close">✕</button>
      <div id="brain-modal-content"></div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  document.getElementById("brain-modal-close").addEventListener("click", closeModal);
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) closeModal();
  });

  function openModal(html) {
    document.getElementById("brain-modal-content").innerHTML = html;
    overlayEl.classList.add("active");
  }

  function closeModal() {
    overlayEl.classList.remove("active");
  }

  const fabEl = document.createElement("button");
  fabEl.id = "brain-exit-fab";
  fabEl.innerHTML = "⬡ Exit Advisor";
  fabEl.title = "Get AI exit advice for an open position";
  fabEl.addEventListener("click", openExitAdvisor);
  document.body.appendChild(fabEl);

  function openExitAdvisor(prefill = {}) {
    openModal(`
      <h3>⬡ Exit Advisor</h3>
      <p style="font-size:12px;color:#64748b;margin:0 0 14px;">
        Enter your open position details to get AI advice: HOLD, SCALE OUT, or EXIT NOW.
      </p>
      <div class="brain-exit-form">
        <label>Ticker</label>
        <input id="exit-ticker" type="text" placeholder="e.g. AAPL" value="${prefill.ticker || ""}" />
        <label>Your Entry Price ($)</label>
        <input id="exit-entry" type="number" step="0.01" placeholder="e.g. 190.25" value="${prefill.entry || ""}" />
        <label>Shares Held (optional)</label>
        <input id="exit-shares" type="number" step="1" placeholder="e.g. 10" value="${prefill.shares || ""}" />
        <label>Your Stop Price (optional)</label>
        <input id="exit-stop" type="number" step="0.01" placeholder="e.g. 187.00" value="${prefill.stop || ""}" />
        <label>Target 1 (optional)</label>
        <input id="exit-target1" type="number" step="0.01" placeholder="e.g. 194.00" value="${prefill.target1 || ""}" />
        <br/>
        <button id="exit-submit-btn">Get Exit Advice</button>
      </div>
      <div id="exit-result"></div>
    `);

    document.getElementById("exit-submit-btn").addEventListener("click", async () => {
      const ticker = document.getElementById("exit-ticker").value.trim().toUpperCase();
      const entryPrice = parseFloat(document.getElementById("exit-entry").value);
      const shares = parseFloat(document.getElementById("exit-shares").value) || 0;
      const stop = parseFloat(document.getElementById("exit-stop").value) || 0;
      const target1 = parseFloat(document.getElementById("exit-target1").value) || 0;

      if (!ticker || !entryPrice) {
        document.getElementById("exit-result").innerHTML = `<div class="brain-error">Please enter a ticker and entry price.</div>`;
        return;
      }

      document.getElementById("exit-result").innerHTML = `<div class="brain-loading">Checking live price and position...</div>`;

      try {
        const response = await fetch("/api/ai/exit-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, entry_price: entryPrice, shares, stop, target1 })
        });
        const data = await response.json();

        if (!data.ok) {
          document.getElementById("exit-result").innerHTML = `<div class="brain-error">${escHtml(data.error || "Exit check failed.")}</div>`;
          return;
        }

        const verdictClass = getVerdictClass(data.verdict);
        const pnlLabel = data.dollar_pnl != null ? `$${data.dollar_pnl > 0 ? "+" : ""}${data.dollar_pnl.toFixed(2)}` : "";
        const pnlColor = data.pnl_pct > 0 ? "#22c55e" : data.pnl_pct < 0 ? "#ef4444" : "#94a3b8";

        document.getElementById("exit-result").innerHTML = `
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">
            ${escHtml(ticker)} · Live: <strong style="color:#e2e8f0">$${data.live_price?.toFixed(2) ?? "—"}</strong>
            · Entry: $${data.entry_price?.toFixed(2) ?? "—"}
            · P&L: <strong style="color:${pnlColor}">${data.pnl_pct > 0 ? "+" : ""}${data.pnl_pct?.toFixed(2) ?? "—"}%${pnlLabel ? ` (${pnlLabel})` : ""}</strong>
          </div>
          <div class="brain-verdict ${verdictClass}">${escHtml(data.verdict)}</div>
          <div class="brain-meta">AI exit analysis · ${new Date(data.createdAt).toLocaleTimeString()}</div>
        `;
      } catch (error) {
        document.getElementById("exit-result").innerHTML = `<div class="brain-error">Request failed: ${escHtml(error.message)}</div>`;
      }
    });
  }

  async function injectMorningBriefing() {
    const target = document.querySelector("main") || document.querySelector(".panel") || document.body;
    const bannerEl = document.createElement("div");
    bannerEl.id = "brain-briefing-banner";
    bannerEl.innerHTML = `
      <button id="brain-briefing-dismiss" title="Dismiss">✕</button>
      <h4>📋 Today's Game Plan</h4>
      <div id="brain-briefing-text" class="briefing-loading">Loading morning briefing...</div>
    `;
    target.insertBefore(bannerEl, target.firstChild);

    document.getElementById("brain-briefing-dismiss").addEventListener("click", () => {
      bannerEl.remove();
    });

    try {
      const response = await fetch("/api/ai/morning-briefing");
      const data = await response.json();

      if (!data.ok || !data.briefing) {
        document.getElementById("brain-briefing-text").textContent = data.error || "Briefing unavailable — run a scan first.";
        document.getElementById("brain-briefing-text").style.color = "#64748b";
        return;
      }

      document.getElementById("brain-briefing-text").textContent = data.briefing;
    } catch {
      document.getElementById("brain-briefing-text").textContent = "Could not load briefing. Is the server running?";
      document.getElementById("brain-briefing-text").style.color = "#64748b";
    }
  }

  function injectTakeButtons() {
    const tables = document.querySelectorAll("table");

    tables.forEach((table) => {
      const headerRow = table.querySelector("thead tr");
      if (!headerRow) return;

      const headers = [...headerRow.querySelectorAll("th")].map((th) => th.textContent.trim().toLowerCase());
      const tickerIdx = headers.indexOf("ticker");
      if (tickerIdx === -1) return;
      if (headers.includes("ai")) return;

      const aiTh = document.createElement("th");
      aiTh.textContent = "AI";
      aiTh.style.cssText = "color:#38bdf8;white-space:nowrap;";
      headerRow.appendChild(aiTh);

      const bodyRows = table.querySelectorAll("tbody tr");
      bodyRows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length <= tickerIdx) return;
        const ticker = cells[tickerIdx]?.textContent?.trim().toUpperCase();
        if (!ticker || ticker.length > 10) return;

        const td = document.createElement("td");
        const btn = document.createElement("button");
        btn.className = "brain-take-btn";
        btn.textContent = "Take?";
        btn.title = `Ask AI: Should I take this ${ticker} trade?`;
        btn.addEventListener("click", () => askShouldITake(ticker));
        td.appendChild(btn);
        row.appendChild(td);
      });
    });
  }

  async function askShouldITake(ticker) {
    openModal(`
      <div class="brain-ticker-badge">${escHtml(ticker)}</div>
      <h3>Should I take this trade?</h3>
      <div class="brain-loading">Checking live price and signal...</div>
    `);

    try {
      const response = await fetch("/api/ai/trade-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker })
      });
      const data = await response.json();

      if (!data.ok) {
        document.getElementById("brain-modal-content").innerHTML = `
          <div class="brain-ticker-badge">${escHtml(ticker)}</div>
          <h3>Should I take this trade?</h3>
          <div class="brain-error">${escHtml(data.error || "Check failed.")}</div>
          <div class="brain-meta" style="margin-top:10px;">Run a scan first so the AI has a signal to evaluate.</div>
        `;
        return;
      }

      const verdictClass = getVerdictClass(data.verdict);
      const distLabel = data.distance_from_entry_pct != null
        ? `${data.distance_from_entry_pct > 0 ? "+" : ""}${data.distance_from_entry_pct}% from entry`
        : "";

      document.getElementById("brain-modal-content").innerHTML = `
        <div class="brain-ticker-badge">${escHtml(ticker)}</div>
        <h3>Should I take this trade?</h3>
        <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
          Live price: <strong style="color:#e2e8f0">$${data.live_price?.toFixed(2) ?? "—"}</strong>
          · Entry: ${escHtml(data.entry ?? "—")}
          ${distLabel ? `· <span style="color:${Math.abs(parseFloat(data.distance_from_entry_pct)) < 0.5 ? "#22c55e" : "#f59e0b"}">${distLabel}</span>` : ""}
        </div>
        <div class="brain-verdict ${verdictClass}">${escHtml(data.verdict)}</div>
        <div class="brain-meta">
          Stop: ${escHtml(data.stop ?? "—")} · Target 1: ${escHtml(data.target1 ?? "—")}
          · Analyzed ${new Date(data.createdAt).toLocaleTimeString()}
        </div>
        <div style="margin-top:14px;">
          <button class="brain-take-btn" onclick="document.getElementById('brain-exit-fab').click()">⬡ Track this position</button>
        </div>
      `;
    } catch (error) {
      document.getElementById("brain-modal-content").innerHTML = `
        <div class="brain-ticker-badge">${escHtml(ticker)}</div>
        <h3>Should I take this trade?</h3>
        <div class="brain-error">Request failed: ${escHtml(error.message)}</div>
      `;
    }
  }

  function injectGradeButtons() {
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      const headerRow = table.querySelector("thead tr");
      if (!headerRow) return;

      const headers = [...headerRow.querySelectorAll("th")].map((header) => header.textContent.trim().toLowerCase());
      const hasOutcome = headers.some((header) => header.includes("outcome") || header.includes("pnl"));
      if (!hasOutcome) return;
      if (headers.includes("grade")) return;

      const tickerIdx = headers.indexOf("ticker");
      const outcomeIdx = headers.findIndex((header) => header.includes("outcome"));
      if (tickerIdx === -1) return;

      const gradeTh = document.createElement("th");
      gradeTh.textContent = "Grade";
      gradeTh.style.color = "#818cf8";
      headerRow.appendChild(gradeTh);

      const bodyRows = table.querySelectorAll("tbody tr");
      bodyRows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        const ticker = cells[tickerIdx]?.textContent?.trim().toUpperCase();
        const outcome = outcomeIdx >= 0 ? cells[outcomeIdx]?.textContent?.trim() : "";
        const td = document.createElement("td");

        if (ticker && ["win", "loss", "breakeven"].includes(outcome)) {
          const btn = document.createElement("button");
          btn.className = "brain-grade-btn";
          btn.textContent = "Grade";
          btn.addEventListener("click", () => gradeThisTrade(ticker, outcome));
          td.appendChild(btn);
        }

        row.appendChild(td);
      });
    });
  }

  async function gradeThisTrade(ticker, outcome) {
    openModal(`
      <div class="brain-ticker-badge">${escHtml(ticker)}</div>
      <h3>Trade Grade</h3>
      <div class="brain-loading">Analyzing your trade...</div>
    `);

    try {
      const response = await fetch("/api/ai/grade-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, outcome })
      });
      const data = await response.json();

      if (!data.ok) {
        document.getElementById("brain-modal-content").innerHTML = `
          <div class="brain-ticker-badge">${escHtml(ticker)}</div>
          <h3>Trade Grade</h3>
          <div class="brain-error">${escHtml(data.error || "Grade failed.")}</div>
        `;
        return;
      }

      const gradeColor = { A: "#22c55e", B: "#86efac", C: "#f59e0b", D: "#fb923c", F: "#ef4444" };
      const gradeMatch = data.grade?.match(/GRADE:\s*([A-F])/i);
      const letter = gradeMatch?.[1]?.toUpperCase() || "?";
      const color = gradeColor[letter] || "#94a3b8";

      document.getElementById("brain-modal-content").innerHTML = `
        <div class="brain-ticker-badge">${escHtml(ticker)}</div>
        <h3>Trade Grade · <span style="color:${color};font-size:20px;">${escHtml(letter)}</span></h3>
        <div class="brain-verdict" style="border-left-color:${color}">${escHtml(data.grade)}</div>
        <div class="brain-meta">
          Outcome: ${escHtml(outcome)}
          ${data.pnl_pct != null ? ` · P&L: ${data.pnl_pct > 0 ? "+" : ""}${data.pnl_pct.toFixed(2)}%` : ""}
          · Graded ${new Date(data.createdAt).toLocaleTimeString()}
        </div>
      `;
    } catch (error) {
      document.getElementById("brain-modal-content").innerHTML = `
        <div class="brain-ticker-badge">${escHtml(ticker)}</div>
        <h3>Trade Grade</h3>
        <div class="brain-error">Request failed: ${escHtml(error.message)}</div>
      `;
    }
  }

  function getVerdictClass(text) {
    const upper = String(text || "").toUpperCase();
    if (upper.includes("BUY NOW")) return "verdict-buy";
    if (upper.includes("SKIP")) return "verdict-skip";
    if (upper.includes("WAIT")) return "verdict-wait";
    if (upper.includes("EXIT NOW")) return "verdict-exit";
    if (upper.includes("SCALE OUT")) return "verdict-scale";
    if (upper.includes("HOLD")) return "verdict-hold";
    return "";
  }

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init() {
    injectMorningBriefing();
    setTimeout(() => {
      injectTakeButtons();
      injectGradeButtons();
    }, 1500);
    setTimeout(() => {
      injectTakeButtons();
      injectGradeButtons();
    }, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
