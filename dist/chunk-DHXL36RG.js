#!/usr/bin/env node
import {
  hybridSearch
} from "./chunk-RZI7TYAG.js";

// src/core/planning.ts
async function planContext(vault, query) {
  const out = { similarPlans: [], lessons: [] };
  try {
    const results = await hybridSearch(vault, query, 8);
    for (const r of results) {
      const excerpt = (r.excerpts[0] ?? "").replace(/\n+/g, " ").slice(0, 300);
      if (r.note.type === "plan" && out.similarPlans.length < 3) {
        out.similarPlans.push(`\xAB${r.note.title}\xBB (${r.note.status ?? "sin status"}): ${excerpt}`);
      } else if ((r.note.type === "lesson" || r.note.type === "solution") && out.lessons.length < 3) {
        out.lessons.push(`\xAB${r.note.title}\xBB: ${excerpt}`);
      }
    }
  } catch {
  }
  return out;
}
var FAT_TASK_CHARS = 140;
function planQualityHints(dod, tasks, design) {
  const hints = [];
  if (dod.length < 2) {
    hints.push("DoD con menos de 2 criterios \u2014 agrega criterios verificables por comando (tests, build, curl).");
  }
  const vague = dod.filter((d) => /funcione bien|quede bonito|esté listo|sea mejor/i.test(d));
  if (vague.length) {
    hints.push(`Criterios no verificables (${vague.length}): reescr\xEDbelos como algo que un comando pueda confirmar.`);
  }
  const fat = tasks.filter((t) => t.length > FAT_TASK_CHARS);
  if (fat.length) {
    hints.push(`${fat.length} tarea(s) muy grandes (>${FAT_TASK_CHARS} chars) \u2014 div\xEDdelas: una tarea = un task_verify.`);
  }
  if (tasks.length > 5 && !design?.trim()) {
    hints.push("Plan grande sin secci\xF3n de dise\xF1o \u2014 considera pasar `design` (stack/decisiones de arquitectura) para fijar el rumbo antes de ejecutar.");
  }
  return hints;
}
function architectBlock(ctx, hints) {
  const parts = [];
  if (ctx.similarPlans.length) {
    parts.push(`PLANES SIMILARES PREVIOS (resume, no dupliques):
${ctx.similarPlans.map((p) => `- ${p}`).join("\n")}`);
  }
  if (ctx.lessons.length) {
    parts.push(`LECCIONES RELEVANTES (consid\xE9ralas al planear):
${ctx.lessons.map((l) => `- ${l}`).join("\n")}`);
  }
  if (hints.length) {
    parts.push(`SUGERENCIAS DE CALIDAD (el plan qued\xF3 guardado; mej\xF3ralo si aplican):
${hints.map((h) => `- ${h}`).join("\n")}`);
  }
  return parts.join("\n\n");
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
    PreCompact: hookCommand(path.join(d, "hooks", "on-stop.js"), 30)
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
  for (const [event, cmd] of Object.entries(wanted)) {
    const matchers = (settings.hooks[event] ?? []).filter(
      (m) => !m.hooks?.some((h) => isOurs(h.command))
    );
    matchers.push({ hooks: [cmd] });
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
    return ["SessionStart", "UserPromptSubmit"].every(
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
      timeout: 15e3
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
  registerMcpProject,
  registerMcpGlobal,
  mcpRegisteredProject,
  pkgVersion
};
