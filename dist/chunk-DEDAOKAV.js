#!/usr/bin/env node

// src/hooks/util.ts
async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function runHook(budgetMs, body) {
  const cleanup = async () => {
    try {
      const { disposeEmbedder } = await import("./embedder-7Z4XNL6H.js");
      await disposeEmbedder();
    } catch {
    }
  };
  const timer = setTimeout(() => void cleanup(), budgetMs);
  timer.unref();
  process.exitCode = 0;
  readStdinJson().then((input) => body(input)).catch(() => {
  }).finally(() => {
    clearTimeout(timer);
    void cleanup();
  });
}
function projectName(cwd) {
  if (!cwd) return "general";
  return cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "general";
}
function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max) + " \u2026";
}

export {
  runHook,
  projectName,
  truncate
};
