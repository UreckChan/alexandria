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
  protocolEnabled,
  resolveVault,
  toggleEnabled,
  vaultExists
} from "../chunk-TFQ7WSIB.js";
import {
  VaultIndex
} from "../chunk-AXUEYSNZ.js";
import "../chunk-XWR74BQ2.js";
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
  if (protocolEnabled()) {
    const openPlans = idx.notesByTag("plan").filter((n) => n.status === "active");
    parts.push(
      `## Protocolo Alexandria (activo)
El protocolo es PALANCA, no l\xEDmite: \xFAsalo para rendir m\xE1s con menos tokens, nunca como burocracia. Tareas simples \u2192 responde directo, sin ceremonia. Tareas no triviales \u2192 ciclo con las tools MCP: 1) plan_create (objetivo + Definition of Done) \u2192 2) ejecuta con toda tu capacidad \u2192 3) task_verify con evidencia real (tests/build \u2014 la evidencia elimina errores, no te frena) \u2192 si algo falla, vault_search por lecciones ANTES de re-debuggear (conocimiento previo = tokens gratis) \u2192 4) lesson_extract si resolviste algo no obvio. Reutiliza lo cacheado con criterio: valida que siga aplicando si el c\xF3digo cambi\xF3.` + (openPlans.length > 0 ? `
**Planes abiertos:** ${openPlans.map((p) => p.title).join(" \xB7 ")} \u2014 ret\xF3malos, no dupliques.` : "")
    );
  }
  const map = notes.find(
    (n) => (n.type === "map" || n.title.toLowerCase().startsWith("mapa - ")) && n.title.toLowerCase().includes(proj.toLowerCase())
  );
  if (map && toggleEnabled("digest.map")) {
    try {
      const raw = fs.readFileSync(path.join(vault.root, map.rel), "utf8");
      const body = raw.replace(/^---[\s\S]*?---\n/, "");
      parts.push(`## Mapa del proyecto \xAB${proj}\xBB (conocimiento previo \u2014 NO re-explorar lo ya mapeado)
${truncate(body.trim(), 4e3)}`);
    } catch {
    }
  }
  const sessions = idx.notesByTag("session").sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")).slice(0, 3);
  if (sessions.length > 0) {
    const lines = sessions.map((s) => `- ${s.title} (${(s.created ?? "").slice(0, 10)})`);
    parts.push(`## Sesiones recientes en la b\xF3veda
${lines.join("\n")}`);
  }
  const distilled = idx.notesByTag("note").length + idx.notesByTag("lesson").length;
  if (map && distilled < 3) {
    parts.push(
      `B\xF3veda joven (${distilled} notas destiladas): al descubrir decisiones, m\xF3dulos o vocabulario del dominio, gu\xE1rdalos compactos con vault_save \u2014 tokens gratis en sesiones futuras.`
    );
  }
  const titles = toggleEnabled("digest.titleIndex") ? notes.filter((n) => n.type !== "prompt").sort((a, b) => (b.hits ?? 1) - (a.hits ?? 1)).slice(0, 25).map((n) => n.title) : [];
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
