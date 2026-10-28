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
function logFold(vault, line) {
  try {
    fs.mkdirSync(vault.cache, { recursive: true });
    fs.appendFileSync(path.join(vault.cache, "stats.jsonl"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), kind: "fold", ...line }) + "\n");
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
    docTokensServed: 0,
    folds: 0,
    foldTokensOriginal: 0,
    foldTokensServed: 0,
    dedupSavedTokens: 0
  };
  try {
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      if (!raw.trim()) continue;
      try {
        const line = JSON.parse(raw);
        if (line.kind === "fold") {
          const f = line;
          summary.folds++;
          summary.foldTokensOriginal += charsToTokens(f.originalChars ?? 0);
          summary.foldTokensServed += charsToTokens(f.servedChars ?? 0);
          continue;
        }
        if (line.kind === "doc") {
          const d = line;
          if (d.op === "ingest") summary.docIngests++;
          else summary.docReads++;
          summary.docTokensOriginal += d.tokensOriginal ?? 0;
          summary.docTokensServed += d.tokensServed ?? 0;
          continue;
        }
        const n = line.count ?? 1;
        if (line.dedupSkippedChars) summary.dedupSavedTokens += charsToTokens(line.dedupSkippedChars);
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
function readSessionUsage(vault) {
  const by = /* @__PURE__ */ new Map();
  let raw = "";
  try {
    raw = fs.readFileSync(path.join(vault.cache, "stats.jsonl"), "utf8");
  } catch {
    return [];
  }
  for (const l of raw.split("\n")) {
    if (!l.trim()) continue;
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (!o.session || o.t === "summary") continue;
    const u = by.get(o.session) ?? { session: o.session, first: o.t ?? "", last: o.t ?? "", injections: 0, injectedTokens: 0, dedupSavedTokens: 0, folds: 0, foldTokensOriginal: 0, foldTokensServed: 0, topNotes: [], notes: /* @__PURE__ */ new Map() };
    if (o.t && o.t < u.first) u.first = o.t;
    if (o.t && o.t > u.last) u.last = o.t;
    if (o.kind === "fold") {
      u.folds++;
      u.foldTokensOriginal += charsToTokens(o.originalChars ?? 0);
      u.foldTokensServed += charsToTokens(o.servedChars ?? 0);
    } else if (o.kind !== "doc") {
      u.injections++;
      u.injectedTokens += charsToTokens(o.injectedChars ?? 0);
      u.dedupSavedTokens += charsToTokens(o.dedupSkippedChars ?? 0);
      for (const r of o.rels ?? []) u.notes.set(r, (u.notes.get(r) ?? 0) + 1);
    }
    by.set(o.session, u);
  }
  return [...by.values()].map(({ notes, ...u }) => ({ ...u, topNotes: [...notes].sort((a, b) => b[1] - a[1]).slice(0, 5) })).sort((a, b) => b.last.localeCompare(a.last));
}

export {
  charsToTokens,
  logInjection,
  logDocUse,
  logFold,
  readStats,
  readSessionUsage
};
