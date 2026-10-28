#!/usr/bin/env node
import {
  hybridSearch
} from "./chunk-Y6S6SKH4.js";
import {
  logDocUse
} from "./chunk-POA77JSS.js";
import {
  convertFile
} from "./chunk-UU4MGB2C.js";
import {
  ensureVaultStructure
} from "./chunk-CEHNXDUE.js";
import {
  slugify
} from "./chunk-BV2KJV5W.js";
import {
  DIM,
  dot,
  embed,
  modelPresent
} from "./chunk-EDYBSJSS.js";

// src/core/planning.ts
var MAX_ITEMS = 2;
var EXCERPT_CHARS = 150;
async function planContext(vault, query) {
  const out = { similarPlans: [], lessons: [] };
  try {
    const results = await hybridSearch(vault, query, 8);
    for (const r of results) {
      const excerpt = (r.excerpts[0] ?? "").replace(/\n+/g, " ").slice(0, EXCERPT_CHARS);
      if (r.note.type === "plan" && out.similarPlans.length < MAX_ITEMS) {
        out.similarPlans.push(`\xAB${r.note.title}\xBB (${r.note.status ?? "?"}): ${excerpt}`);
      } else if ((r.note.type === "lesson" || r.note.type === "solution") && out.lessons.length < MAX_ITEMS) {
        out.lessons.push(`\xAB${r.note.title}\xBB: ${excerpt}`);
      }
    }
  } catch {
  }
  return out;
}
var FAT_TASK_CHARS = 140;
var MAX_HINTS = 3;
function planQualityHints(dod, tasks, design) {
  const hints = [];
  const fat = tasks.filter((t) => t.length > FAT_TASK_CHARS);
  if (fat.length) hints.push(`${fat.length} tarea(s) gorda(s) (>${FAT_TASK_CHARS}c) \u2014 1 tarea = 1 task_verify`);
  if (dod.length < 2) hints.push("DoD <2 criterios verificables");
  const vague = dod.filter((d) => /funcione bien|quede bonito|esté listo|sea mejor/i.test(d));
  if (vague.length) hints.push(`${vague.length} criterio(s) no verificable(s) por comando`);
  if (tasks.length > 5 && !design?.trim()) hints.push("sin `design` (plan grande)");
  return hints.slice(0, MAX_HINTS);
}
function architectBlock(ctx, hints) {
  const parts = [];
  for (const p of ctx.similarPlans) parts.push(`Similar: ${p}`);
  for (const l of ctx.lessons) parts.push(`Lecci\xF3n: ${l}`);
  if (hints.length) parts.push(`Hints: ${hints.join(" \xB7 ")}`);
  return parts.join("\n");
}

// src/core/register.ts
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
function distDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return here.endsWith(`${path.sep}hooks`) || here.endsWith(`${path.sep}mcp`) ? path.dirname(here) : here;
}
var MARKER = "alexandria";
function hookCommand(script, timeout) {
  return { type: "command", command: `node "${script}"`, timeout };
}
function isOurs(cmd) {
  return cmd.includes(MARKER) || cmd.includes(distDir());
}
function registerHooks(settingsPath) {
  const d = distDir();
  const wanted = {
    SessionStart: hookCommand(path.join(d, "hooks", "on-session-start.js"), 20),
    UserPromptSubmit: hookCommand(path.join(d, "hooks", "on-prompt.js"), 30),
    Stop: hookCommand(path.join(d, "hooks", "on-stop.js"), 30),
    PreCompact: hookCommand(path.join(d, "hooks", "on-stop.js"), 30),
    // Read de PDF/DOCX/XLSX → sugiere doc_ingest/doc_read (toggle docs.interceptRead)
    PreToolUse: { ...hookCommand(path.join(d, "hooks", "on-read.js"), 5), matcher: "Read" }
  };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    if (fs.existsSync(settingsPath)) {
      throw new Error(`No pude parsear ${settingsPath} \u2014 rev\xEDsalo manualmente antes de registrar hooks.`);
    }
  }
  settings.hooks ??= {};
  for (const [event, { matcher, ...cmd }] of Object.entries(wanted)) {
    const matchers = (settings.hooks[event] ?? []).filter(
      (m) => !m.hooks?.some((h) => isOurs(h.command))
    );
    matchers.push(matcher ? { matcher, hooks: [cmd] } : { hooks: [cmd] });
    settings.hooks[event] = matchers;
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
function unregisterHooks(settingsPath) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (!settings.hooks) return;
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].map((m) => ({ ...m, hooks: m.hooks.filter((h) => !isOurs(h.command)) })).filter((m) => m.hooks.length > 0);
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  } catch {
  }
}
function projectSettingsPath(projectDir) {
  return path.join(projectDir, ".claude", "settings.json");
}
function globalSettingsPath() {
  return path.join(os.homedir(), ".claude", "settings.json");
}
function hooksRegistered(settingsPath) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const hooks = settings.hooks ?? {};
    return ["SessionStart", "UserPromptSubmit", "PreToolUse"].every(
      (ev) => (hooks[ev] ?? []).some((m) => m.hooks?.some((h) => isOurs(h.command)))
    );
  } catch {
    return false;
  }
}
function serverCommand(portable) {
  return portable ? { command: "npx", args: ["-y", "@ureck/alexandria", "alexandria", "serve-mcp"] } : { command: "node", args: [path.join(distDir(), "mcp", "server.js")] };
}
function registerMcpProject(projectDir, portable = false) {
  const file = path.join(projectDir, ".mcp.json");
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    if (fs.existsSync(file)) {
      throw new Error(`No pude parsear ${file} \u2014 rev\xEDsalo manualmente.`);
    }
  }
  cfg.mcpServers ??= {};
  cfg.mcpServers["alexandria"] = serverCommand(portable);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  return file;
}
function registerMcpGlobal(portable = false) {
  const { command, args } = serverCommand(portable);
  try {
    execFileSync("claude", ["mcp", "add", "--scope", "user", "alexandria", "--", command, ...args], {
      stdio: "pipe",
      timeout: 15e3,
      shell: process.platform === "win32"
      // en Windows los binarios globales de npm son shims .cmd/.ps1
    });
    return true;
  } catch {
    return false;
  }
}
function mcpRegisteredProject(projectDir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(projectDir, ".mcp.json"), "utf8"));
    return Boolean(cfg.mcpServers?.alexandria);
  } catch {
    return false;
  }
}

// src/core/pkg.ts
import fs2 from "fs";
import path2 from "path";
var cached = null;
function pkgVersion() {
  if (cached) return cached;
  try {
    const pkg = JSON.parse(fs2.readFileSync(path2.join(distDir(), "..", "package.json"), "utf8"));
    cached = String(pkg.version);
  } catch {
    cached = "0.0.0";
  }
  return cached;
}

// src/docs/docs.ts
import fs3 from "fs";
import path3 from "path";
import crypto from "crypto";
import matter from "gray-matter";
import MiniSearch from "minisearch";
var DOCS_DIR = "docs";
var OUTLINE_MAX = 60;
var tok = (s) => Math.ceil(s.length / 4);
var sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
function docsDir(vault) {
  return path3.join(vault.managed, DOCS_DIR);
}
function docFile(vault, abs) {
  const name = slugify(path3.basename(abs, path3.extname(abs))) || "documento";
  return path3.join(docsDir(vault), `${name}-${sha256(abs).slice(0, 6)}.md`);
}
function parseSections(body) {
  const out = [];
  let title = "Inicio";
  let buf = [];
  const push = () => {
    const text = buf.join("\n").trim();
    if (text) out.push({ id: `s${out.length + 1}`, title, text, tokens: tok(text) });
    buf = [];
  };
  for (const line of body.split("\n")) {
    const h = line.match(/^#{1,3}\s+(.+)$/);
    if (h) {
      push();
      title = h[1].trim();
      buf = [line];
    } else buf.push(line);
  }
  push();
  return out;
}
function docBody(content) {
  return content.replace(/^Fuente:.*\n+(Proyecto: \[\[[^\]]*\]\]\n+)?/, "");
}
function loadDoc(vault, file) {
  try {
    const { data, content } = matter(fs3.readFileSync(file, "utf8"));
    if (data.type !== "document") return null;
    return {
      rel: path3.relative(vault.root, file).split(path3.sep).join("/"),
      title: String(data.title ?? path3.basename(file)),
      source: String(data.source ?? ""),
      format: data.format,
      pages: data.pages,
      rows: data.rows,
      tokensOriginal: Number(data.tokensOriginal ?? 0),
      sections: parseSections(docBody(content))
    };
  } catch {
    return null;
  }
}
function listDocs(vault) {
  try {
    return fs3.readdirSync(docsDir(vault)).filter((f) => f.endsWith(".md")).map((f) => loadDoc(vault, path3.join(docsDir(vault), f))).filter((d) => Boolean(d));
  } catch {
    return [];
  }
}
function findDoc(vault, ref) {
  const r = ref.trim();
  if (!r) return null;
  const abs = path3.resolve(r);
  const byFile = path3.isAbsolute(r) || fs3.existsSync(abs) ? docFile(vault, abs) : null;
  if (byFile && fs3.existsSync(byFile)) return loadDoc(vault, byFile);
  const low = r.toLowerCase();
  const docs = listDocs(vault);
  return docs.find((d) => d.rel.toLowerCase() === low || d.title.toLowerCase() === low || d.source.toLowerCase() === low) ?? docs.find((d) => d.title.toLowerCase().includes(low) || path3.basename(d.source).toLowerCase().includes(low)) ?? null;
}
async function ingestDoc(vault, file, opts = {}) {
  const abs = path3.resolve(file);
  if (!fs3.existsSync(abs) || !fs3.statSync(abs).isFile()) throw new Error(`No existe el archivo: ${abs}`);
  const hash = sha256(fs3.readFileSync(abs));
  const target = docFile(vault, abs);
  if (!opts.force && fs3.existsSync(target)) {
    try {
      if (matter(fs3.readFileSync(target, "utf8")).data.sha256 === hash) {
        const doc = loadDoc(vault, target);
        if (doc) return { doc, reused: true };
      }
    } catch {
    }
  }
  const conv = await convertFile(abs);
  if (!conv.markdown.trim()) {
    conv.markdown = "## \u26A0 Sin texto extra\xEDble\n\nEl cuerpo del documento est\xE1 vac\xEDo: puede ser una plantilla, o tener solo encabezado/pie, im\xE1genes o cuadros de texto.";
  }
  ensureVaultStructure(vault);
  fs3.mkdirSync(path3.dirname(target), { recursive: true });
  const title = path3.basename(abs);
  const proj = opts.project ?? path3.basename(process.cwd());
  const meta = {
    title,
    aliases: [title],
    type: "document",
    tags: [proj, "documento"],
    created: (/* @__PURE__ */ new Date()).toISOString(),
    hits: 1,
    source: abs,
    format: conv.format,
    sha256: hash,
    tokensOriginal: conv.tokensOriginal
  };
  if (conv.pages) meta.pages = conv.pages;
  if (conv.rows !== void 0) meta.rows = conv.rows;
  const header = `Fuente: \`${abs}\` \xB7 ${conv.format}${conv.pages ? ` \xB7 ${conv.pages} p\xE1ginas` : ""}${conv.rows !== void 0 ? ` \xB7 ${conv.rows} filas` : ""}

Proyecto: [[Mapa - ${proj}]]

`;
  const tmp = `${target}.${process.pid}.tmp`;
  fs3.writeFileSync(tmp, matter.stringify(header + conv.markdown + "\n", meta));
  fs3.renameSync(tmp, target);
  return { doc: loadDoc(vault, target), reused: false };
}
function outline(doc) {
  const total = doc.sections.reduce((s, x) => s + x.tokens, 0);
  const lines = doc.sections.slice(0, OUTLINE_MAX).map((s) => `${s.id} \xB7 ${s.title} (~${s.tokens} tok)`);
  const more = doc.sections.length > OUTLINE_MAX ? `
\u2026 +${doc.sections.length - OUTLINE_MAX} secciones (usa query para encontrarlas)` : "";
  const text = `\xAB${doc.title}\xBB \u2014 ${doc.format}${doc.pages ? `, ${doc.pages} p\xE1gs` : ""}${doc.rows !== void 0 ? `, ${doc.rows} filas` : ""} \xB7 ${doc.sections.length} secciones
` + lines.join("\n") + more;
  return `${text}

Original \u2248 ${doc.tokensOriginal.toLocaleString("en")} tokens \xB7 todo convertido \u2248 ${total.toLocaleString("en")} \xB7 este \xEDndice \u2248 ${tok(text)}. Pide solo lo necesario con doc_read (sections o query).`;
}
async function ingestAndOutline(vault, file, opts = {}) {
  const { doc, reused } = await ingestDoc(vault, file, opts);
  const text = outline(doc);
  logDocUse(vault, { op: "ingest", tokensOriginal: doc.tokensOriginal, tokensServed: tok(text) });
  return { text: (reused ? "(sin cambios desde la \xFAltima ingesta)\n" : "") + text, doc, reused };
}
async function rankSections(vault, doc, query) {
  const mini = new MiniSearch({ fields: ["title", "text"], storeFields: ["id"], searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true } });
  mini.addAll(doc.sections);
  const bm = /* @__PURE__ */ new Map();
  const hits = mini.search(query);
  const top = hits[0]?.score ?? 0;
  for (const h of hits) bm.set(String(h.id), top ? h.score / top : 0);
  const cos = /* @__PURE__ */ new Map();
  if (modelPresent() && doc.sections.length <= MAX_SEMANTIC_SECTIONS) {
    try {
      const vecs = await sectionVectors(vault, doc);
      const [q] = await embed([query], "query");
      doc.sections.forEach((s, i) => cos.set(s.id, dot(q, vecs[i])));
      const vals = [...cos.values()];
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      for (const [id, c] of cos) cos.set(id, hi > lo ? (c - lo) / (hi - lo) : 1);
    } catch {
      cos.clear();
    }
  }
  const score = (id) => cos.size ? 0.5 * (bm.get(id) ?? 0) + 0.5 * (cos.get(id) ?? 0) : bm.get(id) ?? 0;
  const ranked = doc.sections.map((s) => ({ s, sc: score(s.id) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  const best = ranked[0]?.sc ?? 0;
  return ranked.filter((x) => x.sc >= best * 0.6).map((x) => x.s);
}
var fold = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function matchRows(doc, query, budget) {
  const terms = fold(query).split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return null;
  const hits = [];
  for (const s of doc.sections) {
    const m = s.title.match(/^Hoja «(.+)» · filas/);
    if (!m) continue;
    const lines = s.text.split("\n").filter((l) => l.startsWith("|"));
    const [header, , ...body] = lines;
    for (const row of body) {
      const f = fold(row);
      const score = terms.filter((t) => f.includes(t)).length;
      if (score > 0) hits.push({ sheet: m[1], header, row, score });
    }
  }
  if (hits.length === 0) return null;
  const top = Math.max(...hits.map((h) => h.score));
  const best = hits.filter((h) => h.score === top);
  const out = [];
  let used = 0;
  let shown = 0;
  let sheet = "";
  for (const h of best) {
    const add = (h.sheet !== sheet ? `
### Hoja \xAB${h.sheet}\xBB
${h.header}
${h.header.replace(/[^|]+/g, " --- ")}
` : "") + h.row;
    if (used + tok(add) > budget) break;
    out.push(add);
    used += tok(add);
    sheet = h.sheet;
    shown++;
  }
  const match = top === terms.length ? "contienen todos los t\xE9rminos" : `contienen ${top} de ${terms.length} t\xE9rminos`;
  return `\xAB${doc.title}\xBB \xB7 ${best.length} filas ${match}; mostrando ${shown} (\u2248 ${used} de \u2248 ${doc.tokensOriginal.toLocaleString("en")} tokens del original)
` + out.join("\n") + (shown < best.length ? `

+${best.length - shown} filas m\xE1s: sube max_tokens o afina la pregunta.` : "");
}
var MAX_SEMANTIC_SECTIONS = 300;
async function sectionVectors(vault, doc) {
  const key = sha256(doc.rel + doc.sections.map((s) => s.text).join("\0")).slice(0, 16);
  const file = path3.join(vault.cache, "docvec", `${key}.bin`);
  const dim = DIM;
  try {
    const buf = fs3.readFileSync(file);
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    if (all.length === doc.sections.length * dim) {
      return doc.sections.map((_, i) => all.subarray(i * dim, (i + 1) * dim));
    }
  } catch {
  }
  const vecs = await embed(doc.sections.map((s) => `${s.title}
${s.text.slice(0, 1200)}`), "passage");
  try {
    fs3.mkdirSync(path3.dirname(file), { recursive: true });
    const flat = new Float32Array(vecs.length * dim);
    vecs.forEach((v, i) => flat.set(v, i * dim));
    fs3.writeFileSync(file, Buffer.from(flat.buffer));
  } catch {
  }
  return vecs;
}
async function readDoc(vault, ref, opts = {}) {
  const doc = findDoc(vault, ref);
  if (!doc) return `No encontr\xE9 el documento \xAB${ref}\xBB. Ingi\xE9relo primero con doc_ingest (ruta del archivo).`;
  const budget = Math.max(200, opts.maxTokens ?? 1500);
  if (!opts.sections?.length && opts.query?.trim() && (doc.format === "xlsx" || doc.format === "csv")) {
    const rows = matchRows(doc, opts.query, budget);
    if (rows) {
      logDocUse(vault, { op: "read", tokensOriginal: 0, tokensServed: tok(rows) });
      return rows;
    }
  }
  let candidates;
  if (opts.sections?.length) {
    const want = new Set(opts.sections.map((s) => s.trim().toLowerCase()));
    candidates = doc.sections.filter((s) => want.has(s.id) || want.has(s.title.toLowerCase()));
  } else if (opts.query?.trim()) {
    candidates = await rankSections(vault, doc, opts.query);
  } else {
    candidates = doc.sections;
  }
  if (candidates.length === 0) return `Ninguna secci\xF3n coincide.

${outline(doc)}`;
  const picked = [];
  let used = 0;
  for (const s of candidates) {
    if (used + s.tokens <= budget) {
      picked.push(s);
      used += s.tokens;
    } else if (picked.length === 0) {
      const cut = { ...s, text: s.text.slice(0, budget * 4) + `
\u2026(recortada: ~${s.tokens} tok; sube max_tokens para verla completa)` };
      picked.push(cut);
      used = budget;
      break;
    }
    if (opts.query && picked.length >= 4) break;
  }
  const order = new Map(doc.sections.map((s, i) => [s.id, i]));
  picked.sort((a, b) => order.get(a.id) - order.get(b.id));
  const omitted = doc.sections.filter((s) => !picked.some((p) => p.id === s.id));
  const body = picked.map((s) => `[${s.id}]
${s.text}`).join("\n\n");
  const head = `\xAB${doc.title}\xBB \xB7 ${picked.map((s) => s.id).join(", ")} \xB7 \u2248 ${used} de \u2248 ${doc.tokensOriginal.toLocaleString("en")} tokens del original`;
  const tail = omitted.length ? `

+${omitted.length} secciones no incluidas: ${omitted.slice(0, 10).map((s) => `${s.id} ${s.title.length > 40 ? s.title.slice(0, 40) + "\u2026" : s.title}`).join(" \xB7 ")}${omitted.length > 10 ? " \u2026" : ""}` : "";
  const text = `${head}

${body}${tail}`;
  logDocUse(vault, { op: "read", tokensOriginal: 0, tokensServed: tok(text) });
  return text;
}

export {
  planContext,
  planQualityHints,
  architectBlock,
  distDir,
  registerHooks,
  unregisterHooks,
  projectSettingsPath,
  globalSettingsPath,
  hooksRegistered,
  serverCommand,
  registerMcpProject,
  registerMcpGlobal,
  mcpRegisteredProject,
  pkgVersion,
  listDocs,
  ingestAndOutline,
  readDoc
};
