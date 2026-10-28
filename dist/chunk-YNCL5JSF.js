#!/usr/bin/env node
import {
  hybridSearch
} from "./chunk-47S5I3D3.js";
import {
  slugify
} from "./chunk-44QPE5IM.js";
import {
  convertFile,
  htmlToMarkdown
} from "./chunk-NUG7HLOU.js";
import {
  logDocUse
} from "./chunk-X4V6SYYA.js";
import {
  ensureVaultStructure
} from "./chunk-YICWI3U3.js";
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
    PreToolUse: { ...hookCommand(path.join(d, "hooks", "on-read.js"), 5), matcher: "Read" },
    // Salida grande de Bash → plegada (toggle run.fold)
    PostToolUse: { ...hookCommand(path.join(d, "hooks", "on-bash.js"), 5), matcher: "Bash" }
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
    return ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse"].every(
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

// src/code/outline.ts
import fs3 from "fs";
import path3 from "path";
var EXT = {
  ".ts": "c",
  ".tsx": "c",
  ".mts": "c",
  ".cts": "c",
  ".js": "c",
  ".jsx": "c",
  ".mjs": "c",
  ".cjs": "c",
  ".php": "c",
  ".go": "c",
  ".java": "c",
  ".cs": "c",
  ".kt": "c",
  ".kts": "c",
  ".rs": "c",
  ".swift": "c",
  ".dart": "c",
  ".py": "python"
};
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", "vendor", "coverage", "target", "__pycache__", ".venv", "venv", "out", "Alexandria", "KnowledgeVault"]);
function langOf(file) {
  return EXT[path3.extname(file).toLowerCase()];
}
function maskCode(src, lang) {
  const out = src.split("");
  let i = 0;
  const blank = (a, b) => {
    for (let k = a; k < b && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (lang === "c" && c === "/" && n === "/") {
      const e = src.indexOf("\n", i);
      blank(i, e < 0 ? src.length : e);
      i = e < 0 ? src.length : e;
    } else if (lang === "c" && c === "/" && n === "*") {
      const e = src.indexOf("*/", i + 2);
      blank(i, e < 0 ? src.length : e + 2);
      i = e < 0 ? src.length : e + 2;
    } else if (c === "#" && (lang === "python" || (i === 0 || src[i - 1] === "\n") && n !== "[" && n !== "!")) {
      const e = src.indexOf("\n", i);
      blank(i, e < 0 ? src.length : e);
      i = e < 0 ? src.length : e;
    } else if (lang === "python" && (src.startsWith('"""', i) || src.startsWith("'''", i))) {
      const q = src.slice(i, i + 3);
      const e = src.indexOf(q, i + 3);
      blank(i + 3, e < 0 ? src.length : e);
      i = e < 0 ? src.length : e + 3;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") j++;
        else if (src[j] === "\n" && c !== "`") break;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
    } else i++;
  }
  return out.join("");
}
var KEYWORDS = /* @__PURE__ */ new Set(["if", "for", "while", "switch", "catch", "return", "function", "else", "do", "try", "with", "new", "typeof", "await", "sizeof", "foreach", "using", "lock", "match", "loop", "unless"]);
var TOP_PATTERNS = [
  [/^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, "function"],
  [/^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:final\s+)?(?:public\s+|internal\s+|private\s+)?(?:static\s+)?(?:partial\s+)?(?:data\s+|sealed\s+|open\s+)?class\s+([A-Za-z_$][\w$]*)/, "class"],
  [/^\s*(?:export\s+)?(?:declare\s+)?(?:public\s+)?interface\s+([A-Za-z_$][\w$]*)/, "interface"],
  [/^\s*(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/, "enum"],
  [/^\s*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=]*>)?\s*=/, "type"],
  [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/, "function"],
  [/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/, "function"],
  [/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|trait|enum)\s+([A-Za-z_]\w*)/, "struct"],
  [/^\s*impl(?:<[^>]*>)?\s+(?:[\w:<>]+\s+for\s+)?([A-Za-z_][\w:]*)/, "impl"],
  [/^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, "function"],
  // constantes/variables de primer nivel (regex, config, tablas): también se piden por nombre
  [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/, "const"],
  [/^(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+([A-Z_][A-Z0-9_]*)\s*:/, "const"],
  [/^([A-Z_][A-Z0-9_]*)\s*=/, "const"],
  [/^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/, "struct"],
  [/^\s*(?:abstract\s+|final\s+)?(?:trait)\s+([A-Za-z_]\w*)/, "trait"],
  [/^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?function\s+([A-Za-z_]\w*)/, "function"]
];
var METHOD = /^\s*(?:(?:public|private|protected|internal|static|async|readonly|override|abstract|final|virtual|get|set|suspend|open|fun|def)\s+)*(?:[\w<>[\],.?]+\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/;
function signature(lines, start) {
  let sig = "";
  for (let k = start; k < Math.min(lines.length, start + 4); k++) {
    sig += (sig ? " " : "") + lines[k].trim();
    if (/[{:]\s*$|=>\s*\{?\s*$|;\s*$/.test(lines[k]) || /\)\s*(:[^{]*)?\{/.test(lines[k])) break;
  }
  sig = sig.replace(/\s*\{\s*$/, "").replace(/\s+/g, " ");
  return sig.length > 160 ? sig.slice(0, 160) + "\u2026" : sig;
}
function braceEnd(masked, start) {
  let depth = 0;
  let opened = false;
  let paren = 0;
  let typeDepth = 0;
  let prev = "";
  for (let k = start; k < masked.length; k++) {
    for (const ch of masked[k]) {
      if (!opened) {
        if (ch === "(") paren++;
        else if (ch === ")") paren = Math.max(0, paren - 1);
        else if (ch === "{") {
          if (paren > 0 || typeDepth > 0 || /[:<,|&(]/.test(prev)) typeDepth++;
          else {
            opened = true;
            depth = 1;
          }
        } else if (ch === "}") typeDepth = Math.max(0, typeDepth - 1);
        else if (ch === ";" && paren === 0 && typeDepth === 0) return k;
      } else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return k;
      }
      if (ch.trim()) prev = ch;
    }
    if (!opened && k >= start + 8) return start;
  }
  return opened ? masked.length - 1 : start;
}
function constEnd(masked, start) {
  for (let k = start; k < Math.min(masked.length, start + 200); k++) {
    if (k > start && /^\S/.test(masked[k]) && !/^[)\]}]/.test(masked[k])) return k - 1;
    if (/;\s*$/.test(masked[k])) return k;
  }
  return start;
}
function outlineC(src) {
  const lines = src.split("\n");
  const masked = maskCode(src, "c").split("\n");
  const syms = [];
  const containers = [];
  for (let i = 0; i < masked.length; i++) {
    const m = masked[i];
    if (!m.trim()) continue;
    const parent = containers.find((c) => i > c.start - 1 && i <= c.end - 1 && i !== c.start - 1);
    let hit = null;
    for (const [re, kind] of TOP_PATTERNS) {
      const mm = m.match(re);
      if (mm) {
        hit = [mm[1], kind];
        break;
      }
    }
    if (!hit && parent && ["class", "interface", "impl", "trait", "struct"].includes(parent.kind)) {
      const mm = m.match(METHOD);
      if (mm && !KEYWORDS.has(mm[1]) && /\)\s*(?::[^;{]*)?\{|\)\s*(?:->[^{]*)?\{|\)\s*$/.test(m) && !/;\s*$/.test(m)) hit = [mm[1], "method"];
    }
    if (!hit) continue;
    const end = hit[1] === "const" ? constEnd(masked, i) : hit[1] === "type" && !m.includes("{") ? i : braceEnd(masked, i);
    const sym = { name: hit[0], kind: hit[1], start: i + 1, end: end + 1, signature: signature(lines, i), parent: parent?.name };
    syms.push(sym);
    if (["class", "interface", "impl", "trait", "struct"].includes(sym.kind)) containers.push(sym);
    if (["function", "method", "type", "enum", "const"].includes(sym.kind)) i = Math.max(i, end);
  }
  return syms;
}
function outlinePython(src) {
  const lines = src.split("\n");
  const masked = maskCode(src, "python").split("\n");
  const syms = [];
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  for (let i = 0; i < masked.length; i++) {
    const m = masked[i].match(/^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/);
    if (!m) continue;
    const ind = m[1].length;
    let end = i;
    for (let k = i + 1; k < masked.length; k++) {
      if (!masked[k].trim()) continue;
      if (indentOf(masked[k]) <= ind) break;
      end = k;
    }
    const parent = [...syms].reverse().find((s) => s.kind === "class" && s.start - 1 < i && s.end - 1 >= i);
    syms.push({ name: m[3], kind: m[2] === "class" ? "class" : parent ? "method" : "function", start: i + 1, end: end + 1, signature: signature(lines, i).replace(/:\s*$/, ""), parent: parent?.name });
  }
  return syms;
}
function outlineSource(src, lang) {
  return lang === "python" ? outlinePython(src) : outlineC(src);
}
var tok = (s) => Math.ceil(s.length / 4);
function outlineFile(file) {
  const lang = langOf(file);
  if (!lang) return `Sin soporte para ${path3.extname(file) || file}: usa Read con offset/limit.`;
  const src = fs3.readFileSync(file, "utf8");
  const syms = outlineSource(src, lang);
  const total = src.split("\n").length;
  const head = `${file} \xB7 ${total} l\xEDneas \xB7 ~${tok(src).toLocaleString("en")} tokens \xB7 ${syms.length} s\xEDmbolos`;
  if (syms.length === 0) return `${head}
(sin declaraciones detectadas: usa Read con offset/limit)`;
  const body = syms.map((s) => `${s.parent ? "  " : ""}L${s.start}${s.end > s.start ? `\u2013${s.end}` : ""}  ${s.signature}`).join("\n");
  return `${head}
${body}

Pide el cuerpo de uno con code_symbol (archivo + nombre, o Clase.metodo).`;
}
function outlineDir(dir, maxTokens = 2500) {
  const files = [];
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs3.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const full = path3.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (langOf(full) && !/\.(min|d)\.[jt]s$/.test(e.name)) files.push(full);
    }
  };
  walk(dir);
  const out = [];
  let used = 0;
  let shown = 0;
  for (const f of files) {
    let syms = [];
    let lines = 0;
    try {
      const src = fs3.readFileSync(f, "utf8");
      if (src.length > 1e6) continue;
      lines = src.split("\n").length;
      syms = outlineSource(src, langOf(f)).filter((s) => !s.parent);
    } catch {
      continue;
    }
    const names = syms.map((s) => s.name);
    const line = `${path3.relative(dir, f)} (${lines} l): ${names.slice(0, 25).join(", ")}${names.length > 25 ? ` \u2026+${names.length - 25}` : ""}`;
    if (used + tok(line) > maxTokens) break;
    out.push(line);
    used += tok(line);
    shown++;
  }
  const more = files.length > shown ? `
\u2026 +${files.length - shown} archivos (sube max_tokens o pide una subcarpeta)` : "";
  return `${dir} \xB7 ${files.length} archivos de c\xF3digo
${out.join("\n")}${more}

Detalle de un archivo: code_outline con su ruta.`;
}
function symbolSource(file, name, maxTokens = 4e3) {
  const lang = langOf(file);
  if (!lang) return `Sin soporte para ${path3.extname(file) || file}: usa Read con offset/limit.`;
  const src = fs3.readFileSync(file, "utf8");
  const lines = src.split("\n");
  const syms = outlineSource(src, lang);
  const [a, b] = name.includes(".") ? name.split(".", 2) : [void 0, name];
  const matches = syms.filter((s2) => s2.name === b && (!a || s2.parent === a));
  if (matches.length === 0) {
    const near = syms.filter((s2) => s2.name.toLowerCase().includes(b.toLowerCase())).slice(0, 8);
    return `No encontr\xE9 \xAB${name}\xBB en ${file}.${near.length ? ` Parecidos: ${near.map((s2) => (s2.parent ? `${s2.parent}.${s2.name}` : s2.name) + ` (L${s2.start})`).join(", ")}` : ""} Si es una declaraci\xF3n poco com\xFAn, usa Read con offset/limit.`;
  }
  const s = matches[0];
  const body = lines.slice(s.start - 1, s.end).map((l, k) => `${s.start + k}: ${l}`).join("\n");
  const cut = body.length > maxTokens * 4 ? body.slice(0, maxTokens * 4) + `
\u2026(recortado: el s\xEDmbolo ocupa ~${tok(body)} tokens; sube max_tokens)` : body;
  const others = matches.length > 1 ? `
(otras ${matches.length - 1} coincidencias: ${matches.slice(1).map((m) => `L${m.start}`).join(", ")})` : "";
  return `${file} L${s.start}\u2013${s.end} \xB7 ${s.kind}${s.parent ? ` de ${s.parent}` : ""}
${cut}${others}`;
}

// src/docs/docs.ts
import fs4 from "fs";
import path4 from "path";
import crypto from "crypto";
import matter from "gray-matter";
import MiniSearch from "minisearch";
var DOCS_DIR = "docs";
var OUTLINE_MAX = 60;
var tok2 = (s) => Math.ceil(s.length / 4);
var sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
function docsDir(vault) {
  return path4.join(vault.managed, DOCS_DIR);
}
function docFile(vault, abs) {
  const name = slugify(path4.basename(abs, path4.extname(abs))) || "documento";
  return path4.join(docsDir(vault), `${name}-${sha256(abs).slice(0, 6)}.md`);
}
function parseSections(body) {
  const out = [];
  let title = "Inicio";
  let buf = [];
  const push = () => {
    const text = buf.join("\n").trim();
    if (text) out.push({ id: `s${out.length + 1}`, title, text, tokens: tok2(text) });
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
    const { data, content } = matter(fs4.readFileSync(file, "utf8"));
    if (data.type !== "document") return null;
    return {
      rel: path4.relative(vault.root, file).split(path4.sep).join("/"),
      title: String(data.title ?? path4.basename(file)),
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
    return fs4.readdirSync(docsDir(vault)).filter((f) => f.endsWith(".md")).map((f) => loadDoc(vault, path4.join(docsDir(vault), f))).filter((d) => Boolean(d));
  } catch {
    return [];
  }
}
function findDoc(vault, ref) {
  const r = ref.trim();
  if (!r) return null;
  const abs = path4.resolve(r);
  const byFile = path4.isAbsolute(r) || fs4.existsSync(abs) ? docFile(vault, abs) : null;
  if (byFile && fs4.existsSync(byFile)) return loadDoc(vault, byFile);
  const low = r.toLowerCase();
  const docs = listDocs(vault);
  return docs.find((d) => d.rel.toLowerCase() === low || d.title.toLowerCase() === low || d.source.toLowerCase() === low) ?? docs.find((d) => d.title.toLowerCase().includes(low) || path4.basename(d.source).toLowerCase().includes(low)) ?? null;
}
var isUrl = (s) => /^https?:\/\//i.test(s.trim());
var URL_TTL_MS = 7 * 864e5;
var URL_MAX_BYTES = 5 * 1024 * 1024;
async function ingestUrl(vault, url, opts) {
  const target = docFile(vault, url);
  if (!opts.force && fs4.existsSync(target)) {
    try {
      const fetched = Date.parse(String(matter(fs4.readFileSync(target, "utf8")).data.fetched_at ?? ""));
      if (Date.now() - fetched < URL_TTL_MS) {
        const doc = loadDoc(vault, target);
        if (doc) return { doc, reused: true };
      }
    } catch {
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2e4);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "alexandria-doc-ingest", accept: "text/html,text/markdown,text/plain" } });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${url}`);
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!/text\/(html|markdown|plain|x-markdown)|application\/xhtml/.test(type)) throw new Error(`Tipo no soportado: ${type || "desconocido"} (solo HTML, Markdown o texto)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > URL_MAX_BYTES) throw new Error(`La p\xE1gina pesa ${(buf.length / 1024 / 1024).toFixed(1)} MB (tope 5 MB)`);
  const raw = buf.toString("utf8");
  const isHtml = /html/.test(type);
  const markdown = isHtml ? await htmlToMarkdown(raw) : raw;
  const title = isHtml && raw.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1]?.trim() || url;
  return writeDoc(vault, target, {
    title,
    source: url,
    format: isHtml ? "html" : "markdown",
    sha: sha256(buf),
    tokensOriginal: tok2(raw),
    markdown,
    project: opts.project,
    extra: { fetched_at: (/* @__PURE__ */ new Date()).toISOString() }
  });
}
function writeDoc(vault, target, d) {
  ensureVaultStructure(vault);
  fs4.mkdirSync(path4.dirname(target), { recursive: true });
  const proj = d.project ?? path4.basename(process.cwd());
  const markdown = d.markdown.trim() ? d.markdown : "## \u26A0 Sin texto extra\xEDble\n\nEl cuerpo del documento est\xE1 vac\xEDo: puede ser una plantilla, o tener solo encabezado/pie, im\xE1genes o cuadros de texto.";
  const meta = {
    title: d.title,
    aliases: [d.title],
    type: "document",
    tags: [proj, "documento"],
    created: (/* @__PURE__ */ new Date()).toISOString(),
    hits: 1,
    source: d.source,
    format: d.format,
    sha256: d.sha,
    tokensOriginal: d.tokensOriginal,
    ...d.extra
  };
  if (d.pages) meta.pages = d.pages;
  if (d.rows !== void 0) meta.rows = d.rows;
  const header = `Fuente: \`${d.source}\` \xB7 ${d.format}${d.pages ? ` \xB7 ${d.pages} p\xE1ginas` : ""}${d.rows !== void 0 ? ` \xB7 ${d.rows} filas` : ""}

Proyecto: [[Mapa - ${proj}]]

`;
  const tmp = `${target}.${process.pid}.tmp`;
  fs4.writeFileSync(tmp, matter.stringify(header + markdown + "\n", meta));
  fs4.renameSync(tmp, target);
  return { doc: loadDoc(vault, target), reused: false };
}
async function ingestDoc(vault, file, opts = {}) {
  if (isUrl(file)) return ingestUrl(vault, file.trim(), opts);
  const abs = path4.resolve(file);
  if (!fs4.existsSync(abs) || !fs4.statSync(abs).isFile()) throw new Error(`No existe el archivo: ${abs}`);
  const hash = sha256(fs4.readFileSync(abs));
  const target = docFile(vault, abs);
  if (!opts.force && fs4.existsSync(target)) {
    try {
      if (matter(fs4.readFileSync(target, "utf8")).data.sha256 === hash) {
        const doc = loadDoc(vault, target);
        if (doc) return { doc, reused: true };
      }
    } catch {
    }
  }
  const conv = await convertFile(abs);
  return writeDoc(vault, target, {
    title: path4.basename(abs),
    source: abs,
    format: conv.format,
    sha: hash,
    tokensOriginal: conv.tokensOriginal,
    markdown: conv.markdown,
    pages: conv.pages,
    rows: conv.rows,
    project: opts.project
  });
}
function outline(doc) {
  const total = doc.sections.reduce((s, x) => s + x.tokens, 0);
  const lines = doc.sections.slice(0, OUTLINE_MAX).map((s) => `${s.id} \xB7 ${s.title} (~${s.tokens} tok)`);
  const more = doc.sections.length > OUTLINE_MAX ? `
\u2026 +${doc.sections.length - OUTLINE_MAX} secciones (usa query para encontrarlas)` : "";
  const text = `\xAB${doc.title}\xBB \u2014 ${doc.format}${doc.pages ? `, ${doc.pages} p\xE1gs` : ""}${doc.rows !== void 0 ? `, ${doc.rows} filas` : ""} \xB7 ${doc.sections.length} secciones
` + lines.join("\n") + more;
  return `${text}

Original \u2248 ${doc.tokensOriginal.toLocaleString("en")} tokens \xB7 todo convertido \u2248 ${total.toLocaleString("en")} \xB7 este \xEDndice \u2248 ${tok2(text)}. Pide solo lo necesario con doc_read (sections o query).`;
}
async function ingestAndOutline(vault, file, opts = {}) {
  const { doc, reused } = await ingestDoc(vault, file, opts);
  const text = outline(doc);
  logDocUse(vault, { op: "ingest", tokensOriginal: doc.tokensOriginal, tokensServed: tok2(text) });
  return { text: (reused ? "(sin cambios desde la \xFAltima ingesta)\n" : "") + text, doc, reused };
}
async function rankSections(vault, doc, query) {
  const mini = new MiniSearch({
    fields: ["title", "text"],
    storeFields: ["id"],
    processTerm: (t) => fold(t),
    searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true }
  });
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
    if (used + tok2(add) > budget) break;
    out.push(add);
    used += tok2(add);
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
  const file = path4.join(vault.cache, "docvec", `${key}.bin`);
  const dim = DIM;
  try {
    const buf = fs4.readFileSync(file);
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    if (all.length === doc.sections.length * dim) {
      return doc.sections.map((_, i) => all.subarray(i * dim, (i + 1) * dim));
    }
  } catch {
  }
  const vecs = await embed(doc.sections.map((s) => `${s.title}
${s.text.slice(0, 1200)}`), "passage");
  try {
    fs4.mkdirSync(path4.dirname(file), { recursive: true });
    const flat = new Float32Array(vecs.length * dim);
    vecs.forEach((v, i) => flat.set(v, i * dim));
    fs4.writeFileSync(file, Buffer.from(flat.buffer));
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
      logDocUse(vault, { op: "read", tokensOriginal: 0, tokensServed: tok2(rows) });
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
  logDocUse(vault, { op: "read", tokensOriginal: 0, tokensServed: tok2(text) });
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
  outlineFile,
  outlineDir,
  symbolSource,
  listDocs,
  isUrl,
  ingestAndOutline,
  readDoc
};
