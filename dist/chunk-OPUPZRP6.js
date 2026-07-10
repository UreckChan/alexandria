#!/usr/bin/env node

// src/core/stats.ts
import fs from "fs";
import path from "path";
var charsToTokens = (chars) => Math.round(chars / 4);
function logInjection(vault, line) {
  try {
    fs.mkdirSync(vault.cache, { recursive: true });
    fs.appendFileSync(
      path.join(vault.cache, "stats.jsonl"),
      JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), ...line }) + "\n"
    );
  } catch {
  }
}
function readStats(vault) {
  const file = path.join(vault.cache, "stats.jsonl");
  const summary = {
    injections: 0,
    solutionCacheHits: 0,
    injectedTokens: 0,
    estimatedSavedTokens: 0
  };
  try {
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      if (!raw.trim()) continue;
      try {
        const line = JSON.parse(raw);
        summary.injections++;
        if (line.kind === "solution-cache") summary.solutionCacheHits++;
        summary.injectedTokens += charsToTokens(line.injectedChars);
      } catch {
      }
    }
  } catch {
  }
  summary.estimatedSavedTokens = summary.injectedTokens * 9;
  return summary;
}

export {
  logInjection,
  readStats
};
