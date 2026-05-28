# sidecoach MCP server: T-0022 OMC dev-tools extension

Owner: Jonah | Filed: 2026-05-28 | Status: pending team-lead approval before implementation

This memo extends `DESIGN.md` (the T-0018 ship) with the v1 plan for the OMC-grade dev-tool extensions tracked under T-0022. Read alongside `DESIGN.md` Section 2 (tool catalog), Section 4 (error taxonomy), and Section 5 (failure modes).

---

## 1. Mandate and constraints

T-0018 shipped 10 sidecoach-domain tools (registry reads + 159-rule validators + cost ledger + cheatsheet + flow metadata) to a "zero drops, zero failures" bar: 79/79 tests, uniform error guard, Zod input validation, per-tool timeouts, structured `ToolError` taxonomy, redacted stderr logger, graceful SIGTERM. T-0022 must EXTEND that bar, not regress it.

The team-lead brief identified four OMC dev tools as the candidate set:

1. **AST grep** (`ast_grep_search`, `ast_grep_replace` in OMC)
2. **LSP** (`lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_document_symbols`, `lsp_workspace_symbols` in OMC)
3. **Python REPL** (`python_repl` in OMC, persistent JSON-RPC bridge over Unix socket)
4. **State management** (in-process Map per the brief's spec; OMC's `state-tools.ts` is filesystem-backed mode state - orthogonal to what was asked for)

Quality over coverage was reaffirmed: "2 rock-solid tools beats 4 flimsy ones."

---

## 2. Tools chosen for v1

### 2a. State management (4 tools)

Aligned 1:1 with the brief's spec - in-process `Map`, scoped to the MCP server process lifetime, TTL-based expiry, bounded keys + values + total entries.

| Tool | Purpose | Defaults | Caps |
|---|---|---|---|
| `sidecoach_state_set` | Write `key -> value` with optional TTL override | TTL 30 min | key 4096 bytes; value 65536 bytes; total entries 1000 |
| `sidecoach_state_get` | Read `key`. Returns `{value, expiresAt}` or `{value: null}` if missing or expired (lazy-expires on access) | - | - |
| `sidecoach_state_delete` | Drop a key. Returns `{deleted: boolean}` | - | - |
| `sidecoach_state_list_keys` | List currently-live keys, optional `prefix` filter | - | max 100 keys returned per call |

**Why this fits the T-0018 bar:**
- Zero external deps - just `Map<string, {value, expiresAt}>`.
- Mutable surface is process-local; the brief's "scoped to session" maps to the MCP server's single-stdio-connection lifetime. No cross-session bleed possible because there is no cross-session.
- Expiry is lazy on read + a sweep on every mutating write (no setInterval, no event-loop pinning).
- Bounded everywhere: per-key, per-value, total-map, list-keys page size.
- Trivially unit-testable; trivially fault-injectable (force the map to a stub).
- Exception model is uniform: oversize key/value -> `INVALID_INPUT` via Zod; map at cap -> `VALIDATOR_FAILURE` from handler.

### 2b. AST grep (1 tool)

OMC ships TWO ast tools: search and replace. We ship only `sidecoach_ast_grep` (search) in v1.

| Tool | Purpose | Defaults | Caps |
|---|---|---|---|
| `sidecoach_ast_grep` | Run an ast-grep pattern over project files | 10s timeout, language=auto-detected by file ext, max 100 matches, per-match 500-char text cap, max 1000 files scanned | path MUST resolve inside `SIDECOACH_PROJECT_ROOT` (env, defaults to `process.cwd()`); pattern length max 4096 chars |

Implementation: shell out to the `ast-grep` CLI binary via `execFile` with an `AbortController` wired to the existing per-tool timeout race. CLI output is parsed via `--json=stream` for structured matches. DEPENDENCY_MISSING (`DOWNSTREAM_UNAVAILABLE` code with `resource: 'ast-grep'`) is returned at the FIRST call after a single PATH-probe at server startup (cached on the registries bundle).

**Why CLI instead of `@ast-grep/napi`:**
- Native module would add a platform-specific native binding to the server's dependency tree. Currently the server has zero native deps.
- Graceful degradation is cleaner: missing CLI -> structured `DOWNSTREAM_UNAVAILABLE`; missing napi binding -> obscure require-time error per OMC's own comment block.
- The CLI's `--json=stream` output is stable and well-documented.

**Why search-only, not replace:**
- Replace is a write operation. Adds an entire class of test burden (did the file change correctly? did it preserve byte-perfect surrounding content? was the encoding right?) that distracts from shipping a hardened search.
- The team-lead brief asks for "find every call to function X" - search satisfies the use case. Replace can land in v2 if the demand surfaces.

**Why no `dryRun` flag:** search is intrinsically dry. Replace would need it; we are not shipping replace.

---

## 3. Tools REJECTED for v1

### 3a. LSP - DEFERRED

OMC's LSP tool stack is non-trivial:
- `lspClientManager` with per-file-type language-server discovery (`getServerForFile`)
- Per-client subprocess spawn with stdio JSON-RPC LSP protocol
- Lease-based concurrency control to protect a client from idle eviction mid-operation
- Per-server initialization handshake (capabilities exchange, workspace folder registration)
- Five user-facing tools wrapping `client.hover`, `client.definition`, `client.references`, `client.documentSymbols`, `client.workspaceSymbols`
- A workspace-symbol search index that scales with the workspace size

The brief's "reuse an existing language server connection; don't spawn one per call" is the right call - but there is NO existing language-server connection in the sidecoach server today. Building one up to T-0018's bar means:
- A new subsystem (`src/lsp/`) with ~600 LOC of LSP-protocol plumbing
- Language-server discovery + install detection (tsserver, gopls, rust-analyzer, etc.)
- Subprocess lifecycle management with idle eviction
- A whole new category of failure modes (server crash mid-RPC, server takes 8s to initialize, server returns malformed responses, server hangs on shutdown)
- Significantly more test surface (fault injection for each of the above)

This cannot be hardened to the "zero drops, zero failures" bar in this timeframe. Deferring.

### 3b. Python REPL - REJECTED outright

The brief lists seven non-negotiable sandboxing requirements:
1. Process isolation (subprocess, not in-server eval)
2. CPU + memory limits (rlimit or container)
3. Network egress blocked
4. Filesystem access scoped to a temp dir
5. Hard timeout (default 10s)
6. Output size cap (default 64KB)
7. No `import os`, no `subprocess`, no `__import__` (AST inspection to reject)

The brief is explicit: "If you can't deliver all of the above, DON'T ship Python REPL. Ship the other tools instead."

Cross-platform reality:
- (1), (5), (6) are straightforward on Node via `child_process.execFile` + AbortController.
- (2) on Linux uses `prlimit` or `ulimit`; on macOS the closest is `sandbox-exec` which is officially deprecated (warns at every invocation since Big Sur) and has no portable memory cap.
- (3) on Linux requires network namespaces (root) or seccomp; on macOS requires `sandbox-exec` with `(deny network*)`, same deprecation story.
- (4) is doable on both via `cwd: tmpDir`, but enforcing READ scope requires sandbox-exec or chroot - neither portable.
- (7) is doable via Python `ast.parse` walk to reject forbidden names. But this is incomplete defense (eval-via-`compile()`, `getattr(__builtins__, "...")`, etc.).

Conclusion: a v1 Python REPL on this codebase would meet maybe 4 of 7 requirements portably. Per the brief: REJECT. Filing a `T-0022b` follow-up to spec a containerized variant (Docker or Podman) where all seven requirements ARE meetable would be a separate, larger piece of work.

---

## 4. Schemas

All schemas added to `src/schemas.ts` following the existing pattern (raw shape + wrapped Zod object + inferred TS type, registered in `TOOL_INPUT_SCHEMAS`).

```ts
// State tools
export const stateSetShape = {
  key: z.string().min(1).max(4096),
  value: z.string().min(0).max(65536),          // values stored as opaque string (JSON-stringify on caller side)
  ttlMs: z.number().int().min(1).max(86_400_000).optional(),  // 1ms to 24h
};
export const stateGetShape = {
  key: z.string().min(1).max(4096),
};
export const stateDeleteShape = {
  key: z.string().min(1).max(4096),
};
export const stateListKeysShape = {
  prefix: z.string().min(0).max(4096).optional(),
};

// AST grep
export const astGrepShape = {
  pattern: z.string().min(1).max(4096),
  language: z.enum([
    'javascript', 'typescript', 'tsx', 'python', 'go', 'rust',
    'java', 'c', 'cpp', 'html', 'css', 'json', 'yaml'
  ]).optional(),    // omitted -> auto-detect by file ext
  path: z.string().min(1).max(2048).optional(),  // relative to project root; defaults to "."
  maxResults: z.number().int().min(1).max(100).optional(),  // hard cap 100
};
```

---

## 5. Failure modes (extending DESIGN.md Section 5)

| Tool | Code | Trigger | Recovery |
|---|---|---|---|
| state_set | INVALID_INPUT | key/value over Zod cap | caller shrinks input |
| state_set | VALIDATOR_FAILURE | map at total-entry cap (1000) | caller deletes stale keys, retries |
| state_get | (no error) | missing or expired key | returns `{value: null}` |
| state_delete | (no error) | missing key | returns `{deleted: false}` |
| state_list_keys | (no error) | empty store | returns `{keys: []}` |
| ast_grep | DOWNSTREAM_UNAVAILABLE | `ast-grep` not on PATH | install ast-grep; structured error with install hint |
| ast_grep | INVALID_INPUT | path resolves outside `SIDECOACH_PROJECT_ROOT` | caller passes a path inside the project |
| ast_grep | TIMEOUT | ast-grep CLI exceeds 10s | caller narrows path or pattern |
| ast_grep | VALIDATOR_FAILURE | ast-grep CLI exits non-zero with stderr | redacted stderr surfaced in `errorMessage` |

All other failure modes inherit T-0018's uniform guard behavior unchanged.

---

## 6. Test plan

Target: 79 existing + ~30 new = ~109 total, all green.

### 6a. Unit (target +18)
- `__tests__/unit/state-store.test.ts` (~10): set/get round-trip, expiry-on-access, sweep on mutation, list-keys with prefix, list-keys cap at 100, key-overflow rejection, value-overflow rejection, total-entry-cap rejection, delete-missing returns false, get-after-delete returns null.
- `__tests__/unit/ast-grep-parser.test.ts` (~4): parse `--json=stream` output, per-match text truncation, error-line handling, empty-output handling.
- `__tests__/unit/schemas.test.ts` (existing file, +4): four new schemas validated.

### 6b. Integration (target +6)
- `__tests__/integration/state-tools.test.ts` (~3): real subprocess + 4 new state tools + cross-tool interaction (set->list->get->delete).
- `__tests__/integration/ast-grep.test.ts` (~3): real subprocess + ast_grep against the sidecoach repo (mock fixture if ast-grep not installed in CI - test the DOWNSTREAM_UNAVAILABLE path too).

### 6c. Fault-injection (target +6)
- `__tests__/fault-injection/state-overflow.test.ts` (~3): force total-entry cap, force key overflow, force value overflow.
- `__tests__/fault-injection/state-ttl.test.ts` (~1): set with 1ms TTL, sleep 5ms, verify lazy-expire.
- `__tests__/fault-injection/ast-grep-missing.test.ts` (~1): stub PATH to omit ast-grep, verify DOWNSTREAM_UNAVAILABLE.
- `__tests__/fault-injection/ast-grep-timeout.test.ts` (~1): force a short timeout, verify TIMEOUT code (uses an artificial pattern that won't terminate quickly, or a path with many files).

---

## 7. Open questions for team-lead

None - the rejection rationale for LSP and Python REPL is concrete, the chosen subset is scoped, and the test plan mirrors T-0018's structure.

If team-lead overrides and asks for LSP in v1, the right answer is: pull T-0014 (CLI binary) or T-0021 (HUD) out of the queue to make room - this would be ~3 days of LSP infrastructure work to hit the T-0018 bar.

If team-lead overrides and asks for Python REPL in v1, the right answer is: scope shifts to "containerized REPL" (Docker required at runtime) which is a separate workstream worth its own task.

---

## 8. Backout plan

Each new tool file is independent and can be omitted from `src/tools/index.ts` without affecting the other 10 T-0018 tools. Reverting T-0022 reduces the catalog to 10 with zero data migration.

The state store is per-process and ephemeral by design - no on-disk artifacts to clean up.

---

End of memo. Awaiting team-lead approval to begin implementation.

---
<!-- T-0026 begin -->

# T-0026: LSP integration subsystem (implements the section 3a deferral)

Owner: Jonah | Filed: 2026-05-28 | Status: implemented

Section 3a above DEFERRED the LSP tool stack because building it to the T-0018
bar is a ~600 LOC subsystem with a new class of failure modes. T-0026 closes
that deferral. The subset, surface, and hardening below extend the T-0018 /
T-0022 quality bar 1:1 (Zod-validated input, uniform `wrapHandler` guard,
structured `ToolError` taxonomy, redacted stderr logger, per-tool timeouts).

## 1. Subsystem architecture (`src/lsp/`)

Four modules, each with a single responsibility and an injected seam for tests:

- **`framing.ts`** - pure Content-Length wire codec. `encodeMessage()` plus
  `LspFramer` (incremental reader). No I/O, so partial reads, concatenated
  frames, bad/missing Content-Length, non-JSON bodies, and oversized lengths are
  all unit-tested directly. A bad header resyncs past the header block instead of
  wedging the stream.
- **`servers.ts`** - language-to-binary map + extension discovery. Adding a
  language is a one-line entry; nothing else hard-codes a language. Maps file
  extension -> `{command, args, extensions, languageId}` and resolves the LSP
  `languageId` (e.g. `.tsx` -> `typescriptreact`).
- **`client.ts`** - one `LspClient` drives one server subprocess over a
  `RawTransport` seam: request/response correlation by id, the
  `initialize -> initialized -> workspaceFolders` handshake, `didOpen`/`didClose`
  document lifecycle, graceful `shutdown -> exit -> force-kill`, and rejection of
  every in-flight request when the transport dies. The production transport
  (`spawnChildTransport`) wraps `child_process.spawn`; tests inject a fake.
- **`index.ts`** - `LspClientManager`: spawn-on-demand per language, lease-based
  concurrency, lazy idle eviction, binary probe (cached), graceful `shutdownAll`.
  Plus the process-wide singleton (`getSharedLspManager` / `setSharedLspManager`
  / `resetSharedLspManager` / `peekSharedLspManager`).
- **`tool-support.ts`** - the shared lifecycle (resolve root -> validate path ->
  discover server -> acquire lease -> didOpen -> request -> didClose -> release)
  so each of the 5 tool files is a thin description + one-line delegation.

Tool handlers live in `src/tools/lsp-*.ts` and delegate to `tool-support.ts`.

## 2. Lease-based concurrency (the rationale)

A language server is expensive to start (cold init can take seconds) so it is
pooled and reused. But reuse plus idle eviction is a race: a sweep could evict a
server that another request is mid-call on. The lease solves this. `acquire()`
increments a lease counter BEFORE awaiting the init handshake and returns a
`release()` the caller MUST call in a `finally`. `evictIdle()` only touches
servers with **zero** leases that have been idle past the threshold (default 5
min). So an in-use server can never be evicted out from under a request, while
genuinely idle servers are reclaimed. Eviction is lazy (runs on each `acquire`),
so there is no `setInterval` pinning the event loop - same discipline as the
state store's lazy expiry. The init handshake is awaited under the lease, so a
slow-starting server is protected during its own startup.

One implementation note worth recording: the per-request timeout timer is NOT
`unref`'d (unlike ast_grep's). A pending LSP request must keep the event loop
alive until it settles; the timer is cleared on response and `die()` clears all
pending timers on shutdown, so it can never outlive its request. (An earlier
`unref` let an idle process exit before the timeout fired - benign in production
where stdio holds the loop open, but it silently truncated the test runner.)

## 3. Tool surface (5 tools, mirror OMC)

All positions are 0-based (LSP convention). All `file` args resolve inside
`SIDECOACH_PROJECT_ROOT` via `resolveProjectRoot` + `validatePathInRoot`.

| Tool | Arg shape | Notes |
|---|---|---|
| `sidecoach_lsp_hover` | `{file, line, character}` | uniform position shape |
| `sidecoach_lsp_goto_definition` | `{file, line, character}` | normalizes Location/LocationLink |
| `sidecoach_lsp_find_references` | `{file, line, character, includeDeclaration?}` | +1 flag the method needs (default true) |
| `sidecoach_lsp_document_symbols` | `{file}` | file-level; no position |
| `sidecoach_lsp_workspace_symbols` | `{query, language?, file?}` | query, not a position; selector picks the server, defaults to typescript |

Two documented deviations from the bare `file+line+character` shape:
`find_references` adds `includeDeclaration` (required by the LSP method), and
`workspace_symbols` is project-wide so it takes a `query` plus a server selector.

Timeouts: 60s outer (per-tool), 30s initialize-handshake, 15s per request.

## 4. Failure modes (extending DESIGN.md Section 5)

| Trigger | Code | Behavior |
|---|---|---|
| No server binary on PATH for the file's language | `DOWNSTREAM_UNAVAILABLE` (`resource: lsp:<lang>`) | install hint; server never spawned |
| Unsupported file type (no language mapping) | `DOWNSTREAM_UNAVAILABLE` (`resource: lsp`) | lists supported languages |
| `file` resolves outside the project root / symlink escape | `INVALID_INPUT` | caught before any spawn |
| Server crash mid-RPC (exit / EPIPE) | `DOWNSTREAM_UNAVAILABLE` | in-flight requests rejected; dead server evicted on next acquire |
| Slow init (> init-timeout) | `TIMEOUT` | broken server evicted, not left in the pool |
| Malformed LSP response (bad Content-Length / non-JSON / unknown id) | (no error) | frame dropped, client survives, request still resolves on a later valid frame |
| Hang on shutdown (no `shutdown` response) | (no error) | shutdown-timeout fires, subprocess force-killed |
| Server error response | `VALIDATOR_FAILURE` (`validator: lsp`) | error message surfaced (redacted) |

All other behavior inherits the T-0018 uniform guard unchanged.

## 5. Testing without real language servers

The RPC layer is exercised entirely without an installed server. Unit tests
drive `LspClient` and `LspClientManager` through an in-process `FakeTransport`
(`__tests__/lsp-fakes.ts`). Integration tests run a genuine subprocess round-trip
against `__tests__/fixtures/fake-lsp-server.js`, which speaks the real
Content-Length framed protocol over stdio - so framing + client + manager + tool
handlers are validated end-to-end deterministically. If a real server (e.g.
`typescript-language-server`) IS on PATH, one extra integration test does a live
round-trip; otherwise it logs a skip. Absence of a server never fails the suite.

Test counts added by T-0026: unit +45 (framing 10, servers 7, client 8, manager
8, schemas 6, tools 6), integration +8, fault-injection +6. Suite total 145 ->
204, all green.

<!-- T-0026 end -->
