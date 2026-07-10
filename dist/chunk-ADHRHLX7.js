#!/usr/bin/env node
import {
  VaultIndex
} from "./chunk-ZW7XY3EN.js";
import {
  dot,
  embed,
  modelPresent
} from "./chunk-EDYBSJSS.js";

// src/core/search.ts
import MiniSearch from "minisearch";
var RRF_K = 60;
var VEC_WEIGHT = 1.3;
var STOPWORDS = new Set(
  "de la que el en y a los del se las por un para con no una su al lo como mas m\xE1s pero sus le ya o este si s\xED porque esta entre cuando muy sin sobre tambi\xE9n me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto m\xED antes algunos qu\xE9 unos yo otro otras otra \xE9l tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros the a an and or but if of at by for with about to from in on is are was were be been being it its this that these those i you he she we they what which who whom how all any both each".split(" ")
);
function buildMini(idx) {
  const mini = new MiniSearch({
    fields: ["text", "title", "tags"],
    storeFields: [],
    idField: "id",
    processTerm: (term) => {
      const t = term.toLowerCase();
      return t.length < 2 || STOPWORDS.has(t) ? null : t;
    }
  });
  mini.addAll(
    idx.meta.chunks.map((c, i) => ({
      id: i,
      text: c.text,
      title: idx.meta.notes[c.note]?.title ?? "",
      tags: (idx.meta.notes[c.note]?.tags ?? []).join(" ")
    }))
  );
  return mini;
}
function recencyBoost(note) {
  if (!note?.created) return 1;
  const age = (Date.now() - Date.parse(note.created)) / 864e5;
  if (Number.isNaN(age)) return 1;
  const hits = Math.min(note.hits ?? 1, 10);
  return 1 + 0.15 * Math.exp(-Math.max(age, 0) / 45) + 0.02 * hits;
}
async function hybridSearch(vault, query, k = 6, opts = {}) {
  const idx = VaultIndex.load(vault);
  if (opts.refresh !== false) {
    await idx.refresh().catch(() => {
    });
  }
  if (idx.meta.chunks.length === 0) return [];
  const rrf = /* @__PURE__ */ new Map();
  const cosineByChunk = /* @__PURE__ */ new Map();
  if (idx.emb && modelPresent()) {
    try {
      const [q] = await embed([query], "query");
      const scored = [];
      for (let i = 0; i < idx.meta.chunks.length; i++) {
        scored.push({ i, s: dot(q, idx.row(i)) });
      }
      scored.sort((a, b) => b.s - a.s);
      scored.slice(0, 50).forEach(({ i, s }, rank) => {
        cosineByChunk.set(i, s);
        rrf.set(i, (rrf.get(i) ?? 0) + VEC_WEIGHT / (RRF_K + rank + 1));
      });
    } catch {
    }
  }
  const mini = buildMini(idx);
  const kwHits = mini.search(query, { fuzzy: 0.2, prefix: true });
  kwHits.slice(0, 50).forEach((h, rank) => {
    rrf.set(h.id, (rrf.get(h.id) ?? 0) + 1 / (RRF_K + rank + 1));
  });
  const byNote = /* @__PURE__ */ new Map();
  const ranked = [...rrf.entries()].sort((a, b) => b[1] - a[1]);
  for (const [chunkIdx, score] of ranked) {
    const chunk = idx.meta.chunks[chunkIdx];
    const note = idx.meta.notes[chunk.note];
    const boosted = score * recencyBoost(note);
    const entry = byNote.get(chunk.note) ?? { score: 0, cosine: 0, excerpts: [] };
    entry.score += boosted;
    entry.cosine = Math.max(entry.cosine, cosineByChunk.get(chunkIdx) ?? 0);
    if (entry.excerpts.length < 2) {
      entry.excerpts.push((chunk.heading ? `[${chunk.heading}] ` : "") + chunk.text);
    }
    byNote.set(chunk.note, entry);
  }
  let results = [...byNote.entries()].filter(([rel]) => idx.meta.notes[rel]).map(([rel, e]) => ({ note: idx.meta.notes[rel], score: e.score, cosine: e.cosine, excerpts: e.excerpts })).sort((a, b) => b.score - a.score).slice(0, k);
  if (opts.expand && results.length > 0) {
    const have = new Set(results.map((r) => r.note.rel));
    for (const r of results.slice(0, 2)) {
      for (const nb of idx.neighbors(r.note.rel).slice(0, 2)) {
        if (have.has(nb.note.rel)) continue;
        have.add(nb.note.rel);
        const firstChunk = idx.meta.chunks.find((c) => c.note === nb.note.rel);
        results.push({
          note: nb.note,
          score: r.score * 0.4,
          cosine: 0,
          excerpts: firstChunk ? [firstChunk.text] : []
        });
      }
    }
    results = results.sort((a, b) => b.score - a.score).slice(0, k + 3);
  }
  return results;
}

export {
  hybridSearch
};
