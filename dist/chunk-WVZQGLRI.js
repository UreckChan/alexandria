#!/usr/bin/env node
import {
  currentHarness,
  defaultOutput,
  formatContext,
  normalizeInput
} from "./chunk-YICWI3U3.js";

// src/hooks/util.ts
import fs from "fs";
import os from "os";
import path from "path";
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
var expired = false;
var emitted = false;
function emitContext(kind, text) {
  if (expired) return 0;
  const out = formatContext(currentHarness(), kind, text);
  if (out === null) return 0;
  process.stdout.write(out);
  emitted = true;
  return text.length;
}
function logHookError(kind, detail) {
  try {
    const dir = process.platform === "win32" && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "alexandria") : path.join(os.homedir(), ".cache", "alexandria");
    const file = path.join(dir, "hook-errors.log");
    fs.mkdirSync(dir, { recursive: true });
    try {
      if (fs.statSync(file).size > 256 * 1024) fs.rmSync(file, { force: true });
    } catch {
    }
    fs.appendFileSync(file, `${(/* @__PURE__ */ new Date()).toISOString()}	${kind}	${detail.slice(0, 500)}
`);
  } catch {
  }
}
function runHook(budgetMs, body, kind = "stop") {
  process.env.ALEXANDRIA_HOOK = "1";
  const cleanup = async () => {
    try {
      const { disposeEmbedder } = await import("./embedder-7Z4XNL6H.js");
      await disposeEmbedder();
    } catch {
    }
  };
  const timer = setTimeout(() => {
    expired = true;
    logHookError("timeout", `presupuesto de ${budgetMs}ms agotado`);
    void cleanup();
  }, budgetMs);
  timer.unref();
  process.exitCode = 0;
  readStdinJson().then((raw) => body(normalizeInput(raw))).catch((e) => {
    logHookError("error", e instanceof Error ? `${e.message}
${e.stack ?? ""}` : String(e));
  }).finally(() => {
    clearTimeout(timer);
    const fallback = emitted ? null : defaultOutput(currentHarness(), kind);
    if (fallback) process.stdout.write(fallback);
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
  emitContext,
  runHook,
  projectName,
  truncate
};
