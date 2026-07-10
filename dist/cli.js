#!/usr/bin/env node
import {
  readStats
} from "./chunk-OPUPZRP6.js";
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
} from "./chunk-KHTYRYDR.js";
import {
  hybridSearch
} from "./chunk-O7FDC2PB.js";
import {
  VaultIndex
} from "./chunk-UWAIMIG2.js";
import {
  createNote,
  defaultVaultPath,
  ensureVaultStructure,
  globalConfigPath,
  resolveVault,
  vaultExists,
  writeGlobalConfig,
  writeProjectConfig
} from "./chunk-CZM5NQZJ.js";
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

// src/graph/viewer.ts
import fs from "fs";
import http from "http";
import path from "path";
import { spawn } from "child_process";
function buildGraphData(idx) {
  const deg = /* @__PURE__ */ new Map();
  for (const l of idx.meta.links) {
    deg.set(l.from, (deg.get(l.from) ?? 0) + 1);
    deg.set(l.to, (deg.get(l.to) ?? 0) + 1);
  }
  const nodes = Object.values(idx.meta.notes).map((n) => ({
    id: n.rel,
    title: n.title,
    type: n.type,
    deg: deg.get(n.rel) ?? 0,
    hits: n.hits ?? 1
  }));
  const edges = idx.meta.links.map((l) => ({ s: l.from, t: l.to, type: l.type }));
  return { nodes, edges };
}
function renderGraphHtml(data) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Alexandria \u2014 grafo de conocimiento</title>
<style>
  html,body{margin:0;height:100%;background:#0f1117;color:#e6e6e6;font:14px/1.4 system-ui,sans-serif;overflow:hidden}
  #hud{position:fixed;top:12px;left:12px;background:#1a1d27cc;padding:10px 14px;border-radius:10px;max-width:340px}
  #hud h1{font-size:15px;margin:0 0 4px}
  #hud .leg span{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 10px}
  #info{position:fixed;bottom:12px;left:12px;background:#1a1d27cc;padding:10px 14px;border-radius:10px;max-width:420px;display:none}
  canvas{display:block}
</style>
</head>
<body>
<div id="hud">
  <h1>\u{1F9E0} Alexandria \u2014 grafo</h1>
  <div id="counts"></div>
  <div class="leg">
    <span style="background:#7aa2f7"></span>nota
    <span style="background:#9ece6a"></span>sesi\xF3n
    <span style="background:#e0af68"></span>prompt
    <span style="background:#f7768e"></span>mapa
  </div>
  <div style="opacity:.7;margin-top:4px">arrastra nodos \xB7 rueda = zoom \xB7 click = detalle<br>l\xEDnea s\xF3lida = [[wikilink]] \xB7 punteada = sem\xE1ntica</div>
</div>
<div id="info"></div>
<canvas id="c"></canvas>
<script>
const DATA = ${JSON.stringify(data)};
const COLORS = { note:'#7aa2f7', session:'#9ece6a', prompt:'#e0af68', map:'#f7768e' };
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W, H; const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
fit(); addEventListener('resize', fit);
document.getElementById('counts').textContent = DATA.nodes.length + ' notas \xB7 ' + DATA.edges.length + ' conexiones';

const nodes = DATA.nodes.map((n,i) => ({...n,
  x: Math.cos(i/DATA.nodes.length*6.283)*Math.min(W,H)*.3 + W/2 + (Math.random()-.5)*40,
  y: Math.sin(i/DATA.nodes.length*6.283)*Math.min(W,H)*.3 + H/2 + (Math.random()-.5)*40,
  vx:0, vy:0, r: 4 + Math.min(n.deg,12)*1.2 + Math.min(n.hits,8)*.5
}));
const byId = new Map(nodes.map(n=>[n.id,n]));
const edges = DATA.edges.filter(e=>byId.has(e.s)&&byId.has(e.t)).map(e=>({a:byId.get(e.s), b:byId.get(e.t), type:e.type}));

let zoom = 1, panX = 0, panY = 0, dragNode = null, hot = true, heat = 300;
function step(){
  if(!hot) return;
  // repulsi\xF3n O(n\xB2) \u2014 bien hasta ~1500 nodos
  for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i], b=nodes[j];
    let dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2);
    const f = Math.min(1800/d2, 8);
    dx/=d; dy/=d;
    a.vx-=dx*f; a.vy-=dy*f; b.vx+=dx*f; b.vy+=dy*f;
  }
  for(const e of edges){
    let dx=e.b.x-e.a.x, dy=e.b.y-e.a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01;
    const want = e.type==='wikilink'?110:160;
    const f=(d-want)*0.004*(e.type==='wikilink'?1.4:0.7);
    dx/=d; dy/=d;
    e.a.vx+=dx*f*d; e.a.vy+=dy*f*d; e.b.vx-=dx*f*d; e.b.vy-=dy*f*d;
  }
  for(const n of nodes){
    n.vx += (W/2-n.x)*0.0004; n.vy += (H/2-n.y)*0.0004; // gravedad al centro
    n.vx*=0.85; n.vy*=0.85;
    if(n!==dragNode){ n.x+=n.vx; n.y+=n.vy; }
  }
  if(--heat<=0 && !dragNode) hot=false;
}
function draw(){
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H);
  ctx.setTransform(zoom,0,0,zoom,panX,panY);
  for(const e of edges){
    ctx.beginPath();
    ctx.setLineDash(e.type==='semantic'?[4,4]:[]);
    ctx.strokeStyle = e.type==='semantic' ? '#3b4261' : '#565f89';
    ctx.lineWidth = 1;
    ctx.moveTo(e.a.x,e.a.y); ctx.lineTo(e.b.x,e.b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  for(const n of nodes){
    ctx.beginPath(); ctx.fillStyle = COLORS[n.type]||'#7aa2f7';
    ctx.arc(n.x,n.y,n.r,0,6.283); ctx.fill();
  }
  if(zoom>0.6){
    ctx.fillStyle='#c0caf5'; ctx.font = (11/Math.max(zoom,1))+'px system-ui';
    for(const n of nodes){ if(n.deg>0||zoom>1.1) ctx.fillText(n.title.slice(0,28), n.x+n.r+3, n.y+3); }
  }
}
(function loop(){ step(); draw(); requestAnimationFrame(loop); })();

const toWorld = (x,y)=>[(x-panX)/zoom,(y-panY)/zoom];
const pick = (x,y)=>{ const [wx,wy]=toWorld(x,y); return nodes.find(n=>{const dx=n.x-wx,dy=n.y-wy;return dx*dx+dy*dy<=(n.r+4)*(n.r+4);}); };
let panning=false, px=0, py=0;
cv.addEventListener('mousedown',e=>{ const n=pick(e.clientX,e.clientY); if(n){dragNode=n;hot=true;heat=150;} else {panning=true;px=e.clientX;py=e.clientY;} });
addEventListener('mousemove',e=>{
  if(dragNode){ const [wx,wy]=toWorld(e.clientX,e.clientY); dragNode.x=wx; dragNode.y=wy; }
  else if(panning){ panX+=e.clientX-px; panY+=e.clientY-py; px=e.clientX; py=e.clientY; }
});
addEventListener('mouseup',e=>{
  if(dragNode===null && !panning) return;
  if(dragNode){ dragNode=null; }
  panning=false;
});
cv.addEventListener('click',e=>{
  const n=pick(e.clientX,e.clientY); const info=document.getElementById('info');
  if(n){ info.style.display='block'; info.innerHTML='<b>'+n.title+'</b><br><span style="opacity:.7">'+n.id+'</span><br>tipo: '+n.type+' \xB7 conexiones: '+n.deg+' \xB7 usos: '+n.hits; }
  else info.style.display='none';
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const f = e.deltaY<0?1.1:0.9;
  panX = e.clientX-(e.clientX-panX)*f; panY = e.clientY-(e.clientY-panY)*f; zoom*=f;
},{passive:false});
</script>
</body>
</html>`;
}
function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
  }
}
async function serveGraph(vault, opts = {}) {
  const idx = VaultIndex.load(vault);
  await idx.refresh(false).catch(() => {
  });
  const html = renderGraphHtml(buildGraphData(idx));
  if (opts.out) {
    const file = path.resolve(opts.out);
    fs.writeFileSync(file, html);
    return file;
  }
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}`;
      if (opts.open !== false) openBrowser(url);
      resolve(url);
    });
  });
}

// src/skills/recommend.ts
import fs2 from "fs";
import os from "os";
import path2 from "path";
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
  return path2.join(os.homedir(), "Documents", "Projects", "Skills");
}
function recommendSkills(vault, installedDirs) {
  const idx = VaultIndex.load(vault);
  const corpus = (idx.meta.chunks.map((c) => c.text).join("\n") + "\n" + Object.values(idx.meta.notes).map((n) => `${n.title} ${n.tags.join(" ")}`).join("\n")).toLowerCase();
  const installed = /* @__PURE__ */ new Set();
  for (const dir of installedDirs) {
    try {
      for (const e of fs2.readdirSync(dir)) installed.add(e);
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
      const local = fs2.existsSync(path2.join(localSkillsRepo(), rule.skill));
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
  fs2.mkdirSync(targetDir, { recursive: true });
  const dest = path2.join(targetDir, rec.skill);
  if (fs2.existsSync(dest)) return { ok: true, detail: "ya instalada" };
  if (rec.source === "local") {
    try {
      fs2.cpSync(path2.join(localSkillsRepo(), rec.skill), dest, { recursive: true });
      return { ok: true, detail: `copiada desde ${localSkillsRepo()}` };
    } catch (e) {
      return { ok: false, detail: `error copiando: ${e.message}` };
    }
  }
  try {
    execFileSync("npx", ["--yes", "skills", "add", rec.skill, "--yes"], {
      stdio: "pipe",
      timeout: 12e4,
      cwd: path2.dirname(targetDir)
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
import fs3 from "fs";
import os2 from "os";
import path3 from "path";
import { execFileSync as execFileSync2 } from "child_process";
var serverScript = () => path3.join(distDir(), "mcp", "server.js");
function readJsonSafe(file) {
  try {
    return JSON.parse(fs3.readFileSync(file, "utf8"));
  } catch {
    if (fs3.existsSync(file)) throw new Error(`no pude parsear ${file} \u2014 rev\xEDsalo manualmente`);
    return {};
  }
}
function writeJson(file, data) {
  fs3.mkdirSync(path3.dirname(file), { recursive: true });
  fs3.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
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
  return path3.join(os2.homedir(), ...p);
}
function vscodeUserDir() {
  if (process.platform === "darwin") return home("Library", "Application Support", "Code", "User");
  if (process.platform === "win32") return path3.join(process.env.APPDATA ?? home("AppData", "Roaming"), "Code", "User");
  return home(".config", "Code", "User");
}
var AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    supportsProject: true,
    detect: () => fs3.existsSync(home(".claude")),
    register(scope, projectDir) {
      if (scope === "project") return mergeMcpServers(path3.join(projectDir, ".mcp.json"));
      return mergeMcpServers(home(".claude.json"));
    }
  },
  {
    id: "cursor",
    name: "Cursor",
    supportsProject: true,
    detect: () => fs3.existsSync(home(".cursor")),
    register(scope, projectDir) {
      const file = scope === "project" ? path3.join(projectDir, ".cursor", "mcp.json") : home(".cursor", "mcp.json");
      return mergeMcpServers(file);
    }
  },
  {
    id: "opencode",
    name: "OpenCode",
    supportsProject: true,
    detect: () => fs3.existsSync(home(".config", "opencode")) || fs3.existsSync(home(".opencode")),
    register(scope, projectDir) {
      const file = scope === "project" ? path3.join(projectDir, "opencode.json") : home(".config", "opencode", "opencode.json");
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
    detect: () => fs3.existsSync(home(".codeium", "windsurf")),
    register() {
      return mergeMcpServers(home(".codeium", "windsurf", "mcp_config.json"));
    }
  },
  {
    id: "cline",
    name: "Cline (VS Code)",
    supportsProject: false,
    detect: () => fs3.existsSync(path3.join(vscodeUserDir(), "globalStorage", "saoudrizwan.claude-dev")),
    register() {
      const file = path3.join(
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
    detect: () => fs3.existsSync(home(".codex")),
    register() {
      const file = home(".codex", "config.toml");
      const block = `[mcp_servers.alexandria]
command = "node"
args = ["${serverScript().replace(/\\/g, "\\\\")}"]
`;
      try {
        let text = "";
        try {
          text = fs3.readFileSync(file, "utf8");
        } catch {
        }
        if (/^\[mcp_servers\.alexandria\]/m.test(text)) {
          text = text.replace(/\[mcp_servers\.alexandria\][^[]*/m, block);
        } else {
          text = text.trimEnd() + (text.trim() ? "\n\n" : "") + block;
        }
        fs3.mkdirSync(path3.dirname(file), { recursive: true });
        fs3.writeFileSync(file, text);
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
    detect: () => fs3.existsSync(home(".gemini")),
    register(scope, projectDir) {
      const file = scope === "project" ? path3.join(projectDir, ".gemini", "settings.json") : home(".gemini", "settings.json");
      return mergeMcpServers(file);
    }
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    supportsProject: false,
    detect: () => fs3.existsSync(home(".openclaw")),
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
    detect: () => fs3.existsSync(home(".hermes")),
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
          text = fs3.readFileSync(file, "utf8");
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
        fs3.mkdirSync(path3.dirname(file), { recursive: true });
        fs3.writeFileSync(file, text);
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
    detect: () => fs3.existsSync(vscodeUserDir()),
    register(scope, projectDir) {
      const file = scope === "project" ? path3.join(projectDir, ".vscode", "mcp.json") : path3.join(vscodeUserDir(), "mcp.json");
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

// src/cli.ts
function registerAgentsMcp(agents, scope, cwd) {
  for (const agent of agents) {
    if (agent.id === "claude") {
      if (scope === "project") {
        const file = registerMcpProject(cwd);
        console.log(pc.green(`\u2713 MCP \u2192 Claude Code (${file})`));
        continue;
      }
      if (registerMcpGlobal()) {
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
  "ruta del vault Obsidian (existente o nuevo). Default: ./KnowledgeVault con --project, ~/KnowledgeVault en global"
).option("--skills", "al final, recomendar e instalar skills seg\xFAn el contenido").option(
  "--agents <ids>",
  `agentes de IA donde registrar el MCP: "all", "detected" o csv de ${AGENTS.map((a) => a.id).join(",")} (default: claude + detectados)`
).action(async (opts) => {
  const isProject = Boolean(opts.project) && !opts.global;
  const cwd = process.cwd();
  const vaultPath = path4.resolve(opts.path ?? (isProject ? path4.join(cwd, "KnowledgeVault") : defaultVaultPath()));
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
  registerAgentsMcp(chosen, scope, cwd);
  const skipped = AGENTS.filter((a) => !chosen.includes(a));
  if (skipped.length > 0) {
    console.log(pc.dim(`  Otros agentes disponibles: ${skipped.map((a) => a.id).join(", ")} \u2192 ale agents <ids>`));
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
program.command("add").description("Guardar una nota manualmente").argument("<title>", "t\xEDtulo").option("-c, --content <text>", "contenido markdown (o se lee de stdin)").option("-t, --tags <tags>", "tags separados por coma").action(async (title, opts) => {
  const { vault } = await ensureReady();
  let content = opts.content;
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
  console.log(pc.bold("\n\u{1F4B0} Ahorro estimado"));
  console.log(`  Inyecciones de contexto: ${s.injections} (${s.solutionCacheHits} con soluci\xF3n cacheada)`);
  console.log(`  Tokens inyectados: ~${s.injectedTokens.toLocaleString()}`);
  console.log(`  Tokens ahorrados (vs re-explorar): ~${pc.green(s.estimatedSavedTokens.toLocaleString())}
`);
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
program.command("uninstall").description("Quita hooks de Claude Code (no borra la b\xF3veda ni las notas)").option("--project", "quitar del proyecto (cwd)").action((opts) => {
  const settings = opts.project ? projectSettingsPath(process.cwd()) : globalSettingsPath();
  unregisterHooks(settings);
  console.log(pc.green(`\u2713 Hooks de alexandria eliminados de ${settings}`));
  console.log(pc.dim("  MCP: qu\xEDtalo con `claude mcp remove alexandria` o borrando la entrada de .mcp.json. Tus notas quedan intactas."));
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
