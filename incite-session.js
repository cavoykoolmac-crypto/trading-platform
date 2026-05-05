import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import * as readline from "node:readline";

const SESSION_FILE = "./incite-session.json";

async function saveSession() {
  console.log("\nIncite Session Saver");
  console.log("─────────────────────────────────────");
  console.log("A browser window will open.");
  console.log("Log into Incite manually.");
  console.log("Once you see the chat page, come back here and press ENTER.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();
  await page.goto("https://app.inciteai.com/chat", {
    waitUntil: "domcontentloaded"
  });

  await waitForEnter("Logged in and can see the chat? Press ENTER to save session: ");

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const chatReady = await page
    .locator('textarea[placeholder*="stocks" i], textarea[placeholder*="crypto" i], textarea[placeholder*="message" i], div[contenteditable="true"]')
    .first()
    .isVisible()
    .catch(() => false);
  const stillBlocked = /sign in\b|log in\b/i.test(bodyText);

  if (!chatReady || stillBlocked) {
    throw new Error("Incite chat is not fully open in this browser yet. Wait until you can type into the real chat input, then run node incite-session.js again.");
  }

  const storageState = await context.storageState();
  await writeFile(SESSION_FILE, JSON.stringify(storageState, null, 2));

  console.log(`\nSaved session to ${SESSION_FILE}`);
  console.log("The Incite bridge will reuse this session automatically.");
  console.log("Re-run this script if you get logged out.\n");

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

saveSession().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
