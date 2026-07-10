# 🏛️ Alexandria

> Bóveda de conocimiento local para tus agentes de IA — ahorra tokens, recuerda entre sesiones, conecta tus ideas.

[![npm](https://img.shields.io/npm/v/%40ureck%2Falexandria)](https://www.npmjs.com/package/@ureck/alexandria)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/☕_Invítame_un_café-ureck-yellow)](https://buymeacoffee.com/ureck)

Alexandria captura automáticamente tus prompts y sesiones de IA, busca en ese conocimiento **antes** de gastar tokens, y conecta todo en un grafo estilo Obsidian. **100% local**: sin base de datos, sin API keys, sin telemetría, sin costo.

Funciona con los agentes más usados vía MCP: **Claude Code · Cursor · OpenCode · Windsurf · Cline · Codex CLI · Gemini CLI · VS Code (Copilot) · OpenClaw · Hermes Agent**.

## ¿Por qué?

Cada sesión nueva de un agente de IA empieza de cero: re-explora tu código, re-deriva decisiones que ya tomaste, re-consume los mismos tokens. Alexandria rompe ese ciclo:

- **Ahorra tokens**: cada prompt dispara una búsqueda semántica local (<100ms) que inyecta al agente solo los fragmentos relevantes — en vez de releer archivos completos.
- **Cero re-análisis entre sesiones**: al abrir sesión, el agente recibe el mapa del proyecto y el conocimiento acumulado.
- **Memoria de soluciones**: si un prompt casi idéntico ya se resolvió antes, inyecta esa solución — el agente no la re-deriva.
- **Es un vault de Obsidian**: markdown puro con `[[wikilinks]]`. Ábrelo en Obsidian cuando quieras.
- **Multiplataforma**: Windows, macOS, Linux · Node, Bun o Deno. Pure JS, sin dependencias nativas que fallen al instalar.

## Instalación

```bash
# npm (Node ≥ 20)
npm install -g @ureck/alexandria

# bun
bun add -g @ureck/alexandria

# deno
deno install -grA -n ale npm:@ureck/alexandria/ale
# (si Deno se queja de "minimum dependency date": agrega --minimum-dependency-age=0)
```

Confirma que quedó instalado:

```bash
$ ale --version
0.2.3
```

## Primeros pasos

Un solo comando instala todo (modelo de embeddings ~130MB una única vez, hooks, MCP, índice):

```bash
# Global — una bóveda compartida para todas tus sesiones (~/KnowledgeVault)
ale init

# Por proyecto — bóveda DENTRO del repo (./KnowledgeVault)
cd mi-proyecto
ale init --project

# Con tu vault de Obsidian existente
ale init --path ~/Documents/MiVaultObsidian

# Eligiendo en qué agentes registrar el MCP
ale init --agents all                      # todos los soportados
ale init --agents claude,cursor,opencode   # solo esos
# (sin --agents: Claude Code + los que detecte instalados)
```

<details>
<summary>Salida esperada de <code>ale init --project</code></summary>

```
  ▄▀█ █░░ █▀▀ ▀▄▀ ▄▀█ █▄░█ █▀▄ █▀█ █ ▄▀█
  █▀█ █▄▄ ██▄ █░█ █▀█ █░▀█ █▄▀ █▀▄ █ █▀█
  🏛  Bóveda de conocimiento local · creada por Ureck

Instalación por proyecto

✓ Bóveda en /Users/tu/mi-proyecto/KnowledgeVault (vault Obsidian válido)
✓ Config del proyecto: /Users/tu/mi-proyecto/.vault.json
✓ Hooks registrados en /Users/tu/mi-proyecto/.claude/settings.json
  SessionStart (digest) · UserPromptSubmit (contexto+captura) · Stop/PreCompact (sesiones)
✓ MCP → Claude Code (/Users/tu/mi-proyecto/.mcp.json)
↓ Descargando modelo de embeddings (una sola vez)…
✓ Modelo listo (búsqueda semántica activada)
✓ Índice: 0 notas, 0 conexiones

✅ Listo. Abre una sesión de tu agente y todo funciona solo — nada que reconectar nunca.
```

</details>

Después de `init` no hay nada que reconectar, nunca. Importante: los hooks cargan **al arrancar** una sesión — abre una sesión *nueva* de tu agente en esa carpeta (una que ya estaba abierta no los verá). Desde ahí, cada prompt busca en la bóveda antes de gastar tokens y cada cierre de sesión guarda lo aprendido.

> 💡 **Tip**: si la bóveda vive dentro de un repo git, agrega `KnowledgeVault/` a tu `.gitignore` — los digests de sesión son conocimiento personal tuyo, no del repo.

## Uso diario — ejemplos

### Buscar conocimiento (semántico + keyword)

Busca por **significado**, no por palabras exactas:

```bash
$ ale search como publico mi app en la tienda de google

Despliegue de Flutter release (Alexandria/notes/2026-07-09-despliegue.md, note) ● relevancia alta
  Para publicar en Play Store: keystore fuera de git, key.properties,
  flutter build appbundle. Firmar siempre con la clave de producción.
```

Nota que la query no comparte ni una palabra clave con la nota ("tienda de google" → "Play Store"). Más ejemplos:

```bash
ale search error de cors en el api            # encuentra tu solución de hace meses
ale search "decisión de arquitectura" -k 10   # más resultados
ale search autenticacion --expand             # incluye notas CONECTADAS a los resultados (grafo)
```

La etiqueta `● relevancia alta/media/baja` es relativa al mejor resultado — confía en ella más que en el número.

### Guardar notas manualmente

```bash
# Nota rápida
ale add "Configuración de Prisma" -c "Singleton en src/lib/prisma.ts con globalThis" -t "prisma,db"

# Desde un archivo o pipe
cat DECISIONES.md | ale add "Decisiones de arquitectura Q3"

# Con [[wikilinks]] para conectar conocimiento
ale add "Deploy en Vercel" -c "Regiones cdg1, ver [[Configuración de Prisma]]" -t deploy
```

(La captura automática vía hooks hace esto solo en cada sesión de Claude Code — `add` es para conocimiento extra.)

### Ver el grafo de conexiones

**El grafo se mantiene solo** — no hay que generarlo: cada vez que la bóveda cambia (captura automática, `ale add`, reindex), se regenera `<bóveda>/grafo.html`. Doble clic y siempre está al día.

```bash
ale graph                    # visor EN VIVO en tu navegador: se actualiza solo cada 3s
ale graph --out otro.html    # copia estática a otra ruta (opcional)
```

Nodos = notas (tamaño = conexiones, color = tipo), líneas sólidas = `[[wikilinks]]`, punteadas = similitud semántica. Auto-encuadre, hover resalta vecinos, click muestra detalle y conexiones, caja para filtrar por título/tag. El grafo brilla a partir de ~20-30 notas — es acumulativo por diseño.

**En Obsidian**: abre la carpeta de la bóveda como vault y usa su graph view nativo — las notas llevan `aliases` en el frontmatter para que Obsidian resuelva los `[[wikilinks]]` (sin eso los ve como enlaces rotos). Las notas viejas se migran solas en el siguiente reindex. Ojo: `grafo.html` no se abre *dentro* de Obsidian (no renderiza HTML) — es para el navegador.

### Medir cuánto te está ahorrando

```bash
$ ale stats

🧠 Bóveda: /Users/tu/KnowledgeVault (global)
  Notas: 142 {"note":80,"prompt":38,"session":22,"map":2}
  Chunks indexados: 385 · Conexiones: 91
  Búsqueda semántica: activa

💰 Ahorro estimado
  Inyecciones de contexto: 57 (12 con solución cacheada)
  Tokens inyectados: ~21,300
  Tokens ahorrados (vs re-explorar): ~191,700
```

### Skills recomendadas según tus patrones

```bash
$ ale skills

📦 Skills recomendadas según tu bóveda:
  pdf-report-gen [local] — detecté 14 menciones de pdf, membrete en la bóveda
  auth-standard  [local] — detecté 9 menciones de auth, login, jwt en la bóveda

¿Instalar todas? [s/N/números separados por coma]
```

Analiza los temas de tus notas y sugiere skills de Claude (desde skills.sh o tu repo local). `-y` instala sin preguntar, `--project` instala en `.claude/skills/` del proyecto.

### Mantenimiento (casi nunca lo necesitas)

```bash
ale doctor              # verifica y repara: modelo, hooks, MCP, índice
ale reindex             # reindexado incremental (solo notas cambiadas)
ale reindex --force     # desde cero (p. ej. tras editar mucho en Obsidian)
ale uninstall           # quita hooks; tus notas quedan intactas
```

Todo comando auto-repara antes de correr: si falta el modelo lo descarga, si el índice está viejo lo actualiza — no tienes que pensar en ello.

## Agentes soportados

```bash
ale agents                 # lista con detección automática (● = detectado en tu máquina)
ale agents all             # registra el MCP en todos
ale agents cursor,gemini   # solo en esos
ale agents detected        # solo los detectados
```

| Agente | Config que escribe | Por proyecto |
|---|---|---|
| Claude Code | `.mcp.json` / `claude mcp add` + hooks | ✓ |
| Cursor | `~/.cursor/mcp.json` / `.cursor/mcp.json` | ✓ |
| OpenCode | `opencode.json` | ✓ |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | — |
| Cline | `cline_mcp_settings.json` (VS Code) | — |
| Codex CLI | `~/.codex/config.toml` | — |
| Gemini CLI | `~/.gemini/settings.json` / `.gemini/settings.json` | ✓ |
| VS Code (Copilot) | `mcp.json` (perfil) / `.vscode/mcp.json` | ✓ |
| OpenClaw | `~/.openclaw/openclaw.json` | — |
| Hermes Agent (Nous) | `hermes mcp add` / `~/.hermes/config.yaml` | — |

Los registros hacen **merge idempotente**: nunca pisan tus otros servidores MCP configurados.

**Nota**: la captura automática por hooks (digest de sesión, inyección por prompt, guardado al terminar) es exclusiva de Claude Code — los demás agentes no tienen sistema de hooks. En ellos el conocimiento fluye por las herramientas MCP, que el agente usa solo.

## Cómo funciona

```
Sesión del agente de IA
  │
  ├─ SessionStart ──► inyecta digest: mapa del proyecto + conocimiento previo   (hooks, Claude Code)
  ├─ Cada prompt ───► búsqueda híbrida local → inyecta solo lo relevante        (hooks, Claude Code)
  │                   └─ prompt casi idéntico ya resuelto → inyecta la solución (caché)
  ├─ MCP tools ─────► vault_search · vault_save · vault_related · vault_link   (todos los agentes)
  └─ Stop/PreCompact► guarda el resultado de la sesión en la bóveda             (hooks, Claude Code)
                                │
                        <Vault Obsidian>/Alexandria/*.md   ← markdown, [[wikilinks]]
                        <Vault>/.vault/                    ← índice (regenerable)
```

- **Búsqueda híbrida**: embeddings locales (transformers.js, modelo multilingüe e5-small) + BM25, combinados con RRF y boost por recencia/uso. Sin internet funciona en modo keyword.
- **Índice incremental**: solo re-procesa notas cuyo mtime cambió. El grafo nunca se recalcula completo.
- **Deduplicación**: prompts casi idénticos no crean notas nuevas — suman `hits` (y suben en el ranking).
- **Sobre los scores**: el modelo e5 comprime los cosenos (~0.76–0.86 incluso entre temas sin relación); el *ranking* es lo confiable, no el número crudo — por eso la etiqueta de relevancia.

## Herramientas MCP (las usa el agente solo)

En cualquier agente conectado, pídele cosas como *"busca en mi bóveda cómo configuré el deploy"* o *"guarda esta decisión en la bóveda"*:

- `vault_search(query, k)` — busca conocimiento antes de explorar código.
- `vault_save(title, content, tags)` — guarda decisiones/arquitectura. `title: "Mapa - <proyecto>"` actualiza el mapa que se inyecta al inicio de cada sesión de Claude Code.
- `vault_related(title)` — vecinos en el grafo (wikilinks + semánticos) sin releer archivos.
- `vault_link(from, to)` — conecta dos notas con `[[wikilink]]`.

## Comandos — referencia

| Comando | Qué hace |
|---|---|
| `ale init [--project] [--path <dir>] [--agents <ids>] [--skills]` | Instala todo (una vez). Bóveda default: `./KnowledgeVault` con `--project`, `~/KnowledgeVault` en global |
| `ale agents [ids] [--project]` | Lista agentes / registra el MCP en ellos |
| `ale search <query> [-k n] [--expand]` | Búsqueda híbrida; `--expand` trae vecinos del grafo |
| `ale add <título> [-c texto] [-t tags]` | Guardar nota manual (o por stdin) |
| `ale graph [--out file.html] [--no-open]` | Grafo interactivo local |
| `ale skills [-y] [--project]` | Recomienda e instala skills de Claude según tus patrones |
| `ale stats` | Notas, conexiones y tokens ahorrados estimados |
| `ale reindex [--force]` | Reindexar (incremental por default) |
| `ale doctor [--project]` | Verifica y repara: modelo, hooks, MCP, índice |
| `ale uninstall [--project]` | Quita hooks (las notas quedan intactas) |
| `ale --vault <ruta> <comando>` | Cualquier comando contra otra bóveda |

`alexandria` funciona como alias de `ale`.

## Privacidad y seguridad

- **Todo corre en tu máquina**: el modelo de embeddings se descarga una vez (Hugging Face) y después funciona offline. Tus notas jamás salen de tu disco. Sin telemetría.
- **Sin API keys, sin cuentas, sin costo.**
- Los escáneres de dependencias (Socket, etc.) marcan alertas de *network/shell/env access* en el árbol de dependencias: provienen del runtime de ML (`onnxruntime`/`transformers.js`, que necesita filesystem y descarga inicial del modelo) y del SDK oficial de MCP — no de código de Alexandria. El código fuente es abierto y auditable; el paquete publicado no ejecuta install scripts propios.
- Los configs generados (`.mcp.json`, hooks) apuntan a la ruta de instalación de tu máquina. Si compartes un repo con equipo, cambia el `command` a `npx -y @ureck/alexandria alexandria serve-mcp` para que sea portable.

## V2 (roadmap)

- Bot de Telegram (grammY, polling local — sin servidor público): `/search`, `/save` desde el teléfono.
- `ale consolidate`: detección de duplicados y clusters → notas-resumen.

## Código y contribuciones

El código fuente se mantiene en un repositorio privado; este repositorio público contiene el compilado distribuido en npm (el mismo contenido del paquete, auditable).

- 🐛 **Issues y sugerencias**: [github.com/UreckChan/alexandria/issues](https://github.com/UreckChan/alexandria/issues)
- 📦 **Releases**: cada versión de npm tiene su tag aquí

## Apoya el proyecto ☕

Alexandria es gratis y open source. Si te ahorra tokens (y dinero), puedes invitarme un café:

**[☕ buymeacoffee.com/ureck](https://buymeacoffee.com/ureck)**

Hecho con 🏛 por **[Ureck](https://buymeacoffee.com/ureck)** — MIT License.
