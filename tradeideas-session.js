import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import * as readline from "node:readline";

const SESSION_FILE = new URL("./data/tradeideas-session.json", import.meta.url);
const LOGIN_URL = process.env.TRADE_IDEAS_SESSION_URL || "https://www.trade-ideas.com/";

async function saveTradeIdeasSession() {
  console.log("\nTrade Ideas Premium Session Saver");
  console.log("A browser window will open.");
  console.log("Log into your Trade Ideas premium account manually.");
  console.log("When your premium scanner or alerts page is visible, return here and press ENTER.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForEnter("Logged in and looking at your premium Trade Ideas page? Press ENTER to save session: ");

  const pageState = await inspectTradeIdeasPage(page);
  if (pageState.loginFormVisible) {
    console.log(`\nCurrent page title: ${pageState.title || "unknown"}`);
    console.log(`Current page url: ${pageState.url || "unknown"}`);
    throw new Error("Still seeing a visible login form. Finish login in the opened browser window first.");
  }

  await mkdir(new URL("./data/", import.meta.url), { recursive: true });
  const storageState = await context.storageState();
  await writeFile(SESSION_FILE, JSON.stringify(storageState, null, 2));

  console.log(`\nSaved from page: ${pageState.title || "unknown"}`);
  console.log(`Saved URL: ${pageState.url || "unknown"}`);
  console.log(`\nSaved Trade Ideas session to ${SESSION_FILE.pathname}`);
  console.log("The backend will use this saved session until it expires.\n");

  await browser.close();
}

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function inspectTradeIdeasPage(page) {
  return page.evaluate(() => {
    const title = document.title || "";
    const url = window.location.href || "";
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
    const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email" i], input[placeholder*="email" i]')).filter(visible);
    const loginButtons = Array.from(document.querySelectorAll("button, a, input[type='submit']")).filter((element) => {
      if (!visible(element)) return false;
      const text = (element.innerText || element.textContent || element.value || "").trim();
      return /^(sign in|log in|login|continue)$/i.test(text);
    });
    return {
      title,
      url,
      loginFormVisible: passwordInputs.length > 0 || (emailInputs.length > 0 && loginButtons.length > 0)
    };
  });
}

saveTradeIdeasSession().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
