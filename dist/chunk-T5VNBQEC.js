#!/usr/bin/env node
import {
  hybridSearch
} from "./chunk-AHBSZGSC.js";

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
