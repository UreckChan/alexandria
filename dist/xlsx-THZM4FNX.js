#!/usr/bin/env node

// src/docs/xlsx.ts
import JSZip from "jszip";
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}
var attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
function textOf(xml) {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}
function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
var DATE_IDS = /* @__PURE__ */ new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function isDateFormat(code) {
  const c = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
  return /[dmyh]/i.test(c) && !/^[#0.,%\s]+$/.test(c);
}
function excelDate(serial, date1904 = false) {
  const ms = Math.round((serial + (date1904 ? 1462 : 0) - 25569) * 864e5);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? String(serial) : d.toISOString().slice(0, 10);
}
function numText(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : v;
}
async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const read = async (p) => await zip.file(p)?.async("string") ?? "";
  const workbook = await read("xl/workbook.xml");
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbook);
  const rels = await read("xl/_rels/workbook.xml.rels");
  const target = /* @__PURE__ */ new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const t = attr(m[0], "Target");
    if (id && t) target.set(id, t.startsWith("/") ? t.slice(1) : t.startsWith("xl/") ? t : `xl/${t}`);
  }
  const shared = [];
  for (const m of (await read("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  const styles = await read("xl/styles.xml");
  const customFmt = /* @__PURE__ */ new Map();
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    const code = attr(m[0], "formatCode");
    if (code !== void 0) customFmt.set(id, decodeXml(code));
  }
  const dateStyle = [];
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    dateStyle.push(DATE_IDS.has(id) || customFmt.has(id) && isDateFormat(customFmt.get(id)));
  }
  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(attr(m[0], "name") ?? `Hoja${sheets.length + 1}`);
    const rid = attr(m[0], "r:id") ?? attr(m[0], "id");
    const file = rid && target.get(rid) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = await read(file);
    const rows = [];
    const rowsByNum = /* @__PURE__ */ new Map();
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = [];
      let next = 0;
      for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1];
        const inner = c[2] ?? "";
        const ref = attr(a, "r");
        const col = ref ? colIndex(ref) : next;
        next = col + 1;
        const t = attr(a, "t");
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val = "";
        if (t === "s") val = v !== void 0 ? shared[Number(v)] ?? "" : "";
        else if (t === "inlineStr") val = textOf(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
        else if (t === "b") val = v === "1" ? "true" : v === "0" ? "false" : "";
        else if (t === "str" || t === "e") val = v !== void 0 ? decodeXml(v) : "";
        else if (v !== void 0) {
          const s = Number(attr(a, "s") ?? 0);
          val = dateStyle[s] && Number.isFinite(Number(v)) ? excelDate(Number(v), date1904) : numText(v);
        }
        if (val === "") continue;
        while (row.length < col) row.push("");
        row[col] = val;
      }
      rowsByNum.set(Number(attr(r[0], "r") ?? rowsByNum.size + 1), row);
    }
    for (const mc of xml.matchAll(/<mergeCell\b[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/gi)) {
      const [c1, r1, c2, r2] = [colIndex(mc[1]), Number(mc[2]), colIndex(mc[3]), Number(mc[4])];
      const master = rowsByNum.get(r1)?.[c1] ?? "";
      if (!master) continue;
      for (let rn = r1; rn <= r2; rn++) {
        const row = rowsByNum.get(rn) ?? [];
        for (let cn = c1; cn <= c2; cn++) {
          while (row.length < cn) row.push("");
          row[cn] = master;
        }
        rowsByNum.set(rn, row);
      }
    }
    for (const n of [...rowsByNum.keys()].sort((a, b) => a - b)) {
      const row = rowsByNum.get(n);
      if (row.some((x) => x !== "")) rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}
export {
  colIndex,
  decodeXml,
  excelDate,
  readXlsx
};
