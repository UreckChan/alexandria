#!/usr/bin/env node
import {
  runHook
} from "../chunk-WVZQGLRI.js";
import {
  saveRun,
  shouldFoldOutput
} from "../chunk-OGVWOBYH.js";
import {
  logFold
} from "../chunk-X4V6SYYA.js";
import {
  resolveVault,
  toggleEnabled,
  vaultExists
} from "../chunk-YICWI3U3.js";
import "../chunk-EDYBSJSS.js";

// src/hooks/on-bash.ts
runHook(3e3, async (input) => {
  if (!toggleEnabled("run.fold")) return;
  if (input.toolName && input.toolName !== "Bash") return;
  const res = input.toolResponse;
  if (!input.command || !res || res.interrupted || res.isImage) return;
  const stdout = typeof res.stdout === "string" ? res.stdout : "";
  const stderr = typeof res.stderr === "string" ? res.stderr : "";
  const output = stderr ? `${stdout}
${stderr}` : stdout;
  if (!shouldFoldOutput(input.command, output.length)) return;
  const { fold } = saveRun({ command: input.command, cwd: input.cwd ?? process.cwd(), output, exitCode: 0, ms: input.durationMs ?? 0 });
  if (!fold.folded) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: { stdout: fold.text, stderr: "", interrupted: false, isImage: false }
      }
    })
  );
  try {
    const vault = resolveVault({ cwd: input.cwd });
    if (vaultExists(vault)) logFold(vault, { originalChars: fold.originalChars, servedChars: fold.text.length, session: input.session_id });
  } catch {
  }
});
