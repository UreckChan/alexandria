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
var EST_LOW = 3;
var EST_HIGH = 8;
function readStats(vault) {
  const file = path.join(vault.cache, "stats.jsonl");
  const summary = {
    injections: 0,
    solutionCacheHits: 0,
    injectedTokens: 0,
    cacheHitTokens: 0,
    estSavedLow: 0,
    estSavedHigh: 0
  };
  try {
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      if (!raw.trim()) continue;
      try {
        const line = JSON.parse(raw);
        summary.injections++;
        const tk = charsToTokens(line.injectedChars);
        summary.injectedTokens += tk;
        if (line.kind === "solution-cache") {
          summary.solutionCacheHits++;
          summary.cacheHitTokens += tk;
        }
      } catch {
      }
    }
  } catch {
  }
  summary.estSavedLow = summary.injectedTokens * EST_LOW;
  summary.estSavedHigh = summary.injectedTokens * EST_HIGH;
  return summary;
}

export {
  logInjection,
  readStats
};
