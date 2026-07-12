#!/usr/bin/env node
import {
  logInjection
} from "../chunk-XITAQVOZ.js";
import {
  projectName,
  runHook,
  truncate
} from "../chunk-DEDAOKAV.js";
import {
  hybridSearch
} from "../chunk-3ETM6PKR.js";
import {
  resolveVault,
  vaultExists
} from "../chunk-DYCARGQR.js";
import "../chunk-7G3NPKDO.js";
import {
  createNote,
  touchNote
} from "../chunk-XWR74BQ2.js";
import "../chunk-EDYBSJSS.js";

// src/hooks/on-prompt.ts
import fs from "fs";
import path from "path";
var MAX_INJECT_CHARS = 6e3;
var MIN_PROMPT_CHARS = 20;
var DEDUP_COSINE = 0.93;
var SOLUTION_COSINE = 0.93;
var RELEVANT_COSINE = 0.82;
var RELEVANT_MARGIN = 0.04;
runHook(25e3, async (input) => {
  const prompt = (input.prompt ?? "").trim();
  if (prompt.length < MIN_PROMPT_CHARS || prompt.startsWith("/")) return;
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  const rawResults = await hybridSearch(vault, prompt, 5, { expand: true });
  const STALE_DAYS = 60;
  const results = rawResults.filter((r) => {
    if (r.note.type !== "prompt" && r.note.type !== "session") return true;
    if ((r.note.hits ?? 1) > 1) return true;
    const age = r.note.created ? (Date.now() - Date.parse(r.note.created)) / 864e5 : 0;
    return age <= STALE_DAYS;
  });
  const maxCos = results.reduce((m, r) => Math.max(m, r.cosine), 0);
  const relevant = maxCos > 0 ? results.filter((r) => r.cosine >= RELEVANT_COSINE && r.cosine >= maxCos - RELEVANT_MARGIN) : results.filter((r) => r.score > 0.02);
  let injected = "";
  if (relevant.length > 0) {
    const cached = relevant.find(
      (r) => (r.note.type === "prompt" || r.note.type === "session") && r.cosine >= SOLUTION_COSINE
    );
    const lines = [];
    if (cached) {
      lines.push(
        `\u26A1 Ya resolviste algo casi id\xE9ntico antes (\xAB${cached.note.title}\xBB). Parte de esa soluci\xF3n en vez de re-derivarla \u2014 valida que siga aplicando si el c\xF3digo cambi\xF3:
${truncate(cached.excerpts.join("\n"), 2e3)}`
      );
    }
    for (const r of relevant) {
      if (r === cached) continue;
      lines.push(`\u2022 \xAB${r.note.title}\xBB (${r.note.rel}):
${truncate(r.excerpts.join("\n"), 900)}`);
      if (lines.join("\n\n").length > MAX_INJECT_CHARS) break;
    }
    injected = `<alexandria-contexto>
Contexto recuperado de la b\xF3veda local (usa esto antes de releer archivos o re-explorar):

` + truncate(lines.join("\n\n"), MAX_INJECT_CHARS) + `
</alexandria-contexto>`;
    process.stdout.write(injected);
    logInjection(vault, {
      kind: cached ? "solution-cache" : "inject",
      injectedChars: injected.length,
      promptChars: prompt.length
    });
    for (const r of relevant) {
      if (r.note.type === "lesson" || r.note.type === "solution") {
        try {
          touchNote(path.join(vault.root, r.note.rel));
        } catch {
        }
      }
    }
  }
  const dupe = rawResults.find((r) => r.note.type === "prompt" && r.cosine >= DEDUP_COSINE);
  if (dupe) {
    try {
      touchNote(path.join(vault.root, dupe.note.rel));
    } catch {
    }
    return;
  }
  const proj = projectName(input.cwd);
  const title = truncate(prompt.replace(/\s+/g, " "), 70);
  fs.mkdirSync(vault.managed, { recursive: true });
  createNote(vault.managed, {
    title,
    type: "prompt",
    tags: [proj],
    dir: "prompts",
    content: `Proyecto: [[Mapa - ${proj}]]

## Prompt

${truncate(prompt, 4e3)}`
  });
});
