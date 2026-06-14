---
name: Sidecoach MCP Server - Design Memo
description: Architecture and contract memo for the hardened sidecoach Model Context Protocol server (T-0018).
type: reference
---

# Sidecoach MCP Server - Design Memo (T-0018)

This memo is the contract for the sidecoach custom MCP server. It is written
BEFORE implementation. Every section must be tight enough that the implementer
can lift it straight into code without judgment calls. If a section reads
hand-wavy ("we'll handle errors later", "TODO: think about cancellation"), it
gets tightened here, not deferred to the codebase.

The user mandate, verbatim: "do not build me a flimsy custom MCP server. I
need it hardened to work when expected with zero drops and zero failures.
Make it the best."

---

## 1. Goals and non-goals

### Goals

- Expose the sidecoach capabilities that exist TODAY as MCP tools, callable by
  any MCP client (Claude Code via `.mcp.json` or `~/.claude/settings.json`
  `mcpServers`, the Claude desktop app, any other MCP-aware host).
- Zero unhandled exceptions reaching the MCP transport layer. Every code path
  inside a tool handler is wrapped in a uniform guard that converts throws into
  protocol-conformant error responses.
- Every tool input is validated against a strict Zod schema BEFORE the tool
  body runs. Invalid input returns a structured validation error, not a crash.
- Per-tool timeouts. Default 30000ms, per-call configurable via the request
  payload, and globally overridable via env var.
- Concurrent request safety. Multiple in-flight calls do not corrupt shared
  state, do not contaminate logs across calls, and do not produce surprising
  interleaved outputs.
- Graceful degradation when downstream dependencies fail (a validator throws,
  a registry file is missing, a JSON parse fails). The tool returns a
  structured error payload; the server stays alive for the next call.
- Deterministic, reproducible behavior. Same input -> same output, modulo
  the live cost ledger (which is stateful by design).
- Test coverage: unit (per-tool happy + at least 2 error paths), integration
  (real subprocess + real MCP client), fault-injection (mock validators throw),
  concurrency (10 parallel calls), timeout (forced-slow downstream).
- Distribution: one-command install, simple `.mcp.json` recipe, README that
  a colleague can follow without reading the source.

### Non-goals

- LLM invocation. Sidecoach is rule-based today. The MCP server presents the
  rule-based capabilities as tools. It does NOT call Claude itself; that
  remains the caller's responsibility. When T-0007 (Codex/Gemini orchestration)
  lands, the MCP server may grow tools that invoke external CLIs, but that is
  out of scope for T-0018.
- Side-effecting file writes outside of `.claude/memory/` writes that the
  underlying flow handlers already do. The MCP tools are read-mostly:
  validators, registry queries, keyword resolution. The one mutation surface
  is `get_cost_ledger` (which reads the in-memory ledger; it does not write).
  Future tools that mutate state must declare it in their tool description.
- Re-implementing sidecoach logic. The MCP server is a presentation layer over
  `sidecoach/src/*`. If a tool needs new behavior, the behavior belongs in
  `sidecoach/src/` and the tool calls it.
- Authentication or capability gating beyond what MCP itself provides. The
  stdio transport implicitly authenticates by process boundary - if you can
  spawn the server, you can call its tools. We do not add per-tool auth.
- Streaming partial results. Every tool returns a single response per call.
  If a future tool benefits from streaming, we add it then; not preemptively.

---

## 2. Transport choice

**Choice: stdio.**

The server speaks Model Context Protocol over standard input/output. The MCP
SDK ships a `StdioServerTransport` that handles framing and JSON-RPC
multiplexing. Claude Code's `.mcp.json` and the desktop app's
`claude_desktop_config.json` both default to `command + args` invocation of
stdio MCP servers, which is the universal lowest-common-denominator path.

**Rationale (rejected alternatives):**

- **Streamable HTTP / SSE**: would let the server be a long-lived shared
  process, but introduces a new failure surface (port binding, TLS for
  non-localhost, request routing), and sidecoach is a per-developer local
  tool, not a multi-tenant service. The cost-ledger module
  (`getSessionLedger()`) is module-global in the sidecoach Node process,
  which means "session" already maps to "one MCP server process." stdio
  keeps that mapping clean.
- **WebSocket**: same shared-process drawbacks as HTTP, plus more complex
  client integration. No MCP host we ship to today prefers WS.

**Implications:**

- stdout is RESERVED for JSON-RPC. Any `console.log` from a tool handler
  corrupts the stream. The logger therefore writes to stderr only; we lint
  this in unit tests by checking that `process.stdout` is not written to
  except by the SDK transport.
- The host owns the process lifecycle. We must handle SIGTERM and SIGINT
  to flush logs and exit cleanly with code 0.

---

## 3. Tool catalog

Ten tools, deliberately. Each is justified by an existing sidecoach capability.
No tool exists without a backing implementation.

The team-lead brief proposed an initial list of 10; this memo's catalog matches
that list 1:1. We considered adding (a) a `sidecoach_run_benchmark` tool but
rejected it for T-0018 because benchmark runs take >30s and writing baselines
is a side-effect that doesn't belong in a request-response RPC surface (it is
a CLI concern, lives at `npm run bench`); (b) a `sidecoach_run_flow` tool that
would directly invoke a flow handler, but rejected it because flow handlers
expect a full `FlowExecutionContext` shape that's awkward to pass through
JSON-RPC and the orchestrator is the right caller, not an external MCP client.

### Tool naming

All tools use the prefix `sidecoach_` so that when an MCP client merges
multiple servers into one tool namespace, sidecoach tools are immediately
recognizable. Tools follow `verb_noun` naming.

### Tool table

| # | Tool name | Purpose | Input | Output | Errors | Timeout | Idempotent |
|---|---|---|---|---|---|---|---|
| 1 | `sidecoach_list_verbs` | Return the 22 verbs from `sidecoach-verbs.json` | `{}` (optional filter by `phase`) | `{verbs: Verb[]}` | INVALID_INPUT (filter not a string), DOWNSTREAM_UNAVAILABLE (verbs JSON unreadable) | 5000ms | yes |
| 2 | `sidecoach_list_lanes` | Return the lanes from `sidecoach-lanes.json` (lane_build / lane_ship / lane_delight / lane_live / lane_calm / lane_converge) | `{}` | `{count, lanes: Lane[]}` | DOWNSTREAM_UNAVAILABLE (lane registry missing/structure-invalid, no fallback) | 5000ms | yes |
| 3 | `sidecoach_list_flows` | Return all flow IDs + names + descriptions from `sidecoach/src/flows.ts` | `{}` (optional filter by `tier` or `idPrefix`) | `{flows: FlowSummary[]}` | INVALID_INPUT | 5000ms | yes |
| 4 | `sidecoach_classify_intent` | Classify a natural prompt against the lane registry using the same grouped scoring / clause binding / occurrence-aware suppression as the hook; computes advisory-nudge eligibility from `sidecoach-intent.json` but never reads/mutates the cooldown | `{prompt: string}` (1-4000 chars) | `{decision: {outcome, winningLane, verbMatch, diagnosticLane, laneScores, schemaVersion}, winningLabel?, nudge?}` (outcome in ROUTE/CLASSIFY/OUT_OF_SCOPE/CONTEXT_CHECK/VERB/NUDGE_ELIGIBLE/SILENT) | INVALID_INPUT (empty/too long), DOWNSTREAM_UNAVAILABLE (lane registry missing) | 5000ms | yes |
| 4a | `sidecoach_lane` | Drive a lane through the engine state machine (start / advance / status / list), wrapping the same `createExecutionEngine().{startLane,advanceLane,laneStatus,listLanes}` the monitor CLI uses | `{operation, projectPath?, laneId?, target?, renderUrl?, startRequestId?, checkpointId?, action?, expectedRevision?, reason?, report?, all?}` (start-only `renderUrl` http/https/file/data activates the browser-backed rules) | `{result}` or `{count, lanes}` | INVALID_INPUT (per-operation contract), TIMEOUT (response deadline) | 25000ms | start is idempotent on `startRequestId` |
| 5 | `sidecoach_validate_polish_standard` | Run `PolishStandardValidator.validateAll` against provided context | `{html?: string, css?: string, designTokens?: object, contextOverrides?: object}` | `PolishValidationReport` | INVALID_INPUT, VALIDATOR_FAILURE | 30000ms | yes |
| 6 | `sidecoach_validate_extended_domain` | Run `ExtendedDomainValidator.validateAll` against provided context | `{html?: string, css?: string, designTokens?: object, typography?: object, colors?: object, spacing?: object, motion?: object, accessibility?: object, contrast?: object, performance?: object, visualization?: object, internationalization?: object}` | `DomainValidationReport` | INVALID_INPUT, VALIDATOR_FAILURE | 30000ms | yes |
| 7 | `sidecoach_validate_taste` | Run `validateTaste(html, css)` | `{html: string, css?: string, iconLibrary?: string}` | `{violations: TasteViolation[], formatted: string}` | INVALID_INPUT, VALIDATOR_FAILURE | 30000ms | yes |
| 8 | `sidecoach_get_cost_ledger` | Read current session cost ledger from `model-routing.ts` | `{format?: "raw"|"summary"}` (default `summary`) | `{entries: CostEntry[], summary: string, totals: {calls, inputTokens, outputTokens, estimatedCostUsd}}` | INVALID_INPUT | 5000ms | yes (read-only) |
| 9 | `sidecoach_get_cheatsheet` | Return the CHEATSHEET.md content | `{section?: "lanes"|"verbs"|"flows"|"routing"|"all"}` (default `all`) | `{content: string, section: string, source: string}` | INVALID_INPUT, DOWNSTREAM_UNAVAILABLE (cheatsheet not found) | 5000ms | yes |
| 10 | `sidecoach_get_flow_metadata` | Given a flow ID, return its description, tier assignment, registered validators, and model-routing config | `{flowId: string}` | `{flowId, name, description, triggers, modelConfig, validators: string[]}` | INVALID_INPUT (unknown flow ID), DOWNSTREAM_UNAVAILABLE | 5000ms | yes |

### Schema sketches (Zod)

(Verbatim shape; the implementation imports these from `schemas.ts`.)

```ts
// 1. list_verbs
ListVerbsInput = z.object({ phase: z.string().min(1).max(64).optional() })

// 4. classify_intent
ClassifyIntentInput = z.object({ prompt: z.string().min(1).max(4000) })

// 5. validate_polish_standard
ValidatePolishInput = z.object({
  html: z.string().max(2_000_000).optional(),
  css: z.string().max(2_000_000).optional(),
  designTokens: z.record(z.unknown()).optional(),
  contextOverrides: z.record(z.unknown()).optional(),
}).refine(v => v.html || v.css || v.designTokens, {
  message: "at least one of html, css, or designTokens is required",
})

// 7. validate_taste
ValidateTasteInput = z.object({
  html: z.string().min(1).max(2_000_000),
  css: z.string().max(2_000_000).optional(),
  iconLibrary: z.string().max(64).optional(),
})

// 10. get_flow_metadata
GetFlowMetadataInput = z.object({
  flowId: z.string().min(1).max(128),
})
```

Output schemas are documented in the README's "Tool catalog" section and
enforced by TypeScript types; we do not Zod-validate outputs at runtime
because they originate from sidecoach's own typed APIs and adding output
validation would double the maintenance cost without changing protocol
correctness.

---

## 4. Concurrency model

The MCP SDK's `Server` class delivers each tool call to the handler in
isolation. Each call gets its own request context. The handler is `async`
and returns a Promise. Multiple in-flight Promises are interleaved by the
Node event loop, not by threads.

**Shared mutable state:** the cost ledger in `model-routing.ts` is the only
mutable module-global state we expose. `get_cost_ledger` reads it; it does
not write. The validators are pure functions over their context arguments
(they do not write module-globals). Registries (`verbs.json`, `modes.json`,
`flows.ts`, `CHEATSHEET.md`) are loaded once at startup into immutable
in-memory snapshots; we do NOT re-read them per request because that opens
a TOCTOU race during deploys. The registry-reload path is a server restart.

**Isolation:**

- Each tool call gets its own AbortController. Timeouts and shutdowns
  abort the controller, which propagates to any async-cancellable work in
  the handler.
- That `controller.signal` is passed into every handler via `ToolDependencies.signal`
  as a per-call response deadline. For `sidecoach_lane` it is used truthfully:
  the handler stops awaiting the engine result and returns `TIMEOUT` when the
  deadline fires, but the engine methods take no external signal, so an
  already-started `startLane`/`advanceLane` continues to completion under its own
  P4b-1 operation lease and heartbeat. P4d does not claim engine cancellation.

**Lane + intent registry loading (P4d).** Beyond verbs/modes/flows/cheatsheet,
`loadAllRegistries` loads two more slots:
- `lanes`: loaded via the classifier's own validating `loadRegistry`
  (`keyword-resolver.ts`), which THROWS on structural invalidity (no lanes,
  incomplete scope, missing scoring keys). The loader surfaces that throw as a
  null slot, which disables the lane tier loudly - `list_lanes`/`classify_intent`
  return `DOWNSTREAM_UNAVAILABLE`. Unlike modes (which fall back to `modes.ts`),
  there is NO silent TS fallback for lanes; the registry is the single source of truth.
- `intent`: a plain JSON parse of `sidecoach-intent.json`, used only to compute
  advisory-nudge eligibility and surface the nudge text. A missing/invalid file
  yields a null slot (eligibility computes to false, no nudge). The MCP never
  reads or mutates the cooldown state referenced inside it; cooldown -> NUDGE/SILENT
  delivery stays the Python hook's job.
- Logs are correlated with a per-request `requestId` (UUID v4) so concurrent
  call logs don't blur together when read in stderr.
- Validators receive a fresh, JSON-cloned input object per call. We do not
  pass the raw input reference into the validator, so even if a future
  validator mutated its argument (it doesn't today, but defense in depth),
  no other in-flight call sees the mutation.

**Stress test (T-0018 testing requirement):** spawn 10 concurrent calls to
`sidecoach_validate_taste` with distinct HTML inputs, verify (a) all 10
return a correct response, (b) no log interleaving corrupts a single
requestId's log lines, (c) total wall-clock time < 2x the slowest single
call (proves real concurrency, not serial fall-back).

---

## 5. Error taxonomy

We distinguish three failure categories. Each surfaces differently.

### A. Protocol errors

Surfaced via the SDK's built-in JSON-RPC error response (object with `code` +
`message`). Caller sees a JSON-RPC error, not a tool result.

- `-32700` JSON parse error (malformed request body)
- `-32600` Invalid request (missing `jsonrpc`, `id`, `method`)
- `-32601` Method not found (caller invoked a tool name we don't expose)
- `-32602` Invalid params (the SDK's own param schema rejected the call)

We do not raise these manually; the SDK does. Our job is to NOT let an
internal exception bubble up as one of these by accident, which would tell
the caller "the server is broken" when actually one tool failed.

### B. Tool errors

The tool ran, the input was schema-valid, but the operation returned a
business-level failure. Surfaced as a tool result with `isError: true` and a
content block that includes a structured `error` JSON object. The session
stays healthy; the next call works normally.

Error code enum (exported from `errors.ts`):

- `INVALID_INPUT` - Zod schema rejection, post-protocol. Includes
  `validationIssues` array with path + message per Zod issue.
- `DOWNSTREAM_UNAVAILABLE` - registry file missing, JSON parse failed, flow
  not in registry. Includes `resource` name.
- `VALIDATOR_FAILURE` - validator threw. Includes `validator` name and
  `errorMessage` (redacted of stack trace).
- `TIMEOUT` - tool exceeded its budget. Includes `timeoutMs`.
- `INTERNAL_ERROR` - the last-resort catch. Includes `requestId` so the
  user can find the stderr log line. Should NEVER fire in normal use; if it
  does, that's a bug.

Every tool error response has this shape:

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "{ \"code\": \"INVALID_INPUT\", \"message\": \"...\", \"validationIssues\": [...] }"
  }]
}
```

The text block contains a JSON-stringified `ToolError` so clients can parse
it programmatically while still getting a human-readable display.

### C. Internal errors (programmer bugs)

A throw escapes the tool handler. The uniform error guard in `index.ts`
catches it, logs the full stack to stderr with the requestId, and returns
an `INTERNAL_ERROR` tool error (NOT a protocol error - we do not want the
caller to think the server is dead). Then it keeps running.

If we throw inside the guard itself (which would be very bad), the SDK's
outermost error handler catches it and returns a `-32603 Internal error`
protocol error. We have not observed this path in testing; it exists as a
last-resort backstop.

---

## 6. Lifecycle

### Startup

1. `index.ts` boots. Reads env vars: `SIDECOACH_MCP_TIMEOUT_MS` (default
   30000), `SIDECOACH_MCP_LOG_LEVEL` (default `info`).
2. Initializes the logger (stderr-only writer).
3. Loads registries: `claude/hooks/sidecoach-verbs.json`,
   `claude/hooks/sidecoach-modes.json`, `claude/hooks/sidecoach-lanes.json`
   (via the classifier's validating loader; no TS fallback),
   `claude/hooks/sidecoach-intent.json`, the in-process `flows.ts` and
   `modes.ts` exports, `CHEATSHEET.md`. Logs `info` on each load, `error`
   on any failure but continues startup (the affected tool will return
   DOWNSTREAM_UNAVAILABLE rather than crashing the server).
4. Registers tool handlers with the `Server`.
5. Connects `StdioServerTransport`. The SDK now handles the `initialize`
   handshake automatically, reporting:
   - `serverInfo: { name: "sidecoach", version: <from package.json> }`
   - `capabilities: { tools: { listChanged: false } }`
6. Logs `info: server ready, transport=stdio, pid=<pid>`.

### Steady state

- Tool calls arrive over stdin, are dispatched to handlers, responses go
  back over stdout. Logger writes activity lines to stderr.
- In-flight calls are tracked in a Map<requestId, AbortController> so
  shutdown can cancel them.

### Shutdown signals

- SIGTERM, SIGINT, and `process.on('beforeExit')` all funnel into a
  single `shutdown(reason)` function.
- `shutdown` (a) logs `info: shutting down (reason=<reason>)`, (b) iterates
  in-flight AbortControllers and aborts each, (c) waits up to 2 seconds
  for in-flight calls to settle, (d) calls `server.close()` to flush the
  transport, (e) calls `process.exit(0)`.
- A second SIGTERM during shutdown forces `process.exit(1)` immediately.

### Cleanup

No persistent state. No temp files. No background timers other than the
per-call timeout `setTimeout` (cleared on completion or abort).

---

## 7. Logging strategy

Logger writes to `process.stderr`, structured as one JSON object per line:

```json
{"ts": "2026-05-28T12:34:56.789Z", "level": "info", "requestId": "uuid-or-startup", "tool": "sidecoach_validate_taste", "msg": "tool call complete", "durationMs": 142}
```

Levels: `debug`, `info`, `warn`, `error`. Default `info`. Configurable via
`SIDECOACH_MCP_LOG_LEVEL`.

**What we log:**

- Startup: server config, registries loaded, registry load failures.
- Per request: `tool call start` (with requestId + tool name + input size in
  bytes - NOT input contents, to keep secrets out of logs), `tool call
  complete` (with duration + isError), `tool call error` (with error code +
  redacted message).
- Shutdown: signal received, in-flight count, exit.

**What we do NOT log:**

- Tool input bodies (may contain HTML/CSS that itself contains user data).
- Tool output bodies (same).
- Full stack traces at INFO level. Stack traces appear at DEBUG only and
  in the `INTERNAL_ERROR` path at ERROR level.
- API keys, file paths under `~/.ssh`, anything matching a credential
  pattern. The logger has a `redact` pass; today it only redacts when the
  message string literally contains `password=` or `token=` substrings,
  which is a starting heuristic. If the server grows tools that handle
  secrets, the redact pass tightens.

---

## 8. Test strategy

Three test categories, each with a clear pass criterion. All run via
`cd sidecoach/mcp-server && npm test`.

### Unit (per-tool, in `__tests__/unit/`)

For each of the 10 tools:

- Happy path: valid input -> valid output, shape matches schema, no errors
  in stderr.
- Error path 1 (invalid input): empty string for a required field, or wrong
  type, or out-of-range length. Asserts `INVALID_INPUT` with the right
  validationIssues path.
- Error path 2 (downstream): mock the underlying module to throw or return
  a malformed value. Asserts the correct `DOWNSTREAM_UNAVAILABLE` or
  `VALIDATOR_FAILURE` code.

Some tools get more (e.g. `classify_intent` has a separate test per outcome:
ROUTE with a winning label, VERB, NUDGE_ELIGIBLE with nudge text, and the
no-cooldown invariant). Target: at least 30 unit tests across the tool surface.

### Integration (`__tests__/integration/`)

One end-to-end test that:

1. Spawns the built server as a subprocess (`child_process.spawn`).
2. Sends a real `initialize` request over its stdin and verifies the
   response (`serverInfo.name === "sidecoach"`, capabilities present).
3. Sends `tools/list` and verifies all 10 expected tool names are present
   with valid input schemas.
4. Sends a valid `tools/call` for each of the 10 tools, asserts the
   response shape.
5. Sends an INVALID `tools/call` (bad input) for at least one tool, asserts
   `isError: true` and the right code.
6. Sends SIGTERM, waits for the subprocess to exit, asserts exit code 0.

This catches the things unit tests can't: protocol framing bugs, stdout
contamination from accidental `console.log`, shutdown handling.

### Fault injection (`__tests__/fault-injection/`)

Tests that exercise edges:

- Force a validator to throw mid-call (monkey-patch + restore in
  `beforeEach`/`afterEach`). Assert `VALIDATOR_FAILURE` + server still
  alive (next call succeeds).
- Force a registry file to be missing at startup (temp-rename + restore).
  Assert affected tool returns `DOWNSTREAM_UNAVAILABLE`; unaffected tools
  work normally.
- Concurrency: fire 10 calls in parallel via `Promise.all`, assert all 10
  return correct responses, no requestId collisions in stderr.
- Timeout: monkey-patch a validator to await `new Promise` that never
  resolves, call the tool with a 200ms timeout override, assert `TIMEOUT`
  fires at ~200ms (not at 30s) and the server stays alive.

### Test count target

- Unit: at least 30 (3 per tool minimum).
- Integration: 1 multi-step test.
- Fault injection: at least 4 (validator throw, registry missing,
  concurrency, timeout).

---

## 9. Distribution

### Install

The MCP server lives at `sidecoach/mcp-server/`. It is a separate npm
package from the parent `sidecoach` package because:

1. The MCP server has additional dependencies (`@modelcontextprotocol/sdk`,
   `zod`) that the parent sidecoach codebase does not need.
2. The MCP server has its own build target (`dist/index.js` is an
   executable Node script with shebang) that is awkward to graft onto the
   parent package's library-style build.
3. Tests are slow (integration test spawns subprocesses); isolating them
   keeps the parent `npm test` fast.

**Build:**

```
cd sidecoach/mcp-server
npm install
npm run build      # tsc -> dist/
npm test           # unit + integration + fault-injection
```

The built entry is `dist/index.js`. Make it executable:

```
chmod +x dist/index.js
```

The package.json `bin` field points `sidecoach-mcp-server` at `dist/index.js`
so a global install (if anyone ever does that) exposes the command.

### Wire-up

Claude Code reads `.mcp.json` from the current working directory and
`mcpServers` from `~/.claude/settings.json` (per the harness rules in
CLAUDE.md). The README documents the exact snippet for each path. For the
in-repo case:

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

For a colleague who doesn't have the dotfiles checkout pinned to that path,
the README has a portable variant using relative paths or env vars.

We do NOT auto-install into `~/.claude/settings.json` from `install.sh`
today; the user adds the snippet manually after reading the README. Auto-
install can come later (a follow-up task) once the contract has shaken out.

---

## 10. Failure modes considered + mitigations

| # | Failure mode | Mitigation |
|---|---|---|
| 1 | Tool handler throws an unhandled exception | Uniform error guard in `index.ts` wraps every handler in `try/catch`; converts to `INTERNAL_ERROR` tool response; server stays alive. |
| 2 | Invalid input passed to validator | Zod schema validates BEFORE handler body runs. Rejected with `INVALID_INPUT` + structured `validationIssues`. |
| 3 | Tool hangs (validator infinite loop, missing await) | Per-tool timeout via `Promise.race` with `setTimeout`. Default 30000ms, env-overridable. Returns `TIMEOUT` and aborts the call's AbortController. |
| 4 | stdout corruption from accidental `console.log` | Logger writes to stderr only. Lint rule + unit test verifies `process.stdout.write` is not called from any tool path. |
| 5 | Concurrent calls corrupt shared state | Validators are pure over input args; registries are immutable post-load; ledger is read-only from MCP surface. Per-request AbortController + requestId isolation. |
| 6 | Caller sends malformed JSON-RPC | SDK handles; returns `-32700` parse error. No reach to our code. |
| 7 | Caller invokes unknown tool name | SDK handles; returns `-32601` method not found. |
| 8 | Registry file missing at startup | Logged at startup; affected tool returns `DOWNSTREAM_UNAVAILABLE` per call; unaffected tools continue. |
| 9 | Validator throws mid-call (e.g. malformed CSS triggers a regex bug) | Caught by uniform guard; returned as `VALIDATOR_FAILURE` with redacted error message; server alive. |
| 10 | Shutdown signal arrives mid-call | In-flight AbortControllers are aborted; 2s grace period; then `process.exit(0)`. Caller sees a terminated session, not a hung process. |
| 11 | Double-SIGTERM | First sets `shuttingDown=true`; second triggers `process.exit(1)` immediately. Avoids "user is hammering Ctrl-C and nothing happens." |
| 12 | Caller sends a huge input (DoS attempt) | Zod schemas cap string lengths (2MB for HTML/CSS, 4KB for phrases, 128 chars for IDs). Reject `INVALID_INPUT` if exceeded. |
| 13 | Two MCP clients spawn two server processes simultaneously | Each process has its own ledger and registries; stdio transports are per-process; no shared state. No mitigation needed; this is the design. |
| 14 | `@modelcontextprotocol/sdk` API change | Pin to a specific minor version in package.json; bump deliberately. Integration test will catch API drift in the next install. |
| 15 | `flows.ts` adds a new flow ID after server start | Server's in-memory registry is stale until next restart. `get_flow_metadata` returns `DOWNSTREAM_UNAVAILABLE` for the new ID. Acceptable - sidecoach development is local, restart cost is seconds. Future: file-watcher reload. |
| 16 | Validator outputs leak PII from the HTML the caller provided | The caller provided the HTML; we return what the validator computed against it. The MCP protocol is process-local; PII never leaves the user's machine via this surface. Logger does NOT log inputs/outputs, so we don't accidentally persist PII to disk. |
| 17 | Cost ledger has thousands of entries | `get_cost_ledger` returns full list only in `raw` format; `summary` (default) returns aggregates. Caller chooses verbosity. No artificial cap; if it grows pathological we cap then. |
| 18 | DESIGN.md goes out of date | Filed as a beat with `relates_to: session_2026-05-28_t0018_mcp_server.md`; reviewed at every server-touching task. |
| 19 | (T-0022) state_set called when store at 1000-entry cap | Sweep stale entries before the cap check (frees expired slots). If still at cap, return `VALIDATOR_FAILURE` with `code=TOO_MANY_ENTRIES`. Caller can delete + retry. |
| 20 | (T-0022) state_set called with key/value over Zod cap | Schema rejects with `INVALID_INPUT` before the handler body runs. Defense in depth: store's internal `validateKey/validateValue` also raise `StoreError` which the handler maps to `INVALID_INPUT`. |
| 21 | (T-0022) state_get on key whose TTL just expired | Lazy expiry on read: the entry is dropped from the map and the response is `{value: null}`. No error - missing/expired keys are not failures (matches normal cache semantics). |
| 22 | (T-0022) state TTL math overflows | Zod schema caps `ttlMs` at 24h (86_400_000); the store also enforces the same cap. No `Date.now() + ttlMs` overflow possible in the next ~290 million years. |
| 23 | (T-0022) ast_grep CLI binary not on PATH | Probed at first call (cached per process). Missing -> `DOWNSTREAM_UNAVAILABLE` with `resource: "ast-grep"` and install hint. Server stays alive; other tools unaffected. |
| 24 | (T-0022) ast_grep path escapes project root | `validatePathInRoot` resolves the user path against `SIDECOACH_PROJECT_ROOT`, follows symlinks via realpath, computes the relative offset. If it starts with `..` or is absolute, returns `INVALID_INPUT` with `path escapes the project root`. Tests cover `..`, absolute `/etc`, and symlink-to-outside attacks. |
| 25 | (T-0022) ast_grep CLI hangs on a pathological pattern | AbortController-tied timeout at 9.5s (under the 10s tool budget so we report `TIMEOUT` cleanly inside the handler). execFile timeout option provides defense in depth. |
| 26 | (T-0022) ast_grep CLI exits non-zero (bad pattern, unsupported language) | Maps to `VALIDATOR_FAILURE` with `validator: "ast-grep"` and the redacted stderr in `errorMessage`. Server stays alive. |
| 27 | (T-0022) ast_grep stdout exceeds 4 MiB | execFile's `maxBuffer: 4 MiB` cap returns an `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` errno. The handler maps to `VALIDATOR_FAILURE`. Caller should narrow the path or pattern. |
| 28 | (T-0022) `SIDECOACH_PROJECT_ROOT` points at a non-existent path or a file (not a directory) | `resolveProjectRoot` raises `INVALID_INPUT` at the first ast_grep call. Other tools (state, registries, validators) are unaffected. |

---

## Final review (self-check before implementation)

- [x] Goals/non-goals are concrete enough to reject scope creep.
- [x] Transport choice has explicit rationale; alternatives named and rejected.
- [x] Each of 10 tools has input/output/errors/timeout/idempotency documented.
- [x] Concurrency model addresses shared state explicitly. No hand-wave.
- [x] Error taxonomy distinguishes protocol vs tool vs internal; each
      category has a code, a shape, and a surfacing path.
- [x] Lifecycle covers startup, signals, double-signal, cleanup.
- [x] Logging spec includes what we don't log (PII, secrets).
- [x] Test strategy has per-category targets with counts.
- [x] Distribution includes the exact .mcp.json snippet and the rationale
      for separate-package vs in-parent.
- [x] Failure modes table has at least 15 distinct rows. (Currently 28 after T-0022 extension.)

No section reads as "TODO: think about X later." This memo is ready to be
turned into code.
