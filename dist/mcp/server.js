#!/usr/bin/env node
import {
  pkgVersion
} from "../chunk-KHTYRYDR.js";
import {
  hybridSearch
} from "../chunk-BCLBZ7NX.js";
import {
  ensureVaultStructure,
  resolveVault
} from "../chunk-DYCARGQR.js";
import {
  VaultIndex
} from "../chunk-MLA3KZPZ.js";
import {
  createNote,
  setNoteStatus,
  slugify,
  upsertNote
} from "../chunk-XWR74BQ2.js";
import "../chunk-EDYBSJSS.js";

// src/mcp/server.ts
import path from "path";
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var vault = resolveVault({ cwd: process.cwd() });
var server = new McpServer({ name: "alexandria", version: pkgVersion() });
var text = (t) => ({ content: [{ type: "text", text: t }] });
function findMap(idx) {
  return Object.values(idx.meta.notes).find((n) => n.type === "map" || n.title.startsWith("Mapa - "));
}
function findByTitle(idx, t) {
  const lower = t.toLowerCase();
  return Object.values(idx.meta.notes).find(
    (n) => n.title.toLowerCase() === lower || n.rel.toLowerCase() === lower
  );
}
server.tool(
  "vault_search",
  "Busca conocimiento en la b\xF3veda local (b\xFAsqueda sem\xE1ntica + keyword). \xDAsala ANTES de explorar c\xF3digo o re-derivar contexto: si la b\xF3veda ya lo sabe, ahorras tokens.",
  { query: z.string().describe("Qu\xE9 buscar, en lenguaje natural"), k: z.number().int().min(1).max(15).optional() },
  async ({ query, k }) => {
    const results = await hybridSearch(vault, query, k ?? 5, { expand: true });
    if (results.length === 0) return text("Sin resultados en la b\xF3veda.");
    const out = results.map(
      (r, i) => `${i + 1}. \xAB${r.note.title}\xBB (${r.note.rel}, tipo: ${r.note.type})
${r.excerpts.map((e) => "   " + e.replace(/\n/g, "\n   ").slice(0, 900)).join("\n")}`
    ).join("\n\n");
    return text(out);
  }
);
server.tool(
  "vault_save",
  'Guarda conocimiento destilado en la b\xF3veda (decisiones, arquitectura, soluciones). Si title empieza con "Mapa - " actualiza/crea el mapa del proyecto (se inyecta al inicio de cada sesi\xF3n).',
  {
    title: z.string(),
    content: z.string().describe("Markdown; puede incluir [[wikilinks]] a otras notas"),
    tags: z.array(z.string()).optional()
  },
  async ({ title, content, tags }) => {
    ensureVaultStructure(vault);
    if (!title.startsWith("Mapa - ") && !/\[\[/.test(content)) {
      const idxPre = VaultIndex.load(vault);
      const map = Object.values(idxPre.meta.notes).find(
        (n) => n.type === "map" || n.title.startsWith("Mapa - ")
      );
      if (map) content = `${content.trim()}

Proyecto: [[${map.title}]]`;
    }
    let file;
    if (title.startsWith("Mapa - ")) {
      file = upsertNote(vault.managed, {
        fixedName: `mapa-${slugify(title.replace("Mapa - ", ""))}`,
        title,
        type: "map",
        tags: tags ?? [],
        dir: "notes",
        content
      });
    } else {
      file = createNote(vault.managed, { title, content, tags: tags ?? [], type: "note" });
    }
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    return text(`Guardado en ${path.relative(vault.root, file)}`);
  }
);
server.tool(
  "vault_related",
  "Vecinos de una nota en el grafo de conocimiento (wikilinks + conexiones sem\xE1nticas) \u2014 trae conocimiento conectado sin releer archivos.",
  { title: z.string().describe("T\xEDtulo o ruta relativa de la nota") },
  async ({ title }) => {
    const idx = VaultIndex.load(vault);
    const lower = title.toLowerCase();
    const note = Object.values(idx.meta.notes).find(
      (n) => n.title.toLowerCase() === lower || n.rel.toLowerCase() === lower
    );
    if (!note) return text(`No encontr\xE9 la nota \xAB${title}\xBB.`);
    const nbs = idx.neighbors(note.rel);
    if (nbs.length === 0) return text(`\xAB${note.title}\xBB no tiene conexiones a\xFAn.`);
    return text(
      nbs.map((n) => `- \xAB${n.note.title}\xBB (${n.note.rel}) [${n.type}${n.w ? ` ${n.w}` : ""}]`).join("\n")
    );
  }
);
server.tool(
  "vault_link",
  "Crea una conexi\xF3n expl\xEDcita [[wikilink]] entre dos notas de la b\xF3veda.",
  { from: z.string(), to: z.string() },
  async ({ from, to }) => {
    const idx = VaultIndex.load(vault);
    const find = (t) => Object.values(idx.meta.notes).find(
      (n) => n.title.toLowerCase() === t.toLowerCase() || n.rel.toLowerCase() === t.toLowerCase()
    );
    const a = find(from);
    const b = find(to);
    if (!a || !b) return text(`No encontr\xE9 ${!a ? `\xAB${from}\xBB` : `\xAB${to}\xBB`}.`);
    const file = path.join(vault.root, a.rel);
    fs.appendFileSync(file, `
[[${b.title}]]
`);
    await idx.refresh().catch(() => {
    });
    return text(`Conectado: \xAB${a.title}\xBB \u2192 [[${b.title}]]`);
  }
);
server.tool(
  "plan_create",
  'PROTOCOLO paso 1 (solo tareas NO triviales \u2014 las simples resp\xF3ndelas directo, sin ceremonia): crea el plan con Definition of Done (criterios verificables de "terminado") y tareas numeradas. Verifica cada tarea con task_verify. El plan enfoca tu capacidad, no la limita; y deja huella reutilizable.',
  {
    title: z.string().describe('Nombre corto del objetivo, ej. "Login con Google"'),
    goal: z.string().describe("Qu\xE9 se quiere lograr, en una o dos frases"),
    dod: z.array(z.string()).describe("Definition of Done: criterios verificables de \xE9xito"),
    tasks: z.array(z.string()).describe("Tareas numeradas, chicas y verificables")
  },
  async ({ title, goal, dod, tasks }) => {
    ensureVaultStructure(vault);
    const idx = VaultIndex.load(vault);
    const map = findMap(idx);
    const content = [
      `## Objetivo
${goal}`,
      `## Definition of Done
${dod.map((d) => `- [ ] ${d}`).join("\n")}`,
      `## Tareas
${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
      map ? `Proyecto: [[${map.title}]]` : ""
    ].join("\n\n");
    const file = createNote(vault.managed, {
      title: `Plan - ${title}`,
      type: "plan",
      status: "active",
      tags: ["plan"],
      dir: "notes",
      content
    });
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    return text(
      `Plan guardado en ${path.relative(vault.root, file)}. Ejecuta las tareas UNA por una; tras cada una llama task_verify con evidencia real (salida de tests/build). Al terminar todo, llama lesson_extract.`
    );
  }
);
server.tool(
  "task_verify",
  "PROTOCOLO paso 2: registra el resultado VERIFICADO de una tarea con evidencia real (salida de tests, build, curl \u2014 no lo des por hecho sin correrlo). Guarda el veredicto compacto; si fall\xF3, busca lecciones previas con vault_search antes de improvisar.",
  {
    plan: z.string().describe('T\xEDtulo del plan al que pertenece (ej. "Plan - Login con Google")'),
    task: z.string().describe("Qu\xE9 tarea se verific\xF3"),
    passed: z.boolean().describe("true si la evidencia confirma que funciona"),
    evidence: z.string().describe('Evidencia compacta: "npm test \u2192 12/12 passed", c\xF3digo de error, etc.'),
    completes_plan: z.boolean().optional().describe("true si esta era la \xFAltima tarea y el plan queda completado")
  },
  async ({ plan, task, passed, evidence, completes_plan }) => {
    ensureVaultStructure(vault);
    const idx = VaultIndex.load(vault);
    const planNote = findByTitle(idx, plan);
    const file = createNote(vault.managed, {
      title: `${passed ? "OK" : "FALLO"} - ${task.slice(0, 60)}`,
      type: "verification",
      status: passed ? "completed" : "failed",
      tags: ["verificacion"],
      dir: "notes",
      content: `**Tarea:** ${task}

**Veredicto:** ${passed ? "\u2705 pas\xF3" : "\u274C fall\xF3"}

**Evidencia:**
\`\`\`
${evidence.slice(0, 1500)}
\`\`\`

${planNote ? `Plan: [[${planNote.title}]]` : ""}`
    });
    if (completes_plan && planNote) {
      try {
        setNoteStatus(path.join(vault.root, planNote.rel), passed ? "completed" : "failed");
      } catch {
      }
    }
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    if (!passed) {
      const lessons = await hybridSearch(vault, `${task} ${evidence.slice(0, 200)}`, 3);
      const useful = lessons.filter((l) => l.note.type === "lesson" || l.note.type === "solution");
      if (useful.length > 0) {
        return text(
          `Fallo registrado (${path.relative(vault.root, file)}). LECCIONES PREVIAS que podr\xEDan aplicar \u2014 \xFAsalas antes de improvisar:
` + useful.map((l) => `- \xAB${l.note.title}\xBB: ${l.excerpts[0]?.slice(0, 300) ?? ""}`).join("\n")
        );
      }
      return text(`Fallo registrado. Sin lecciones previas para esto \u2014 cuando lo resuelvas, guarda la lecci\xF3n con lesson_extract.`);
    }
    return text(`Verificaci\xF3n guardada${completes_plan ? " y plan marcado como completado" : ""}. ${completes_plan ? "Cierra con lesson_extract si hubo aprendizaje." : "Siguiente tarea."}`);
  }
);
server.tool(
  "lesson_extract",
  "PROTOCOLO paso 3: al resolver un error o terminar un plan, destila LA lecci\xF3n (qu\xE9 fall\xF3/funcion\xF3 y c\xF3mo evitarlo/repetirlo). 200 tokens hoy ahorran 20,000 de re-debug ma\xF1ana. Se inyecta autom\xE1ticamente cuando el problema reaparezca.",
  {
    title: z.string().describe('Lecci\xF3n en una frase, ej. "GOOGLE_CLIENT_SECRET debe ir en .env"'),
    lesson: z.string().describe("Qu\xE9 pas\xF3, causa ra\xEDz, y c\xF3mo aplicarla la pr\xF3xima vez"),
    links: z.array(z.string()).optional().describe("T\xEDtulos de notas relacionadas (plan, feature, etc.)")
  },
  async ({ title, lesson, links }) => {
    ensureVaultStructure(vault);
    const idx = VaultIndex.load(vault);
    const map = findMap(idx);
    const wikilinks = (links ?? []).map((l) => findByTitle(idx, l)).filter((n) => Boolean(n)).map((n) => `[[${n.title}]]`);
    if (map) wikilinks.push(`[[${map.title}]]`);
    const file = createNote(vault.managed, {
      title: `Lecci\xF3n - ${title.slice(0, 70)}`,
      type: "lesson",
      tags: ["leccion"],
      dir: "notes",
      content: `${lesson}

${wikilinks.length ? `Relacionado: ${[...new Set(wikilinks)].join(" \xB7 ")}` : ""}`
    });
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    return text(`Lecci\xF3n guardada en ${path.relative(vault.root, file)} \u2014 se inyectar\xE1 autom\xE1ticamente cuando el tema reaparezca.`);
  }
);
await server.connect(new StdioServerTransport());
