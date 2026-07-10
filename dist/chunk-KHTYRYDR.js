#!/usr/bin/env node

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
function registerMcpProject(projectDir) {
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
  cfg.mcpServers["alexandria"] = {
    command: "node",
    args: [path.join(distDir(), "mcp", "server.js")]
  };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  return file;
}
function registerMcpGlobal() {
  const server = path.join(distDir(), "mcp", "server.js");
  try {
    execFileSync("claude", ["mcp", "add", "--scope", "user", "alexandria", "--", "node", server], {
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
