#!/usr/bin/env node
import {
  charsToTokens,
  isHarnessInjected
} from "./chunk-MDGFK6UC.js";
import {
  isoDate
} from "./chunk-3CB7GRFJ.js";
import {
  MODEL_ID,
  modelCacheDir
} from "./chunk-EDYBSJSS.js";

// src/core/clean.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
var ARCHIVE_DIR = "archive";
var STATS_KEEP_DAYS = 90;
function archiveRoot(vault) {
  return path.join(vault.managed, ARCHIVE_DIR);
}
function bodyOf(abs) {
  try {
    return matter(fs.readFileSync(abs, "utf8")).content.trim();
  } catch {
    return "";
  }
}
function promptText(body) {
  return body.replace(/^Proyecto: \[\[[^\]]*\]\]\s*/m, "").replace(/^## Prompt\s*/m, "").trim();
}
function sizeOf(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((s, f) => s + sizeOf(path.join(p, f)), 0);
  } catch {
    return 0;
  }
}
function planClean(vault, notes, opts) {
  const cutoff = Date.now() - opts.days * 864e5;
  const archRel = path.relative(vault.root, archiveRoot(vault)).split(path.sep).join("/");
  const bundles = /* @__PURE__ */ new Map();
  const noise = [];
  const legacy = [];
  try {
    for (const f of fs.readdirSync(archiveRoot(vault))) {
      if (!f.endsWith(".md")) continue;
      const abs = path.join(archiveRoot(vault), f);
      if (!fs.statSync(abs).isFile()) continue;
      const fm = matter(fs.readFileSync(abs, "utf8")).data;
      if (fm.type !== "prompt") continue;
      legacy.push({
        rel: path.relative(vault.root, abs).split(path.sep).join("/"),
        title: fm.title ?? f,
        type: "prompt",
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        created: isoDate(fm.created),
        hits: fm.hits ?? 1,
        links: []
      });
    }
  } catch {
  }
  for (const n of [...notes, ...legacy]) {
    if (n.type !== "prompt") continue;
    const abs = path.join(vault.root, n.rel);
    if (!opts.keepNoise && isHarnessInjected(promptText(bodyOf(abs)))) {
      noise.push(n);
      continue;
    }
    const legacy2 = n.rel.startsWith(`${archRel}/`);
    const old = n.created !== void 0 && Date.parse(n.created) < cutoff;
    if (!legacy2 && !(old && (n.hits ?? 1) <= 1)) continue;
    const proj = (n.tags.find((t) => t !== "prompt") ?? "general").replace(/[\\/:*?"<>|]/g, "-");
    const key = `${proj}/${(n.created ?? "").slice(0, 7) || "sin-fecha"}`;
    const list = bundles.get(key) ?? [];
    list.push(n);
    bundles.set(key, list);
  }
  let tmpFiles = [];
  try {
    tmpFiles = fs.readdirSync(vault.cache).filter((f) => f.endsWith(".tmp")).map((f) => path.join(vault.cache, f));
  } catch {
  }
  const staleModels = [];
  const [org, name] = MODEL_ID.split("/");
  try {
    for (const o of fs.readdirSync(modelCacheDir())) {
      const orgDir = path.join(modelCacheDir(), o);
      if (!fs.statSync(orgDir).isDirectory()) continue;
      for (const m of fs.readdirSync(orgDir)) {
        const dir = path.join(orgDir, m);
        if (!(o === org && m === name) && fs.existsSync(path.join(dir, "config.json"))) staleModels.push(dir);
      }
    }
  } catch {
  }
  return { bundles, noise, tmpFiles, staleModels, statsLinesToRotate: oldStatsLines(vault).length };
}
function oldStatsLines(vault) {
  const cutoff = Date.now() - STATS_KEEP_DAYS * 864e5;
  try {
    return fs.readFileSync(path.join(vault.cache, "stats.jsonl"), "utf8").split("\n").filter((l) => {
      try {
        const o = JSON.parse(l);
        return o.t !== "summary" && Date.parse(o.t ?? "") < cutoff;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function section(n, text) {
  return `## ${(n.created ?? "").slice(0, 10)} \u2014 ${n.title.replace(/\n/g, " ")}

${text}
`;
}
function applyClean(vault, plan) {
  const res = { compacted: 0, dropped: 0, bundlesWritten: 0, removedDerived: 0, bytesFreed: 0 };
  for (const [key, list] of plan.bundles) {
    const [proj, month] = key.split("/");
    const file = path.join(archiveRoot(vault), proj, `${month}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const items = list.sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "")).map((n) => ({ n, abs: path.join(vault.root, n.rel), text: promptText(bodyOf(path.join(vault.root, n.rel))) })).filter((x) => x.text);
    if (items.length === 0) continue;
    let current = "";
    try {
      current = fs.readFileSync(file, "utf8");
    } catch {
      current = matter.stringify(
        `Prompts archivados por \`ale clean\`: texto \xEDntegro, fuera del \xEDndice sem\xE1ntico y del grafo.
B\xFAscalos con \`ale search --archive "<texto>"\`.

Proyecto: [[Mapa - ${proj}]]
`,
        { title: `Archivo de prompts \u2014 ${proj} ${month}`, type: "archive", tags: [proj, "archivo"], created: (/* @__PURE__ */ new Date()).toISOString() }
      ).trimEnd() + "\n";
    }
    const next = current.trimEnd() + "\n\n" + items.map((x) => section(x.n, x.text)).join("\n");
    writeAtomic(file, next);
    res.bundlesWritten++;
    const written = fs.readFileSync(file, "utf8");
    for (const x of items) {
      if (!written.includes(x.text)) continue;
      res.bytesFreed += sizeOf(x.abs);
      fs.rmSync(x.abs, { force: true });
      res.compacted++;
    }
  }
  for (const n of plan.noise) {
    const abs = path.join(vault.root, n.rel);
    res.bytesFreed += sizeOf(abs);
    fs.rmSync(abs, { force: true });
    res.dropped++;
  }
  for (const p of [...plan.tmpFiles, ...plan.staleModels]) {
    res.bytesFreed += sizeOf(p);
    fs.rmSync(p, { recursive: true, force: true });
    res.removedDerived++;
  }
  rotateStats(vault);
  return res;
}
function rotateStats(vault) {
  const file = path.join(vault.cache, "stats.jsonl");
  const old = new Set(oldStatsLines(vault));
  if (old.size === 0) return 0;
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const agg = /* @__PURE__ */ new Map();
  const keep = [];
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (old.has(l) || o.t === "summary") {
      const a = agg.get(o.kind ?? "inject") ?? { injectedChars: 0, count: 0, tokens: 0 };
      a.injectedChars += o.injectedChars ?? 0;
      a.count += o.count ?? 1;
      a.tokens += o.tokens ?? charsToTokens(o.injectedChars ?? 0);
      agg.set(o.kind ?? "inject", a);
    } else keep.push(l);
  }
  const summary = [...agg].map(([kind, a]) => JSON.stringify({ t: "summary", kind, ...a }));
  writeAtomic(file, [...summary, ...keep].join("\n") + "\n");
  return old.size;
}
function searchArchive(vault, query, k = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const hits = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        const text = fs.readFileSync(full, "utf8");
        for (const sec of text.split(/\n(?=## )/)) {
          const low = sec.toLowerCase();
          const score = terms.reduce((s, t) => s + (low.includes(t) ? 1 : 0), 0);
          if (score === 0) continue;
          const heading = sec.match(/^## (.+)$/m)?.[1] ?? path.basename(full);
          hits.push({ file: path.relative(vault.root, full), heading, excerpt: sec.replace(/^## .+\n/, "").trim().slice(0, 400), score });
        }
      }
    }
  };
  walk(archiveRoot(vault));
  return hits.sort((a, b) => b.score - a.score).slice(0, k).map(({ score: _s, ...h }) => h);
}
function dirBytes(p, exclude) {
  return sizeOf(p) - (exclude ? sizeOf(exclude) : 0);
}
var LAST_CLEAN = "last-clean";
function autoCleanDue(vault) {
  try {
    const t = fs.statSync(path.join(vault.cache, LAST_CLEAN)).mtimeMs;
    return Date.now() - t > 7 * 864e5;
  } catch {
    return true;
  }
}
function markCleaned(vault) {
  try {
    fs.mkdirSync(vault.cache, { recursive: true });
    fs.writeFileSync(path.join(vault.cache, LAST_CLEAN), (/* @__PURE__ */ new Date()).toISOString());
  } catch {
  }
}

export {
  ARCHIVE_DIR,
  planClean,
  applyClean,
  searchArchive,
  dirBytes,
  autoCleanDue,
  markCleaned
};
