#!/usr/bin/env node
import {
  DIM,
  MODEL_ID,
  chunkMarkdown,
  dot,
  embed,
  modelPresent
} from "./chunk-EDYBSJSS.js";

// src/core/notes.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
var NOTE_TYPES = [
  "note",
  "prompt",
  "session",
  "map",
  "plan",
  "task",
  "verification",
  "lesson",
  "solution"
];
var SKIP_DIRS = /* @__PURE__ */ new Set([".obsidian", ".vault", ".trash", ".git", "node_modules"]);
function extractWikilinks(content) {
  const out = /* @__PURE__ */ new Set();
  const re = /\[\[([^\]|#\n]+)(?:[|#][^\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].trim();
    if (target) out.add(target);
  }
  return [...out];
}
function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "nota";
}
function listMarkdownFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}
function parseNote(root, absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  const rel = path.relative(root, absPath).split(path.sep).join("/");
  const title = typeof data.title === "string" && data.title || path.basename(absPath, ".md");
  const type = NOTE_TYPES.includes(data.type) ? data.type : "note";
  const status = ["active", "completed", "failed"].includes(data.status) ? data.status : void 0;
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  return {
    rel,
    title,
    type,
    status,
    tags,
    created: data.created ? String(data.created) : void 0,
    hits: typeof data.hits === "number" ? data.hits : 1,
    content,
    links: extractWikilinks(content)
  };
}
function frontmatter(n) {
  const lines = [
    "---",
    `title: ${JSON.stringify(n.title)}`,
    // aliases: Obsidian resuelve [[wikilinks]] contra alias, no contra el title
    // del frontmatter — sin esto su graph view muestra los enlaces como rotos
    `aliases: [${JSON.stringify(n.title)}]`,
    `type: ${n.type}`,
    ...n.status ? [`status: ${n.status}`] : [],
    `tags: [${n.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `hits: ${n.hits ?? 1}`,
    "---",
    ""
  ];
  return lines.join("\n");
}
function ensureAlias(absPath) {
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    const { data, content } = matter(raw);
    if (!data.title || data.aliases) return false;
    data.aliases = [String(data.title)];
    fs.writeFileSync(absPath, matter.stringify(content, data));
    return true;
  } catch {
    return false;
  }
}
function createNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "notes");
  fs.mkdirSync(dir, { recursive: true });
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const base = `${date}-${slugify(n.title)}`;
  let file = path.join(dir, `${base}.md`);
  let i = 2;
  while (fs.existsSync(file)) file = path.join(dir, `${base}-${i++}.md`);
  fs.writeFileSync(
    file,
    frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
  );
  return file;
}
function setNoteStatus(absPath, status) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  data.status = status;
  data.updated = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(absPath, matter.stringify(content, data));
}
function touchNote(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  data.hits = (typeof data.hits === "number" ? data.hits : 1) + 1;
  data.updated = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(absPath, matter.stringify(content, data));
}
function upsertNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "notes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${n.fixedName}.md`);
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    const { data } = matter(raw);
    data.updated = (/* @__PURE__ */ new Date()).toISOString();
    fs.writeFileSync(file, matter.stringify(n.content.trim() + "\n", data));
  } else {
    fs.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
    );
  }
  return file;
}
function appendToNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${n.fixedName}.md`);
  if (fs.existsSync(file)) {
    fs.appendFileSync(file, "\n" + n.content.trim() + "\n");
  } else {
    fs.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "session", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
    );
  }
  return file;
}

// src/core/index.ts
import fs2 from "fs";
import path2 from "path";
function isHookProcess() {
  return process.env.ALEXANDRIA_HOOK === "1";
}
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
  /** diccionario lazy tag/type → rels; la bóveda nunca borra, así que los
   *  escaneos lineales sobre TODAS las notas crecen para siempre — esto los evita */
  _tagIndex = null;
  /**
   * ¿Puede este contexto reconstruir el índice entero (caro)? true en CLI,
   * false en hooks — un hook con presupuesto corto jamás debe intentarlo.
   * Default = lo que diga el proceso (runHook marca el proceso como hook), así
   * queda cubierto CUALQUIER camino de código, no solo los que pasan el flag.
   */
  allowFullRebuild = !isHookProcess();
  get metaPath() {
    return path2.join(this.vault.cache, "meta.json");
  }
  get embPath() {
    return path2.join(this.vault.cache, "embeddings.bin");
  }
  static load(vault) {
    const idx = new _VaultIndex(vault);
    try {
      const meta = JSON.parse(fs2.readFileSync(idx.metaPath, "utf8"));
      if (meta.version === 1 && meta.model === MODEL_ID) {
        idx.meta = meta;
        try {
          const buf = fs2.readFileSync(idx.embPath);
          const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
          if (arr.length === meta.chunks.length * meta.dim) {
            idx.emb = arr.slice();
          } else {
            idx.emb = null;
            try {
              fs2.rmSync(idx.embPath, { force: true });
            } catch {
            }
          }
        } catch {
          idx.emb = null;
        }
      }
    } catch (e) {
      if (fs2.existsSync(idx.metaPath)) {
        try {
          fs2.rmSync(idx.metaPath, { force: true });
          fs2.rmSync(idx.embPath, { force: true });
        } catch {
        }
      }
    }
    return idx;
  }
  get rebuildFlagPath() {
    return path2.join(this.vault.cache, "needs-rebuild");
  }
  /** Deja constancia de que el índice está degradado y hace falta un reindex completo. */
  markNeedsRebuild() {
    try {
      if (fs2.existsSync(this.rebuildFlagPath)) return;
      fs2.mkdirSync(this.vault.cache, { recursive: true });
      fs2.writeFileSync(this.rebuildFlagPath, (/* @__PURE__ */ new Date()).toISOString());
    } catch {
    }
  }
  /** ¿El índice tiene chunks pero le faltan los vectores (búsqueda degradada)? */
  isDegraded() {
    return this.emb === null && this.meta.chunks.length > 0 && modelPresent();
  }
  /** ¿El índice quedó marcado como degradado (chunks sin vectores)? */
  needsRebuild() {
    return fs2.existsSync(this.rebuildFlagPath);
  }
  clearNeedsRebuild() {
    try {
      fs2.rmSync(this.rebuildFlagPath, { force: true });
    } catch {
    }
  }
  /** Escritura atómica: tmp + rename — un hook y un comando concurrentes nunca dejan el archivo a medias. */
  writeAtomic(file, data) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs2.writeFileSync(tmp, data);
    fs2.renameSync(tmp, file);
  }
  save() {
    fs2.mkdirSync(this.vault.cache, { recursive: true });
    this.writeAtomic(this.metaPath, JSON.stringify(this.meta));
    if (this.emb) {
      this.writeAtomic(this.embPath, Buffer.from(this.emb.buffer, this.emb.byteOffset, this.emb.byteLength));
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
      const rel = path2.relative(this.vault.root, abs).split(path2.sep).join("/");
      onDisk.set(rel, { abs, mtime: fs2.statSync(abs).mtimeMs });
    }
    if (withEmbeddings && this.emb === null && this.meta.chunks.length > 0) {
      if (this.allowFullRebuild) {
        force = true;
      } else {
        this.markNeedsRebuild();
        withEmbeddings = false;
      }
    }
    const changed = [];
    for (const [rel, info] of onDisk) {
      if (force || this.meta.mtimes[rel] !== info.mtime) changed.push(rel);
    }
    const removed = Object.keys(this.meta.mtimes).filter((rel) => !onDisk.has(rel));
    if (changed.length === 0 && removed.length === 0) {
      return { changed: 0, removed: 0, embedded: this.emb !== null };
    }
    this._tagIndex = null;
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
        const managedRel = path2.relative(this.vault.root, this.vault.managed).split(path2.sep).join("/");
        const inManaged = managedRel === "" || rel.startsWith(`${managedRel}/`);
        if (inManaged && ensureAlias(info.abs)) {
          info.mtime = fs2.statSync(info.abs).mtimeMs;
        }
        const note = parseNote(this.vault.root, info.abs);
        this.meta.notes[rel] = {
          rel,
          title: note.title,
          type: note.type,
          status: note.status,
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
    if (this.emb !== null) this.clearNeedsRebuild();
    else if (this.meta.chunks.length > 0 && modelPresent()) this.markNeedsRebuild();
    try {
      const { writeStaticGraph } = await import("./viewer-JQCSWJ3C.js");
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
  /**
   * Notas por tag o por tipo (`notesByTag('plan')`, `notesByTag('oauth')`) —
   * lookup O(1) contra el diccionario en vez de filtrar todas las notas.
   */
  notesByTag(key) {
    if (!this._tagIndex) {
      const m = /* @__PURE__ */ new Map();
      for (const n of Object.values(this.meta.notes)) {
        for (const k of [n.type, ...n.tags]) {
          const arr = m.get(k);
          if (arr) arr.push(n.rel);
          else m.set(k, [n.rel]);
        }
      }
      this._tagIndex = m;
    }
    return (this._tagIndex.get(key) ?? []).map((rel) => this.meta.notes[rel]).filter(Boolean);
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
  slugify,
  createNote,
  setNoteStatus,
  touchNote,
  upsertNote,
  appendToNote,
  VaultIndex
};
