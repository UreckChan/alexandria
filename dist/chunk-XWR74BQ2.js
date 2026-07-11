#!/usr/bin/env node

// src/core/notes.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
var NOTE_TYPES = [
  "note",
  "prompt",
  "session",
  "map",
  "plan",
  "task",
  "verification",
  "lesson",
  "solution"
];
var SKIP_DIRS = /* @__PURE__ */ new Set([".obsidian", ".vault", ".trash", ".git", "node_modules"]);
function extractWikilinks(content) {
  const out = /* @__PURE__ */ new Set();
  const re = /\[\[([^\]|#\n]+)(?:[|#][^\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].trim();
    if (target) out.add(target);
  }
  return [...out];
}
function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "nota";
}
function listMarkdownFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}
function parseNote(root, absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  const rel = path.relative(root, absPath).split(path.sep).join("/");
  const title = typeof data.title === "string" && data.title || path.basename(absPath, ".md");
  const type = NOTE_TYPES.includes(data.type) ? data.type : "note";
  const status = ["active", "completed", "failed"].includes(data.status) ? data.status : void 0;
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  return {
    rel,
    title,
    type,
    status,
    tags,
    created: data.created ? String(data.created) : void 0,
    hits: typeof data.hits === "number" ? data.hits : 1,
    content,
    links: extractWikilinks(content)
  };
}
function frontmatter(n) {
  const lines = [
    "---",
    `title: ${JSON.stringify(n.title)}`,
    // aliases: Obsidian resuelve [[wikilinks]] contra alias, no contra el title
    // del frontmatter — sin esto su graph view muestra los enlaces como rotos
    `aliases: [${JSON.stringify(n.title)}]`,
    `type: ${n.type}`,
    ...n.status ? [`status: ${n.status}`] : [],
    `tags: [${n.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `hits: ${n.hits ?? 1}`,
    "---",
    ""
  ];
  return lines.join("\n");
}
function ensureAlias(absPath) {
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    const { data, content } = matter(raw);
    if (!data.title || data.aliases) return false;
    data.aliases = [String(data.title)];
    fs.writeFileSync(absPath, matter.stringify(content, data));
    return true;
  } catch {
    return false;
  }
}
function createNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "notes");
  fs.mkdirSync(dir, { recursive: true });
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const base = `${date}-${slugify(n.title)}`;
  let file = path.join(dir, `${base}.md`);
  let i = 2;
  while (fs.existsSync(file)) file = path.join(dir, `${base}-${i++}.md`);
  fs.writeFileSync(
    file,
    frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
  );
  return file;
}
function setNoteStatus(absPath, status) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  data.status = status;
  data.updated = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(absPath, matter.stringify(content, data));
}
function touchNote(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  data.hits = (typeof data.hits === "number" ? data.hits : 1) + 1;
  data.updated = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(absPath, matter.stringify(content, data));
}
function upsertNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "notes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${n.fixedName}.md`);
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    const { data } = matter(raw);
    data.updated = (/* @__PURE__ */ new Date()).toISOString();
    fs.writeFileSync(file, matter.stringify(n.content.trim() + "\n", data));
  } else {
    fs.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
    );
  }
  return file;
}
function appendToNote(managed, n) {
  const dir = path.join(managed, n.dir ?? "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${n.fixedName}.md`);
  if (fs.existsSync(file)) {
    fs.appendFileSync(file, "\n" + n.content.trim() + "\n");
  } else {
    fs.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "session", tags: n.tags ?? [], status: n.status }) + n.content.trim() + "\n"
    );
  }
  return file;
}

export {
  slugify,
  listMarkdownFiles,
  parseNote,
  ensureAlias,
  createNote,
  setNoteStatus,
  touchNote,
  upsertNote,
  appendToNote
};
