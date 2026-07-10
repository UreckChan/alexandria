#!/usr/bin/env node

// src/core/vault.ts
import fs from "fs";
import os from "os";
import path from "path";
var MANAGED_DIR = "Alexandria";
function configDir() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "alexandria");
  }
  return path.join(os.homedir(), ".config", "alexandria");
}
function globalConfigPath() {
  return path.join(configDir(), "config.json");
}
function defaultVaultPath() {
  return path.join(os.homedir(), "KnowledgeVault");
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function findProjectConfig(from) {
  let dir = path.resolve(from);
  for (; ; ) {
    const candidate = path.join(dir, ".vault.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function build(root, source, projectConfig) {
  return {
    root,
    managed: path.join(root, MANAGED_DIR),
    cache: path.join(root, ".vault"),
    source,
    projectConfig
  };
}
function resolveVault(opts = {}) {
  if (opts.flag) return build(path.resolve(opts.flag), "flag");
  const cwd = opts.cwd ?? process.cwd();
  const projectFile = findProjectConfig(cwd);
  if (projectFile) {
    const cfg = readJson(projectFile);
    if (cfg?.vaultPath) {
      const base = path.dirname(projectFile);
      return build(path.resolve(base, cfg.vaultPath), "project", projectFile);
    }
  }
  const globalCfg = readJson(globalConfigPath());
  if (globalCfg?.vaultPath) return build(globalCfg.vaultPath, "global");
  return build(defaultVaultPath(), "default");
}
function vaultExists(v) {
  return fs.existsSync(v.managed) || fs.existsSync(v.cache);
}
function ensureVaultStructure(v) {
  for (const dir of [
    v.root,
    v.managed,
    path.join(v.managed, "notes"),
    path.join(v.managed, "prompts"),
    path.join(v.managed, "sessions"),
    v.cache
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function writeGlobalConfig(vaultPath) {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(globalConfigPath(), JSON.stringify({ vaultPath }, null, 2) + "\n");
}
function writeProjectConfig(projectDir, vaultPath) {
  const file = path.join(projectDir, ".vault.json");
  const rel = path.relative(projectDir, vaultPath) || ".";
  const stored = rel.startsWith("..") ? vaultPath : rel;
  fs.writeFileSync(file, JSON.stringify({ vaultPath: stored }, null, 2) + "\n");
  return file;
}

// src/core/notes.ts
import fs2 from "fs";
import path2 from "path";
import matter from "gray-matter";
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
      entries = fs2.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const full = path2.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}
function parseNote(root, absPath) {
  const raw = fs2.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  const rel = path2.relative(root, absPath).split(path2.sep).join("/");
  const title = typeof data.title === "string" && data.title || path2.basename(absPath, ".md");
  const type = ["note", "prompt", "session", "map"].includes(data.type) ? data.type : "note";
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  return {
    rel,
    title,
    type,
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
    const raw = fs2.readFileSync(absPath, "utf8");
    const { data, content } = matter(raw);
    if (!data.title || data.aliases) return false;
    data.aliases = [String(data.title)];
    fs2.writeFileSync(absPath, matter.stringify(content, data));
    return true;
  } catch {
    return false;
  }
}
function createNote(managed, n) {
  const dir = path2.join(managed, n.dir ?? "notes");
  fs2.mkdirSync(dir, { recursive: true });
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const base = `${date}-${slugify(n.title)}`;
  let file = path2.join(dir, `${base}.md`);
  let i = 2;
  while (fs2.existsSync(file)) file = path2.join(dir, `${base}-${i++}.md`);
  fs2.writeFileSync(
    file,
    frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [] }) + n.content.trim() + "\n"
  );
  return file;
}
function touchNote(absPath) {
  const raw = fs2.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  data.hits = (typeof data.hits === "number" ? data.hits : 1) + 1;
  data.updated = (/* @__PURE__ */ new Date()).toISOString();
  fs2.writeFileSync(absPath, matter.stringify(content, data));
}
function upsertNote(managed, n) {
  const dir = path2.join(managed, n.dir ?? "notes");
  fs2.mkdirSync(dir, { recursive: true });
  const file = path2.join(dir, `${n.fixedName}.md`);
  if (fs2.existsSync(file)) {
    const raw = fs2.readFileSync(file, "utf8");
    const { data } = matter(raw);
    data.updated = (/* @__PURE__ */ new Date()).toISOString();
    fs2.writeFileSync(file, matter.stringify(n.content.trim() + "\n", data));
  } else {
    fs2.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "note", tags: n.tags ?? [] }) + n.content.trim() + "\n"
    );
  }
  return file;
}
function appendToNote(managed, n) {
  const dir = path2.join(managed, n.dir ?? "sessions");
  fs2.mkdirSync(dir, { recursive: true });
  const file = path2.join(dir, `${n.fixedName}.md`);
  if (fs2.existsSync(file)) {
    fs2.appendFileSync(file, "\n" + n.content.trim() + "\n");
  } else {
    fs2.writeFileSync(
      file,
      frontmatter({ title: n.title, type: n.type ?? "session", tags: n.tags ?? [] }) + n.content.trim() + "\n"
    );
  }
  return file;
}

export {
  MANAGED_DIR,
  globalConfigPath,
  defaultVaultPath,
  resolveVault,
  vaultExists,
  ensureVaultStructure,
  writeGlobalConfig,
  writeProjectConfig,
  slugify,
  listMarkdownFiles,
  parseNote,
  ensureAlias,
  createNote,
  touchNote,
  upsertNote,
  appendToNote
};
