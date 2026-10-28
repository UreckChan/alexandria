#!/usr/bin/env node
import {
  architectBlock,
  ingestAndOutline,
  isUrl,
  outlineDir,
  outlineFile,
  pkgVersion,
  planContext,
  planQualityHints,
  readDoc,
  symbolSource
} from "../chunk-BXVNQVLX.js";
import {
  hybridSearch
} from "../chunk-47S5I3D3.js";
import {
  searchArchive
} from "../chunk-WSVNMMNN.js";
import {
  VaultIndex,
  createNote,
  setNoteStatus,
  slugify,
  supersedeNote,
  upsertNote
} from "../chunk-44QPE5IM.js";
import "../chunk-I5H4BN3F.js";
import {
  showRun
} from "../chunk-OGVWOBYH.js";
import "../chunk-X4V6SYYA.js";
import {
  ensureVaultStructure,
  resolveVault,
  toggleEnabled
} from "../chunk-YICWI3U3.js";
import "../chunk-EDYBSJSS.js";

// src/mcp/server.ts
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/core/hints.ts
var NOT_FOUND = /no such file|not found|cannot find|ENOENT|does not exist/i;
var RELATIVE_PATH = /(?:^|\s)(?!-)(?!\/)[\w.-]*\.\w+|(?:^|\s)\.{1,2}\//;
function pathHint(cmd, cwdArg, runDir, evidence) {
  if (!cmd) return "";
  if (!NOT_FOUND.test(evidence)) return "";
  if (!RELATIVE_PATH.test(cmd)) return "";
  const asked = cwdArg?.trim();
  const suggested = asked || "<carpeta-del-proyecto>";
  const clientDropped = Boolean(asked) && asked !== runDir;
  return `

\u{1F4A1} El comando se ejecut\xF3 en: ${runDir}` + (clientDropped ? ` \u2014 tu \`cwd\` NO lleg\xF3 (algunos clientes MCP descartan par\xE1metros nuevos hasta reiniciar la sesi\xF3n).` : ` \u2014 probablemente NO es la carpeta de tu proyecto.`) + `
   Ruta relativa + directorio equivocado = "no such file". Dos salidas:
   1) comando autocontenido (funciona en CUALQUIER cliente): \`cd ${suggested} && ${cmd}\`
   2) rutas absolutas en el comando.`;
}

// src/mcp/server.ts
var vault = resolveVault({ cwd: process.cwd() });
var server = new McpServer({ name: "alexandria", version: pkgVersion() });
var text = (t) => ({ content: [{ type: "text", text: t }] });
var tail = (s, n) => s.length > n ? "\u2026\n" + s.slice(-n) : s;
function findMap(idx) {
  const maps = Object.values(idx.meta.notes).filter((n) => n.type === "map" || n.title.startsWith("Mapa - "));
  const own = `Mapa - ${path.basename(process.cwd())}`.toLowerCase();
  return maps.find((n) => n.title.toLowerCase() === own) ?? maps[0];
}
function findByTitle(idx, t) {
  const lower = t.toLowerCase();
  const alt = lower.startsWith("plan - ") ? lower : `plan - ${lower}`;
  return Object.values(idx.meta.notes).find(
    (n) => [lower, alt].includes(n.title.toLowerCase()) || n.rel.toLowerCase() === lower
  );
}
server.registerTool(
  "vault_search",
  {
    description: "Busca conocimiento en la b\xF3veda local (b\xFAsqueda sem\xE1ntica + keyword). \xDAsala ANTES de explorar c\xF3digo o re-derivar contexto: si la b\xF3veda ya lo sabe, ahorras tokens.",
    inputSchema: { query: z.string().describe("Qu\xE9 buscar, en lenguaje natural"), k: z.number().int().min(1).max(15).optional() }
  },
  async ({ query, k }) => {
    const results = await hybridSearch(vault, query, k ?? 5, { expand: true });
    if (results.length === 0) {
      const arch = searchArchive(vault, query, 3);
      if (arch.length === 0) return text("Sin resultados en la b\xF3veda.");
      return text(
        "Sin resultados en el \xEDndice; en el archivo de prompts compactados:\n\n" + arch.map((h, i) => `${i + 1}. \xAB${h.heading}\xBB (${h.file})
   ${h.excerpt.replace(/\n/g, " ").slice(0, 400)}`).join("\n\n")
      );
    }
    const out = results.map(
      (r, i) => `${i + 1}. \xAB${r.note.title}\xBB (${r.note.rel}, tipo: ${r.note.type})${r.note.status === "superseded" ? ` [reemplazada por \xAB${r.note.supersededBy ?? "?"}\xBB]` : ""}
${r.excerpts.map((e) => "   " + e.replace(/\n/g, "\n   ").slice(0, 900)).join("\n")}`
    ).join("\n\n");
    return text(out);
  }
);
server.registerTool(
  "vault_save",
  {
    description: 'Guarda conocimiento destilado en la b\xF3veda (decisiones, arquitectura, soluciones). Si title empieza con "Mapa - " actualiza/crea el mapa del proyecto (se inyecta al inicio de cada sesi\xF3n). Si esta nota CAMBIA una decisi\xF3n o hecho anterior, pasa `supersedes` con el t\xEDtulo de la vieja: queda marcada como reemplazada y deja de inyectarse (no se borra).',
    inputSchema: {
      title: z.string(),
      content: z.string().describe("Markdown; puede incluir [[wikilinks]] a otras notas"),
      tags: z.array(z.string()).optional(),
      supersedes: z.array(z.string()).optional().describe("T\xEDtulos o rutas de notas que esta reemplaza (decisi\xF3n cambiada, hecho desactualizado)")
    }
  },
  async ({ title, content, tags, supersedes }) => {
    ensureVaultStructure(vault);
    if (!title.startsWith("Mapa - ") && !/\[\[/.test(content)) {
      const map = findMap(VaultIndex.load(vault));
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
    const replaced = [];
    if (supersedes?.length) {
      const idxS = VaultIndex.load(vault);
      for (const ref of supersedes) {
        const old = findByTitle(idxS, ref);
        if (old && path.join(vault.root, old.rel) !== file) {
          supersedeNote(path.join(vault.root, old.rel), title);
          replaced.push(old.title);
        }
      }
    }
    await VaultIndex.load(vault).refresh().catch(() => {
    });
    return text(
      `Guardado en ${path.relative(vault.root, file)}` + (replaced.length ? `. Reemplaza a: ${replaced.map((t) => `\xAB${t}\xBB`).join(", ")} (marcadas, ya no se inyectan).` : "") + (supersedes?.length && replaced.length < supersedes.length ? ` No encontr\xE9: ${supersedes.length - replaced.length}.` : "")
    );
  }
);
server.registerTool(
  "vault_related",
  {
    description: "Vecinos de una nota en el grafo de conocimiento (wikilinks + conexiones sem\xE1nticas) \u2014 trae conocimiento conectado sin releer archivos.",
    inputSchema: { title: z.string().describe("T\xEDtulo o ruta relativa de la nota") }
  },
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
server.registerTool(
  "vault_link",
  {
    description: "Crea una conexi\xF3n expl\xEDcita [[wikilink]] entre dos notas de la b\xF3veda.",
    inputSchema: { from: z.string(), to: z.string() }
  },
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
server.registerTool(
  "doc_ingest",
  {
    description: "\xDAsala EN VEZ de leer directamente un PDF, DOCX, XLSX, CSV o HTML (leer un PDF cuesta ~2,000 tokens por p\xE1gina), o una p\xE1gina de documentaci\xF3n web por URL (se baja una vez y se reutiliza 7 d\xEDas). La convierte localmente a markdown por secciones, la indexa y devuelve SOLO el \xEDndice de secciones (~200 tokens). Si el archivo no cambi\xF3, reutiliza la conversi\xF3n. Despu\xE9s pide lo que necesites con doc_read.",
    inputSchema: {
      path: z.string().describe("Ruta del archivo (absoluta o relativa al proyecto) o URL http(s) de una p\xE1gina de documentaci\xF3n"),
      force: z.boolean().optional().describe("Reconvertir (o volver a bajar la URL) aunque no haya cambiado")
    }
  },
  async ({ path: p, force }) => {
    try {
      const abs = isUrl(p) || path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      const res = await ingestAndOutline(vault, abs, { force });
      return text(res.text);
    } catch (e) {
      return text(`No pude ingerir \xAB${p}\xBB: ${e.message}`);
    }
  }
);
server.registerTool(
  "doc_read",
  {
    description: "Lee un documento ya ingerido SIN cargarlo completo: por ids de secci\xF3n (del \xEDndice de doc_ingest) o por pregunta (devuelve las secciones m\xE1s relevantes). Nunca pasa de max_tokens y dice qu\xE9 secciones quedaron fuera para que pidas m\xE1s solo si hace falta.",
    inputSchema: {
      doc: z.string().describe("Ruta del archivo original, t\xEDtulo o parte del nombre"),
      sections: z.array(z.string()).optional().describe('Ids de secci\xF3n, ej. ["s2","s5"]'),
      query: z.string().optional().describe("Pregunta: devuelve las secciones que la responden"),
      max_tokens: z.number().int().min(200).max(2e4).optional().describe("Presupuesto de tokens (default 1500)")
    }
  },
  async ({ doc, sections, query, max_tokens }) => text(await readDoc(vault, doc, { sections, query, maxTokens: max_tokens }))
);
var resolvePath = (p) => path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
server.registerTool(
  "code_outline",
  {
    description: "\xDAsala ANTES de leer un archivo de c\xF3digo completo: devuelve solo las firmas (funciones, clases, m\xE9todos, tipos) con su rango de l\xEDneas, sin cuerpos \u2014 una fracci\xF3n de los tokens del archivo. Con una carpeta, lista los s\xEDmbolos de primer nivel de cada archivo. Luego pide solo lo que necesites con code_symbol. JS/TS, Python, PHP, Go, Java, C#, Kotlin, Rust.",
    inputSchema: {
      path: z.string().describe("Archivo o carpeta (absoluta o relativa al proyecto)"),
      max_tokens: z.number().int().min(200).max(2e4).optional().describe("Tope para carpetas (default 2500)")
    }
  },
  async ({ path: p, max_tokens }) => {
    const abs = resolvePath(p);
    if (!fs.existsSync(abs)) return text(`No existe: ${abs}`);
    return text(fs.statSync(abs).isDirectory() ? outlineDir(abs, max_tokens) : outlineFile(abs));
  }
);
server.registerTool(
  "code_symbol",
  {
    description: 'Devuelve SOLO el cuerpo de un s\xEDmbolo (funci\xF3n, clase o "Clase.metodo") con n\xFAmeros de l\xEDnea, en vez del archivo entero. Si no lo encuentra, sugiere nombres parecidos.',
    inputSchema: {
      path: z.string().describe("Archivo"),
      name: z.string().describe("Nombre del s\xEDmbolo o Clase.metodo"),
      max_tokens: z.number().int().min(200).max(2e4).optional()
    }
  },
  async ({ path: p, name, max_tokens }) => {
    const abs = resolvePath(p);
    if (!fs.existsSync(abs)) return text(`No existe: ${abs}`);
    return text(symbolSource(abs, name, max_tokens));
  }
);
server.registerTool(
  "run_output",
  {
    description: 'Lee la salida COMPLETA de una corrida plegada por Alexandria (ale run / hook) sin volver a ejecutarla: por rango de l\xEDneas o filtrada con regex, sin pasar de max_tokens. El id viene en la l\xEDnea "salida completa: ale run show <id>"; "last" = la \xFAltima.',
    inputSchema: {
      id: z.string().describe('Id de la corrida o "last"'),
      grep: z.string().optional().describe("Regex: solo l\xEDneas que coinciden"),
      lines: z.string().optional().describe('Rango "a-b"'),
      max_tokens: z.number().int().min(100).max(2e4).optional()
    }
  },
  async ({ id, grep, lines, max_tokens }) => text(showRun(id, { grep, lines, maxTokens: max_tokens }))
);
server.registerTool(
  "plan_create",
  {
    description: "PROTOCOLO paso 1 (solo tareas NO triviales \u2014 las simples resp\xF3ndelas directo, sin ceremonia): crea el plan como un ARQUITECTO. Si el objetivo es vago, haz 2-3 preguntas de aclaraci\xF3n al usuario ANTES de crear el plan (qu\xE9 es \xE9xito, restricciones, alcance). DoD = criterios verificables por comando; tareas chicas y en orden de construcci\xF3n. Para planes grandes pasa `design` (stack/decisiones de arquitectura). La respuesta trae planes similares previos y lecciones \u2014 \xFAsalos para planear mejor. Verifica cada tarea con task_verify.",
    inputSchema: {
      title: z.string().describe('Nombre corto del objetivo, ej. "Login con Google"'),
      goal: z.string().describe("Qu\xE9 se quiere lograr, en una o dos frases"),
      dod: z.array(z.string()).describe("Definition of Done: criterios verificables de \xE9xito"),
      tasks: z.array(z.string()).describe("Tareas numeradas, chicas y verificables, en orden de construcci\xF3n"),
      design: z.string().optional().describe('Decisiones de arquitectura/stack del plan (el "blueprint"): qu\xE9 se eligi\xF3 y por qu\xE9. Recomendado en planes de >5 tareas.')
    }
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
    const cleanTitle = title.replace(/^\s*(plan\s*-\s*)+/i, "").trim() || title;
    const file = createNote(vault.managed, {
      title: `Plan - ${cleanTitle}`,
      type: "plan",
      status: "active",
      // tag del proyecto: el digest de inicio muestra solo los planes de este proyecto
      tags: ["plan", path.basename(process.cwd())],
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
server.registerTool(
  "task_verify",
  {
    description: 'PROTOCOLO paso 2: verifica una tarea con EVIDENCIA REAL, no con tu palabra. Pasa verify_command (ej. "npm test", "npm run build", "curl -sf localhost:3000") y Alexandria lo EJECUTA \u2014 el veredicto sale del exit code real. Si no puedes correr un comando, pasa evidence textual, pero se marca como auto-reportado (m\xE1s d\xE9bil). Si falla, busca lecciones previas antes de improvisar.',
    inputSchema: {
      plan: z.string().describe('T\xEDtulo del plan al que pertenece, tal como lo devolvi\xF3 plan_create (ej. "Plan - Login con Google")'),
      task: z.string().describe("Qu\xE9 tarea se verific\xF3"),
      passed: z.boolean().describe("Lo que T\xDA crees que pas\xF3 (se compara contra el resultado real del comando)"),
      verify_command: z.string().optional().describe('Comando a EJECUTAR para verificar de verdad; exit 0 = pas\xF3. Ej. "npm test", "npm run build". Preferido sobre evidence.'),
      cwd: z.string().optional().describe("Directorio donde correr verify_command. Por defecto se usa el del agente (a menudo la RA\xCDZ del workspace, no tu subproyecto): si tu comando usa rutas relativas, pasa aqu\xED la carpeta del proyecto."),
      evidence: z.string().optional().describe("Solo si NO hay comando: evidencia textual (queda marcada como auto-reportada, sin verificar)."),
      completes_plan: z.boolean().optional().describe("true si esta era la \xFAltima tarea y el plan queda completado")
    }
  },
  async ({ plan, task, passed, verify_command, cwd, evidence, completes_plan }) => {
    ensureVaultStructure(vault);
    const idx = VaultIndex.load(vault);
    const planNote = findByTitle(idx, plan);
    let realPassed = passed;
    let realEvidence;
    let verified = false;
    let discrepancy = "";
    const runDir = cwd?.trim() && fs.existsSync(cwd.trim()) ? cwd.trim() : process.cwd();
    if (verify_command && verify_command.trim()) {
      verified = true;
      try {
        const out = execSync(verify_command, {
          cwd: runDir,
          timeout: 18e4,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024
        });
        realPassed = true;
        realEvidence = `$ ${verify_command}
(cwd: ${runDir}, exit 0)
${tail(out, 1500)}`;
      } catch (e) {
        const err = e;
        realPassed = false;
        const output = ((err.stdout ?? "") + "\n" + (err.stderr ?? "")).trim() || err.message;
        realEvidence = `$ ${verify_command}
(cwd: ${runDir}, exit ${err.status ?? "\u22600"})
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
      const head = `Fallo ${verified ? "CONFIRMADO por el comando" : "registrado (auto-reportado)"} (${path.relative(vault.root, file)}).${discrepancy}` + pathHint(verify_command, cwd, runDir, realEvidence);
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
server.registerTool(
  "lesson_extract",
  {
    description: "PROTOCOLO paso 3: al resolver un error o terminar un plan, destila LA lecci\xF3n (qu\xE9 fall\xF3/funcion\xF3 y c\xF3mo evitarlo/repetirlo). 200 tokens hoy ahorran 20,000 de re-debug ma\xF1ana. Se inyecta autom\xE1ticamente cuando el problema reaparezca.",
    inputSchema: {
      title: z.string().describe('Lecci\xF3n en una frase, ej. "GOOGLE_CLIENT_SECRET debe ir en .env"'),
      lesson: z.string().describe("Qu\xE9 pas\xF3, causa ra\xEDz, y c\xF3mo aplicarla la pr\xF3xima vez"),
      links: z.array(z.string()).optional().describe("T\xEDtulos de notas relacionadas (plan, feature, etc.)")
    }
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
