# 🏛️ Alexandria

> A local knowledge vault for your AI agents — saves tokens, remembers across sessions, and turns every model into a disciplined engineer.

[![npm](https://img.shields.io/npm/v/%40ureck%2Falexandria)](https://www.npmjs.com/package/@ureck/alexandria)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/☕_Buy_me_a_coffee-ureck-yellow)](https://buymeacoffee.com/ureck)

Alexandria automatically captures your AI prompts and sessions, searches that knowledge **before** spending tokens, and connects everything in an Obsidian-style graph. **100% local**: no database, no API keys, no telemetry, no cost.

Works with the most popular agents via MCP: **Claude Code · Cursor · OpenCode · Windsurf · Cline · Codex CLI · Gemini CLI · VS Code (Copilot) · OpenClaw · Hermes Agent**.

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
| `plan_create(title, goal, dod, tasks)` | Writes a plan note with a **Definition of Done** and numbered tasks before touching code | No wandering; open plans are re-injected next session so work is resumed, not repeated |
| `task_verify(plan, task, passed, evidence)` | Records the real verdict of each task (test/build output, compacted) | "✅ 12/12 passed" (5 tokens) instead of a 500-line log; on failure it automatically surfaces **past lessons** that match |
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
0.5.0
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

(Automatic capture via hooks already does this in every Claude Code session — `add` is for extra knowledge.)

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

💰 Estimated savings
  Context injections: 57 (12 with cached solution)
  Injected tokens: ~21,300
  Tokens saved (vs re-exploring): ~191,700
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
ale consolidate [--days 45]   # ARCHIVES old unused prompts to Alexandria/archive/
                              # — out of the graph and injection, still searchable: nothing is ever lost
ale uninstall                 # removes hooks; your notes stay untouched
```

Every command self-repairs before running: missing model → downloads it; stale index → updates it.

## Supported agents

```bash
ale agents                 # list with auto-detection (● = found on your machine)
ale agents all             # register the MCP server in all of them
ale agents cursor,gemini   # just these
```

| Agent | Config written | Per-project |
|---|---|---|
| Claude Code | `.mcp.json` / `claude mcp add` + hooks | ✓ |
| Cursor | `~/.cursor/mcp.json` / `.cursor/mcp.json` | ✓ |
| OpenCode | `opencode.json` | ✓ |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | — |
| Cline | `cline_mcp_settings.json` (VS Code) | — |
| Codex CLI | `~/.codex/config.toml` | — |
| Gemini CLI | `~/.gemini/settings.json` / `.gemini/settings.json` | ✓ |
| VS Code (Copilot) | `mcp.json` (profile) / `.vscode/mcp.json` | ✓ |
| OpenClaw | `~/.openclaw/openclaw.json` | — |
| Hermes Agent (Nous) | `hermes mcp add` / `~/.hermes/config.yaml` | — |

Registrations are **idempotent merges** — your other MCP servers are never touched.

**Note**: automatic capture via hooks (session digest, per-prompt injection, session save on close) is Claude Code-only — other agents don't have a hook system. There, knowledge flows through the MCP tools, which the agent uses on its own (the protocol instructions travel inside the tool descriptions).

## How it works

```
AI agent session
  │
  ├─ SessionStart ──► injects digest: protocol manifest + project map + open plans   (hooks, Claude Code)
  ├─ Every prompt ──► local hybrid search → injects only what's relevant             (hooks, Claude Code)
  │                   └─ near-identical prompt already solved → injects the solution (cache)
  ├─ MCP tools ─────► vault_search · vault_save · vault_related · vault_link         (all agents)
  │                   plan_create · task_verify · lesson_extract                     (the Protocol)
  └─ Stop/PreCompact► saves the session outcome into the vault                       (hooks, Claude Code)
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
| `ale init [--project] [--path <dir>] [--agents <ids>] [--auto\|--manual] [--no-protocol]` | Installs everything: vault (default `./Alexandria` / `~/Alexandria`), hooks, MCP, .gitignore, project scan, CLAUDE.md |
| `ale agents [ids] [--project]` | List agents / register the MCP server |
| `ale search <query> [-k n] [--expand]` | Hybrid search; `--expand` pulls graph neighbors |
| `ale add <title> [-c text] [--file <path>] [-t tags]` | Save a note (inline, from file, or stdin) |
| `ale plan <file> [--title t]` | Create a Protocol plan from a .md/.txt file (checkboxes → Definition of Done) |
| `ale graph [--out file.html] [--no-open]` | Live local graph viewer |
| `ale audit` | Protocol health: plans without DoD, failures without lessons, orphan notes |
| `ale stats` | Notes, connections, protocol metrics, estimated tokens saved |
| `ale config <get\|set> <key> [value]` | Configuration (e.g. `protocol` true/false) |
| `ale skills [-y] [--project]` | Recommends & installs Claude skills based on your patterns |
| `ale reindex [--force]` | Reindex (incremental by default) |
| `ale consolidate [--days n] [--dry]` | Archive old unused prompts — never deletes |
| `ale doctor [--project]` | Check & repair: model, hooks, MCP, index |
| `ale uninstall [--project]` | Remove hooks (notes stay untouched) |
| `ale --vault <path> <cmd>` | Run any command against another vault |

`alexandria` works as an alias of `ale`.

## Privacy & security

- **Everything runs on your machine**: the embedding model is downloaded once (Hugging Face) and then works offline. Your notes never leave your disk. No telemetry.
- **No API keys, no accounts, no cost.**
- Dependency scanners (Socket, etc.) flag *network/shell/env access* in the dependency tree: those come from the ML runtime (`onnxruntime`/`transformers.js`, which needs filesystem access and the one-time model download) and the official MCP SDK — not from Alexandria's code. The published package runs no install scripts of its own.
- Generated configs (`.mcp.json`, hooks) point at your machine's install path. If you share a repo with a team, switch the `command` to `npx -y @ureck/alexandria alexandria serve-mcp` for portability.

## Support the project ☕

Alexandria is free and open source. If it saves you tokens (and money), you can buy me a coffee:

**[☕ buymeacoffee.com/ureck](https://buymeacoffee.com/ureck)**

Built with 🏛 by **[Ureck](https://buymeacoffee.com/ureck)** — MIT License.
