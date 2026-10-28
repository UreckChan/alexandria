#!/usr/bin/env node
import {
  modelCacheDir
} from "./chunk-EDYBSJSS.js";

// src/run/fold.ts
var FOLD_THRESHOLD = 2048;
var MAX_ERROR_LINES = 30;
var TAIL_LINES = 15;
var MAX_LINE = 300;
var ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g;
var ERROR_RE = /\b(error|errors|fail|failed|failure|failing|fatal|panic|exception|traceback|ERR!|cannot find|not found|undefined is not|segmentation fault)\b|✗|✘|×\s|FAIL\b|E\d{3,}/i;
var SUMMARY_RE = /^\s*(tests?:|test files|test suites?:|suites?:|ran \d+ tests?|\d+ (passed|failed|passing|failing)|=+ .*(passed|failed).* =+|ok\s+\S+\s+[\d.]+s|build (succeeded|failed|success)|compiled (successfully|with)|found \d+ (vulnerabilit|error))/i;
function stripAnsi(s) {
  return s.replace(ANSI, "").replace(/\r(?!\n)/g, "\n");
}
var clip = (l) => l.length > MAX_LINE ? l.slice(0, MAX_LINE) + "\u2026" : l;
function collapse(lines) {
  const out = [];
  for (const l of lines) {
    if (!l.trim()) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const prev = out[out.length - 1];
    const m = prev?.match(/^(.*) \(×(\d+)\)$/);
    if (prev === l) out[out.length - 1] = `${l} (\xD72)`;
    else if (m && m[1] === l) out[out.length - 1] = `${l} (\xD7${Number(m[2]) + 1})`;
    else out.push(l);
  }
  return out;
}
function foldOutput({ output, exitCode, ms, id, command }) {
  const clean = stripAnsi(output);
  if (clean.length <= FOLD_THRESHOLD) return { text: clean, folded: false, originalChars: clean.length };
  const lines = clean.split("\n");
  const keep = /* @__PURE__ */ new Set();
  let errors = 0;
  const PASS = /^\s*(✓|✔|√|ok\b|PASS\b|passed\b)/i;
  lines.forEach((l, i) => {
    if (errors >= MAX_ERROR_LINES || PASS.test(l) || !ERROR_RE.test(l)) return;
    for (let j = i - 1; j <= i + 3; j++) if (j >= 0 && j < lines.length && lines[j].trim()) keep.add(j);
    errors++;
  });
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const tailStart = Math.max(0, lines.length - TAIL_LINES);
  const summary = lines.filter((l, i) => i < tailStart && SUMMARY_RE.test(l)).slice(-8);
  const errBlock = [];
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i >= tailStart) continue;
    if (i > last + 1 && errBlock.length) errBlock.push("  \u22EF");
    errBlock.push(clip(lines[i]));
    last = i;
  }
  const secs = (ms / 1e3).toFixed(1);
  const parts = [
    `\u29C9 ${command.length > 80 ? command.slice(0, 80) + "\u2026" : command} \xB7 exit ${exitCode} \xB7 ${secs}s \xB7 ${lines.length} l\xEDneas (${Math.ceil(clean.length / 4).toLocaleString("en")} tokens) \u2192 plegado por Alexandria`
  ];
  if (errBlock.length) parts.push(`\u2014 errores/fallos \u2014
${collapse(errBlock).join("\n")}`);
  const shown = new Set(errBlock);
  const freshSummary = summary.map(clip).filter((l) => !shown.has(l));
  if (freshSummary.length) parts.push(`\u2014 resumen \u2014
${collapse(freshSummary).join("\n")}`);
  parts.push(`\u2014 final \u2014
${collapse(lines.slice(tailStart).map(clip)).join("\n").trim()}`);
  parts.push(`salida completa: ale run show ${id} [--grep <regex>] [--lines a-b]  (o tool MCP run_output)`);
  return { text: parts.join("\n"), folded: true, originalChars: clean.length };
}
var NOISY = /^(\s*(npx\s+|bunx\s+)?)(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck|check|install|i|ci|add|audit)\b|^\s*npx\s+(vitest|jest|tsc|eslint|next\s+build|playwright\s+test|prisma\s+(migrate|generate))\b|^\s*(pytest|python3?\s+-m\s+pytest|cargo\s+(build|test|check|clippy)|go\s+(test|build|vet)|mvn\b|\.?\/?gradlew?\b|docker\s+(build|compose\s+(up|build))|dotnet\s+(build|test)|composer\s+install|pip3?\s+install|make)\b/;
var VIEWER = /^\s*(cat|head|tail|sed|awk|less|more|bat|jq|yq|diff|grep|rg|find|ls|tree|curl|wget|wc|git\s+(show|diff|log|blame|status)|node\s+-[ep]|python3?\s+-c)\b/;
var GENERIC_FOLD = 4e4;
function shouldFoldOutput(command, chars) {
  if (chars <= FOLD_THRESHOLD) return false;
  if (/\bale\s+run\b|\balexandria\s+run\b|cli\.js"?\s+run\b/.test(command)) return false;
  const last = (command.split("&&").pop() ?? "").trim();
  if (NOISY.test(last)) return true;
  return chars > GENERIC_FOLD && !VIEWER.test(last);
}

// src/run/run.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
var KEEP_RUNS = 50;
var MAX_CAPTURE = 50 * 1024 * 1024;
function runsDir() {
  return path.join(path.dirname(modelCacheDir()), "runs");
}
function newId() {
  return Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
}
function rotate() {
  try {
    const metas = fs.readdirSync(runsDir()).filter((f) => f.endsWith(".json")).sort();
    for (const f of metas.slice(0, Math.max(0, metas.length - KEEP_RUNS))) {
      const id = f.slice(0, -5);
      fs.rmSync(path.join(runsDir(), `${id}.json`), { force: true });
      fs.rmSync(path.join(runsDir(), `${id}.log`), { force: true });
    }
  } catch {
  }
}
function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    let size = 0;
    const take = (b) => {
      if (size < MAX_CAPTURE) chunks.push(b);
      size += b.length;
    };
    const child = spawn(command, { cwd, shell: true, env: process.env, windowsHide: true });
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const finish = (code) => {
      let output = Buffer.concat(chunks).toString("utf8");
      if (size > MAX_CAPTURE) output += `
\u2026(salida truncada a ${MAX_CAPTURE / 1024 / 1024} MB de ${(size / 1024 / 1024).toFixed(1)} MB)`;
      resolve(saveRun({ command, cwd, output, exitCode: code, ms: Date.now() - started }));
    };
    child.on("error", (e) => {
      take(Buffer.from(String(e.message)));
      finish(127);
    });
    child.on("close", (code, signal) => finish(code ?? (signal ? 128 : 1)));
  });
}
function saveRun(r) {
  const id = newId();
  const meta = { id, command: r.command, cwd: r.cwd, exitCode: r.exitCode, ms: r.ms, chars: r.output.length, t: (/* @__PURE__ */ new Date()).toISOString() };
  const fold = foldOutput({ output: r.output, exitCode: r.exitCode, ms: r.ms, id, command: r.command });
  if (fold.folded) {
    try {
      fs.mkdirSync(runsDir(), { recursive: true });
      fs.writeFileSync(path.join(runsDir(), `${id}.log`), stripAnsi(r.output));
      fs.writeFileSync(path.join(runsDir(), `${id}.json`), JSON.stringify(meta));
      rotate();
    } catch {
    }
  }
  return { meta, fold };
}
function showRun(id, opts = {}) {
  const ref = id === "last" ? lastRunId() : id;
  const file = ref ? path.join(runsDir(), `${ref}.log`) : "";
  if (!ref || !fs.existsSync(file)) return `No encontr\xE9 la corrida \xAB${id}\xBB. Las \xFAltimas: ${listRuns(5).map((m) => m.id).join(", ") || "(ninguna)"}`;
  const all = fs.readFileSync(file, "utf8").split("\n");
  let picked = all.map((l, i) => ({ n: i + 1, l }));
  if (opts.lines) {
    const [a, b] = opts.lines.split("-").map((x) => parseInt(x, 10));
    picked = picked.filter((x) => x.n >= (a || 1) && x.n <= (b || a || all.length));
  }
  if (opts.grep) {
    let re;
    try {
      re = new RegExp(opts.grep, "i");
    } catch {
      re = new RegExp(opts.grep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    picked = picked.filter((x) => re.test(x.l));
  }
  const budget = (opts.maxTokens ?? 2e3) * 4;
  const out = [];
  let used = 0;
  for (const x of picked) {
    const line = `${x.n}: ${x.l}`;
    if (used + line.length > budget) {
      out.push(`\u2026(+${picked.length - out.length} l\xEDneas; acota con --lines o --grep, o sube max_tokens)`);
      break;
    }
    out.push(line);
    used += line.length + 1;
  }
  return `corrida ${ref} \xB7 ${picked.length} de ${all.length} l\xEDneas
${out.join("\n")}`;
}
function listRuns(n = 10) {
  try {
    return fs.readdirSync(runsDir()).filter((f) => f.endsWith(".json")).sort().slice(-n).reverse().map((f) => JSON.parse(fs.readFileSync(path.join(runsDir(), f), "utf8")));
  } catch {
    return [];
  }
}
function lastRunId() {
  return listRuns(1)[0]?.id;
}

export {
  shouldFoldOutput,
  runCommand,
  saveRun,
  showRun,
  listRuns
};
