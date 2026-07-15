#!/usr/bin/env node

// src/core/vault.ts
import fs from "fs";
import os from "os";
import path from "path";
var MANAGED_DIR = "Alexandria";
function configDir() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "alexandria");
  }
  return path.join(os.homedir(), ".config", "alexandria");
}
function globalConfigPath() {
  return path.join(configDir(), "config.json");
}
function defaultVaultPath() {
  const legacy = path.join(os.homedir(), "KnowledgeVault");
  if (fs.existsSync(legacy)) return legacy;
  return path.join(os.homedir(), "Alexandria");
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function findProjectConfig(from) {
  let dir = path.resolve(from);
  for (; ; ) {
    const candidate = path.join(dir, ".vault.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function build(root, source, projectConfig) {
  const managed = path.basename(root).toLowerCase() === MANAGED_DIR.toLowerCase() ? root : path.join(root, MANAGED_DIR);
  return {
    root,
    managed,
    cache: path.join(root, ".vault"),
    source,
    projectConfig
  };
}
function resolveVault(opts = {}) {
  if (opts.flag) return build(path.resolve(opts.flag), "flag");
  const cwd = opts.cwd ?? process.cwd();
  const projectFile = findProjectConfig(cwd);
  if (projectFile) {
    const cfg = readJson(projectFile);
    if (cfg?.vaultPath) {
      const base = path.dirname(projectFile);
      return build(path.resolve(base, cfg.vaultPath), "project", projectFile);
    }
  }
  const globalCfg = readJson(globalConfigPath());
  if (globalCfg?.vaultPath) return build(globalCfg.vaultPath, "global");
  return build(defaultVaultPath(), "default");
}
function vaultExists(v) {
  return fs.existsSync(v.managed) || fs.existsSync(v.cache);
}
function ensureVaultStructure(v) {
  for (const dir of [
    v.root,
    v.managed,
    path.join(v.managed, "notes"),
    path.join(v.managed, "prompts"),
    path.join(v.managed, "sessions"),
    v.cache
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function writeGlobalConfig(vaultPath) {
  fs.mkdirSync(configDir(), { recursive: true });
  const current = readJson(globalConfigPath()) ?? {};
  fs.writeFileSync(globalConfigPath(), JSON.stringify({ ...current, vaultPath }, null, 2) + "\n");
}
function getConfigKey(key) {
  const cfg = readJson(globalConfigPath()) ?? {};
  return cfg[key];
}
function setConfigKey(key, value) {
  fs.mkdirSync(configDir(), { recursive: true });
  const cfg = readJson(globalConfigPath()) ?? {};
  cfg[key] = value;
  fs.writeFileSync(globalConfigPath(), JSON.stringify(cfg, null, 2) + "\n");
}
function protocolEnabled() {
  const v = getConfigKey("protocol");
  return v !== false && v !== "false";
}
function toggleEnabled(key) {
  const v = getConfigKey(key);
  return v !== false && v !== "false";
}
var TOKEN_TOGGLES = [
  {
    key: "protocol",
    label: "Protocolo Alexandria",
    desc: "Ciclo plan \u2192 verificar \u2192 aprender (manifiesto en el digest + tools MCP)",
    impact: "cuesta ~6% del digest (~120 tokens); su ahorro es diferido: lecciones evitan re-debug"
  },
  {
    key: "architect.enrich",
    label: "Arquitecto en plan_create",
    desc: "Planes similares + lecciones + hints de calidad en cada plan nuevo",
    impact: "encarece cada plan_create ~2-3\xD7 (~+90-110 tokens); apuesta a no duplicar trabajo"
  },
  {
    key: "tokens.solutionCache",
    label: "Cach\xE9 de soluciones",
    desc: "Si un prompt casi id\xE9ntico ya se resolvi\xF3, inyecta esa soluci\xF3n",
    impact: "cuesta hasta ~33% del presupuesto por prompt (~500 tokens); evita re-derivar completo"
  },
  {
    key: "tokens.promptSearch",
    label: "B\xFAsqueda sem\xE1ntica por prompt",
    desc: "Inyecta fragmentos relevantes de la b\xF3veda en cada prompt \u2014 el mecanismo PRINCIPAL de ahorro",
    impact: "cuesta hasta ~1500 tokens/prompt; apagarlo apaga la raz\xF3n de ser de Alexandria"
  },
  {
    key: "digest.map",
    label: "Mapa del proyecto al iniciar sesi\xF3n",
    desc: "Inyecta el mapa (stack, estructura, decisiones) en el digest de SessionStart",
    impact: "cuesta hasta ~50% del digest (~1000 tokens); evita re-explorar el proyecto"
  },
  {
    key: "digest.titleIndex",
    label: "\xCDndice de t\xEDtulos en el digest",
    desc: "Lista hasta 25 t\xEDtulos de lo que la b\xF3veda ya sabe",
    impact: "cuesta ~10% del digest (~200 tokens); orienta al agente sobre qu\xE9 buscar"
  }
];
function writeProjectConfig(projectDir, vaultPath) {
  const file = path.join(projectDir, ".vault.json");
  const rel = path.relative(projectDir, vaultPath) || ".";
  const stored = rel.startsWith("..") ? vaultPath : rel;
  fs.writeFileSync(file, JSON.stringify({ vaultPath: stored }, null, 2) + "\n");
  return file;
}

export {
  globalConfigPath,
  defaultVaultPath,
  resolveVault,
  vaultExists,
  ensureVaultStructure,
  writeGlobalConfig,
  getConfigKey,
  setConfigKey,
  protocolEnabled,
  toggleEnabled,
  TOKEN_TOGGLES,
  writeProjectConfig
};
