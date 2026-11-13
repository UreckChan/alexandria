#!/usr/bin/env node
import {
  acquireReindexLock,
  releaseReindexLock,
  transferReindexLock
} from "../chunk-KRMDWHCZ.js";
import {
  buildCapsule,
  extractSession,
  forgetInjected,
  saveCapsule
} from "../chunk-ADA25MTF.js";
import {
  projectName,
  runHook,
  truncate
} from "../chunk-JJ62U6UP.js";
import {
  autoCleanDue,
  markCleaned
} from "../chunk-VCVBX3VT.js";
import {
  VaultIndex,
  appendToNote
} from "../chunk-DELBYC3Y.js";
import "../chunk-X4V6SYYA.js";
import {
  ensureVaultStructure,
  lastExchange,
  resolveVault,
  toggleEnabled,
  vaultExists
} from "../chunk-YICWI3U3.js";
import "../chunk-LUAVB3CA.js";

// src/hooks/on-stop.ts
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
runHook(25e3, async (input) => {
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  let lastUser = input.prompt?.trim() ?? "";
  let lastAssistant = input.answer?.trim() ?? "";
  if (input.compact && input.session_id) {
    forgetInjected(vault.cache, input.session_id);
    if (input.transcript_path && fs.existsSync(input.transcript_path)) {
      try {
        const all = fs.readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean);
        const proj2 = projectName(input.cwd);
        const openPlans = VaultIndex.load(vault).notesByTag("plan").filter((n) => n.status === "active" && n.tags.some((t) => t.toLowerCase() === proj2.toLowerCase())).map((n) => n.title);
        saveCapsule(vault.cache, input.session_id, buildCapsule(extractSession(all), { cwd: input.cwd, openPlans }));
      } catch {
      }
    }
  }
  if (!lastAssistant && input.transcript_path && fs.existsSync(input.transcript_path)) {
    const lines = fs.readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean);
    const ex = lastExchange(lines.slice(-200));
    lastAssistant = ex.assistant;
    lastUser ||= ex.user;
  }
  if (!lastAssistant) return;
  ensureVaultStructure(vault);
  const proj = projectName(input.cwd);
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const sid = (input.session_id ?? "sesion").slice(0, 8);
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 16);
  const isCompact = input.compact;
  appendToNote(vault.managed, {
    fixedName: `${date}-${proj}-${sid}`,
    title: `Sesi\xF3n ${date} \u2014 ${proj}`,
    type: "session",
    tags: [proj, "sesion"],
    dir: "sessions",
    content: `## ${stamp}${isCompact ? " (pre-compactaci\xF3n)" : ""}

` + (lastUser ? `**Pregunta:** ${truncate(lastUser.replace(/\s+/g, " "), 500)}

` : "") + `**Resultado:** ${truncate(lastAssistant, 2500)}

Proyecto: [[Mapa - ${proj}]]`
  });
  await maybeRebuildInBackground(vault);
  maybeCleanInBackground(vault);
});
function maybeCleanInBackground(vault) {
  try {
    if (!toggleEnabled("clean.auto") || !autoCleanDue(vault)) return;
    markCleaned(vault);
    const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
    if (!fs.existsSync(cli)) return;
    const child = spawn(process.execPath, [cli, "--vault", vault.root, "clean", "--yes", "--quiet"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, ALEXANDRIA_HOOK: "" }
    });
    child.unref();
  } catch {
  }
}
async function maybeRebuildInBackground(vault, cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.js")) {
  let locked = false;
  try {
    if (!toggleEnabled("index.autoRebuild")) return;
    const idx = VaultIndex.load(vault);
    if (!idx.needsRebuild() && !idx.isDegraded()) return;
    if (!fs.existsSync(cli)) return;
    if (!acquireReindexLock(vault)) return;
    locked = true;
    const child = spawn(process.execPath, [cli, "--vault", vault.root, "reindex", "--force"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      // Windows: sin esto puede parpadear una consola al cerrar sesión
      // proceso CLI: sí puede reconstruir; ALEXANDRIA_REINDEX_PARENT le permite adoptar el candado
      env: { ...process.env, ALEXANDRIA_HOOK: "", ALEXANDRIA_REINDEX_PARENT: String(process.pid) }
    });
    if (!child.pid) {
      releaseReindexLock(vault);
      return;
    }
    transferReindexLock(vault, child.pid);
    locked = false;
    try {
      os.setPriority(child.pid, 10);
    } catch {
    }
    child.unref();
  } catch {
    if (locked) releaseReindexLock(vault);
  }
}
export {
  maybeRebuildInBackground
};
