#!/usr/bin/env node
import {
  projectName,
  runHook,
  truncate
} from "../chunk-DEDAOKAV.js";
import {
  ensureVaultStructure,
  resolveVault,
  vaultExists
} from "../chunk-TFQ7WSIB.js";
import {
  appendToNote
} from "../chunk-XWR74BQ2.js";

// src/hooks/on-stop.ts
import fs from "fs";
function textOf(msg) {
  const c = msg.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
  }
  return "";
}
runHook(25e3, async (input) => {
  if (!input.transcript_path || !fs.existsSync(input.transcript_path)) return;
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  ensureVaultStructure(vault);
  const raw = fs.readFileSync(input.transcript_path, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  let lastUser = "";
  let lastAssistant = "";
  for (const line of lines.slice(-200)) {
    try {
      const msg = JSON.parse(line);
      const text = textOf(msg).trim();
      if (!text) continue;
      if (msg.type === "user" && !text.startsWith("<")) lastUser = text;
      if (msg.type === "assistant") lastAssistant = text;
    } catch {
    }
  }
  if (!lastAssistant) return;
  const proj = projectName(input.cwd);
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const sid = (input.session_id ?? "sesion").slice(0, 8);
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 16);
  const isCompact = input.hook_event_name === "PreCompact" || Boolean(input.trigger);
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
});
