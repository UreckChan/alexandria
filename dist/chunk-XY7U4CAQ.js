#!/usr/bin/env node
import {
  VaultIndex
} from "./chunk-AXUEYSNZ.js";

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
  return {
    nodes: Object.values(idx.meta.notes).filter((n) => !n.rel.split("/").includes("archive")).map((n) => ({
      id: n.rel,
      title: n.title,
      type: n.type,
      deg: deg.get(n.rel) ?? 0,
      hits: n.hits ?? 1,
      tags: n.tags
    })),
    edges: idx.meta.links.map((l) => ({ s: l.from, t: l.to, type: l.type, w: l.w })),
    generated: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function renderGraphHtml(data, live) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Alexandria \u2014 grafo de conocimiento</title>
<style>
  :root { --bg:#0b0d13; --panel:#141826f2; --line:#232a3d; --txt:#dde3f4; --dim:#8b93ad; }
  html,body{margin:0;height:100%;background:var(--bg);color:var(--txt);font:14px/1.45 -apple-system,system-ui,sans-serif;overflow:hidden}
  canvas{display:block;cursor:grab}
  canvas.dragging{cursor:grabbing}
  .card{position:fixed;background:var(--panel);border:1px solid var(--line);border-radius:14px;backdrop-filter:blur(12px);box-shadow:0 8px 30px #0008}
  #hud{top:14px;left:14px;padding:12px 16px;max-width:330px}
  #hud h1{font-size:15px;margin:0 0 2px;letter-spacing:.3px}
  #hud .sub{color:var(--dim);font-size:12px}
  .leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--dim)}
  .leg b{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px}
  .leg label{cursor:pointer;user-select:none}
  .leg input{accent-color:#7aa2f7;margin-right:4px;vertical-align:-2px}
  #hint{color:var(--dim);font-size:11px;margin-top:6px}
  #info{bottom:14px;left:14px;padding:12px 16px;max-width:440px;display:none}
  #info b{font-size:14px}
  #info .meta{color:var(--dim);font-size:12px;margin-top:2px}
  #tip{padding:6px 10px;font-size:12px;pointer-events:none;display:none;border-radius:8px;white-space:nowrap}
  #live{top:14px;right:14px;padding:6px 12px;font-size:11px;color:var(--dim);display:${live ? "block" : "none"}}
  #live b{color:#9ece6a}
  #search{position:fixed;top:14px;left:50%;transform:translateX(-50%);}
  #search input{background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--txt);padding:7px 12px;width:230px;font-size:13px;outline:none}
  #search input:focus{border-color:#7aa2f7}
</style>
</head>
<body>
<div id="hud" class="card">
  <h1>\u{1F3DB}\uFE0F Alexandria</h1>
  <div class="sub" id="counts"></div>
  <div class="leg" id="leg">
    <label><input type="checkbox" data-type="note" checked><b style="background:#7aa2f7"></b>nota</label>
    <label><input type="checkbox" data-type="map" checked><b style="background:#f7768e"></b>mapa</label>
    <label><input type="checkbox" data-type="plan" checked><b style="background:#bb9af7"></b>plan</label>
    <label><input type="checkbox" data-type="verification" checked><b style="background:#2ac3de"></b>verificaci\xF3n</label>
    <label><input type="checkbox" data-type="lesson" checked><b style="background:#ffc777"></b>lecci\xF3n</label>
    <label><input type="checkbox" data-type="solution" checked><b style="background:#73daca"></b>soluci\xF3n</label>
    <label><input type="checkbox" data-type="session" checked><b style="background:#9ece6a"></b>sesi\xF3n</label>
    <label><input type="checkbox" data-type="prompt"><b style="background:#565f89"></b>prompt</label>
  </div>
  <div id="hint">filtros por tipo (prompts ocultos por default \u2014 ruido) \xB7 arrastra \xB7 rueda = zoom<br>hover = conexiones \xB7 click = detalle \xB7 \u2014 s\xF3lida = [[wikilink]] \xB7 \u2025 punteada = sem\xE1ntica</div>
</div>
<div id="search"><input id="q" placeholder="filtrar notas\u2026" autocomplete="off"></div>
<div id="live" class="card">\u25CF <b>en vivo</b> \u2014 se actualiza solo</div>
<div id="info" class="card"></div>
<div id="tip" class="card"></div>
<canvas id="c"></canvas>
<script>
'use strict';
const LIVE = ${live};
let DATA = ${JSON.stringify(data)};
const COLORS = { note:'#7aa2f7', session:'#9ece6a', prompt:'#565f89', map:'#f7768e', plan:'#bb9af7', verification:'#2ac3de', lesson:'#ffc777', solution:'#73daca', task:'#7dcfff' };
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const DPR = Math.min(devicePixelRatio || 1, 2);
let W, H;
function fit(){ W = innerWidth; H = innerHeight; cv.width = W*DPR; cv.height = H*DPR; cv.style.width = W+'px'; cv.style.height = H+'px'; }
fit(); addEventListener('resize', () => { fit(); fitView(); });

// Estado global ANTES de loadData: asigna heat/hot al cargar (evita TDZ)
let nodes = [], byId = new Map(), edges = [];
let zoom = 1, panX = 0, panY = 0, dragNode = null, hot = true, heat = 300;
let didFit = false, hover = null, filter = '';
// filtros por tipo (estilo Obsidian) \u2014 prompts ocultos por default: son ruido visual
const typeOn = { note: true, map: true, session: true, prompt: false, plan: true, verification: true, lesson: true, solution: true, task: true };
document.querySelectorAll('#leg input').forEach(cb => cb.addEventListener('change', e => {
  typeOn[e.target.dataset.type] = e.target.checked; heat = Math.max(heat, 30); hot = true;
}));
function radius(n){ return 5 + Math.min(n.deg,14)*1.1 + Math.min(n.hits,8)*0.6; }
function loadData(data, keepPositions){
  const old = keepPositions ? byId : new Map();
  nodes = data.nodes.map((n,i) => {
    const prev = old.get(n.id);
    const angle = i/Math.max(data.nodes.length,1)*6.283;
    return Object.assign({}, n, {
      x: prev ? prev.x : W/2 + Math.cos(angle)*Math.min(W,H)*0.28 + (Math.random()-.5)*30,
      y: prev ? prev.y : H/2 + Math.sin(angle)*Math.min(W,H)*0.28 + (Math.random()-.5)*30,
      vx: 0, vy: 0, r: radius(n)
    });
  });
  byId = new Map(nodes.map(n => [n.id, n]));
  edges = data.edges.filter(e => byId.has(e.s) && byId.has(e.t)).map(e => ({ a: byId.get(e.s), b: byId.get(e.t), type: e.type, w: e.w || 0.5 }));
  document.getElementById('counts').textContent = nodes.length + ' notas \xB7 ' + edges.length + ' conexiones';
  heat = 280; hot = true;
}
loadData(DATA, false);

// ---------- f\xEDsica ----------
function step(){
  if (!hot) return;
  for (let i = 0; i < nodes.length; i++) for (let j = i+1; j < nodes.length; j++){
    const a = nodes[i], b = nodes[j];
    let dx = b.x-a.x, dy = b.y-a.y;
    const d2 = dx*dx + dy*dy + 0.01, d = Math.sqrt(d2);
    // repulsi\xF3n + colisi\xF3n suave (nunca encimados)
    let f = Math.min(2600/d2, 10);
    const minD = a.r + b.r + 14;
    if (d < minD) f += (minD - d) * 0.06;
    dx /= d; dy /= d;
    a.vx -= dx*f; a.vy -= dy*f; b.vx += dx*f; b.vy += dy*f;
  }
  for (const e of edges){
    let dx = e.b.x-e.a.x, dy = e.b.y-e.a.y;
    const d = Math.sqrt(dx*dx+dy*dy) + 0.01;
    const want = e.type === 'wikilink' ? 120 : 175;
    // resorte lineal ACOTADO \u2014 jam\xE1s multiplicar por d otra vez (explota a NaN)
    const f = Math.max(-6, Math.min(6, (d - want) * (e.type === 'wikilink' ? 0.03 : 0.015)));
    dx /= d; dy /= d;
    e.a.vx += dx*f; e.a.vy += dy*f; e.b.vx -= dx*f; e.b.vy -= dy*f;
  }
  const VMAX = 14;
  for (const n of nodes){
    n.vx += (W/2 - n.x) * 0.0005; n.vy += (H/2 - n.y) * 0.0005;
    n.vx *= 0.86; n.vy *= 0.86;
    // velocidad acotada + saneo: la simulaci\xF3n no puede reventar con ning\xFAn grafo
    n.vx = Math.max(-VMAX, Math.min(VMAX, n.vx)) || 0;
    n.vy = Math.max(-VMAX, Math.min(VMAX, n.vy)) || 0;
    if (n !== dragNode){ n.x += n.vx; n.y += n.vy; }
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)){ n.x = W/2; n.y = H/2; n.vx = n.vy = 0; }
  }
  if (--heat <= 0 && !dragNode) { hot = false; if (!didFit) fitView(); }
}

// ---------- auto-encuadre ----------
function fitView(){
  if (!nodes.length) return;
  didFit = true;
  let x0=1e9, y0=1e9, x1=-1e9, y1=-1e9;
  for (const n of nodes){ x0=Math.min(x0,n.x); y0=Math.min(y0,n.y); x1=Math.max(x1,n.x); y1=Math.max(y1,n.y); }
  const pad = 90, w = Math.max(x1-x0, 60), h = Math.max(y1-y0, 60);
  zoom = Math.min((W-pad*2)/w, (H-pad*2)/h, 1.6);
  panX = W/2 - (x0+x1)/2 * zoom;
  panY = H/2 - (y0+y1)/2 * zoom;
}
setTimeout(fitView, 900); // encuadre inicial tras estabilizar

// ---------- render ----------
function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  const g = ctx.createRadialGradient(W/2,H/2,80, W/2,H/2,Math.max(W,H)*0.7);
  g.addColorStop(0,'#11141d'); g.addColorStop(1,'#0b0d13');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.setTransform(DPR*zoom,0,0,DPR*zoom,DPR*panX,DPR*panY);

  const active = hover ? new Set([hover, ...edges.filter(e=>e.a===hover||e.b===hover).flatMap(e=>[e.a,e.b])]) : null;
  const match = filter ? new Set(nodes.filter(n => n.title.toLowerCase().includes(filter) || n.tags.join(' ').toLowerCase().includes(filter))) : null;
  const shown = (n) => typeOn[n.type] !== false;
  const visible = (n) => (!active || active.has(n)) && (!match || match.has(n));

  for (const e of edges){
    if (!shown(e.a) || !shown(e.b)) continue;
    const on = visible(e.a) && visible(e.b) && (!active || e.a===hover || e.b===hover);
    ctx.beginPath();
    ctx.setLineDash(e.type === 'semantic' ? [5,5] : []);
    ctx.strokeStyle = e.type === 'semantic' ? '#3d4560' : '#57648f';
    ctx.globalAlpha = on ? (e.type==='semantic'?0.55:0.8) : 0.07;
    ctx.lineWidth = on && active ? 2 : 1.2;
    const mx = (e.a.x+e.b.x)/2 - (e.b.y-e.a.y)*0.08;
    const my = (e.a.y+e.b.y)/2 + (e.b.x-e.a.x)*0.08;
    ctx.moveTo(e.a.x, e.a.y); ctx.quadraticCurveTo(mx, my, e.b.x, e.b.y); ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const n of nodes){
    if (!shown(n)) continue;
    const on = visible(n);
    const color = COLORS[n.type] || '#7aa2f7';
    ctx.globalAlpha = on ? 1 : 0.12;
    ctx.shadowColor = color; ctx.shadowBlur = on ? (n === hover ? 26 : 12) : 0;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(n.x, n.y, n === hover ? n.r*1.25 : n.r, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff2e'; ctx.lineWidth = 1;
    ctx.arc(n.x, n.y, n === hover ? n.r*1.25 : n.r, 0, 6.283); ctx.stroke();
  }

  // etiquetas con halo para legibilidad
  const showAll = nodes.length <= 40 || zoom > 1.15;
  ctx.font = (12/Math.max(zoom,0.8)) + 'px -apple-system,system-ui,sans-serif';
  ctx.lineWidth = 3/Math.max(zoom,0.8); ctx.strokeStyle = '#0b0d13';
  for (const n of nodes){
    if (!shown(n) || !visible(n)) continue;
    if (!(showAll || n.deg > 1 || n === hover)) continue;
    const label = n.title.length > 34 ? n.title.slice(0,33)+'\u2026' : n.title;
    ctx.globalAlpha = n === hover ? 1 : 0.85;
    ctx.strokeText(label, n.x + n.r + 5, n.y + 4);
    ctx.fillStyle = '#cdd6f4';
    ctx.fillText(label, n.x + n.r + 5, n.y + 4);
  }
  ctx.globalAlpha = 1;
}
(function loop(){ step(); draw(); requestAnimationFrame(loop); })();

// ---------- interacci\xF3n ----------
const toWorld = (x,y) => [(x-panX)/zoom, (y-panY)/zoom];
const pick = (x,y) => { const [wx,wy] = toWorld(x,y); return nodes.find(n => { if (typeOn[n.type] === false) return false; const dx=n.x-wx, dy=n.y-wy; return dx*dx+dy*dy <= (n.r+6)*(n.r+6); }); };
let panning = false, px = 0, py = 0, moved = false;
const tip = document.getElementById('tip');
cv.addEventListener('mousedown', e => { moved = false; const n = pick(e.clientX, e.clientY); if (n){ dragNode = n; hot = true; heat = 120; } else { panning = true; px = e.clientX; py = e.clientY; } cv.classList.add('dragging'); });
addEventListener('mousemove', e => {
  if (dragNode){ const [wx,wy] = toWorld(e.clientX, e.clientY); dragNode.x = wx; dragNode.y = wy; moved = true; hot = true; heat = Math.max(heat, 40); return; }
  if (panning){ panX += e.clientX-px; panY += e.clientY-py; px = e.clientX; py = e.clientY; moved = true; return; }
  const n = pick(e.clientX, e.clientY);
  if (n !== hover){ hover = n; }
  if (n){ tip.style.display='block'; tip.style.left = (e.clientX+14)+'px'; tip.style.top = (e.clientY+14)+'px'; tip.textContent = n.title; }
  else tip.style.display = 'none';
});
addEventListener('mouseup', () => { dragNode = null; panning = false; cv.classList.remove('dragging'); });
cv.addEventListener('click', e => {
  if (moved) return;
  const n = pick(e.clientX, e.clientY);
  const info = document.getElementById('info');
  if (n){
    const nbs = edges.filter(x => x.a===n || x.b===n).map(x => (x.a===n?x.b:x.a).title);
    info.style.display = 'block';
    info.innerHTML = '<b>' + n.title + '</b><div class="meta">' + n.id + '<br>tipo: ' + n.type + ' \xB7 usos: ' + n.hits + (n.tags.length ? ' \xB7 #' + n.tags.join(' #') : '') + '</div>' +
      (nbs.length ? '<div class="meta" style="margin-top:6px">conecta con: ' + nbs.slice(0,6).join(' \xB7 ') + (nbs.length>6 ? ' +' + (nbs.length-6) : '') + '</div>' : '');
  } else info.style.display = 'none';
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 0.89;
  panX = e.clientX - (e.clientX - panX)*f; panY = e.clientY - (e.clientY - panY)*f; zoom *= f;
}, { passive: false });
document.getElementById('q').addEventListener('input', e => { filter = e.target.value.trim().toLowerCase(); });

// ---------- modo en vivo: el grafo se actualiza solo ----------
if (LIVE) setInterval(async () => {
  try {
    const res = await fetch('/data.json');
    const fresh = await res.json();
    if (fresh.generated !== DATA.generated && (fresh.nodes.length !== DATA.nodes.length || fresh.edges.length !== DATA.edges.length)){
      DATA = fresh; loadData(fresh, true);
    } else { DATA = fresh; }
  } catch { /* server cerrado */ }
}, 3000);
</script>
</body>
</html>`;
}
function writeStaticGraph(idx) {
  const file = path.join(idx.vault.root, "grafo.html");
  fs.writeFileSync(file, renderGraphHtml(buildGraphData(idx), false));
  return file;
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
  const fresh = async () => {
    const idx = VaultIndex.load(vault);
    await idx.refresh(false).catch(() => {
    });
    return idx;
  };
  if (opts.out) {
    const file = path.resolve(opts.out);
    fs.writeFileSync(file, renderGraphHtml(buildGraphData(await fresh()), false));
    return file;
  }
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.startsWith("/data.json")) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(buildGraphData(await fresh())));
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderGraphHtml(buildGraphData(await fresh()), true));
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
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

export {
  buildGraphData,
  renderGraphHtml,
  writeStaticGraph,
  serveGraph
};
