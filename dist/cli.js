#!/usr/bin/env node
import {
  readStats
} from "./chunk-XITAQVOZ.js";
import {
  distDir,
  globalSettingsPath,
  hooksRegistered,
  mcpRegisteredProject,
  pkgVersion,
  projectSettingsPath,
  registerHooks,
  registerMcpGlobal,
  registerMcpProject,
  unregisterHooks
} from "./chunk-IQM5S5N4.js";
import {
  hybridSearch
} from "./chunk-3ETM6PKR.js";
import {
  defaultVaultPath,
  ensureVaultStructure,
  getConfigKey,
  globalConfigPath,
  resolveVault,
  setConfigKey,
  vaultExists,
  writeGlobalConfig,
  writeProjectConfig
} from "./chunk-DYCARGQR.js";
import {
  serveGraph
} from "./chunk-UTXUGXDB.js";
import {
  VaultIndex
} from "./chunk-7G3NPKDO.js";
import {
  createNote,
  slugify,
  upsertNote
} from "./chunk-XWR74BQ2.js";
import {
  MODEL_ID,
  getEmbedder,
  modelPresent
} from "./chunk-EDYBSJSS.js";

// src/cli.ts
import fs4 from "fs";
import path4 from "path";
import readline from "readline/promises";
import { Command } from "commander";
import pc from "picocolors";

// src/skills/recommend.ts
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
var RULES = [
  { skill: "pdf-report-gen", keywords: ["pdf", "reporte pdf", "membrete"] },
  { skill: "excel-report-gen", keywords: ["excel", "xlsx", "spreadsheet", "hoja de calculo", "hoja de c\xE1lculo"] },
  { skill: "qr-checkin", keywords: ["qr", "codigo qr", "c\xF3digo qr", "check-in", "checkin"] },
  { skill: "auth-standard", keywords: ["auth", "login", "jwt", "sesion", "autenticacion", "autenticaci\xF3n"] },
  { skill: "prisma-workflow", keywords: ["prisma", "migracion", "migraci\xF3n", "orm"] },
  { skill: "flutter-offline-scaffold", keywords: ["flutter", "dart", "riverpod", "drift"] },
  { skill: "mapbox-geo", keywords: ["mapbox", "geolocalizacion", "geolocalizaci\xF3n", "geocode", "leaflet"] },
  { skill: "spanish-form-validation", keywords: ["curp", "rfc", "zod", "validacion", "validaci\xF3n", "formulario"] },
  { skill: "testing-ci-setup", keywords: ["vitest", "playwright", "test", "ci", "github actions"] },
  { skill: "tiptap-rich-text", keywords: ["tiptap", "editor de texto", "wysiwyg", "rich text"] },
  { skill: "signature-upload-optimizer", keywords: ["firma", "signature", "compress", "upload", "subir foto"] },
  { skill: "security-headers-baseline", keywords: ["csp", "security headers", "hsts", "seguridad web"] },
  { skill: "server-state-standard", keywords: ["react-query", "tanstack", "zustand", "estado"] },
  { skill: "nextjs-folder-structure", keywords: ["next.js", "nextjs", "app router"] }
];
var MIN_MENTIONS = 3;
function localSkillsRepo() {
  return path.join(os.homedir(), "Documents", "Projects", "Skills");
}
function recommendSkills(vault, installedDirs) {
  const idx = VaultIndex.load(vault);
  const corpus = (idx.meta.chunks.map((c) => c.text).join("\n") + "\n" + Object.values(idx.meta.notes).map((n) => `${n.title} ${n.tags.join(" ")}`).join("\n")).toLowerCase();
  const installed = /* @__PURE__ */ new Set();
  for (const dir of installedDirs) {
    try {
      for (const e of fs.readdirSync(dir)) installed.add(e);
    } catch {
    }
  }
  const out = [];
  for (const rule of RULES) {
    if (installed.has(rule.skill)) continue;
    let mentions = 0;
    const found = [];
    for (const kw of rule.keywords) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}-])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}-])`, "gu");
      const count = (corpus.match(re) ?? []).length;
      if (count > 0) found.push(kw);
      mentions += count;
    }
    if (mentions >= MIN_MENTIONS) {
      const local = fs.existsSync(path.join(localSkillsRepo(), rule.skill));
      out.push({
        skill: rule.skill,
        mentions,
        reason: `detect\xE9 ${mentions} menciones de ${found.slice(0, 3).join(", ")} en la b\xF3veda`,
        source: local ? "local" : "skills.sh"
      });
    }
  }
  return out.sort((a, b) => b.mentions - a.mentions);
}
function installSkill(rec, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, rec.skill);
  if (fs.existsSync(dest)) return { ok: true, detail: "ya instalada" };
  if (rec.source === "local") {
    try {
      fs.cpSync(path.join(localSkillsRepo(), rec.skill), dest, { recursive: true });
      return { ok: true, detail: `copiada desde ${localSkillsRepo()}` };
    } catch (e) {
      return { ok: false, detail: `error copiando: ${e.message}` };
    }
  }
  try {
    execFileSync("npx", ["--yes", "skills", "add", rec.skill, "--yes"], {
      stdio: "pipe",
      timeout: 12e4,
      cwd: path.dirname(targetDir)
    });
    return { ok: true, detail: "instalada desde skills.sh" };
  } catch {
    return {
      ok: false,
      detail: `no disponible en skills.sh \u2014 instala manual: npx skills add <owner>/${rec.skill}`
    };
  }
}

// src/core/agents.ts
import fs2 from "fs";
import os2 from "os";
import path2 from "path";
import { execFileSync as execFileSync2 } from "child_process";
var serverScript = () => path2.join(distDir(), "mcp", "server.js");
function readJsonSafe(file) {
  try {
    return JSON.parse(fs2.readFileSync(file, "utf8"));
  } catch {
    if (fs2.existsSync(file)) throw new Error(`no pude parsear ${file} \u2014 rev\xEDsalo manualmente`);
    return {};
  }
}
function writeJson(file, data) {
  fs2.mkdirSync(path2.dirname(file), { recursive: true });
  fs2.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
function mergeMcpServers(file, key = "mcpServers") {
  try {
    const cfg = readJsonSafe(file);
    const servers = cfg[key] ?? {};
    servers["alexandria"] = { command: "node", args: [serverScript()] };
    cfg[key] = servers;
    writeJson(file, cfg);
    return { ok: true, file };
  } catch (e) {
    return { ok: false, file, detail: e.message };
  }
}
function home(...p) {
  return path2.join(os2.homedir(), ...p);
}
function vscodeUserDir() {
  if (process.platform === "darwin") return home("Library", "Application Support", "Code", "User");
  if (process.platform === "win32") return path2.join(process.env.APPDATA ?? home("AppData", "Roaming"), "Code", "User");
  return home(".config", "Code", "User");
}
var AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    supportsProject: true,
    detect: () => fs2.existsSync(home(".claude")),
    register(scope, projectDir) {
      if (scope === "project") return mergeMcpServers(path2.join(projectDir, ".mcp.json"));
      return mergeMcpServers(home(".claude.json"));
    }
  },
  {
    id: "cursor",
    name: "Cursor",
    supportsProject: true,
    detect: () => fs2.existsSync(home(".cursor")),
    register(scope, projectDir) {
      const file = scope === "project" ? path2.join(projectDir, ".cursor", "mcp.json") : home(".cursor", "mcp.json");
      return mergeMcpServers(file);
    }
  },
  {
    id: "opencode",
    name: "OpenCode",
    supportsProject: true,
    detect: () => fs2.existsSync(home(".config", "opencode")) || fs2.existsSync(home(".opencode")),
    register(scope, projectDir) {
      const file = scope === "project" ? path2.join(projectDir, "opencode.json") : home(".config", "opencode", "opencode.json");
      try {
        const cfg = readJsonSafe(file);
        cfg["$schema"] ??= "https://opencode.ai/config.json";
        const mcp = cfg["mcp"] ?? {};
        mcp["alexandria"] = { type: "local", command: ["node", serverScript()], enabled: true };
        cfg["mcp"] = mcp;
        writeJson(file, cfg);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, file, detail: e.message };
      }
    }
  },
  {
    id: "windsurf",
    name: "Windsurf",
    supportsProject: false,
    detect: () => fs2.existsSync(home(".codeium", "windsurf")),
    register() {
      return mergeMcpServers(home(".codeium", "windsurf", "mcp_config.json"));
    }
  },
  {
    id: "cline",
    name: "Cline (VS Code)",
    supportsProject: false,
    detect: () => fs2.existsSync(path2.join(vscodeUserDir(), "globalStorage", "saoudrizwan.claude-dev")),
    register() {
      const file = path2.join(
        vscodeUserDir(),
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json"
      );
      return mergeMcpServers(file);
    }
  },
  {
    id: "codex",
    name: "Codex CLI (OpenAI)",
    supportsProject: false,
    detect: () => fs2.existsSync(home(".codex")),
    register() {
      const file = home(".codex", "config.toml");
      const block = `[mcp_servers.alexandria]
command = "node"
args = ["${serverScript().replace(/\\/g, "\\\\")}"]
`;
      try {
        let text = "";
        try {
          text = fs2.readFileSync(file, "utf8");
        } catch {
        }
        if (/^\[mcp_servers\.alexandria\]/m.test(text)) {
          text = text.replace(/\[mcp_servers\.alexandria\][^[]*/m, block);
        } else {
          text = text.trimEnd() + (text.trim() ? "\n\n" : "") + block;
        }
        fs2.mkdirSync(path2.dirname(file), { recursive: true });
        fs2.writeFileSync(file, text);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, file, detail: e.message };
      }
    }
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    supportsProject: true,
    detect: () => fs2.existsSync(home(".gemini")),
    register(scope, projectDir) {
      const file = scope === "project" ? path2.join(projectDir, ".gemini", "settings.json") : home(".gemini", "settings.json");
      return mergeMcpServers(file);
    }
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    supportsProject: false,
    detect: () => fs2.existsSync(home(".openclaw")),
    register() {
      const file = home(".openclaw", "openclaw.json");
      try {
        const cfg = readJsonSafe(file);
        const servers = cfg["mcpServers"] ?? {};
        servers["alexandria"] = { command: "node", args: [serverScript()], transport: "stdio" };
        cfg["mcpServers"] = servers;
        writeJson(file, cfg);
        return { ok: true, file, detail: "reinicia el gateway de OpenClaw para que lo tome" };
      } catch (e) {
        return { ok: false, file, detail: e.message };
      }
    }
  },
  {
    id: "hermes",
    name: "Hermes Agent (Nous)",
    supportsProject: false,
    detect: () => fs2.existsSync(home(".hermes")),
    register() {
      const file = home(".hermes", "config.yaml");
      try {
        execFileSync2("hermes", ["mcp", "add", "alexandria", "--command", "node", "--args", serverScript()], {
          stdio: "pipe",
          timeout: 15e3
        });
        return { ok: true, file, detail: "v\xEDa hermes mcp add" };
      } catch {
      }
      try {
        let text = "";
        try {
          text = fs2.readFileSync(file, "utf8");
        } catch {
        }
        if (/^\s*alexandria:/m.test(text)) return { ok: true, file, detail: "ya registrado" };
        const entry = `  alexandria:
    type: stdio
    command: node
    args:
      - "${serverScript()}"
`;
        if (/^mcp_servers:\s*$/m.test(text)) {
          text = text.replace(/^mcp_servers:\s*$/m, (m) => `${m}
${entry.trimEnd()}`);
        } else if (/^mcp_servers:/m.test(text)) {
          return { ok: false, file, detail: "mcp_servers ya existe con formato no est\xE1ndar \u2014 agr\xE9galo manual o usa `hermes mcp add`" };
        } else {
          text = text.trimEnd() + (text.trim() ? "\n\n" : "") + "mcp_servers:\n" + entry;
        }
        fs2.mkdirSync(path2.dirname(file), { recursive: true });
        fs2.writeFileSync(file, text);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, file, detail: e.message };
      }
    }
  },
  {
    id: "vscode",
    name: "VS Code (Copilot)",
    supportsProject: true,
    detect: () => fs2.existsSync(vscodeUserDir()),
    register(scope, projectDir) {
      const file = scope === "project" ? path2.join(projectDir, ".vscode", "mcp.json") : path2.join(vscodeUserDir(), "mcp.json");
      try {
        const cfg = readJsonSafe(file);
        const servers = cfg["servers"] ?? {};
        servers["alexandria"] = { type: "stdio", command: "node", args: [serverScript()] };
        cfg["servers"] = servers;
        writeJson(file, cfg);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, file, detail: e.message };
      }
    }
  }
];
function agentById(id) {
  return AGENTS.find((a) => a.id === id.toLowerCase().trim());
}
function resolveAgents(spec) {
  const s = spec.toLowerCase().trim();
  if (s === "all" || s === "todos") return AGENTS;
  if (s === "detected" || s === "detectados") return AGENTS.filter((a) => a.detect());
  return s.split(",").map((id) => agentById(id)).filter((a) => Boolean(a));
}

// src/cli/banner.ts
var ART = [
  "\u2584\u2580\u2588 \u2588\u2591\u2591 \u2588\u2580\u2580 \u2580\u2584\u2580 \u2584\u2580\u2588 \u2588\u2584\u2591\u2588 \u2588\u2580\u2584 \u2588\u2580\u2588 \u2588 \u2584\u2580\u2588",
  "\u2588\u2580\u2588 \u2588\u2584\u2584 \u2588\u2588\u2584 \u2588\u2591\u2588 \u2588\u2580\u2588 \u2588\u2591\u2580\u2588 \u2588\u2584\u2580 \u2588\u2580\u2584 \u2588 \u2588\u2580\u2588"
];
var TAGLINE = "\u{1F3DB}  B\xF3veda de conocimiento local \xB7 creada por Ureck";
var BAND = [45, 51, 87, 123, 159, 195, 230, 220];
var BASE = 30;
var esc = (c) => `\x1B[${c}`;
var fg = (n) => esc(`38;5;${n}m`);
var RESET = esc("0m");
var HIDE = esc("?25l");
var SHOW = esc("?25h");
var UP = (n) => esc(`${n}A`);
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function paintFrame(band) {
  const half = Math.floor(BAND.length / 2);
  return ART.map((line) => {
    let out = "  ";
    const chars = [...line];
    for (let i = 0; i < chars.length; i++) {
      const d = Math.abs(i - band);
      out += d <= half ? fg(BAND[Math.min(BAND.length - 1, half + (band - i))] ?? BAND[0]) + chars[i] : fg(BASE) + chars[i];
    }
    return out + RESET;
  }).join("\n");
}
async function showBanner(animate) {
  const tty = process.stdout.isTTY && !process.env.CI && process.env.TERM !== "dumb";
  const doAnim = animate ?? tty;
  const width = [...ART[0]].length;
  console.log();
  if (!doAnim || !tty) {
    for (const line of ART) console.log("  " + fg(51) + line + RESET);
    console.log("  " + fg(245) + TAGLINE + RESET + "\n");
    return;
  }
  process.stdout.write(HIDE);
  try {
    process.stdout.write(paintFrame(-99) + "\n");
    const half = Math.floor(BAND.length / 2);
    for (let pass = 0; pass < 2; pass++) {
      for (let band = -half; band <= width + half; band += 2) {
        process.stdout.write(UP(ART.length) + "\r" + paintFrame(band) + "\n");
        await sleep(pass === 0 ? 22 : 14);
      }
    }
    process.stdout.write(UP(ART.length) + "\r" + paintFrame(-99) + "\n");
    const tag = [...TAGLINE];
    process.stdout.write("  " + fg(245));
    for (const ch of tag) {
      process.stdout.write(ch);
      await sleep(9);
    }
    process.stdout.write(RESET + "\n\n");
  } finally {
    process.stdout.write(SHOW);
  }
}

// src/core/setup.ts
import fs3 from "fs";
import os3 from "os";
import path3 from "path";
import { execFileSync as execFileSync3 } from "child_process";
var PERSONAL_CONFIG_FILES = [
  ".vault.json",
  ".mcp.json",
  ".cursor/mcp.json",
  "opencode.json",
  ".vscode/mcp.json",
  ".gemini/settings.json"
];
function ensureGitignore(projectDir, vaultRoot) {
  if (!fs3.existsSync(path3.join(projectDir, ".git"))) return null;
  const entries = [];
  const rel = path3.relative(projectDir, vaultRoot);
  if (!rel.startsWith("..")) entries.push(`${rel.split(path3.sep).join("/")}/`);
  entries.push(...PERSONAL_CONFIG_FILES);
  const file = path3.join(projectDir, ".gitignore");
  let text = "";
  try {
    text = fs3.readFileSync(file, "utf8");
  } catch {
  }
  const has = (e) => text.split("\n").some((l) => l.trim() === e || l.trim() === e.replace(/\/$/, ""));
  const missing = entries.filter((e) => !has(e));
  if (missing.length === 0) return null;
  const block = `${text.trimEnd()}

# Alexandria (conocimiento y config personal \u2014 no del repo)
${missing.join("\n")}
`;
  fs3.writeFileSync(file, text.trim() ? block : block.trimStart());
  return file;
}
function untrackPersonalConfigs(projectDir) {
  if (!fs3.existsSync(path3.join(projectDir, ".git"))) return [];
  const untracked = [];
  for (const f of PERSONAL_CONFIG_FILES) {
    if (!fs3.existsSync(path3.join(projectDir, f))) continue;
    try {
      const tracked = execFileSync3("git", ["ls-files", "--error-unmatch", f], {
        cwd: projectDir,
        stdio: ["ignore", "pipe", "ignore"]
      });
      if (tracked.toString().trim()) {
        execFileSync3("git", ["rm", "--cached", "--quiet", f], { cwd: projectDir, stdio: "ignore" });
        untracked.push(f);
      }
    } catch {
    }
  }
  return untracked;
}
var CLAUDE_MD_START = "<!-- alexandria:start -->";
var CLAUDE_MD_END = "<!-- alexandria:end -->";
function configureClaudeMd(scope, projectDir) {
  const file = scope === "project" ? path3.join(projectDir, "CLAUDE.md") : path3.join(os3.homedir(), ".claude", "CLAUDE.md");
  const block = [
    CLAUDE_MD_START,
    "## Alexandria \u2014 b\xF3veda de conocimiento y Protocolo (uso por default)",
    "- ANTES de explorar c\xF3digo o re-derivar contexto: busca con la tool MCP `vault_search`; si la b\xF3veda ya lo sabe, \xFAsalo.",
    "- El Protocolo Alexandria es palanca, no l\xEDmite: tareas simples se responden directo, sin ceremonia. En tareas no triviales: `plan_create` (objetivo + Definition of Done) \u2192 ejecutar con toda tu capacidad \u2192 `task_verify` con evidencia real (la evidencia elimina errores, no frena) \u2192 si algo falla, `vault_search` por lecciones previas antes de re-debuggear \u2192 `lesson_extract` al resolver algo no obvio. Soluciones cacheadas se validan contra el c\xF3digo actual antes de reutilizarse.",
    "- Al descubrir arquitectura o decisiones: `vault_save` (con `[[wikilinks]]`; el t\xEDtulo `Mapa - <proyecto>` actualiza el mapa que se inyecta al iniciar sesi\xF3n).",
    "- `vault_related` trae conocimiento conectado sin releer archivos.",
    CLAUDE_MD_END
  ].join("\n");
  fs3.mkdirSync(path3.dirname(file), { recursive: true });
  let text = "";
  try {
    text = fs3.readFileSync(file, "utf8");
  } catch {
  }
  if (text.includes(CLAUDE_MD_START)) {
    const re = new RegExp(`${CLAUDE_MD_START}[\\s\\S]*?${CLAUDE_MD_END}`);
    text = text.replace(re, block);
  } else {
    text = (text.trimEnd() + "\n\n" + block + "\n").trimStart();
  }
  fs3.writeFileSync(file, text);
  return file;
}
function removeClaudeMd(scope, projectDir) {
  const file = scope === "project" ? path3.join(projectDir, "CLAUDE.md") : path3.join(os3.homedir(), ".claude", "CLAUDE.md");
  let text;
  try {
    text = fs3.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  if (!text.includes(CLAUDE_MD_START)) return null;
  const re = new RegExp(`\\n*${CLAUDE_MD_START}[\\s\\S]*?${CLAUDE_MD_END}\\n*`);
  const cleaned = text.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned === "") {
    fs3.rmSync(file, { force: true });
  } else {
    fs3.writeFileSync(file, cleaned + "\n");
  }
  return file;
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".next", "dist", "build", ".vault", ".claude", "coverage", "Alexandria", "KnowledgeVault"]);
function scanProject(vault, projectDir) {
  const name = path3.basename(projectDir);
  const mapFile = path3.join(vault.managed, "notes", `mapa-${slugify(name)}.md`);
  if (fs3.existsSync(mapFile)) return null;
  const parts = [`Mapa inicial generado por \`ale init\` (escaneo autom\xE1tico). Actual\xEDzalo con vault_save.`];
  try {
    const pkg = JSON.parse(fs3.readFileSync(path3.join(projectDir, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies }).slice(0, 18);
    const dev = Object.keys({ ...pkg.devDependencies }).slice(0, 10);
    parts.push(`## Stack
${pkg.name ? `Paquete: ${pkg.name}` : ""}
- deps: ${deps.join(", ") || "\u2014"}
- dev: ${dev.join(", ") || "\u2014"}`);
    const scripts = Object.entries(pkg.scripts ?? {}).slice(0, 12);
    if (scripts.length) {
      parts.push(`## Comandos
${scripts.map(([k, v]) => `- \`npm run ${k}\` \u2014 ${v}`).join("\n")}`);
    }
  } catch {
  }
  const tree = [];
  const walk = (dir, depth, prefix) => {
    if (depth > 2 || tree.length > 60) return;
    let entries = [];
    try {
      entries = fs3.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith(".") && !SKIP_DIRS.has(e.name));
    } catch {
      return;
    }
    for (const e of entries.filter((x) => x.isDirectory()).slice(0, 14)) {
      tree.push(`${prefix}${e.name}/`);
      walk(path3.join(dir, e.name), depth + 1, prefix + "  ");
    }
  };
  walk(projectDir, 1, "");
  if (tree.length) parts.push(`## Estructura
\`\`\`
${tree.join("\n")}
\`\`\``);
  try {
    const readme = fs3.readFileSync(path3.join(projectDir, "README.md"), "utf8");
    parts.push(`## README (extracto)
${readme.split("\n").slice(0, 15).join("\n")}`);
  } catch {
  }
  return upsertNote(vault.managed, {
    fixedName: `mapa-${slugify(name)}`,
    title: `Mapa - ${name}`,
    type: "map",
    tags: [name, "mapa"],
    dir: "notes",
    content: parts.join("\n\n")
  });
}

// src/cli.ts
function registerAgentsMcp(agents, scope, cwd, portable = false) {
  for (const agent of agents) {
    if (agent.id === "claude") {
      if (scope === "project") {
        const file = registerMcpProject(cwd, portable);
        console.log(pc.green(`\u2713 MCP \u2192 Claude Code (${file})`));
        continue;
      }
      if (registerMcpGlobal(portable)) {
        console.log(pc.green("\u2713 MCP \u2192 Claude Code (scope user, v\xEDa claude mcp add)"));
        continue;
      }
    }
    const effScope = agent.supportsProject && scope === "project" ? "project" : "global";
    const res = agent.register(effScope, cwd);
    if (res.ok) {
      const note = effScope !== scope ? pc.dim(" [global: no soporta por-proyecto]") : "";
      console.log(pc.green(`\u2713 MCP \u2192 ${agent.name} (${res.file})`) + note);
    } else {
      console.log(pc.yellow(`\u26A0 MCP \u2192 ${agent.name}: ${res.detail ?? "fall\xF3"}`));
    }
  }
}
var program = new Command();
program.name("ale").description("Alexandria \u2014 b\xF3veda de conocimiento local para agentes de IA (Claude Code, Cursor, OpenCode, Windsurf y m\xE1s): captura autom\xE1tica, b\xFAsqueda sem\xE1ntica offline y grafo de conexiones.").version(pkgVersion()).option("--vault <path>", "ruta de la b\xF3veda (anula la configuraci\xF3n)");
var getVault = () => resolveVault({ flag: program.opts().vault });
async function downloadModelIfMissing() {
  if (modelPresent()) return true;
  console.log(pc.cyan(`\u2193 Descargando modelo de embeddings (${MODEL_ID}, una sola vez)\u2026`));
  let lastPct = -1;
  try {
    await getEmbedder((pct) => {
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct;
        process.stdout.write(`\r  ${pct}%   `);
      }
    });
    process.stdout.write("\r  100%  \n");
    console.log(pc.green("\u2713 Modelo listo (b\xFAsqueda sem\xE1ntica activada)"));
    return true;
  } catch (e) {
    console.log(pc.yellow(`\u26A0 No pude descargar el modelo (${e.message}).`));
    console.log(pc.yellow("  La b\xF3veda funcionar\xE1 en modo keyword-only; corre `ale doctor` con internet para activar la b\xFAsqueda sem\xE1ntica."));
    return false;
  }
}
async function ensureReady(vault = getVault()) {
  ensureVaultStructure(vault);
  const idx = VaultIndex.load(vault);
  const res = await idx.refresh();
  return { vault, idx, res };
}
program.command("init").description("Crea/conecta la b\xF3veda e instala TODO: modelo, hooks (Claude Code) y MCP en tus agentes de IA (una sola vez, persiste entre sesiones)").option("--project", "registrar para este proyecto (cwd): .vault.json + .claude/settings.json + .mcp.json").option("--global", "registrar para todas las sesiones del usuario (default)").option(
  "--path <dir>",
  "ruta del vault Obsidian (existente o nuevo). Default: ./Alexandria con --project, ~/Alexandria en global"
).option("--auto", "configurar el uso autom\xE1tico en CLAUDE.md sin preguntar").option("--manual", "no tocar CLAUDE.md (config\xFAralo t\xFA)").option("--no-protocol", "instalar sin el Protocolo Alexandria (solo b\xF3veda cl\xE1sica)").option("--portable", "MCP con comando npx (commiteable en repos de equipo) en vez de ruta local").option("--skills", "al final, recomendar e instalar skills seg\xFAn el contenido").option(
  "--agents <ids>",
  `agentes de IA donde registrar el MCP: "all", "detected" o csv de ${AGENTS.map((a) => a.id).join(",")} (default: claude + detectados)`
).action(async (opts) => {
  const isProject = Boolean(opts.project) && !opts.global;
  const cwd = process.cwd();
  const vaultPath = path4.resolve(opts.path ?? (isProject ? path4.join(cwd, "Alexandria") : defaultVaultPath()));
  await showBanner();
  console.log(pc.bold(`Instalaci\xF3n ${isProject ? "por proyecto" : "global"}
`));
  const vault = resolveVault({ flag: vaultPath });
  ensureVaultStructure(vault);
  console.log(pc.green(`\u2713 B\xF3veda en ${vault.root} (vault Obsidian v\xE1lido \u2014 \xE1brelo en Obsidian cuando quieras)`));
  if (isProject) {
    const file = writeProjectConfig(cwd, vaultPath);
    console.log(pc.green(`\u2713 Config del proyecto: ${file}`));
  } else {
    writeGlobalConfig(vaultPath);
    console.log(pc.green(`\u2713 Config global: ${globalConfigPath()}`));
  }
  const settings = isProject ? projectSettingsPath(cwd) : globalSettingsPath();
  registerHooks(settings);
  console.log(pc.green(`\u2713 Hooks registrados en ${settings}`));
  console.log(pc.dim("  SessionStart (digest) \xB7 UserPromptSubmit (contexto+captura) \xB7 Stop/PreCompact (sesiones)"));
  const scope = isProject ? "project" : "global";
  const chosen = opts.agents ? resolveAgents(opts.agents) : [...AGENTS.filter((a) => a.id === "claude" || a.detect())];
  registerAgentsMcp(chosen, scope, cwd, opts.portable);
  if (opts.portable) console.log(pc.dim("  MCP portable (npx) \u2014 apto para commitear en repos de equipo"));
  const skipped = AGENTS.filter((a) => !chosen.includes(a));
  if (skipped.length > 0) {
    console.log(pc.dim(`  Otros agentes disponibles: ${skipped.map((a) => a.id).join(", ")} \u2192 ale agents <ids>`));
  }
  if (isProject) {
    const gi = ensureGitignore(cwd, vault.root);
    if (!opts.portable) {
      const untracked = untrackPersonalConfigs(cwd);
      if (untracked.length > 0) {
        console.log(pc.green(`\u2713 Configs personales sacados del \xEDndice de git: ${untracked.join(", ")}`));
      }
    }
    if (gi) console.log(pc.green(`\u2713 B\xF3veda agregada a ${gi}`));
  }
  let auto = opts.auto ? true : opts.manual ? false : void 0;
  if (auto === void 0) {
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = (await rl.question(pc.bold("\xBFConfigurar a Claude para usar Alexandria autom\xE1ticamente (CLAUDE.md)? [S/n] "))).trim().toLowerCase();
      rl.close();
      auto = ans === "" || ans === "s" || ans === "si" || ans === "s\xED" || ans === "y";
    } else {
      auto = true;
    }
  }
  if (auto) {
    const file = configureClaudeMd(isProject ? "project" : "global", cwd);
    console.log(pc.green(`\u2713 Uso autom\xE1tico configurado en ${file}`));
  } else {
    console.log(pc.dim("  Sin auto-configuraci\xF3n (act\xEDvala luego con: ale init --auto)"));
  }
  setConfigKey("protocol", opts.protocol !== false);
  console.log(
    opts.protocol !== false ? pc.green("\u2713 Protocolo Alexandria activo (plan_create \xB7 task_verify \xB7 lesson_extract) \u2014 ap\xE1galo con: ale config set protocol false") : pc.dim("  Protocolo desactivado (b\xF3veda cl\xE1sica) \u2014 act\xEDvalo con: ale config set protocol true")
  );
  if (isProject) {
    const map = scanProject(vault, cwd);
    if (map) console.log(pc.green(`\u2713 Proyecto escaneado \u2192 ${path4.relative(vault.root, map)} (mapa inicial)`));
  }
  await downloadModelIfMissing();
  const idx = VaultIndex.load(vault);
  const res = await idx.refresh();
  console.log(pc.green(`\u2713 \xCDndice: ${Object.keys(idx.meta.notes).length} notas, ${idx.meta.links.length} conexiones${res.embedded ? "" : " (keyword-only)"}`));
  console.log(pc.bold(pc.green("\n\u2705 Listo. Abre una sesi\xF3n de tu agente y todo funciona solo \u2014 nada que reconectar nunca.")));
  console.log(pc.dim("   Hooks (captura autom\xE1tica) solo en Claude Code; los dem\xE1s agentes usan las tools MCP."));
  console.log(pc.dim('   Prueba: ale search "algo" \xB7 ale graph \xB7 ale stats \xB7 ale agents\n'));
  if (opts.skills) await runSkills({ yes: false, project: isProject });
});
program.command("plan").description("Crear un plan del Protocolo desde un archivo .md/.txt (en vez de escribirlo en la terminal)").argument("<file>", 'archivo con el plan (los checkboxes "- [ ]" se toman como Definition of Done)').option("--title <t>", "t\xEDtulo del plan (default: nombre del archivo o primer heading)").action(async (file, opts) => {
  const { vault } = await ensureReady();
  const abs = path4.resolve(file);
  const raw = fs4.readFileSync(abs, "utf8");
  const heading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = opts.title ?? heading ?? path4.basename(abs).replace(/\.(md|txt)$/i, "");
  const dod = [...raw.matchAll(/^[-*]\s*\[[ x]\]\s*(.+)$/gim)].map((m) => m[1].trim());
  const noteFile = createNote(vault.managed, {
    title: title.startsWith("Plan - ") ? title : `Plan - ${title}`,
    type: "plan",
    status: "active",
    tags: ["plan"],
    content: raw.trim()
  });
  await VaultIndex.load(vault).refresh();
  console.log(pc.green(`\u2713 Plan creado: ${path4.relative(vault.root, noteFile)}`));
  console.log(pc.dim(`  DoD detectada: ${dod.length} criterios${dod.length ? " \u2014 " + dod.slice(0, 3).join(" \xB7 ") + (dod.length > 3 ? " \u2026" : "") : ' (agrega checkboxes "- [ ]" para criterios verificables)'}`));
  console.log(pc.dim("  El agente lo ver\xE1 como plan abierto al iniciar sesi\xF3n y lo retomar\xE1 con task_verify."));
});
program.command("audit").description("Auditor\xEDa del Protocolo: planes sin DoD, planes abiertos, fallos sin lecci\xF3n, notas sueltas").action(async () => {
  const { vault, idx } = await ensureReady();
  const notes = Object.values(idx.meta.notes).filter((n) => !n.rel.split("/").includes("archive"));
  const plans = notes.filter((n) => n.type === "plan");
  const linked = new Set(idx.meta.links.flatMap((l) => [l.from, l.to]));
  console.log(pc.bold("\n\u{1F3DB}\uFE0F  Auditor\xEDa del Protocolo Alexandria\n"));
  const openPlans = plans.filter((p) => p.status === "active");
  console.log(`  Planes: ${plans.length} (${pc.yellow(`${openPlans.length} abiertos`)}, ${plans.filter((p) => p.status === "completed").length} completados, ${plans.filter((p) => p.status === "failed").length} fallidos)`);
  for (const p of openPlans.slice(0, 8)) console.log(pc.dim(`    \u25CB ${p.title}`));
  const chunksByNote = /* @__PURE__ */ new Map();
  for (const c of idx.meta.chunks) chunksByNote.set(c.note, (chunksByNote.get(c.note) ?? "") + "\n" + c.text);
  const noDod = plans.filter((p) => !/\[[ x]\]/i.test(chunksByNote.get(p.rel) ?? ""));
  if (noDod.length > 0) {
    console.log(pc.yellow(`  \u26A0 Planes sin Definition of Done: ${noDod.length}`));
    for (const p of noDod.slice(0, 5)) console.log(pc.dim(`    - ${p.title}`));
  }
  const fails = notes.filter((n) => n.type === "verification" && n.status === "failed");
  const lessons = notes.filter((n) => n.type === "lesson");
  console.log(`  Verificaciones: ${notes.filter((n) => n.type === "verification").length} (${pc.red(`${fails.length} fallos`)}) \xB7 Lecciones: ${pc.green(String(lessons.length))}`);
  if (fails.length > lessons.length) {
    console.log(pc.yellow(`  \u26A0 Hay m\xE1s fallos (${fails.length}) que lecciones (${lessons.length}) \u2014 fallos resueltos sin destilar aprendizaje.`));
  }
  const loose = notes.filter((n) => n.type !== "prompt" && n.type !== "session" && !linked.has(n.rel));
  if (loose.length > 0) {
    console.log(pc.yellow(`  \u26A0 Notas sin conexiones (invisibles para vault_related): ${loose.length}`));
    for (const n of loose.slice(0, 5)) console.log(pc.dim(`    - ${n.title} \u2192 con\xE9ctala con vault_link o [[wikilinks]]`));
  }
  if (noDod.length === 0 && loose.length === 0 && fails.length <= lessons.length) {
    console.log(pc.green("\n  \u2713 B\xF3veda sana: planes con DoD, conocimiento conectado, fallos con lecci\xF3n."));
  }
  console.log();
});
program.command("config").description("Configuraci\xF3n de Alexandria (ej. protocol true/false)").argument("<accion>", "get | set").argument("<clave>", "ej. protocol").argument("[valor]", "para set: true/false o texto").action((accion, clave, valor) => {
  const key = clave.replace(/^protocol\.enabled$/, "protocol");
  if (accion === "get") {
    const v = getConfigKey(key);
    console.log(v === void 0 ? pc.dim(`${key} sin definir (default: ${key === "protocol" ? "true" : "\u2014"})`) : `${key} = ${JSON.stringify(v)}`);
    return;
  }
  if (accion === "set") {
    const parsed = valor === "true" ? true : valor === "false" ? false : valor;
    setConfigKey(key, parsed);
    console.log(pc.green(`\u2713 ${key} = ${JSON.stringify(parsed)}`));
    return;
  }
  console.log(pc.yellow("Acci\xF3n inv\xE1lida: usa get o set"));
});
program.command("consolidate").description("Archiva prompts viejos sin reuso: salen del grafo y de la inyecci\xF3n, pero NUNCA se pierden \u2014 siguen buscables (contexto infinito)").option("--days <n>", "antig\xFCedad m\xEDnima en d\xEDas", "45").option("--dry", "solo mostrar qu\xE9 se archivar\xEDa").action(async (opts) => {
  const { vault, idx } = await ensureReady();
  const cutoff = Date.now() - (parseInt(opts.days, 10) || 45) * 864e5;
  const stale = Object.values(idx.meta.notes).filter(
    (n) => n.type === "prompt" && (n.hits ?? 1) <= 1 && !n.rel.split("/").includes("archive") && n.created !== void 0 && Date.parse(n.created) < cutoff
  );
  if (stale.length === 0) {
    console.log(pc.dim("Nada que consolidar: sin prompts viejos sin uso."));
    return;
  }
  const archiveDir = path4.join(vault.managed, "archive");
  if (!opts.dry) fs4.mkdirSync(archiveDir, { recursive: true });
  for (const n of stale) {
    console.log(
      `${opts.dry ? pc.yellow("se archivar\xEDa") : pc.cyan("archivado")}  ${n.rel} ${pc.dim(`(${(n.created ?? "").slice(0, 10)}, hits ${n.hits})`)}`
    );
    if (!opts.dry) {
      fs4.renameSync(path4.join(vault.root, n.rel), path4.join(archiveDir, path4.basename(n.rel)));
    }
  }
  if (!opts.dry) {
    await VaultIndex.load(vault).refresh();
    console.log(
      pc.green(`
\u2713 ${stale.length} prompts archivados en ${path4.relative(vault.root, archiveDir)}/ \u2014 fuera del grafo, siguen buscables. Nada se pierde.`)
    );
  } else {
    console.log(pc.dim(`
${stale.length} candidatos. Corre sin --dry para archivarlos.`));
  }
});
program.command("agents").description("Lista los agentes de IA soportados y registra el MCP de Alexandria en los que elijas").argument("[ids]", `"all", "detected" o csv (${AGENTS.map((a) => a.id).join(",")})`).option("--project", "registrar a nivel proyecto (cwd) cuando el agente lo soporte").action((ids, opts) => {
  if (!ids) {
    console.log(pc.bold("\n\u{1F3DB}\uFE0F  Agentes de IA soportados:\n"));
    for (const a of AGENTS) {
      const det = a.detect();
      console.log(
        `  ${det ? pc.green("\u25CF") : pc.dim("\u25CB")} ${a.id.padEnd(9)} ${a.name}${det ? pc.green("  detectado") : pc.dim("  no detectado")}${a.supportsProject ? "" : pc.dim("  (solo global)")}`
      );
    }
    console.log(pc.dim("\n  Registrar MCP: ale agents all \xB7 ale agents detected \xB7 ale agents cursor,opencode\n"));
    return;
  }
  const chosen = resolveAgents(ids);
  if (chosen.length === 0) {
    console.log(pc.yellow(`Ning\xFAn agente coincide con \xAB${ids}\xBB. Ids v\xE1lidos: ${AGENTS.map((a) => a.id).join(", ")}`));
    return;
  }
  registerAgentsMcp(chosen, opts.project ? "project" : "global", process.cwd());
  console.log(pc.dim("\n  Reinicia el agente (o recarga sus MCP) para que tome el servidor.\n"));
});
program.command("add").description("Guardar una nota manualmente").argument("<title>", "t\xEDtulo").option("-c, --content <text>", "contenido markdown (o se lee de stdin)").option("-f, --file <path>", "leer el contenido desde un archivo .md/.txt del proyecto").option("-t, --tags <tags>", "tags separados por coma").action(async (title, opts) => {
  const { vault } = await ensureReady();
  let content = opts.content;
  if (!content && opts.file) {
    content = fs4.readFileSync(path4.resolve(opts.file), "utf8");
  }
  if (!content && !process.stdin.isTTY) {
    content = fs4.readFileSync(0, "utf8");
  }
  const file = createNote(vault.managed, {
    title,
    content: content ?? "",
    tags: opts.tags ? opts.tags.split(",").map((t) => t.trim()) : []
  });
  await VaultIndex.load(vault).refresh();
  console.log(pc.green(`\u2713 ${path4.relative(vault.root, file)}`));
});
program.command("search").description("B\xFAsqueda h\xEDbrida (sem\xE1ntica + keyword) en la b\xF3veda").argument("<query...>", "qu\xE9 buscar").option("-k <n>", "n\xFAmero de resultados", "6").option("--expand", "incluir vecinos del grafo").action(async (query, opts) => {
  const vault = getVault();
  if (!vaultExists(vault)) {
    console.log(pc.yellow("No hay b\xF3veda aqu\xED. Corre `ale init` primero."));
    return;
  }
  const q = query.join(" ");
  const results = await hybridSearch(vault, q, parseInt(opts.k, 10) || 6, { expand: opts.expand });
  if (results.length === 0) {
    console.log(pc.dim("Sin resultados."));
    return;
  }
  const maxCos = results.reduce((m, r) => Math.max(m, r.cosine), 0);
  const relevanceLabel = (cos) => {
    if (maxCos === 0 || cos === 0) return "";
    if (cos >= 0.82 && cos >= maxCos - 0.02) return pc.green(" \u25CF relevancia alta");
    if (cos >= 0.79 && cos >= maxCos - 0.05) return pc.yellow(" \u25CF relevancia media");
    return pc.dim(" \u25CF relevancia baja");
  };
  for (const r of results) {
    const cos = r.cosine > 0 ? pc.dim(` cos ${r.cosine.toFixed(2)}`) : "";
    console.log(`
${pc.bold(pc.cyan(r.note.title))} ${pc.dim(`(${r.note.rel}, ${r.note.type})`)}${relevanceLabel(r.cosine)}${cos}`);
    for (const e of r.excerpts) {
      console.log(pc.dim("  " + e.replace(/\n+/g, " ").slice(0, 220)));
    }
  }
  console.log();
});
program.command("reindex").description("Reindexar la b\xF3veda (incremental; --force para todo)").option("--force", "reindexar todo desde cero").action(async (opts) => {
  const vault = getVault();
  ensureVaultStructure(vault);
  await downloadModelIfMissing();
  const idx = VaultIndex.load(vault);
  const res = await idx.refresh(modelPresent(), opts.force);
  console.log(
    pc.green(
      `\u2713 ${res.changed} notas reindexadas, ${res.removed} eliminadas \u2014 ${Object.keys(idx.meta.notes).length} notas, ${idx.meta.links.length} conexiones${res.embedded ? "" : " (keyword-only)"}`
    )
  );
});
program.command("graph").description("Visor del grafo de conocimiento (local, estilo Obsidian/Graphify)").option("--out <file>", "escribir HTML autocontenido en vez de servir").option("--no-open", "no abrir el navegador").action(async (opts) => {
  const { vault } = await ensureReady();
  const where = await serveGraph(vault, { out: opts.out, open: opts.open });
  if (opts.out) console.log(pc.green(`\u2713 Grafo escrito en ${where}`));
  else {
    console.log(pc.green(`\u2713 Grafo en ${pc.bold(where)} ${pc.dim("(Ctrl+C para cerrar)")}`));
    await new Promise(() => {
    });
  }
});
program.command("stats").description("Estado de la b\xF3veda y tokens ahorrados").action(async () => {
  const { vault, idx } = await ensureReady();
  const notes = Object.values(idx.meta.notes);
  const byType = notes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});
  const s = readStats(vault);
  console.log(pc.bold("\n\u{1F9E0} B\xF3veda: ") + vault.root + pc.dim(` (${vault.source})`));
  console.log(`  Notas: ${notes.length} ${pc.dim(JSON.stringify(byType))}`);
  console.log(`  Chunks indexados: ${idx.meta.chunks.length} \xB7 Conexiones: ${idx.meta.links.length}`);
  console.log(`  B\xFAsqueda sem\xE1ntica: ${idx.emb ? pc.green("activa") : pc.yellow("keyword-only (corre ale reindex con internet)")}`);
  console.log(pc.bold("\n\u{1F3DB}\uFE0F  Protocolo"));
  const plans = notes.filter((n) => n.type === "plan");
  const verifs = notes.filter((n) => n.type === "verification");
  const lessons = notes.filter((n) => n.type === "lesson");
  const reused = lessons.filter((n) => (n.hits ?? 1) > 1).length;
  const passed = verifs.filter((n) => n.status === "completed").length;
  console.log(`  Planes: ${plans.length} (${plans.filter((p) => p.status === "active").length} abiertos) \xB7 Verificaciones: ${verifs.length}${verifs.length ? ` (${Math.round(passed / verifs.length * 100)}% \u2713)` : ""}`);
  console.log(`  Lecciones: ${lessons.length} (${reused} reutilizadas \u2014 cada reuso = debug que no se repiti\xF3)`);
  console.log(pc.bold("\n\u{1F4CA} Medido (hechos, no estimaci\xF3n)"));
  console.log(`  Inyecciones de contexto: ${s.injections}`);
  console.log(`  Aciertos de cach\xE9 de soluci\xF3n: ${s.solutionCacheHits} (${s.cacheHitTokens.toLocaleString()} tokens \u2014 el ahorro m\xE1s claro: soluciones no re-derivadas)`);
  console.log(`  Tokens inyectados (costo): ~${s.injectedTokens.toLocaleString()}`);
  if (s.injectedTokens > 0) {
    console.log(pc.bold("\n\u{1F4B0} Ahorro estimado ") + pc.dim("(banda, NO auditado)"));
    console.log(`  ~${pc.green(s.estSavedLow.toLocaleString())} \u2013 ${pc.green(s.estSavedHigh.toLocaleString())} tokens`);
    console.log(pc.dim(`  Supuesto: el contexto inyectado sustituye releer 3\u20138\xD7 su tama\xF1o en archivos. No es medici\xF3n; el n\xFAmero real depende de qu\xE9 habr\xEDas rele\xEDdo sin la b\xF3veda.`));
  }
  console.log();
});
async function runSkills(opts) {
  const { vault } = await ensureReady();
  const cwd = process.cwd();
  const targetDir = opts.project ? path4.join(cwd, ".claude", "skills") : path4.join(process.env.HOME ?? process.env.USERPROFILE ?? cwd, ".claude", "skills");
  const recs = recommendSkills(vault, [targetDir]);
  if (recs.length === 0) {
    console.log(pc.dim("Sin recomendaciones nuevas: la b\xF3veda a\xFAn no tiene suficientes patrones (o ya est\xE1 todo instalado)."));
    return;
  }
  console.log(pc.bold(`
\u{1F4E6} Skills recomendadas seg\xFAn tu b\xF3veda (destino: ${targetDir}):
`));
  for (const r of recs) {
    console.log(`  ${pc.cyan(r.skill)} ${pc.dim(`[${r.source}]`)} \u2014 ${r.reason}`);
  }
  let selected = recs;
  if (!opts.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(pc.bold("\n\xBFInstalar todas? [s/N/n\xFAmeros separados por coma] "))).trim().toLowerCase();
    rl.close();
    if (answer === "s" || answer === "si" || answer === "s\xED" || answer === "y") {
      selected = recs;
    } else if (/^[\d,\s]+$/.test(answer)) {
      const nums = answer.split(",").map((n) => parseInt(n.trim(), 10) - 1);
      selected = recs.filter((_, i) => nums.includes(i));
    } else {
      console.log(pc.dim("Nada instalado."));
      return;
    }
  }
  for (const r of selected) {
    const res = installSkill(r, targetDir);
    console.log(res.ok ? pc.green(`\u2713 ${r.skill} \u2014 ${res.detail}`) : pc.yellow(`\u26A0 ${r.skill} \u2014 ${res.detail}`));
  }
}
program.command("skills").description("Analiza la b\xF3veda y recomienda/instala skills de Claude (skills.sh o repo local)").option("-y, --yes", "instalar sin preguntar").option("--project", "instalar en .claude/skills del proyecto (default: global del usuario)").action(runSkills);
program.command("doctor").description("Verifica y repara la instalaci\xF3n (modelo, hooks, MCP, \xEDndice)").option("--project", "revisar registros del proyecto (cwd) en vez de los globales").action(async (opts) => {
  const vault = getVault();
  const cwd = process.cwd();
  const nodeOk = parseInt(process.versions.node.split(".")[0], 10) >= 20;
  console.log(pc.bold("\n\u{1FA7A} ale doctor\n"));
  console.log(`${nodeOk ? pc.green("\u2713") : pc.red("\u2717")} Node ${process.versions.node} ${nodeOk ? "" : "(se requiere \u2265 20: https://nodejs.org)"}`);
  ensureVaultStructure(vault);
  console.log(`${pc.green("\u2713")} B\xF3veda: ${vault.root} (${vault.source})`);
  const model = await downloadModelIfMissing();
  console.log(`${model ? pc.green("\u2713") : pc.yellow("\u26A0")} Modelo de embeddings ${model ? "presente" : "ausente (keyword-only)"}`);
  const settings = opts.project ? projectSettingsPath(cwd) : globalSettingsPath();
  if (!hooksRegistered(settings)) {
    registerHooks(settings);
    console.log(`${pc.green("\u2713")} Hooks re-registrados en ${settings}`);
  } else {
    console.log(`${pc.green("\u2713")} Hooks registrados (${settings})`);
  }
  if (opts.project) {
    if (!mcpRegisteredProject(cwd)) {
      registerMcpProject(cwd);
      console.log(`${pc.green("\u2713")} MCP re-registrado en .mcp.json`);
    } else {
      console.log(`${pc.green("\u2713")} MCP registrado (.mcp.json)`);
    }
  } else {
    console.log(pc.dim("  MCP global: verifica con `claude mcp list` (repara con `claude mcp add --scope user alexandria -- node \u2026/mcp/server.js`)"));
  }
  const idx = VaultIndex.load(vault);
  const res = await idx.refresh();
  console.log(`${pc.green("\u2713")} \xCDndice al d\xEDa (${res.changed} reindexadas, ${Object.keys(idx.meta.notes).length} notas)
`);
});
program.command("uninstall").description("Reversi\xF3n limpia: quita hooks, bloque de CLAUDE.md y MCP del proyecto (no borra la b\xF3veda ni las notas)").option("--project", "quitar del proyecto (cwd)").action((opts) => {
  const cwd = process.cwd();
  const scope = opts.project ? "project" : "global";
  const settings = opts.project ? projectSettingsPath(cwd) : globalSettingsPath();
  unregisterHooks(settings);
  console.log(pc.green(`\u2713 Hooks de alexandria eliminados de ${settings}`));
  const claudeMd = removeClaudeMd(scope, cwd);
  if (claudeMd) console.log(pc.green(`\u2713 Bloque de Alexandria removido de ${claudeMd}`));
  if (opts.project) {
    const mcpFile = path4.join(cwd, ".mcp.json");
    try {
      const cfg = JSON.parse(fs4.readFileSync(mcpFile, "utf8"));
      if (cfg.mcpServers?.alexandria) {
        delete cfg.mcpServers.alexandria;
        if (Object.keys(cfg.mcpServers).length === 0) delete cfg.mcpServers;
        if (Object.keys(cfg).length === 0) fs4.rmSync(mcpFile, { force: true });
        else fs4.writeFileSync(mcpFile, JSON.stringify(cfg, null, 2) + "\n");
        console.log(pc.green("\u2713 MCP removido de .mcp.json"));
      }
    } catch {
    }
    console.log(pc.dim('  Otros agentes (Cursor/OpenCode/\u2026): quita "alexandria" de su config si lo registraste.'));
  } else {
    console.log(pc.dim("  MCP global: qu\xEDtalo con `claude mcp remove alexandria`. Tus notas quedan intactas."));
  }
});
program.command("serve-mcp").description("Correr el servidor MCP por stdio (lo usa Claude Code internamente)").action(async () => {
  await import("./mcp/server.js");
});
if (process.argv.length <= 2) {
  await showBanner();
  program.outputHelp();
} else {
  program.parseAsync().catch((e) => {
    console.error(pc.red(`Error: ${e.message}`));
    process.exit(1);
  });
}
