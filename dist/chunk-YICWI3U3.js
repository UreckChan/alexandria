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
function initScopeWarning(opts) {
  if (opts.project || opts.global) return null;
  return `\u26A0 No se indic\xF3 --project ni --global: este vault se comparte con TODAS tus sesiones (~/Alexandria).
  Si quer\xEDas un vault aislado SOLO para este proyecto: Ctrl+C y corre \`ale init --project\` en su lugar.
`;
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
  },
  {
    key: "index.autoRebuild",
    label: "Reparar el \xEDndice al cerrar sesi\xF3n",
    desc: "Si el \xEDndice qued\xF3 sin vectores, reconstruirlo en segundo plano al terminar la sesi\xF3n",
    impact: "no gasta tokens; sin esto la b\xFAsqueda puede quedarse en keyword-only (peor contexto por prompt)"
  },
  {
    key: "docs.interceptRead",
    label: "Redirigir lectura de PDF/DOCX/XLSX",
    desc: "En Claude Code, la primera lectura directa de un PDF/DOCX/XLSX/CSV grande se redirige a doc_ingest/doc_read (el segundo intento pasa)",
    impact: "ahorra ~2,000 tokens por p\xE1gina de PDF; desact\xEDvalo si sueles necesitar ver im\xE1genes/gr\xE1ficas"
  },
  {
    key: "run.fold",
    label: "Plegar salida grande de comandos",
    desc: "Builds/tests/installs/logs largos: el agente recibe errores + resumen + final; la salida completa queda en disco (ale run show)",
    impact: "ahorra la mayor parte de un build o test suite (miles de tokens por corrida); desact\xEDvalo si quieres ver siempre todo"
  },
  {
    key: "context.dedupe",
    label: "No reinyectar lo ya inyectado",
    desc: "Si una nota ya se inyect\xF3 en esta sesi\xF3n, se manda una referencia de 1 l\xEDnea en vez del extracto completo",
    impact: "ahorra hasta ~1500 tokens por prompt en conversaciones largas sobre el mismo tema"
  },
  {
    key: "clean.auto",
    label: "Limpieza autom\xE1tica semanal",
    desc: "Al cerrar sesi\xF3n (m\xE1x. 1 vez por semana, en segundo plano): compacta prompts viejos sin reuso y purga cach\xE9s \u2014 nunca toca lecciones, planes, mapas ni sesiones",
    impact: "no gasta tokens; baja el \xEDndice y el ruido en la b\xFAsqueda (mejor contexto por prompt)"
  }
];
function writeProjectConfig(projectDir, vaultPath) {
  const file = path.join(projectDir, ".vault.json");
  const rel = path.relative(projectDir, vaultPath) || ".";
  const stored = rel.startsWith("..") ? vaultPath : rel;
  fs.writeFileSync(file, JSON.stringify({ vaultPath: stored }, null, 2) + "\n");
  return file;
}

// src/hooks/adapters.ts
var HARNESSES = ["claude", "codex", "gemini", "cursor", "opencode"];
function currentHarness(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith("--harness="))?.slice("--harness=".length);
  return HARNESSES.includes(arg ?? "") ? arg : "claude";
}
function normalizeInput(raw) {
  const event = raw.hook_event_name ?? "";
  return {
    session_id: raw.session_id ?? raw.conversation_id,
    transcript_path: raw.transcript_path ?? void 0,
    cwd: raw.cwd ?? raw.workspace_roots?.[0],
    prompt: raw.prompt,
    answer: raw.last_assistant_message ?? raw.prompt_response ?? raw.text,
    compact: /^(PreCompact|PreCompress|preCompact)$/.test(event) || Boolean(raw.trigger),
    toolName: raw.tool_name,
    filePath: raw.tool_input?.file_path,
    command: typeof raw.tool_input?.command === "string" ? raw.tool_input.command : void 0,
    toolResponse: raw.tool_response,
    durationMs: raw.duration_ms,
    source: raw.source
  };
}
function formatContext(harness, kind, text) {
  switch (harness) {
    case "claude":
    case "opencode":
      return text;
    case "codex":
      return JSON.stringify({
        hookSpecificOutput: { hookEventName: kind === "session" ? "SessionStart" : "UserPromptSubmit", additionalContext: text }
      });
    case "gemini":
      return JSON.stringify({
        hookSpecificOutput: { hookEventName: kind === "session" ? "SessionStart" : "BeforeAgent", additionalContext: text }
      });
    case "cursor":
      return kind === "session" ? JSON.stringify({ additional_context: text }) : null;
  }
}
function defaultOutput(harness, kind) {
  if (harness === "cursor" && kind === "prompt") return JSON.stringify({ continue: true });
  return null;
}
var TEXT_PARTS = /* @__PURE__ */ new Set(["text", "input_text", "output_text"]);
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((p) => TEXT_PARTS.has(p?.type) && typeof p?.text === "string").map((p) => p.text).join("\n");
}
function lastExchange(lines) {
  let user = "";
  let assistant = "";
  for (const line of lines) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const role = msg.message?.role ?? msg.payload?.role ?? msg.role ?? msg.type;
    const text = textOf(msg.message?.content ?? msg.payload?.content ?? msg.content).trim();
    if (!text) continue;
    if (role === "user" && !text.startsWith("<")) user = text;
    if (role === "assistant") assistant = text;
  }
  return { user, assistant };
}
function isHarnessInjected(prompt) {
  const p = prompt.trim();
  return /^<(task-notification|system-reminder|command-|local-command|user-prompt-submit-hook|ide_)/i.test(p) || // mensajes que el arnés escribe como si fueran del usuario
  /^(Tool loaded\.|Your response above was cut off|This session is being continued from a previous conversation|\[Request interrupted|Caveat: The messages below were generated)/i.test(p);
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
  initScopeWarning,
  TOKEN_TOGGLES,
  writeProjectConfig,
  currentHarness,
  normalizeInput,
  formatContext,
  defaultOutput,
  lastExchange,
  isHarnessInjected
};
