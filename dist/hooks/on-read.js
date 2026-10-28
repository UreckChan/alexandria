#!/usr/bin/env node
import {
  runHook
} from "../chunk-WVZQGLRI.js";
import {
  PDF_TOKENS_PER_PAGE,
  formatOf
} from "../chunk-I5H4BN3F.js";
import {
  resolveVault,
  toggleEnabled,
  vaultExists
} from "../chunk-YICWI3U3.js";

// src/hooks/on-read.ts
import fs from "fs";
import path from "path";
var MIN_BYTES = 20 * 1024;
var INTERCEPT = /* @__PURE__ */ new Set(["pdf", "docx", "xlsx", "csv"]);
var MAX_SESSIONS = 20;
function shouldIntercept(cacheDir, sessionId, file) {
  const store = path.join(cacheDir, "read-intercepts.json");
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(store, "utf8"));
  } catch {
  }
  const seen = data[sessionId] ?? [];
  if (seen.includes(file)) return false;
  data[sessionId] = [...seen, file];
  const keys = Object.keys(data);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS))) delete data[k];
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(store, JSON.stringify(data));
  } catch {
    return false;
  }
  return true;
}
runHook(2e3, async (input) => {
  if (!toggleEnabled("docs.interceptRead")) return;
  const file = input.filePath;
  if (!file || input.toolName && input.toolName !== "Read") return;
  const format = formatOf(file);
  if (!format || !INTERCEPT.has(format)) return;
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    return;
  }
  if (size < MIN_BYTES) return;
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  if (!shouldIntercept(vault.cache, input.session_id ?? "sin-sesion", path.resolve(file))) return;
  const cost = format === "pdf" ? `un PDF le\xEDdo directo cuesta ~${PDF_TOKENS_PER_PAGE.toLocaleString("en")} tokens POR P\xC1GINA (imagen + texto)` : `leer el ${format.toUpperCase()} completo cuesta ~${Math.ceil(size / 4).toLocaleString("en")} tokens`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Alexandria: ${cost}. Usa la tool MCP doc_ingest con path "${file}" (devuelve el \xEDndice de secciones, ~200 tokens) y luego doc_read con las secciones o una pregunta. Si de verdad necesitas ver im\xE1genes o gr\xE1ficas del archivo, vuelve a llamar Read: el segundo intento pasa.`
      }
    })
  );
});
export {
  shouldIntercept
};
