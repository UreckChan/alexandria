#!/usr/bin/env node

// src/core/embedder.ts
import fs from "fs";
import os from "os";
import path from "path";
var MODEL_ID = "Xenova/multilingual-e5-small";
var DIM = 384;
function modelCacheDir() {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "alexandria", "models");
  }
  return path.join(os.homedir(), ".cache", "alexandria", "models");
}
function modelPresent() {
  const dir = path.join(modelCacheDir(), ...MODEL_ID.split("/"));
  try {
    return fs.readdirSync(dir).some((f) => f === "onnx" || f.endsWith(".json"));
  } catch {
    return false;
  }
}
var pipePromise = null;
async function getEmbedder(onProgress) {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = modelCacheDir();
      const pipe = await pipeline("feature-extraction", MODEL_ID, {
        dtype: "q8",
        progress_callback: onProgress ? (p) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            onProgress(Math.round(p.progress), p.file ?? "");
          }
        } : void 0
      });
      return pipe;
    })();
    pipePromise.catch(() => {
      pipePromise = null;
    });
  }
  return pipePromise;
}
async function disposeEmbedder() {
  if (!pipePromise) return;
  try {
    const pipe = await pipePromise;
    await pipe.dispose?.();
  } catch {
  }
  pipePromise = null;
}
async function embed(texts, kind = "passage", onProgress) {
  if (texts.length === 0) return [];
  const pipe = await getEmbedder(onProgress);
  const prefixed = texts.map((t) => `${kind}: ${t}`);
  const rows = [];
  const BATCH = 16;
  for (let i = 0; i < prefixed.length; i += BATCH) {
    const batch = prefixed.slice(i, i + BATCH);
    const out = await pipe(batch, { pooling: "mean", normalize: true });
    const dim = out.dims[out.dims.length - 1];
    for (let j = 0; j < batch.length; j++) {
      rows.push(out.data.slice(j * dim, (j + 1) * dim));
    }
  }
  return rows;
}
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function chunkMarkdown(content, maxChars = 1200, overlap = 200) {
  const out = [];
  let heading;
  let buf = "";
  const flush = () => {
    const text = buf.trim();
    if (text.length > 0) out.push({ heading, text });
    buf = buf.slice(Math.max(0, buf.length - overlap));
  };
  for (const para of content.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const h = trimmed.match(/^#{1,6}\s+(.+)$/m);
    if (h) heading = h[1].trim();
    if (buf.length + trimmed.length + 2 > maxChars && buf.trim()) flush();
    if (trimmed.length > maxChars) {
      for (let i = 0; i < trimmed.length; i += maxChars - overlap) {
        out.push({ heading, text: trimmed.slice(i, i + maxChars) });
      }
      buf = "";
      continue;
    }
    buf += (buf ? "\n\n" : "") + trimmed;
  }
  if (buf.trim()) out.push({ heading, text: buf.trim() });
  return out;
}

export {
  MODEL_ID,
  DIM,
  modelCacheDir,
  modelPresent,
  getEmbedder,
  disposeEmbedder,
  embed,
  dot,
  chunkMarkdown
};
