const brainState = {
  primary: "claude",
  claudeAvailable: true,
  claudeFailCount: 0,
  gptFailCount: 0,
  claudeLastFail: null,
  totalRequests: 0,
  claudeRequests: 0,
  gptRequests: 0,
  collabRequests: 0,
  lastProvider: null,
  lastSwitchReason: null,
  startedAt: new Date().toISOString(),
};

const CLAUDE_RETRY_MS = 10 * 60 * 1000;
const MAX_TOKENS = 1000;

export async function askBrain(prompt, context = "", mode = null) {
  const effectiveMode = mode || process.env.AI_MODE || "auto";
  brainState.totalRequests += 1;

  if (!brainState.claudeAvailable && brainState.claudeLastFail) {
    const elapsed = Date.now() - brainState.claudeLastFail;
    if (elapsed > CLAUDE_RETRY_MS) {
      brainState.claudeAvailable = true;
      brainState.claudeFailCount = 0;
    }
  }

  if (effectiveMode === "collab") return runCollabMode(prompt, context);
  if (effectiveMode === "claude") return runClaude(prompt, context);
  if (effectiveMode === "openai") return runGPT(prompt, context);
  return runAutoMode(prompt, context);
}

export function getBrainStatus() {
  return {
    ok: true,
    primary: brainState.primary,
    claude_available: brainState.claudeAvailable,
    claude_fail_count: brainState.claudeFailCount,
    gpt_fail_count: brainState.gptFailCount,
    total_requests: brainState.totalRequests,
    claude_requests: brainState.claudeRequests,
    gpt_requests: brainState.gptRequests,
    collab_requests: brainState.collabRequests,
    last_provider: brainState.lastProvider,
    last_switch_reason: brainState.lastSwitchReason,
    claude_retry_in_ms: brainState.claudeLastFail
      ? Math.max(0, CLAUDE_RETRY_MS - (Date.now() - brainState.claudeLastFail))
      : null,
    started_at: brainState.startedAt,
    anthropic_key_set: Boolean(process.env.ANTHROPIC_API_KEY),
    openai_key_set: Boolean(process.env.OPENAI_API_KEY),
    ai_mode: process.env.AI_MODE || "auto",
  };
}

async function runAutoMode(prompt, context) {
  if (brainState.claudeAvailable && process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await runClaude(prompt, context);
      brainState.primary = "claude";
      return result;
    } catch (err) {
      if (isClaudeQuotaError(err)) {
        brainState.claudeAvailable = false;
        brainState.claudeLastFail = Date.now();
        brainState.claudeFailCount += 1;
        brainState.lastSwitchReason = "Claude quota exhausted - switched to GPT";
        brainState.primary = "openai";
      } else {
        brainState.lastSwitchReason = "Claude error: " + err.message;
      }
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await runGPT(prompt, context);
      brainState.primary = "openai";
      return result;
    } catch (err) {
      brainState.gptFailCount += 1;
      throw new Error("Both Claude and GPT failed: " + err.message);
    }
  }

  throw new Error("No AI keys configured. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY in .env");
}

async function runCollabMode(prompt, context) {
  brainState.collabRequests += 1;
  const claudeAvail = brainState.claudeAvailable && Boolean(process.env.ANTHROPIC_API_KEY);
  const gptAvail = Boolean(process.env.OPENAI_API_KEY);

  if (!claudeAvail && !gptAvail) {
    throw new Error("No AI keys available for collab mode");
  }

  const [claudeResult, gptResult] = await Promise.allSettled([
    claudeAvail ? runClaude(prompt, context) : Promise.reject(new Error("Claude unavailable")),
    gptAvail ? runGPT(prompt, context) : Promise.reject(new Error("GPT unavailable")),
  ]);

  const claudeOk = claudeResult.status === "fulfilled";
  const gptOk = gptResult.status === "fulfilled";

  if (!claudeOk && !gptOk) throw new Error("Both AIs failed in collab mode");
  if (claudeOk && !gptOk) return { ...claudeResult.value, collab: false, note: "GPT unavailable - Claude only" };
  if (gptOk && !claudeOk) return { ...gptResult.value, collab: false, note: "Claude unavailable - GPT only" };

  return mergeCollabResults(claudeResult.value, gptResult.value);
}

function mergeCollabResults(claudeRes, gptRes) {
  const verdictPattern = /\b(BUY NOW|BUY|SELL|HOLD|WAIT|SKIP)\b/gi;
  const claudeText = claudeRes.response || "";
  const gptText = gptRes.response || "";
  const claudeVerdict = (claudeText.match(verdictPattern) || [])[0]?.toUpperCase();
  const gptVerdict = (gptText.match(verdictPattern) || [])[0]?.toUpperCase();
  const agree = Boolean(claudeVerdict && gptVerdict && claudeVerdict === gptVerdict);

  const mergedResponse = agree
    ? `BOTH AIs AGREE: ${claudeVerdict}\n\nClaude:\n${claudeText}\n\nGPT:\n${gptText}`
    : `AIs DISAGREE - use caution\n\nClaude says: ${claudeVerdict || "unclear"}\nGPT says: ${gptVerdict || "unclear"}\n\nClaude:\n${claudeText}\n\nGPT:\n${gptText}\n\nRecommendation: default to WAIT when they conflict.`;

  return {
    ok: true,
    response: mergedResponse,
    provider: "collab",
    claude_verdict: claudeVerdict || null,
    gpt_verdict: gptVerdict || null,
    agreement: agree,
    confidence_boost: agree ? "HIGH - both AIs aligned" : "LOW - AIs disagree, use caution",
    claude_tokens: claudeRes.tokens_used || null,
    gpt_tokens: gptRes.tokens_used || null,
    collab: true,
    timestamp: new Date().toISOString(),
  };
}

async function runClaude(prompt, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  brainState.claudeRequests += 1;
  brainState.lastProvider = "claude";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: MAX_TOKENS,
      system: buildTradingSystemPrompt(),
      messages: [
        {
          role: "user",
          content: context ? `${prompt}\n\nContext:\n${context}` : prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Claude HTTP ${response.status}`);
  }

  const text = data.content?.filter((block) => block.type === "text").map((block) => block.text).join("") || "";
  return {
    ok: true,
    response: text,
    provider: "claude",
    model: data.model || "claude-sonnet-4-6",
    tokens_used: data.usage?.output_tokens || null,
    tokens_input: data.usage?.input_tokens || null,
    timestamp: new Date().toISOString(),
  };
}

async function runGPT(prompt, context) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  brainState.gptRequests += 1;
  brainState.lastProvider = "openai";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildTradingSystemPrompt() },
        { role: "user", content: context ? `${prompt}\n\nContext:\n${context}` : prompt },
      ],
      max_completion_tokens: MAX_TOKENS,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `GPT HTTP ${response.status}`);
  }

  return {
    ok: true,
    response: data.choices?.[0]?.message?.content || "",
    provider: "openai",
    model: data.model || model,
    tokens_used: data.usage?.completion_tokens || null,
    tokens_input: data.usage?.prompt_tokens || null,
    timestamp: new Date().toISOString(),
  };
}

function buildTradingSystemPrompt() {
  return [
    "You are an expert day trading assistant helping a manual trader make better decisions.",
    "Lead with a clear verdict: BUY NOW, WAIT, SKIP, HOLD, SCALE OUT, or EXIT NOW.",
    "Use real numbers from the provided context and never invent indicator values.",
    "Keep responses under 200 words and be direct like a trading coach.",
    "Always include entry, stop loss, and first target if available.",
  ].join(" ");
}

function isClaudeQuotaError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("overloaded") ||
    msg.includes("529") ||
    msg.includes("too many requests") ||
    msg.includes("credit") ||
    msg.includes("usage limit")
  );
}
