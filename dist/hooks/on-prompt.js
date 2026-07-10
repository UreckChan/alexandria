#!/usr/bin/env node
import {
  logInjection
} from "../chunk-OPUPZRP6.js";
import {
  projectName,
  runHook,
  truncate
} from "../chunk-DEDAOKAV.js";
import {
  hybridSearch
} from "../chunk-O7FDC2PB.js";
import "../chunk-UWAIMIG2.js";
import {
  createNote,
  resolveVault,
  touchNote,
  vaultExists
} from "../chunk-CZM5NQZJ.js";
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
  const results = await hybridSearch(vault, prompt, 5, { expand: true });
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
        `\u26A1 Ya resolviste algo casi id\xE9ntico antes (\xAB${cached.note.title}\xBB). Reutiliza esa soluci\xF3n en vez de re-derivarla:
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
  }
  const dupe = results.find((r) => r.note.type === "prompt" && r.cosine >= DEDUP_COSINE);
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
