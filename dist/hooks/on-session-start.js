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
  resolveVault,
  vaultExists
} from "../chunk-KB6KYZFQ.js";
import {
  VaultIndex
} from "../chunk-ZW7XY3EN.js";
import "../chunk-JPHL2JHE.js";
import "../chunk-EDYBSJSS.js";

// src/hooks/on-session-start.ts
import fs from "fs";
import path from "path";
var MAX_CHARS = 8e3;
runHook(15e3, async (input) => {
  const vault = resolveVault({ cwd: input.cwd });
  if (!vaultExists(vault)) return;
  const idx = VaultIndex.load(vault);
  await idx.refresh(false).catch(() => {
  });
  const notes = Object.values(idx.meta.notes);
  if (notes.length === 0) return;
  const proj = projectName(input.cwd);
  const parts = [];
  const map = notes.find(
    (n) => (n.type === "map" || n.title.toLowerCase().startsWith("mapa - ")) && n.title.toLowerCase().includes(proj.toLowerCase())
  );
  if (map) {
    try {
      const raw = fs.readFileSync(path.join(vault.root, map.rel), "utf8");
      const body = raw.replace(/^---[\s\S]*?---\n/, "");
      parts.push(`## Mapa del proyecto \xAB${proj}\xBB (conocimiento previo \u2014 NO re-explorar lo ya mapeado)
${truncate(body.trim(), 4e3)}`);
    } catch {
    }
  }
  const sessions = notes.filter((n) => n.type === "session").sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")).slice(0, 3);
  if (sessions.length > 0) {
    const lines = sessions.map((s) => `- ${s.title} (${(s.created ?? "").slice(0, 10)})`);
    parts.push(`## Sesiones recientes en la b\xF3veda
${lines.join("\n")}`);
  }
  const titles = notes.filter((n) => n.type !== "prompt").sort((a, b) => (b.hits ?? 1) - (a.hits ?? 1)).slice(0, 25).map((n) => n.title);
  if (titles.length > 0) {
    parts.push(`## La b\xF3veda ya tiene conocimiento sobre
${titles.join(" \xB7 ")}`);
  }
  if (parts.length === 0) return;
  const digest = `<alexandria-digest>
B\xF3veda de conocimiento local activa (${notes.length} notas). ANTES de explorar c\xF3digo o re-derivar contexto, usa la herramienta MCP vault_search \u2014 ahorra tokens. Cuando descubras arquitectura o decisiones nuevas, gu\xE1rdalas con vault_save (title: "Mapa - ${proj}").

` + truncate(parts.join("\n\n"), MAX_CHARS) + `
</alexandria-digest>`;
  process.stdout.write(digest);
  logInjection(vault, { kind: "session-start", injectedChars: digest.length });
});
