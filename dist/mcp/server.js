#!/usr/bin/env node
import {
  architectBlock,
  pkgVersion,
  planContext,
  planQualityHints
} from "../chunk-T5VNBQEC.js";
import {
  hybridSearch
} from "../chunk-AHBSZGSC.js";
import {
  ensureVaultStructure,
  resolveVault,
  toggleEnabled
} from "../chunk-TFQ7WSIB.js";
import {
  VaultIndex
} from "../chunk-AXUEYSNZ.js";
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
import { execSync } from "child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var vault = resolveVault({ cwd: process.cwd() });
var server = new McpServer({ name: "alexandria", version: pkgVersion() });
var text = (t) => ({ content: [{ type: "text", text: t }] });
var tail = (s, n) => s.length > n ? "\u2026\n" + s.slice(-n) : s;
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
  "PROTOCOLO paso 1 (solo tareas NO triviales \u2014 las simples resp\xF3ndelas directo, sin ceremonia): crea el plan como un ARQUITECTO. Si el objetivo es vago, haz 2-3 preguntas de aclaraci\xF3n al usuario ANTES de crear el plan (qu\xE9 es \xE9xito, restricciones, alcance). DoD = criterios verificables por comando; tareas chicas y en orden de construcci\xF3n. Para planes grandes pasa `design` (stack/decisiones de arquitectura). La respuesta trae planes similares previos y lecciones \u2014 \xFAsalos para planear mejor. Verifica cada tarea con task_verify.",
  {
    title: z.string().describe('Nombre corto del objetivo, ej. "Login con Google"'),
    goal: z.string().describe("Qu\xE9 se quiere lograr, en una o dos frases"),
    dod: z.array(z.string()).describe("Definition of Done: criterios verificables de \xE9xito"),
    tasks: z.array(z.string()).describe("Tareas numeradas, chicas y verificables, en orden de construcci\xF3n"),
    design: z.string().optional().describe('Decisiones de arquitectura/stack del plan (el "blueprint"): qu\xE9 se eligi\xF3 y por qu\xE9. Recomendado en planes de >5 tareas.')
  },
  async ({ title, goal, dod, tasks, design }) => {
    ensureVaultStructure(vault);
    const enrich = toggleEnabled("architect.enrich");
    const ctx = enrich ? await planContext(vault, `${title} ${goal}`) : { similarPlans: [], lessons: [] };
    const hints = enrich ? planQualityHints(dod, tasks, design) : [];
    const idx = VaultIndex.load(vault);
    const map = findMap(idx);
    const content = [
      `## Objetivo
${goal}`,
      design?.trim() ? `## Dise\xF1o
${design.trim()}` : "",
      `## Definition of Done
${dod.map((d) => `- [ ] ${d}`).join("\n")}`,
      `## Tareas
${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
      map ? `Proyecto: [[${map.title}]]` : ""
    ].filter(Boolean).join("\n\n");
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
    const extra = architectBlock(ctx, hints);
    return text(
      `Plan guardado en ${path.relative(vault.root, file)}. Ejecuta las tareas UNA por una; tras cada una llama task_verify con evidencia real (salida de tests/build). Al terminar todo, llama lesson_extract.` + (extra ? `

${extra}` : "")
    );
  }
);
server.tool(
  "task_verify",
  'PROTOCOLO paso 2: verifica una tarea con EVIDENCIA REAL, no con tu palabra. Pasa verify_command (ej. "npm test", "npm run build", "curl -sf localhost:3000") y Alexandria lo EJECUTA \u2014 el veredicto sale del exit code real. Si no puedes correr un comando, pasa evidence textual, pero se marca como auto-reportado (m\xE1s d\xE9bil). Si falla, busca lecciones previas antes de improvisar.',
  {
    plan: z.string().describe('T\xEDtulo del plan al que pertenece (ej. "Plan - Login con Google")'),
    task: z.string().describe("Qu\xE9 tarea se verific\xF3"),
    passed: z.boolean().describe("Lo que T\xDA crees que pas\xF3 (se compara contra el resultado real del comando)"),
    verify_command: z.string().optional().describe('Comando a EJECUTAR para verificar de verdad; exit 0 = pas\xF3. Ej. "npm test", "npm run build". Preferido sobre evidence.'),
    evidence: z.string().optional().describe("Solo si NO hay comando: evidencia textual (queda marcada como auto-reportada, sin verificar)."),
    completes_plan: z.boolean().optional().describe("true si esta era la \xFAltima tarea y el plan queda completado")
  },
  async ({ plan, task, passed, verify_command, evidence, completes_plan }) => {
    ensureVaultStructure(vault);
    const idx = VaultIndex.load(vault);
    const planNote = findByTitle(idx, plan);
    let realPassed = passed;
    let realEvidence;
    let verified = false;
    let discrepancy = "";
    if (verify_command && verify_command.trim()) {
      verified = true;
      try {
        const out = execSync(verify_command, {
          cwd: process.cwd(),
          timeout: 18e4,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024
        });
        realPassed = true;
        realEvidence = `$ ${verify_command}
(exit 0)
${tail(out, 1500)}`;
      } catch (e) {
        const err = e;
        realPassed = false;
        const output = ((err.stdout ?? "") + "\n" + (err.stderr ?? "")).trim() || err.message;
        realEvidence = `$ ${verify_command}
(exit ${err.status ?? "\u22600"})
${tail(output, 1500)}`;
      }
      if (passed !== realPassed) {
        discrepancy = `

\u26A0 DISCREPANCIA: afirmaste passed=${passed}, pero el comando dio ${realPassed ? "\xC9XITO" : "FALLO"}. Alexandria registr\xF3 el resultado REAL (${realPassed}). Revisa lo que hiciste \u2014 no des por hecho lo que no corriste.`;
      }
    } else {
      realEvidence = `(auto-reportado, SIN comando de verificaci\xF3n \u2014 no ejecutado)
${tail(evidence ?? "sin evidencia", 1500)}`;
    }
    const file = createNote(vault.managed, {
      title: `${realPassed ? "OK" : "FALLO"} - ${task.slice(0, 60)}`,
      type: "verification",
      status: realPassed ? "completed" : "failed",
      tags: verified ? ["verificacion", "verificado"] : ["verificacion", "auto-reportado"],
      dir: "notes",
      content: `**Tarea:** ${task}

**Veredicto:** ${realPassed ? "\u2705 pas\xF3" : "\u274C fall\xF3"} ${verified ? "(verificado ejecutando el comando)" : "(\u26A0 auto-reportado, sin ejecutar)"}

**Evidencia:**
\`\`\`
${realEvidence}
\`\`\`

${planNote ? `Plan: [[${planNote.title}]]` : ""}`
    });
    if (completes_plan && planNote) {
      try {
        setNoteStatus(path.join(vault.root, planNote.rel), realPassed ? "completed" : "failed");
      } catch {
      }
    }
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    if (!realPassed) {
      const lessons = await hybridSearch(vault, `${task} ${realEvidence.slice(0, 200)}`, 3);
      const useful = lessons.filter((l) => l.note.type === "lesson" || l.note.type === "solution");
      const head = `Fallo ${verified ? "CONFIRMADO por el comando" : "registrado (auto-reportado)"} (${path.relative(vault.root, file)}).${discrepancy}`;
      if (useful.length > 0) {
        return text(
          `${head}
LECCIONES PREVIAS que podr\xEDan aplicar \u2014 \xFAsalas antes de improvisar:
` + useful.map((l) => `- \xAB${l.note.title}\xBB: ${l.excerpts[0]?.slice(0, 300) ?? ""}`).join("\n")
        );
      }
      return text(`${head}
Sin lecciones previas \u2014 cuando lo resuelvas, gu\xE1rdala con lesson_extract.`);
    }
    const verdictHint = verified ? "Verificaci\xF3n REAL guardada (comando ejecutado, exit 0)." : "\u26A0 Verificaci\xF3n auto-reportada guardada \u2014 sin comando, no se comprob\xF3 de verdad. Pasa verify_command la pr\xF3xima.";
    return text(
      `${verdictHint}${completes_plan ? " Plan marcado como completado." : ""}${discrepancy} ${completes_plan ? "Cierra con lesson_extract si hubo aprendizaje." : "Siguiente tarea."}`
    );
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
