#!/usr/bin/env node
import {
  pkgVersion
} from "../chunk-KHTYRYDR.js";
import {
  hybridSearch
} from "../chunk-FID2RAOH.js";
import {
  VaultIndex
} from "../chunk-VN7QOAG2.js";
import {
  createNote,
  ensureVaultStructure,
  resolveVault,
  slugify,
  upsertNote
} from "../chunk-CF2GLMR3.js";
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
await server.connect(new StdioServerTransport());
