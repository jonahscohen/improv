# sidecoach-mcp-server

Hardened Model Context Protocol server exposing sidecoach's design-
orchestration capabilities (registries, keyword resolution, validators, cost
ledger, cheatsheet) as MCP tools.

The server is rule-based and read-mostly. It does NOT call any LLM by itself;
it presents the rule-based building blocks that sidecoach uses today as
callable tools, so an MCP client (Claude Code, the desktop app, a test
harness) can invoke them directly.

This file documents installation, configuration, and the tool catalog. The
architecture decisions live in `DESIGN.md` next door.

---

## Install

```
cd sidecoach/mcp-server
npm install
npm run build
```

The build prerequisite is that the parent `sidecoach` package is itself built.
The MCP server imports from `../../dist/` rather than `../../src/` so the
mcp-server's build does not depend on the parent's source compiling cleanly.

```
cd sidecoach
npm run build
cd mcp-server
npm run build
```

The built entry is `sidecoach/mcp-server/dist/index.js` with a node shebang
and executable bit set. Smoke-test it manually:

```
node dist/index.js < /dev/null
# server boots, logs to stderr, exits on EOF
```

---

## Configure (wire it up to Claude Code)

Claude Code reads MCP server definitions from two places:

1. `~/.claude/settings.json` under the `mcpServers` key (global).
2. `.mcp.json` in the current working directory (per-project).

Either of these snippets works. The absolute-path version is portable across
machines that have this dotfiles checkout at the same path; the env-var
version is portable across users.

### Snippet A - absolute path (this machine)

```json
{
  "mcpServers": {
    "sidecoach": {
      "command": "node",
      "args": [
        "/Users/spare3/Documents/Github/improv/sidecoach/mcp-server/dist/index.js"
      ],
      "env": {
        "SIDECOACH_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Snippet B - env-var-driven (portable)

```json
{
  "mcpServers": {
    "sidecoach": {
      "command": "node",
      "args": [
        "${DOTFILES_ROOT}/sidecoach/mcp-server/dist/index.js"
      ],
      "env": {
        "SIDECOACH_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

After editing settings.json, restart your Claude Code session so the host
re-spawns the MCP server and reads the new config.

### Env vars

| Variable | Default | Purpose |
|---|---|---|
| `SIDECOACH_MCP_LOG_LEVEL` | `info` | One of `error` / `warn` / `info` / `debug`. Higher = more verbose stderr logs. |
| `SIDECOACH_MCP_TIMEOUT_MS` | `30000` | Default per-tool timeout in milliseconds. Per-tool timeouts override this (5s for read tools, 30s for validators). |
| `SIDECOACH_PROJECT_ROOT` | `process.cwd()` | Filesystem boundary for `sidecoach_ast_grep` and the LSP tools. Any `path`/`file` argument is resolved against this root, realpath-followed, and rejected if it escapes via `..` or a symlink that points outside. Set to your repo root when launching the server so queries scope to your project. Wrong value (missing dir, file instead of dir) returns `INVALID_INPUT` on the first call. |
| `SIDECOACH_PYTHON_IMAGE` | `python:3-slim` | Container image used by `sidecoach_python_repl_execute`. Override to pin a version or use a smaller base (e.g. `python:3.12-alpine`). The image must be pullable by the local docker/podman runtime. |

---

## Tool catalog

All tools use the `sidecoach_` prefix. None of these tools mutate sidecoach
state (the cost ledger is read-only from this surface).

### `sidecoach_list_verbs`

Return all 22 sidecoach verbs from the canonical registry.

- Input: `{ phase?: string }` (optional phase filter)
- Output: `{ count, total, verbs: [{ verb, pattern, phase, description, oneLineExplanation }] }`
- Errors: `DOWNSTREAM_UNAVAILABLE` if `claude/hooks/sidecoach-verbs.json` is missing.
- Timeout: 5s.

### `sidecoach_list_modes`

Return all 5 sidecoach modes (forge / kiln / bloom / canvas / trim).

- Input: `{}` (no params)
- Output: `{ count, modes: [{ mode, pattern, description, oneLineExplanation, chain }] }`
- Errors: none in normal operation.
- Timeout: 5s.

### `sidecoach_list_flows`

Return all flows from `sidecoach/src/flows.ts` with their model-routing config.

- Input: `{ tier?: number, idPrefix?: string }`
- Output: `{ count, total, flows: [{ id, name, description, tier, modelConfig }] }`
- Errors: `DOWNSTREAM_UNAVAILABLE` if flow registry could not be loaded.
- Timeout: 5s.

### `sidecoach_resolve_keyword`

Resolve a free-text phrase against the verb/mode registries using the same
sanitize + word-boundary + informational-suppression logic as the
UserPromptSubmit hook.

- Input: `{ phrase: string }` (1-4000 chars)
- Output: `{ match: { kind: "verb"|"mode"|"none", name?, chain?, reason? } }`
- Errors: `INVALID_INPUT` (empty/too long), `DOWNSTREAM_UNAVAILABLE` (both registries empty).
- Timeout: 5s.

### `sidecoach_validate_polish_standard`

Run the 22-Point Polish Standard validator against provided HTML / CSS /
design tokens.

- Input: `{ html?, css?, designTokens?, contextOverrides? }` (at least one of html/css/designTokens required)
- Output: `{ report: PolishValidationReport }`
- Errors: `INVALID_INPUT` (all-empty), `VALIDATOR_FAILURE` (validator throw).
- Timeout: 30s.

### `sidecoach_validate_extended_domain`

Run the 112-rule Extended Domain validator across 10 design domains.

- Input: `{ html?, css?, designTokens?, typography?, colors?, spacing?, motion?, accessibility?, contrast?, performance?, visualization?, internationalization? }`
- Output: `{ report: DomainValidationReport }` - `status: "skipped"` if no inputs provided.
- Errors: `VALIDATOR_FAILURE`.
- Timeout: 30s.

### `sidecoach_validate_taste`

Run the taste validator (anti-AI-slop heuristics).

- Input: `{ html: string, css?: string, iconLibrary?: string }`
- Output: `{ violationCount, violations, formatted }`
- Errors: `INVALID_INPUT` (missing html), `VALIDATOR_FAILURE`.
- Timeout: 30s.

### `sidecoach_get_cost_ledger`

Read the in-process session cost ledger from model-routing.

- Input: `{ format?: "raw"|"summary" }` (default `summary`)
- Output: `{ format, totals: { calls, inputTokens, outputTokens, estimatedCostUsd }, entries, summary }`
- Errors: `VALIDATOR_FAILURE` if the ledger module fails (defense in depth).
- Timeout: 5s.

### `sidecoach_get_cheatsheet`

Return the CHEATSHEET.md content, optionally filtered to one section.

- Input: `{ section?: "modes"|"verbs"|"flows"|"routing"|"all" }` (default `all`)
- Output: `{ section, source, content }`
- Errors: `DOWNSTREAM_UNAVAILABLE` if CHEATSHEET.md missing or section unknown.
- Timeout: 5s.

### `sidecoach_get_flow_metadata`

Return metadata for a single flow by ID.

- Input: `{ flowId: string }`
- Output: `{ flow: { id, name, description, triggers, tier, modelConfig } }`
- Errors: `INVALID_INPUT` if flowId is unknown.
- Timeout: 5s.

### `sidecoach_state_set` (T-0022)

Write a key/value pair to the in-process MCP session state store.

- Input: `{ key: string, value: string, ttlMs?: number }`
- Output: `{ key, expiresAt, totalEntries }`
- Caps: key 4 KiB, value 64 KiB, TTL 1ms..24h (default 30 min), total entries 1000.
- Errors: `INVALID_INPUT` (oversize key/value/TTL), `VALIDATOR_FAILURE` (store at total-entry cap).
- Timeout: 5s.
- Lifetime: the store lives on the MCP server's process heap. New stdio
  connection = new process = empty store. No on-disk artifact.

### `sidecoach_state_get` (T-0022)

Read a key from the state store. Missing or expired keys return `value: null`.

- Input: `{ key: string }`
- Output: `{ key, value: string | null, expiresAt? }`
- Errors: `INVALID_INPUT` (oversize key). Missing keys are NOT errors.
- Timeout: 5s.
- Expiry is lazy: a read on an expired key drops it and returns null.

### `sidecoach_state_delete` (T-0022)

Drop a key from the state store. Deleting a missing key is idempotent.

- Input: `{ key: string }`
- Output: `{ key, deleted: boolean }`
- Errors: `INVALID_INPUT` (oversize key).
- Timeout: 5s.

### `sidecoach_state_list_keys` (T-0022)

Enumerate currently-live keys. Optional prefix filter. Capped at 100 keys per call.

- Input: `{ prefix?: string }`
- Output: `{ keys: [{ key, expiresAt }], totalMatches, truncated }`
- Errors: `INVALID_INPUT` (oversize prefix).
- Timeout: 5s.

### `sidecoach_ast_grep` (T-0022)

Run an [ast-grep](https://ast-grep.github.io/) pattern search over project source.

- **Prerequisite:** the `ast-grep` CLI must be on PATH. Install via `brew install ast-grep` or `cargo install ast-grep`. Missing binary returns `DOWNSTREAM_UNAVAILABLE`.
- Input: `{ pattern: string, language?: enum, path?: string, maxResults?: number }`
- Output: `{ pattern, language, path, projectRoot, matchCount, truncated, matches: [{ file, startLine, endLine, startColumn, endColumn, text, language }], durationMs, linesSeen, linesSkipped }`
- Path scoping: relative paths resolve against `SIDECOACH_PROJECT_ROOT` (defaults to cwd). Absolute paths must resolve inside the root. Symlinks are followed before comparison. `..` escape attempts are rejected.
- Caps: 10s timeout, max 100 results (default 50), per-match text capped at 500 chars with `...[truncated]` suffix, max 4 MiB stdout buffered.
- Errors: `DOWNSTREAM_UNAVAILABLE` (binary missing or vanished mid-call), `INVALID_INPUT` (path escape), `TIMEOUT` (slow query), `VALIDATOR_FAILURE` (CLI non-zero exit).
- Search-only - no replace. T-0022 v1 ships search; replace will land in a follow-up if demand surfaces.

<!-- T-0026 LSP tools begin -->

### LSP tools (T-0026)

Five tools wrap a real Language Server Protocol client (`src/lsp/`). They spawn a
language server per language on demand, reuse it across calls (lease-based, so an
in-use server is never idle-evicted mid-request), and tear it down gracefully on
server shutdown. Positions are **0-based** to match the LSP wire protocol exactly
(first line and first column are `0`).

**Language servers are NOT bundled.** Each must be installed separately and be on
PATH. When the server for a file's language is missing, the tool returns a
structured `DOWNSTREAM_UNAVAILABLE` (never a crash).

| Language | File extensions | Binary (install separately) |
|---|---|---|
| TypeScript / JavaScript | `.ts .tsx .js .jsx .mjs .cjs .mts .cts` | `typescript-language-server --stdio` |
| Go | `.go` | `gopls` |
| Rust | `.rs` | `rust-analyzer` |
| Python | `.py .pyi` | `pyright-langserver --stdio` |
| C | `.c .h` | `clangd` |
| C++ | `.cpp .cc .cxx .hpp .hh .hxx` | `clangd` |

All LSP tools resolve `file` inside `SIDECOACH_PROJECT_ROOT` (same realpath +
symlink-escape protection as `ast_grep`), have a 60s outer timeout, a 30s
initialize-handshake timeout, and a 15s per-request timeout.

#### `sidecoach_lsp_hover`

Type signature and docs at a position.

- Input: `{ file: string, line: number, character: number }` (0-based line/character)
- Output: `{ file, projectRoot, language, position, found: boolean, contents: string, range }`
- Errors: `DOWNSTREAM_UNAVAILABLE` (no server / unsupported file type), `INVALID_INPUT` (path escape, missing file), `TIMEOUT`.

#### `sidecoach_lsp_goto_definition`

Locate where the symbol at a position is defined.

- Input: `{ file, line, character }`
- Output: `{ ..., definitionCount, definitions: [{ uri, range }] }` (URIs relativized to the project root; handles Location / Location[] / LocationLink[]).
- Errors: as above.

#### `sidecoach_lsp_find_references`

Every reference to the symbol at a position.

- Input: `{ file, line, character, includeDeclaration?: boolean }` (default `true` - the one deviation from the bare position shape, required by the LSP method).
- Output: `{ ..., referenceCount, truncated, references: [{ uri, range }] }` (capped at 500).
- Errors: as above.

#### `sidecoach_lsp_document_symbols`

File outline (functions, classes, methods, variables). File-level - no position.

- Input: `{ file: string }`
- Output: `{ ..., symbolCount, symbols: [{ name, kind, detail?, range }] }` (hierarchical `DocumentSymbol[]` is flattened; capped at 1000).
- Errors: `DOWNSTREAM_UNAVAILABLE`, `INVALID_INPUT`, `TIMEOUT`.

#### `sidecoach_lsp_workspace_symbols`

Search symbol names across the whole project. Takes a query string instead of a
position; selects the language server via the optional `language` hint, or derives
it from an optional `file`, defaulting to `typescript`.

- Input: `{ query: string, language?: "typescript"|"javascript"|"go"|"rust"|"python"|"c"|"cpp", file?: string }`
- Output: `{ query, projectRoot, language, symbolCount, truncated, symbols: [{ name, kind, location: { uri, range } }] }` (capped at 500).
- Errors: `DOWNSTREAM_UNAVAILABLE` (selected server missing), `INVALID_INPUT` (unknown language).

<!-- T-0026 LSP tools end -->

<!-- T-0025 Python REPL begin -->

### `sidecoach_python_repl_execute` (T-0025)

Execute a one-shot Python snippet inside a locked-down, single-use container.

- **Prerequisite:** a container runtime (`docker` **or** `podman`) must be on PATH. docker is probed first, then podman; the result is cached per process. No runtime, or a binary present but daemon unreachable, returns `DOWNSTREAM_UNAVAILABLE` (never a crash).
- **Image:** `python:3-slim` by default. Override with the `SIDECOACH_PYTHON_IMAGE` env var (e.g. `python:3.12-alpine`). Pull the image once before first use.
- Input: `{ code: string (1..256 KiB), timeoutMs?: number (100..10000, default 10000) }`
- Output: `{ image, runtime, exitCode, timedOut, oomKilled, stdout, stderr, durationMs }`
- **Two defensive layers:**
  1. **Static screen (before any container spawns):** the code is lexically scanned (string/comment contents neutralized first to avoid false positives) and rejected as `INVALID_INPUT` if it imports `os` / `subprocess` / `socket`, or uses `__import__` / `eval` / `exec` / `compile`, or pokes at `__builtins__`. The violation is named in the error.
  2. **Container (the hard boundary):** every run gets `--network none --memory 256m --cpus 0.5 --read-only --tmpfs /tmp:size=64m --user nobody`. Code is streamed over stdin (never lands on disk or in argv). `--rm` cleans up the container.
- **Output cap:** stdout/stderr capped at 64 KiB with a `...[truncated]` suffix.
- **Hard timeout:** 10s container hard-kill (configurable down via `timeoutMs`). On timeout the container is killed (`<runtime> kill`), not just the client, so nothing leaks; the tool returns `TIMEOUT`. The per-tool wrapper budget is 30s, comfortably above the container kill so the internal kill always fires first.
- **Result semantics:** a non-zero container exit (a Python traceback, an OOM kill at exit 137) is a *normal* result returned as data with `exitCode` + `stderr` - it is NOT a tool error. Only a hard timeout maps to `TIMEOUT`.
- Errors: `DOWNSTREAM_UNAVAILABLE` (no runtime / daemon down / runtime vanished mid-call), `INVALID_INPUT` (static-screen violation, oversize code, bad timeout), `TIMEOUT` (container hard-killed).

| Container flag | Why |
|---|---|
| `--network none` | No network namespace at all - egress is impossible from inside the container. |
| `--memory 256m` | Memory ceiling; an allocation past it is OOM-killed (exit 137) rather than exhausting the host. |
| `--cpus 0.5` | Half a core - bounds a busy loop's blast radius until the timeout fires. |
| `--read-only` | Root filesystem is read-only: no persistence, no tampering with the image. |
| `--tmpfs /tmp:size=64m` | The only writable surface, size-capped and wiped with the container. |
| `--user nobody` | Drop to an unprivileged user; code never runs as root. |

<!-- T-0025 Python REPL end -->

---

## Error taxonomy

Every tool error response uses the shape `{ isError: true, content: [{ type: "text", text: <JSON> }] }` where the JSON body is a `ToolError`:

```ts
{
  code: "INVALID_INPUT" | "DOWNSTREAM_UNAVAILABLE" | "VALIDATOR_FAILURE" | "TIMEOUT" | "INTERNAL_ERROR",
  message: string,
  // optional context per code:
  validationIssues?: ValidationIssue[],
  resource?: string,
  validator?: string,
  errorMessage?: string,
  timeoutMs?: number,
  requestId?: string,
}
```

Clients should `JSON.parse(content[0].text)` to handle errors programmatically.

---

## Logging

Structured JSON-per-line to stderr. stdout is reserved for JSON-RPC framing.
Set `SIDECOACH_MCP_LOG_LEVEL=debug` for stack traces on internal errors.

The logger explicitly does NOT log tool input bodies or output bodies (only
byte counts) so HTML/CSS that contains user data does not land on disk via
log redirection. Apparent secrets (Bearer tokens, `api_key=` patterns,
`sk-...` strings) are redacted defensively from any error message before
logging.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module ../../dist/flows` | Parent sidecoach not built | `cd sidecoach && npm run build` |
| `sidecoach is not connected` in Claude Code | settings.json snippet has wrong path | Verify the absolute path resolves; restart session |
| All tool calls return `DOWNSTREAM_UNAVAILABLE` | Registries failed to load (check stderr at startup) | Confirm `claude/hooks/sidecoach-verbs.json` exists and is readable |
| Tools time out | A validator is genuinely slow on a pathological input | Increase `SIDECOACH_MCP_TIMEOUT_MS` for that session, or shrink the input |
| `tools/list` returns 0 tools | `npm install` skipped | `npm install && npm run build` |

---

## Development

```
npm test               # runs unit + integration + fault-injection
npm run test:unit
npm run test:integration
npm run test:fault
```

Unit tests do not touch the SDK. Integration tests spin up either an
in-memory transport pair or a real subprocess (see
`__tests__/integration/stdio.test.ts`).

Architecture decisions are documented in `DESIGN.md`. Read it before making
non-trivial changes to the server's surface or error taxonomy.
