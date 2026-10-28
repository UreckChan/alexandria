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
function logDocUse(vault, line) {
  try {
    fs.mkdirSync(vault.cache, { recursive: true });
    fs.appendFileSync(path.join(vault.cache, "stats.jsonl"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), kind: "doc", ...line }) + "\n");
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
    estSavedHigh: 0,
    docIngests: 0,
    docReads: 0,
    docTokensOriginal: 0,
    docTokensServed: 0
  };
  try {
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      if (!raw.trim()) continue;
      try {
        const line = JSON.parse(raw);
        if (line.kind === "doc") {
          const d = line;
          if (d.op === "ingest") summary.docIngests++;
          else summary.docReads++;
          summary.docTokensOriginal += d.tokensOriginal ?? 0;
          summary.docTokensServed += d.tokensServed ?? 0;
          continue;
        }
        const n = line.count ?? 1;
        summary.injections += n;
        const tk = line.tokens ?? charsToTokens(line.injectedChars);
        summary.injectedTokens += tk;
        if (line.kind === "solution-cache") {
          summary.solutionCacheHits += n;
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
  charsToTokens,
  logInjection,
  logDocUse,
  readStats
};
