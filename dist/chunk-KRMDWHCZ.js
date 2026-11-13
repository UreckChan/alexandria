#!/usr/bin/env node

// src/core/lock.ts
import fs from "fs";
import path from "path";
var STALE_MS = 3 * 60 * 60 * 1e3;
function reindexLockPath(vault) {
  return path.join(vault.cache, "reindex.lock");
}
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
function reindexLockHolder(vault) {
  try {
    const file = reindexLockPath(vault);
    const st = fs.statSync(file);
    const pid = Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10);
    if (Date.now() - st.mtimeMs > STALE_MS) return null;
    return pidAlive(pid) ? pid : null;
  } catch {
    return null;
  }
}
function acquireReindexLock(vault, opts = {}) {
  const pid = opts.pid ?? process.pid;
  const file = reindexLockPath(vault);
  fs.mkdirSync(vault.cache, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, String(pid), { flag: "wx" });
      return true;
    } catch (e) {
      if (e.code !== "EEXIST") return false;
    }
    let holder = null;
    try {
      holder = Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10);
    } catch {
      continue;
    }
    if (holder === pid || opts.adoptFrom !== void 0 && holder === opts.adoptFrom) {
      fs.writeFileSync(file, String(pid));
      return true;
    }
    if (reindexLockHolder(vault) !== null) return false;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      return false;
    }
  }
  return false;
}
function transferReindexLock(vault, toPid, fromPid = process.pid) {
  const file = reindexLockPath(vault);
  try {
    if (Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10) === fromPid) {
      fs.writeFileSync(file, String(toPid));
    }
  } catch {
  }
}
function releaseReindexLock(vault, pid = process.pid) {
  const file = reindexLockPath(vault);
  try {
    if (Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10) === pid) fs.rmSync(file, { force: true });
  } catch {
  }
}

export {
  reindexLockHolder,
  acquireReindexLock,
  transferReindexLock,
  releaseReindexLock
};
