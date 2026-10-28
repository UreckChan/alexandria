# 🏛️ Alexandria

> A local knowledge vault for your AI agents — saves tokens, remembers across sessions, and turns every model into a disciplined engineer.

[![npm](https://img.shields.io/npm/v/%40ureck%2Falexandria)](https://www.npmjs.com/package/@ureck/alexandria)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/☕_Buy_me_a_coffee-ureck-yellow)](https://buymeacoffee.com/ureck)

[![docs](https://img.shields.io/badge/docs-ES%20%C2%B7%20EN-b8860b)](https://alexandria.ureck.dev/) **[Documentation / Documentación](https://alexandria.ureck.dev/)**

Alexandria automatically captures your AI prompts and sessions, searches that knowledge **before** spending tokens, and connects everything in an Obsidian-style graph. **100% local**: no database, no API keys, no telemetry, no cost.

Works with the most popular agents via MCP: **Claude Code · Codex CLI · Gemini CLI · Cursor · OpenCode · Devin CLI · Cline · VS Code (Copilot) · OpenClaw · Hermes Agent · Windsurf (legacy)** — and since 1.4, **automatic capture + context injection via hooks in Claude Code, Codex, Gemini CLI, Cursor and OpenCode**.

## Why?

Every new AI session starts from zero: it re-explores your code, re-derives decisions you already made, re-spends the same tokens. Alexandria breaks that cycle:

- **Saves tokens**: every prompt triggers a local semantic search (<100ms) that injects only the relevant fragments — instead of re-reading whole files.
- **Zero re-analysis between sessions**: on session start, the agent receives the project map and all accumulated knowledge.
- **Solution memory**: if a nearly identical prompt was already solved, the previous solution is injected — the agent doesn't re-derive it.
- **Infinite context, nothing is ever lost**: old noise gets archived, never deleted — everything stays searchable forever.
- **It's a valid Obsidian vault**: plain markdown with `[[wikilinks]]`. Open it in Obsidian anytime.
- **Cross-platform**: Windows, macOS, Linux · Node, Bun or Deno. Pure JS — no native dependencies to break your install.

## The Alexandria Protocol

Beyond memory, Alexandria ships a lightweight engineering protocol that turns **any** MCP-capable model into a senior agent that plans, verifies with evidence, and learns:

> **Plan → Execute one task → Verify with evidence → (on failure: reuse past lessons) → Extract the lesson**

It lives in the MCP tools themselves — their names and descriptions carry the instructions — so it works identically across every agent, with or without hooks:

| MCP tool | What the agent does with it | Token payoff |
|---|---|---|
| `plan_create(title, goal, dod, tasks, design?)` | Plans like an **architect**: clarifies vague goals first, optionally records the architecture (`design` → a `## Design` section), and the response surfaces **similar past plans + relevant lessons** plus quality hints (verifiable DoD, small tasks) — suggestions, never a gate | No wandering; open plans are re-injected next session so work is resumed, not repeated |
| `task_verify(plan, task, passed, verify_command, cwd?)` | **Runs** `verify_command` (e.g. `npm test`) and takes the verdict from the real exit code — not from the agent's word. Flags a **discrepancy** if the agent claimed otherwise; without a command the note is tagged `self-reported` and `ale audit` calls it out | "✅ 12/12 passed" (5 tokens) instead of a 500-line log; on failure it automatically surfaces **past lessons** that match |
| `lesson_extract(title, lesson, links)` | Distills the root cause + fix after solving something non-obvious | ~200 tokens today replace ~20,000 tokens of re-debugging next month |

Lessons and solutions get a ranking boost in search, so the most valuable knowledge always surfaces first. The protocol is **on by default**; toggle it anytime:

```bash
ale config set protocol false   # classic vault only
ale config set protocol true    # back on
ale init --no-protocol          # install without it
```

## Install

```bash
# npm (Node ≥ 20)
npm install -g @ureck/alexandria

# bun
bun add -g @ureck/alexandria

# deno
deno install -grA -n ale npm:@ureck/alexandria/ale
# (if Deno complains about "minimum dependency date", add --minimum-dependency-age=0)
```

Verify:

```bash
$ ale --version
1.6.1
```

## Getting started

One command installs everything (embedding model ~130MB downloaded once, hooks, MCP registration, index):

```bash
# Global — one shared vault for all your sessions (~/Alexandria)
ale init

# Per project — vault INSIDE the repo (./Alexandria)
cd my-project
ale init --project

# Point at an existing Obsidian vault
ale init --path ~/Documents/MyObsidianVault

# Choose which agents get the MCP server
ale init --agents all                      # every supported agent
ale init --agents claude,cursor,opencode   # just these
# (without --agents: Claude Code + whatever is detected on your machine)
```

`ale init --project` also, automatically:
- adds the vault to your `.gitignore` (personal knowledge, not repo code),
- **scans the project** (stack from package.json, npm scripts, folder structure, README excerpt) into an initial `Map - <project>` note — context from the very first session,
- asks *"Configure Claude to use Alexandria automatically?"* and writes the usage rules into `CLAUDE.md` (`--auto` / `--manual` to skip the question).

After `init` there is nothing to reconnect, ever. Important: hooks load **when a session starts** — open a *new* agent session in that folder (an already-open one won't see them).

## Daily usage — examples

### Search by meaning, not keywords

```bash
$ ale search how do I publish my app to the google store

Flutter release deployment (Alexandria/notes/2026-07-09-deploy.md, note) ● high relevance
  To publish on Play Store: keystore outside git, key.properties,
  flutter build appbundle. Always sign with the production key.
```

The query shares zero keywords with the note ("google store" → "Play Store"). More:

```bash
ale search cors error in the api        # finds your fix from months ago
ale search "architecture decision" -k 10
ale search auth --expand                # also pulls notes CONNECTED to the results (graph)
```

The `● high/medium/low relevance` label is relative to the best hit — trust it over the raw number.

### Save notes manually

```bash
# Quick note
ale add "Prisma setup" -c "Singleton in src/lib/prisma.ts using globalThis" -t "prisma,db"

# From a file in your project (or a pipe)
ale add "Q3 architecture decisions" --file DECISIONS.md
cat DECISIONS.md | ale add "Q3 architecture decisions"

# With [[wikilinks]] to connect knowledge
ale add "Vercel deploy" -c "Region cdg1, see [[Prisma setup]]" -t deploy
```

(Automatic capture via hooks already does this in every Claude Code, Codex, Gemini CLI, Cursor and OpenCode session — `add` is for extra knowledge.)

### Read documents without paying for the whole thing (PDF, DOCX, XLSX, CSV, HTML)

Reading a PDF directly costs an agent ~1,500–3,000 tokens **per page** (Claude sends each page as image + text). Alexandria converts documents locally to markdown sections and the agent asks only for what it needs:

```bash
ale ingest "Manual Tecnico.pdf" reports/       # file or folder (pdf, docx, xlsx, csv, tsv, html, md, txt)
ale docs                                        # list ingested documents
ale docs read "Manual Tecnico" -q "which env vars does the deploy need?"
ale docs read pagos.xlsx -q "F-137 pagado"      # spreadsheets: returns the MATCHING ROWS
```

From any agent, the MCP tools `doc_ingest` (returns a ~200-token section outline) and `doc_read` (sections by id or by question, never over `max_tokens`, always telling what was left out) do the same. Measured on real documents:

| Document | Read directly | Outline | Answer to one question |
|---|---|---|---|
| 10-page technical manual (PDF) | ~20,000 tokens | ~248 | ~179 |
| 2,016-row spreadsheet (XLSX) | ~1,241,000 tokens | ~526 | ~579 (matching rows) |

- **PDF**: headings detected by font size (multi-line titles merged), source page kept for citations; scanned PDFs (no text layer) are flagged — Alexandria doesn't do OCR.
- **Spreadsheets**: never sent whole — a per-column summary (type, distinct values, samples) plus 50-row blocks; huge cells (geometries, JSON) are trimmed.
- **Claude Code**: the first direct `Read` of a large PDF/DOCX/XLSX/CSV in a session is redirected to `doc_ingest`/`doc_read`; a second attempt goes through (for when the agent really needs to see images). Toggle: `docs.interceptRead`.
- Unchanged files are never reconverted (sha256). Documents live in `Alexandria/docs/`, outside the vector index (a big spreadsheet would be thousands of chunks); section vectors are computed once per document version and cached.
- `ale stats` shows the **measured** document savings: tokens of the originals vs tokens actually served.

### Manage the context window (1.6)

Most tokens don't go into your prompt — they go into **tool output** and **re-reading**. Alexandria trims both, locally, without a proxy and without rewriting history (which would break the provider's prompt cache):

```bash
ale run -- npm test                    # exit code preserved; agent gets errors + summary + tail
ale run show last --grep "FAIL|Error"  # the full output stays on disk
ale code outline src/                  # symbols per file, no bodies
ale code symbol src/cli.ts runClean    # just that function, with line numbers
ale context                            # what was injected per session, and what was saved
ale supersede "Decision - MySQL" "Decision - Postgres"
```

| Feature | What it does | Measured |
|---|---|---|
| **Folded command output** | Large outputs of tests/builds/installs/logs → errors (with stack location) + test summary + tail; full output in `~/.cache/alexandria/runs`. Automatic in Claude Code (`PostToolUse` on Bash, successful commands) and OpenCode (plugin, also failures); `ale run -- <cmd>` everywhere else. Commands that *read* (`cat`, `git diff`, `grep`…) are never folded | test suite 12.1 KB → 1.4 KB; failing run 12.6 KB → 561 B keeping the failing test, assertion and `file:line` |
| **Code map** | `code_outline` (signatures + line ranges, classes → methods, top-level constants) and `code_symbol` (one body). JS/TS, Python, PHP, Go, Java, C#, Kotlin, Rust — heuristic, no native deps | `src/cli.ts` ~13,600 tokens → outline ~253 |
| **No re-injection** | A note already injected in this session is referenced in one line instead of re-sent (toggle `context.dedupe`) | shown in `ale context` / `ale stats` |
| **Anti-compaction capsule** | Before compacting, a capsule (goal, last request, files edited/read, recent commands, what was saved, open plans) is built **without an LLM** and re-injected right after | real 8.4 MB transcript → ~576 tokens |
| **Facts that expire** | `vault_save(..., supersedes: [...])` / `ale supersede`: the old note is marked, linked and no longer injected — never deleted | |
| **Duplicate suggestions** | `ale clean` lists near-identical lessons/notes (cosine ≥ 0.96); applied only with `--dedupe` | |
| **Context meter** | `ale context [--session id]`: injections, tokens, notes, folded runs, savings per session | |
| **Docs by URL** | `doc_ingest`/`ale ingest` accept `https://…`: one page, fetched once, reused 7 days — the only network access, and only when asked | |

### Control what spends tokens (`ale toggles`)

Every token-spending behavior is opt-out — before or after installing (the config is global, independent of the vault):

```bash
$ ale toggles          # interactive menu: each toggle with its real approximate cost
ale init --off architect.enrich,digest.map   # disable from the start
ale config set tokens.solutionCache false    # scriptable, one by one
```

The toggles: Protocol manifest (~6% of the session digest), Architect enrichment in `plan_create` (~+90 tokens/plan), solution cache (up to ~500 tokens/prompt), per-prompt semantic search (the **main saving mechanism** — up to ~1500 tokens/prompt, disabling it defeats the point), project map in the digest (up to ~1000 tokens), title index (~200 tokens), redirecting direct reads of large PDFs/spreadsheets to `doc_read` (`docs.interceptRead`), folding large command output (`run.fold`), not re-injecting notes already in context (`context.dedupe`), background index rebuild at session close, and weekly background cleanup `clean.auto` (neither costs tokens). All on by default; nothing changes unless you touch them.

### Deep project context (`ale scan`)

`ale init --project` already runs it; re-run anytime the project changes:

```bash
$ ale scan
✓ API: 12 rutas · Env: 8 vars (solo nombres) · Datos: 5 · Convenciones: 4 · .gitignore ✓
```

Four read-only scanners write compact notes (one line per entry) that the agent receives **only when relevant** (per-prompt semantic search — the session digest doesn't grow):

- **`API - <project>`** — App Router routes with HTTP methods, Pages Router handlers, `"use server"` actions, Express/Hono routes.
- **`Env - <project>`** — environment variable **NAMES only, never values** (from `.env.example` / `.env` / `.env.local`).
- **`Datos - <project>`** — data schema parsed from files (prisma models, drizzle tables, `CREATE TABLE` in migrations) — no DB connection.
- **`Convenciones - <project>`** — package manager, monorepo, TS strict, import aliases, framework.
- **`Flujo - <project>`** — what a request goes through: `GET /api/x → auth: requirePermiso(...) → datos: getX, createX → audits`, plus what the middleware protects. The others say what exists; this one says how it connects.

It never touches your source code, and it guarantees the vault (and personal configs) are gitignored before writing — your notes never reach a shared repo, even if you never ran `ale init`.

### Create a plan from a file

Instead of typing a whole plan into the terminal, keep it as markdown in your repo:

```bash
$ ale plan PLAN-migration.md
✓ Plan created: notes/2026-07-11-plan-migrate-to-postgres-17.md
  DoD detected: 3 criteria — backup verified · migrations run clean · app responds on staging
```

Checkbox lines (`- [ ] ...`) become the Definition of Done. The agent sees it as an **open plan** at the start of the next session and resumes it with `task_verify`.

### View the knowledge graph

**The graph maintains itself** — every vault change (automatic capture, `ale add`, reindex) regenerates `<vault>/grafo.html`. Double-click it anytime.

```bash
ale graph                  # LIVE viewer in your browser: auto-refreshes every 3s
ale graph --out other.html # static copy elsewhere (optional)
```

Nodes = notes (size = connections, color = type: 🟪 plans, 🟦 verifications, 🟨 lessons, 🟩 sessions…), solid lines = `[[wikilinks]]`, dashed = semantic similarity. Auto-fit, hover highlights neighbors, click shows details, Obsidian-style **type filters** (prompts hidden by default — they're visual noise). The graph shines from ~20-30 notes on — it's cumulative by design.

**In Obsidian**: open the vault folder as a vault and use the native graph view — notes carry `aliases` in their frontmatter so Obsidian resolves the `[[wikilinks]]`. Old notes are migrated automatically on the next reindex. Note: `grafo.html` is for your browser; Obsidian doesn't render HTML.

### Measure what it saves you

```bash
$ ale stats

🧠 Vault: /Users/you/Alexandria (global)
  Notes: 142 {"note":80,"prompt":38,"session":22,"map":2}
  Indexed chunks: 385 · Connections: 91
  Semantic search: active

🏛️  Protocol
  Plans: 6 (1 open) · Verifications: 14 (86% ✓)
  Lessons: 9 (4 reused — each reuse = a debug session that never happened)

📊 Measured (facts, not estimates)
  Context injections: 57
  Solution cache hits: 12 (~9,400 tokens — clearest win: solutions not re-derived)
  Injected tokens (cost): ~21,300

💰 Estimated savings (band, NOT audited)
  ~63,900 – 170,400 tokens
  Assumption: injected context replaces re-reading 3–8× its size in files. Not a
  measurement — the real number depends on what you'd have re-read without the vault.
```

### Audit your vault's health

```bash
$ ale audit

🏛️  Alexandria Protocol audit
  Plans: 2 (2 open, 0 completed, 0 failed)
  Verifications: 1 (1 failures) · Lessons: 1
  ⚠ Notes without connections (invisible to vault_related): 1
    - Plan - Migrate to Postgres 17 → connect it with vault_link or [[wikilinks]]
```

Flags plans without a Definition of Done, failures without lessons, and orphan notes.

### Maintenance (you rarely need it)

```bash
ale doctor                    # checks & repairs: model, hooks, MCP, index
ale reindex [--force]         # incremental by default
ale clean                     # PREVIEW of a safe cleanup (touches nothing)
ale clean --yes [--backup f]  # apply: old unused prompts → compacted monthly files (full text),
                              # harness noise dropped, stale caches purged. Lessons, plans, maps,
                              # sessions are NEVER touched. Still searchable: ale search --archive "…"
ale uninstall                 # removes hooks + MCP from every agent; your notes stay untouched
```

Every command self-repairs before running: missing model → downloads it; stale index → updates it.

## Supported agents

```bash
ale agents                 # list with auto-detection (● = found on your machine)
ale agents all             # register the MCP server in all of them
ale agents cursor,gemini   # just these
```

| Agent | MCP config written | Hooks (auto capture + injection) | Per-project |
|---|---|---|---|
| Claude Code | `.mcp.json` / `claude mcp add` | `.claude/settings.json` — SessionStart · UserPromptSubmit · Stop · PreCompact | ✓ |
| Codex CLI | `~/.codex/config.toml` / `.codex/config.toml` | `.codex/hooks.json` — SessionStart · UserPromptSubmit · Stop · PreCompact ¹ | ✓ |
| Gemini CLI | `~/.gemini/settings.json` / `.gemini/settings.json` | same file — SessionStart · BeforeAgent · AfterAgent · PreCompress | ✓ |
| Cursor | `~/.cursor/mcp.json` / `.cursor/mcp.json` | `.cursor/hooks.json` — sessionStart · beforeSubmitPrompt ² · afterAgentResponse | ✓ |
| OpenCode | `opencode.json` | plugin `.opencode/plugins/alexandria.js` — injects into the system prompt | ✓ |
| Devin CLI (Cognition) | `.devin/mcp_config.local.json` | — | ✓ |
| Cline | `cline_mcp_settings.json` (VS Code) | — | — |
| VS Code (Copilot) | `mcp.json` (profile) / `.vscode/mcp.json` | — | ✓ |
| OpenClaw | `~/.openclaw/openclaw.json` | — | — |
| Hermes Agent (Nous) | `hermes mcp add` / `~/.hermes/config.yaml` | — | — |
| Windsurf (legacy → Devin) | `~/.codeium/windsurf/mcp_config.json` | — | — |

¹ Codex skips untrusted hooks: open Codex once and approve them with `/hooks`.
² Cursor's `beforeSubmitPrompt` can't inject context — there Alexandria captures the prompt; context arrives via `sessionStart` and the MCP tools.

`ale agents <ids>` registers MCP **and** hooks (`--no-hooks` for MCP only). Registrations are **idempotent merges** — your other MCP servers and hooks are never touched, and a config file that doesn't parse is never overwritten. `ale init` also writes the usage block to `AGENTS.md` (read by Codex, OpenCode, Cursor, Devin…) besides `CLAUDE.md`.

Agents without hooks still get everything through the MCP tools, which the agent uses on its own (the protocol instructions travel inside the tool descriptions).

### As a plugin

The public repo is also a **Claude Code plugin marketplace** (and ships a Codex plugin manifest). The plugin runs the globally installed `alexandria` (falls back to `npx`):

```bash
npm i -g @ureck/alexandria
claude plugin marketplace add UreckChan/alexandria
claude plugin install alexandria@alexandria
```

## How it works

```
AI agent session
  │
  ├─ SessionStart ──► injects digest: protocol manifest + project map + open plans   (hooks)
  ├─ Every prompt ──► local hybrid search → injects only what's relevant             (hooks)
  │                   └─ near-identical prompt already solved → injects the solution (cache)
  ├─ MCP tools ─────► vault_search · vault_save · vault_related · vault_link         (all agents)
  │                   doc_ingest · doc_read  (documents by section, token budget)
  │                   code_outline · code_symbol · run_output  (code map, folded runs)
  │                   plan_create · task_verify · lesson_extract                     (the Protocol)
  └─ Stop/PreCompact► saves the session outcome into the vault                       (hooks)
     hooks: Claude Code · Codex · Gemini CLI · Cursor · OpenCode (one set of scripts, --harness=<id>)
                                │
                        <Obsidian vault>/Alexandria/*.md   ← markdown, [[wikilinks]]
                        <vault>/.vault/                    ← index (regenerable)
```

- **Hybrid search**: local embeddings (transformers.js, multilingual e5-small) + BM25, combined with RRF, boosted by recency, usage, and note type (lessons/solutions rank highest).
- **Incremental index**: only re-processes notes whose mtime changed. The graph is never rebuilt from scratch.
- **Deduplication**: near-identical prompts don't create new notes — they add `hits` (and climb the ranking).
- **About scores**: the e5 model compresses cosines (~0.76–0.86 even for unrelated topics); the *ranking* is what's reliable, hence the relevance label.

## Command reference

| Command | What it does |
|---|---|
| `ale init [--project] [--path <dir>] [--agents <ids>] [--auto\|--manual] [--no-protocol] [--portable]` | Installs everything: vault, hooks, MCP, .gitignore, project scan, CLAUDE.md. `--portable` writes an npx-based MCP command safe to commit for teams |
| `ale scan` | Deep project context: API routes, env var **names**, data schema (file parse), conventions → compact notes (adaptive cap ≤200 entries, fair sampling in monorepos). Read-only; ensures .gitignore |
| `ale toggles` | Interactive menu to enable/disable every token-spending behavior, each with its real approximate cost. Works before or after install; scriptable via `ale init --off <keys>` |
| `ale skills:evolve` | Generates/updates a **living skill for the project** from what the vault knows (stack, conventions, app flow, lessons). Always shows a diff and asks before writing |
| `ale agents [ids] [--project] [--no-hooks]` | List agents / register the MCP server + hooks where supported |
| `ale search <query> [-k n] [--expand] [--archive]` | Hybrid search; `--archive` searches prompts compacted by `ale clean`; `--expand` pulls graph neighbors. With the Protocol on, appends the **chain** (plan + verification + lesson) connected to the top hit |
| `ale add <title> [-c text] [--file <path>] [-t tags]` | Save a note (inline, from file, or stdin) |
| `ale plan <file> [--title t]` | Create a Protocol plan from a .md/.txt file (checkboxes → Definition of Done); surfaces similar past plans + quality hints |
| `ale graph [--out file.html] [--no-open]` | Live local graph viewer |
| `ale audit` | Protocol health: plans without DoD, failures without lessons, orphan notes |
| `ale stats` | Notes, connections, protocol metrics, estimated tokens saved |
| `ale config <get\|set> <key> [value]` | Configuration (e.g. `protocol` true/false) |
| `ale skills [-y] [--project]` | Recommends & installs Claude skills — semantic (e5) + keyword detection over your vault. Local source configurable with `ale config set skills.repo <path>`; otherwise installs from skills.sh |
| `ale reindex [--force]` | Reindex (incremental by default) |
| `ale clean [--yes] [--days n] [--backup f] [--keep-noise] [--dedupe]` | Safe cleanup: compacts old unused prompts (full text kept, out of the vector index), drops harness noise, purges regenerable caches, rotates stats. Preview by default. Runs weekly in the background (toggle `clean.auto`) |
| `ale consolidate [--days n] [--dry]` | Alias of `ale clean --prompts-only` |
| `ale doctor [--project]` | Check & repair: model, hooks, MCP, index |
| `ale uninstall [--project]` | Remove hooks, MCP and instruction blocks from every agent (notes stay untouched) |
| `ale ingest <paths...> [--force]` | Convert PDF/DOCX/XLSX/CSV/HTML/MD to markdown sections and store them in the vault |
| `ale docs` / `ale docs read <doc> [-s ids] [-q question] [--max-tokens n]` | List ingested documents / read only the sections (or spreadsheet rows) you need |
| `ale run -- <cmd>` / `ale run show <id\|last> [--grep re] [--lines a-b]` / `ale run list` | Run a command with folded output (same exit code) / read the full output |
| `ale code outline <file\|dir>` / `ale code symbol <file> <name>` | Code map: signatures without bodies / one symbol's body (`Class.method` works) |
| `ale context [--session id] [--last n]` | Context meter per agent session |
| `ale supersede <old> <new>` | Mark a note as replaced (stops being injected, never deleted) |
| `ale hook <session-start\|prompt\|stop\|read\|bash> [--harness id]` | Run a hook (used by the plugins) |
| `ale --vault <path> <cmd>` | Run any command against another vault |

`alexandria` works as an alias of `ale`.

## Privacy & security

- **Everything runs on your machine**: the embedding model is downloaded once (Hugging Face) and then works offline. Your notes never leave your disk. No telemetry.
- **No API keys, no accounts, no cost.**
- **`ale scan` never reads secrets**: it extracts environment variable **names** only (values are never copied), parses schema **files** (no live DB connection), and guarantees the vault is gitignored before writing — your notes never reach a shared repo.
- Dependency scanners (Socket, etc.) flag *network/shell/env access* in the dependency tree: those come from the ML runtime (`onnxruntime`/`transformers.js`, which needs filesystem access and the one-time model download) and the official MCP SDK — not from Alexandria's code. The published package runs no install scripts of its own.
- **`npm audit` may report `sharp <0.35.0` (libvips CVEs, [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj))**, inherited from `@huggingface/transformers`. As of this writing no published version of `transformers.js` (including the newest, 4.x) uses a patched sharp, so there's no upstream fix yet — and it isn't reachable in Alexandria's own usage anyway: Alexandria only calls `pipeline('feature-extraction', ...)` for text embeddings and never touches images. If you want a clean `npm audit` in your own project, add this to its `package.json`:
  ```json
  "overrides": {
    "sharp": "^0.35.4"
  }
  ```
  (npm's `overrides` only applies at the root of an install, so this must go in *your* project — Alexandria declaring it in its own `package.json` doesn't propagate to consumers.)
- Generated per-project configs (`.mcp.json`, `.vault.json`, etc.) point at your machine's install path, so `ale init --project` automatically gitignores them (and untracks any already committed) — they never leak to a shared repo. For a team that *wants* a shared MCP config, run `ale init --project --portable`, which writes an npx-based command that works on any machine.

## Support the project ☕

Alexandria is free and open source. If it saves you tokens (and money), you can buy me a coffee:

**[☕ buymeacoffee.com/ureck](https://buymeacoffee.com/ureck)**

Built with 🏛 by **[Ureck](https://buymeacoffee.com/ureck)** — MIT License.
