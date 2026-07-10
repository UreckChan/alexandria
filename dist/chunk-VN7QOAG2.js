#!/usr/bin/env node
import {
  MANAGED_DIR,
  ensureAlias,
  listMarkdownFiles,
  parseNote
} from "./chunk-CF2GLMR3.js";
import {
  DIM,
  MODEL_ID,
  chunkMarkdown,
  dot,
  embed,
  modelPresent
} from "./chunk-EDYBSJSS.js";

// src/core/index.ts
import fs from "fs";
import path from "path";
var SEMANTIC_THRESHOLD = 0.9;
var SEMANTIC_TOP = 3;
var VaultIndex = class _VaultIndex {
  constructor(vault) {
    this.vault = vault;
    this.meta = {
      version: 1,
      model: MODEL_ID,
      dim: DIM,
      mtimes: {},
      notes: {},
      chunks: [],
      links: []
    };
  }
  vault;
  meta;
  /** filas de embeddings alineadas 1:1 con meta.chunks; null = índice sin vectores */
  emb = null;
  get metaPath() {
    return path.join(this.vault.cache, "meta.json");
  }
  get embPath() {
    return path.join(this.vault.cache, "embeddings.bin");
  }
  static load(vault) {
    const idx = new _VaultIndex(vault);
    try {
      const meta = JSON.parse(fs.readFileSync(idx.metaPath, "utf8"));
      if (meta.version === 1 && meta.model === MODEL_ID) {
        idx.meta = meta;
        try {
          const buf = fs.readFileSync(idx.embPath);
          const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
          if (arr.length === meta.chunks.length * meta.dim) idx.emb = arr.slice();
        } catch {
          idx.emb = null;
        }
      }
    } catch {
    }
    return idx;
  }
  save() {
    fs.mkdirSync(this.vault.cache, { recursive: true });
    fs.writeFileSync(this.metaPath, JSON.stringify(this.meta));
    if (this.emb) {
      fs.writeFileSync(this.embPath, Buffer.from(this.emb.buffer, this.emb.byteOffset, this.emb.byteLength));
    }
  }
  row(i) {
    return this.emb.subarray(i * this.meta.dim, (i + 1) * this.meta.dim);
  }
  /**
   * Reindexado incremental por mtime. Solo procesa archivos nuevos/cambiados.
   * `withEmbeddings=false` → índice keyword-only (sin cargar modelo).
   */
  async refresh(withEmbeddings = modelPresent(), force = false) {
    const files = listMarkdownFiles(this.vault.root);
    const onDisk = /* @__PURE__ */ new Map();
    for (const abs of files) {
      const rel = path.relative(this.vault.root, abs).split(path.sep).join("/");
      onDisk.set(rel, { abs, mtime: fs.statSync(abs).mtimeMs });
    }
    const changed = [];
    for (const [rel, info] of onDisk) {
      if (force || this.meta.mtimes[rel] !== info.mtime) changed.push(rel);
    }
    const removed = Object.keys(this.meta.mtimes).filter((rel) => !onDisk.has(rel));
    if (changed.length === 0 && removed.length === 0) {
      return { changed: 0, removed: 0, embedded: this.emb !== null };
    }
    const keep = new Set(
      this.meta.chunks.map((_, i) => i).filter((i) => {
        const rel = this.meta.chunks[i].note;
        return onDisk.has(rel) && !changed.includes(rel);
      })
    );
    const newChunks = [];
    const keptRows = [];
    const hadEmb = this.emb !== null;
    for (const i of keep) {
      newChunks.push(this.meta.chunks[i]);
      if (hadEmb) keptRows.push(this.row(i).slice());
    }
    const freshChunks = [];
    for (const rel of changed) {
      const info = onDisk.get(rel);
      try {
        if (rel.startsWith(`${MANAGED_DIR}/`) && ensureAlias(info.abs)) {
          info.mtime = fs.statSync(info.abs).mtimeMs;
        }
        const note = parseNote(this.vault.root, info.abs);
        this.meta.notes[rel] = {
          rel,
          title: note.title,
          type: note.type,
          tags: note.tags,
          created: note.created,
          hits: note.hits,
          links: note.links
        };
        const pieces = chunkMarkdown(note.content);
        const titlePrefix = note.title ? `${note.title}. ` : "";
        for (const p of pieces) {
          freshChunks.push({ note: rel, heading: p.heading, text: p.text });
        }
        if (pieces.length === 0 && note.title) {
          freshChunks.push({ note: rel, text: titlePrefix });
        }
      } catch {
      }
      this.meta.mtimes[rel] = info.mtime;
    }
    for (const rel of removed) {
      delete this.meta.mtimes[rel];
      delete this.meta.notes[rel];
    }
    for (const rel of Object.keys(this.meta.notes)) {
      if (!onDisk.has(rel)) delete this.meta.notes[rel];
    }
    let embedded = hadEmb || newChunks.length === 0;
    let freshRows = [];
    if (withEmbeddings && freshChunks.length > 0) {
      try {
        freshRows = await embed(
          freshChunks.map((c) => `${this.meta.notes[c.note]?.title ?? ""}
${c.heading ?? ""}
${c.text}`),
          "passage"
        );
        embedded = true;
      } catch {
        embedded = false;
      }
    } else if (freshChunks.length > 0) {
      embedded = false;
    }
    this.meta.chunks = [...newChunks, ...freshChunks];
    if (embedded && (hadEmb || newChunks.length === 0) && freshRows.length === freshChunks.length) {
      const all = new Float32Array(this.meta.chunks.length * this.meta.dim);
      [...keptRows, ...freshRows].forEach((r, i) => all.set(r, i * this.meta.dim));
      this.emb = all;
    } else if (freshChunks.length > 0 && !embedded) {
      this.emb = null;
    }
    this.rebuildLinks();
    this.save();
    try {
      const { writeStaticGraph } = await import("./viewer-LD4RTZE7.js");
      writeStaticGraph(this);
    } catch {
    }
    return { changed: changed.length, removed: removed.length, embedded: this.emb !== null };
  }
  /** Wikilinks (título → nota) + links semánticos (similitud entre notas). */
  rebuildLinks() {
    const byTitle = /* @__PURE__ */ new Map();
    for (const n of Object.values(this.meta.notes)) {
      byTitle.set(n.title.toLowerCase(), n.rel);
      byTitle.set(n.rel.replace(/\.md$/, "").split("/").pop().toLowerCase(), n.rel);
    }
    const links = [];
    for (const n of Object.values(this.meta.notes)) {
      for (const target of n.links) {
        const to = byTitle.get(target.toLowerCase());
        if (to && to !== n.rel) links.push({ from: n.rel, to, type: "wikilink" });
      }
    }
    if (this.emb) {
      const rels = Object.keys(this.meta.notes);
      const noteVec = /* @__PURE__ */ new Map();
      for (const rel of rels) {
        const idxs = this.meta.chunks.map((c, i) => c.note === rel ? i : -1).filter((i) => i >= 0);
        if (idxs.length === 0) continue;
        const v = new Float32Array(this.meta.dim);
        for (const i of idxs) {
          const r = this.row(i);
          for (let d = 0; d < this.meta.dim; d++) v[d] += r[d];
        }
        let norm = 0;
        for (let d = 0; d < this.meta.dim; d++) norm += v[d] * v[d];
        norm = Math.sqrt(norm) || 1;
        for (let d = 0; d < this.meta.dim; d++) v[d] /= norm;
        noteVec.set(rel, v);
      }
      const seen = new Set(links.map((l) => `${l.from}\u2192${l.to}`));
      const vecRels = [...noteVec.keys()];
      for (const a of vecRels) {
        const sims = [];
        for (const b of vecRels) {
          if (a === b) continue;
          sims.push({ rel: b, s: dot(noteVec.get(a), noteVec.get(b)) });
        }
        sims.sort((x, y) => y.s - x.s);
        for (const { rel: b, s } of sims.slice(0, SEMANTIC_TOP)) {
          if (s < SEMANTIC_THRESHOLD) break;
          const key = a < b ? `${a}\u2192${b}` : `${b}\u2192${a}`;
          if (seen.has(key) || seen.has(`${a}\u2192${b}`) || seen.has(`${b}\u2192${a}`)) continue;
          seen.add(key);
          links.push({ from: a, to: b, type: "semantic", w: Math.round(s * 100) / 100 });
        }
      }
    }
    this.meta.links = links;
  }
  /** Vecinos directos de una nota en el grafo (sin releer archivos). */
  neighbors(rel) {
    const out = [];
    for (const l of this.meta.links) {
      const other = l.from === rel ? l.to : l.to === rel ? l.from : null;
      if (other && this.meta.notes[other]) {
        out.push({ note: this.meta.notes[other], type: l.type, w: l.w });
      }
    }
    return out;
  }
};

export {
  VaultIndex
};
