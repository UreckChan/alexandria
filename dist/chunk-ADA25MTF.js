#!/usr/bin/env node
import {
  isHarnessInjected
} from "./chunk-YICWI3U3.js";

// src/core/capsule.ts
import fs from "fs";
import path from "path";
var MAX_SESSIONS = 30;
var CAPSULE_CHARS = 2400;
function injectedFile(cacheDir) {
  return path.join(cacheDir, "injected.json");
}
function readStore(cacheDir) {
  try {
    return JSON.parse(fs.readFileSync(injectedFile(cacheDir), "utf8"));
  } catch {
    return {};
  }
}
function injectedInSession(cacheDir, session) {
  return new Set(readStore(cacheDir)[session]?.rels ?? []);
}
function rememberInjected(cacheDir, session, rels) {
  if (!rels.length) return;
  try {
    const store = readStore(cacheDir);
    const prev = store[session]?.rels ?? [];
    store[session] = { rels: [.../* @__PURE__ */ new Set([...prev, ...rels])], t: (/* @__PURE__ */ new Date()).toISOString() };
    const keys = Object.keys(store).sort((a, b) => store[a].t.localeCompare(store[b].t));
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS))) delete store[k];
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(injectedFile(cacheDir), JSON.stringify(store));
  } catch {
  }
}
function forgetInjected(cacheDir, session) {
  try {
    const store = readStore(cacheDir);
    if (!store[session]) return;
    delete store[session];
    fs.writeFileSync(injectedFile(cacheDir), JSON.stringify(store));
  } catch {
  }
}
var FILE_KEYS = ["file_path", "path", "notebook_path", "filePath"];
var TMP_PATH = /^(\/private)?\/tmp\/|^\/var\/folders\/|[\\/]scratchpad[\\/]|[\\/]tasks[\\/][^\\/]+\.output$/;
var EDIT_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit|apply_patch|edit|write)$/i;
function extractSession(lines) {
  const out = { prompts: [], edited: [], read: [], commands: [], saved: [] };
  for (const line of lines) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const role = msg.message?.role ?? msg.type;
    const content = msg.message?.content;
    if (role === "user" && typeof content === "string") {
      if (!content.trim().startsWith("<") && !isHarnessInjected(content)) out.prompts.push(content.trim());
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (role === "user" && b.type === "text" && b.text && !b.text.trim().startsWith("<") && !isHarnessInjected(b.text)) out.prompts.push(b.text.trim());
      if (b.type !== "tool_use" || !b.input) continue;
      const name = b.name ?? "";
      const file = FILE_KEYS.map((k) => b.input[k]).find((v) => typeof v === "string" && /[\\/.]/.test(v));
      if (file && !TMP_PATH.test(file)) (EDIT_TOOLS.test(name) ? out.edited : out.read).push(file);
      if (/^(Bash|shell|bash)$/.test(name) && typeof b.input.command === "string") out.commands.push(b.input.command.split("\n")[0]);
      if (/(vault_save|lesson_extract|plan_create)$/.test(name) && typeof b.input.title === "string") {
        const prefix = name.endsWith("lesson_extract") ? "Lecci\xF3n - " : name.endsWith("plan_create") ? "Plan - " : "";
        out.saved.push(prefix + b.input.title);
      }
    }
  }
  return out;
}
var one = (s, n) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "\u2026" : t;
};
var uniq = (xs) => [...new Set(xs)];
var short = (p, cwd) => cwd && p.startsWith(cwd) ? path.relative(cwd, p) || p : p;
function buildCapsule(ex, opts = {}) {
  const parts = [];
  if (ex.prompts.length) {
    parts.push(`Objetivo inicial: ${one(ex.prompts[0], 300)}`);
    if (ex.prompts.length > 1) parts.push(`\xDAltimo pedido: ${one(ex.prompts[ex.prompts.length - 1], 300)}`);
    const mid = uniq(ex.prompts.slice(1, -1)).slice(-4);
    if (mid.length) parts.push(`Pedidos intermedios:
${mid.map((p) => `- ${one(p, 150)}`).join("\n")}`);
  }
  const edited = uniq(ex.edited.map((f) => short(f, opts.cwd))).slice(-12);
  const read = uniq(ex.read.map((f) => short(f, opts.cwd))).filter((f) => !edited.includes(f)).slice(-6);
  if (edited.length) parts.push(`Archivos editados: ${edited.join(", ")}`);
  if (read.length) parts.push(`Archivos consultados: ${read.join(", ")}`);
  const cmds = uniq(ex.commands.map((c) => one(c, 90))).slice(-4);
  if (cmds.length) parts.push(`Comandos recientes:
${cmds.map((c) => `- ${c}`).join("\n")}`);
  if (ex.saved.length) parts.push(`Guardado en la b\xF3veda: ${uniq(ex.saved).slice(-8).join(" \xB7 ")}`);
  if (opts.openPlans?.length) parts.push(`Planes abiertos: ${opts.openPlans.slice(0, 5).join(" \xB7 ")}`);
  if (!parts.length) return "";
  const body = parts.join("\n");
  return `<alexandria-capsula>
C\xE1psula de esta sesi\xF3n guardada antes de compactar \u2014 recupera lo que la compactaci\xF3n pudo perder (no re-explores lo que ya est\xE1 aqu\xED):
` + (body.length > CAPSULE_CHARS ? body.slice(0, CAPSULE_CHARS) + "\u2026" : body) + `
</alexandria-capsula>`;
}
function capsuleFile(cacheDir, session) {
  return path.join(cacheDir, "capsules", `${session.replace(/[^\w.-]/g, "_")}.md`);
}
function saveCapsule(cacheDir, session, text) {
  if (!text) return;
  try {
    const f = capsuleFile(cacheDir, session);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    const dir = path.dirname(f);
    const files = fs.readdirSync(dir).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => a.t - b.t);
    for (const x of files.slice(0, Math.max(0, files.length - MAX_SESSIONS))) fs.rmSync(path.join(dir, x.n), { force: true });
  } catch {
  }
}
function loadCapsule(cacheDir, session) {
  try {
    return fs.readFileSync(capsuleFile(cacheDir, session), "utf8");
  } catch {
    return null;
  }
}

export {
  injectedInSession,
  rememberInjected,
  forgetInjected,
  extractSession,
  buildCapsule,
  saveCapsule,
  loadCapsule
};
