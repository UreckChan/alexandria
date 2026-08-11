#!/usr/bin/env node
import {
  logInjection
} from "../chunk-XITAQVOZ.js";
import {
  projectName,
  runHook,
  truncate
} from "../chunk-53SIGH5A.js";
import {
  hybridSearch
} from "../chunk-UWB6RKVN.js";
import {
  resolveVault,
  toggleEnabled,
  vaultExists
} from "../chunk-CIOCSIB5.js";
import {
  createNote,
  touchNote
} from "../chunk-QB37UGO6.js";
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
var KEYWORD_REL_FACTOR = 0.6;
runHook(5e3, async (input) => {
  const prompt = (input.prompt ?? "").trim();
  if (prompt.length < MIN_PROMPT_CHARS || prompt.startsWith("/")) return;
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  const rawResults = await hybridSearch(vault, prompt, 5, { expand: true, refresh: false });
  const STALE_DAYS = 60;
  const results = rawResults.filter((r) => {
    if (r.note.type !== "prompt" && r.note.type !== "session") return true;
    if ((r.note.hits ?? 1) > 1) return true;
    const age = r.note.created ? (Date.now() - Date.parse(r.note.created)) / 864e5 : 0;
    return age <= STALE_DAYS;
  });
  const maxCos = results.reduce((m, r) => Math.max(m, r.cosine), 0);
  const maxScore = results.reduce((m, r) => Math.max(m, r.score), 0);
  const relevant = maxCos > 0 ? results.filter((r) => r.cosine >= RELEVANT_COSINE && r.cosine >= maxCos - RELEVANT_MARGIN) : (
    // Keyword-only: criterio RELATIVO al mejor resultado, nunca absoluto. El
    // umbral fijo de 0.02 era inalcanzable — el RRF máximo es 1/(60+1)=0.0164,
    // así que notas tipo note/session/prompt (boost ≤1.0) jamás lo cruzaban y
    // la mayoría de la bóveda quedaba invisible en modo degradado.
    results.filter((r) => maxScore > 0 && r.score >= maxScore * KEYWORD_REL_FACTOR).slice(0, 3)
  );
  const solutionCacheOn = toggleEnabled("tokens.solutionCache");
  const promptSearchOn = toggleEnabled("tokens.promptSearch");
  let injected = "";
  if (relevant.length > 0 && (solutionCacheOn || promptSearchOn)) {
    const cached = solutionCacheOn ? relevant.find(
      (r) => (r.note.type === "prompt" || r.note.type === "session") && r.cosine >= SOLUTION_COSINE
    ) : void 0;
    const lines = [];
    if (cached) {
      lines.push(
        `\u26A1 Ya resolviste algo casi id\xE9ntico antes (\xAB${cached.note.title}\xBB). Parte de esa soluci\xF3n en vez de re-derivarla \u2014 valida que siga aplicando si el c\xF3digo cambi\xF3:
${truncate(cached.excerpts.join("\n"), 2e3)}`
      );
    }
    if (promptSearchOn) {
      for (const r of relevant) {
        if (r === cached) continue;
        lines.push(`\u2022 \xAB${r.note.title}\xBB (${r.note.rel}):
${truncate(r.excerpts.join("\n"), 900)}`);
        if (lines.join("\n\n").length > MAX_INJECT_CHARS) break;
      }
    }
    if (lines.length > 0) {
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
