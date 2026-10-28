#!/usr/bin/env node

// src/docs/convert.ts
import fs from "fs";
import path from "path";
var PDF_TOKENS_PER_PAGE = 2e3;
var ROWS_PER_SECTION = 50;
var SAMPLE_VALUES = 3;
var MAX_CELL = 160;
var MIN_CHARS_PER_PAGE = 40;
var SUPPORTED_EXT = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".html": "html",
  ".htm": "html",
  ".xlsx": "xlsx",
  ".csv": "csv",
  ".tsv": "csv",
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text"
};
function formatOf(file) {
  return SUPPORTED_EXT[path.extname(file).toLowerCase()];
}
var tokens = (s) => Math.ceil(s.length / 4);
async function convertFile(abs) {
  const format = formatOf(abs);
  if (!format) throw new Error(`Formato no soportado: ${path.extname(abs) || abs} (soportados: ${Object.keys(SUPPORTED_EXT).join(" ")})`);
  const buf = fs.readFileSync(abs);
  switch (format) {
    case "pdf":
      return pdfToMarkdown(buf);
    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.convertToHtml({ buffer: buf });
      const markdown = await htmlToMarkdown(value);
      return { format, markdown, tokensOriginal: tokens(markdown) };
    }
    case "html": {
      const markdown = await htmlToMarkdown(buf.toString("utf8"));
      return { format, markdown, tokensOriginal: tokens(buf.toString("utf8")) };
    }
    case "xlsx":
      return xlsxToMarkdown(buf);
    case "csv": {
      const text = buf.toString("utf8");
      const delim = path.extname(abs).toLowerCase() === ".tsv" ? "	" : sniffDelimiter(text);
      const rows = parseCsv(text, delim);
      const markdown = sheetsToMarkdown([{ name: path.basename(abs), rows }]);
      return { format, markdown, rows: Math.max(0, rows.length - 1), tokensOriginal: tokens(text) };
    }
    default: {
      const markdown = buf.toString("utf8");
      return { format, markdown, tokensOriginal: tokens(markdown) };
    }
  }
}
async function pdfToMarkdown(buf) {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const byY = /* @__PURE__ */ new Map();
    for (const it of tc.items) {
      if (!it.str || !it.transform) continue;
      const y = Math.round(it.transform[5]);
      const size = Math.round(Math.hypot(it.transform[0], it.transform[1]) || it.height || 0);
      const arr = byY.get(y) ?? [];
      arr.push({ x: it.transform[4], str: it.str, size });
      byY.set(y, arr);
    }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) {
      const parts = byY.get(y).sort((a, b) => a.x - b.x);
      const text = parts.map((x) => x.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push({ page: p, text, size: Math.max(...parts.map((x) => x.size)) });
    }
  }
  const bySize = [...lines].sort((a, b) => a.size - b.size);
  const totalChars = lines.reduce((n, l) => n + l.text.length, 0);
  let acc = 0;
  const median = bySize.find((l) => (acc += l.text.length) >= totalChars / 2)?.size ?? 0;
  const isHeading = (l) => median > 0 && l.size >= median * 1.3 && l.text.length <= 120;
  const hasHeadings = lines.some(isHeading);
  const out = [];
  let page = 0;
  let para = [];
  const flush = () => {
    if (para.length) out.push(para.join(" ").replace(/^#/, "\\#"));
    para = [];
  };
  for (const l of lines) {
    if (l.page !== page) {
      flush();
      page = l.page;
      if (!hasHeadings) out.push(`## P\xE1gina ${page}`);
    }
    if (hasHeadings && isHeading(l)) {
      flush();
      const prev = out[out.length - 1];
      const m = prev?.match(/^## (.+) \(p\. (\d+)\)$/);
      if (m && Number(m[2]) === l.page && m[1].length + l.text.length < 240) {
        out[out.length - 1] = `## ${m[1]} ${l.text} (p. ${l.page})`;
      } else {
        out.push(`## ${l.text} (p. ${l.page})`);
      }
    } else {
      para.push(l.text);
      if (/[.:;!?]$/.test(l.text)) flush();
    }
  }
  flush();
  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  if (chars < MIN_CHARS_PER_PAGE * pdf.numPages) {
    out.unshift(
      `## \u26A0 PDF escaneado (sin capa de texto)

Solo se extrajeron ${chars} caracteres en ${pdf.numPages} p\xE1gina(s): el contenido es imagen. Alexandria no hace OCR; para leerlo hay que verlo como imagen (Read del archivo, ~${PDF_TOKENS_PER_PAGE.toLocaleString("en")} tokens por p\xE1gina) \u2014 de preferencia solo las p\xE1ginas necesarias.`
    );
  }
  return {
    format: "pdf",
    markdown: out.join("\n\n"),
    pages: pdf.numPages,
    tokensOriginal: pdf.numPages * PDF_TOKENS_PER_PAGE
  };
}
async function htmlToMarkdown(html) {
  const TurndownService = (await import("turndown")).default;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  td.remove(["script", "style", "nav", "footer", "aside", "noscript", "iframe", "svg", "title", "head"]);
  td.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll("tr")).map(
        (tr) => Array.from(tr.children).map((c) => cell(c.textContent ?? ""))
      );
      return rows.length ? "\n\n" + mdTable(rows) + "\n\n" : "";
    }
  });
  td.addRule("img", { filter: "img", replacement: (_c, node) => node.getAttribute("alt") ? `[imagen: ${node.getAttribute("alt")}]` : "" });
  return td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}
var cell = (v) => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return (t.length > MAX_CELL ? t.slice(0, MAX_CELL) + `\u2026(+${t.length - MAX_CELL})` : t).replace(/\|/g, "\\|");
};
function mdTable(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(width - r.length).fill("")];
  const [head, ...body] = rows.map(pad);
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}
function inferType(values) {
  const vals = values.filter((v) => v !== "");
  if (vals.length === 0) return "vac\xEDa";
  if (vals.every((v) => /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(v.replace(/,/g, "")))) return "n\xFAmero";
  if (vals.every((v) => !isNaN(Date.parse(v)) && /\d{4}|\d{1,2}[/-]\d{1,2}/.test(v))) return "fecha";
  if (new Set(vals).size <= Math.max(5, vals.length * 0.05)) return `categor\xEDa (${new Set(vals).size} valores)`;
  return "texto";
}
function sheetsToMarkdown(sheets) {
  const out = [];
  for (const { name, rows } of sheets) {
    const clean = rows.map((r) => Array.from(r ?? [], (c) => c ?? "")).filter((r) => r.some((c) => c !== ""));
    if (clean.length === 0) continue;
    const [header, ...data] = clean;
    const cols = header.map((h, i) => h || `col${i + 1}`);
    out.push(`## Hoja \xAB${name}\xBB \u2014 resumen`);
    out.push(`Filas de datos: ${data.length} \xB7 Columnas: ${cols.length}`);
    out.push(
      mdTable([
        ["columna", "tipo", "ejemplos"],
        ...cols.map((c, i) => {
          const values = data.map((r) => r[i] ?? "");
          const sample = [...new Set(values.filter(Boolean))].slice(0, SAMPLE_VALUES).map((v) => v.slice(0, 40));
          return [cell(c), inferType(values), cell(sample.join(", "))];
        })
      ])
    );
    for (let i = 0; i < data.length; i += ROWS_PER_SECTION) {
      const block = data.slice(i, i + ROWS_PER_SECTION);
      out.push(`## Hoja \xAB${name}\xBB \xB7 filas ${i + 1}\u2013${i + block.length}`);
      out.push(mdTable([cols.map(cell), ...block.map((r) => r.map(cell))]));
    }
  }
  return out.join("\n\n");
}
async function xlsxToMarkdown(buf) {
  const { readXlsx } = await import("./xlsx-THZM4FNX.js");
  const sheets = await readXlsx(buf);
  let totalRows = 0;
  let rawChars = 0;
  for (const sh of sheets) {
    totalRows += Math.max(0, sh.rows.length - 1);
    for (const r of sh.rows) rawChars += r.join(",").length + 1;
  }
  return { format: "xlsx", markdown: sheetsToMarkdown(sheets), rows: totalRows, tokensOriginal: Math.ceil(rawChars / 4) };
}
function sniffDelimiter(text) {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "	", "|"].map((d) => [d, first.split(d).length]);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}
function parseCsv(text, delim = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

export {
  PDF_TOKENS_PER_PAGE,
  formatOf,
  convertFile,
  htmlToMarkdown
};
