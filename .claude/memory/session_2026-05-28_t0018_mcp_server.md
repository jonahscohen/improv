---
name: T-0018 sidecoach MCP server shipped
description: Hardened Model Context Protocol server at sidecoach/mcp-server exposing 10 sidecoach capabilities as MCP tools - design memo + impl + 79 tests + live subprocess smoke transcript
type: project
relates_to: [feedback_attribution.md, session_2026-05-28_t0015_legacy_flow_cull.md]
---

# T-0018 - Sidecoach custom MCP server (Jonah, 2026-05-28)

User explicitly asked for a hardened MCP server: "do not build me a flimsy
custom MCP server. I need it hardened to work when expected with zero drops
and zero failures. Make it the best." Met.

## Tool catalog (10 tools, all sidecoach_ prefixed)

| Tool | Purpose | Timeout |
|---|---|---|
| `sidecoach_list_verbs` | Return the 22 verbs from `sidecoach-verbs.json`, optional phase filter | 5s |
| `sidecoach_list_modes` | Return the 5 modes (forge/kiln/bloom/canvas/trim) | 5s |
| `sidecoach_list_flows` | Return all flows from `flows.ts` with their model-routing config; tier/idPrefix filters | 5s |
| `sidecoach_resolve_keyword` | Run the bash hook's sanitize + word-boundary + informational-suppression logic over a phrase | 5s |
| `sidecoach_validate_polish_standard` | Run the 22-Point Polish Standard validator | 30s |
| `sidecoach_validate_extended_domain` | Run the 112-rule Extended Domain validator across 10 domains | 30s |
| `sidecoach_validate_taste` | Run the taste validator (anti-AI-slop heuristics) | 30s |
| `sidecoach_get_cost_ledger` | Read the in-process model-routing session ledger, summary or raw | 5s |
| `sidecoach_get_cheatsheet` | Return CHEATSHEET.md content with optional section filter | 5s |
| `sidecoach_get_flow_metadata` | Return one flow's name, triggers, tier, modelConfig | 5s |

## Test pass count by category

- Unit: **63/63**
  - errors.test.ts: 7
  - logger.test.ts: 6
  - schemas.test.ts: 11
  - keyword-resolver.test.ts: 13
  - tools.test.ts: 26
- Integration: **6/6**
  - in-memory.test.ts (real SDK Client over InMemoryTransport pair): 4
  - stdio.test.ts (real subprocess + JSON-RPC over stdio): 2
- Fault-injection: **10/10**
  - registry-missing.test.ts: 3
  - validator-throw.test.ts: 4
  - timeout-and-concurrency.test.ts: 3

Total: **79/79 PASS**. `npx tsc --noEmit` clean.

## Architecture key decisions

**Why:** the brief mandated quality over speed. The 18-row failure-modes
table in DESIGN.md drove the design.

**How:** layered foundation (errors -> logger -> schemas -> registries ->
keyword-resolver -> tool handlers -> server -> index). Each layer is
testable in isolation. The "uniform error guard" lives in `server.ts`'s
`wrapHandler` - every tool handler is wrapped with input snapshot
logging, AbortController-backed timeout via `Promise.race`, try/catch ->
`thrownToToolError`, response shaping. Handlers themselves stay pure
(input + deps -> `{data, summary}`), so they unit-test without the SDK.

**Parent decoupling:** the MCP server imports from `../../dist/` (parent
sidecoach's compiled output) rather than `../../src/`. This decouples
the mcp-server's build from the parent's source-compile state - relevant
because T-0015's legacy flow cull and T-0016's bench-ledger wiring were
landing on the same day with their own tsc issues. README documents
"build parent first" as the prerequisite.

**stdio transport, not HTTP:** session-equals-process maps cleanly to
the model-routing ledger's module-global lifetime. HTTP would have
required port binding + multi-tenant complexity for a per-developer
local tool. Justified in DESIGN.md section 2.

## Failure modes considered + mitigations applied

(18 rows in DESIGN.md, summarized.)

| Failure | Mitigation in code |
|---|---|
| Handler throws unhandled | Uniform guard catches; INTERNAL_ERROR returned; server alive |
| Bad input passed to validator | Zod schema validates BEFORE handler body; INVALID_INPUT with `validationIssues` |
| Tool hangs | Promise.race vs setTimeout(timeoutMs); AbortController fires; TIMEOUT returned |
| stdout corruption from console.log | Logger writes to `process.stderr.write` only |
| Concurrent calls corrupt state | Per-request AbortController + UUID requestId; immutable registries |
| Registry missing at startup | Logged warn; affected tool returns DOWNSTREAM_UNAVAILABLE per-call |
| Validator throws mid-call | Caught in wrapper; VALIDATOR_FAILURE with redacted error |
| SIGTERM mid-call | Abort in-flight controllers; 2s grace; clean exit 0 |
| Double-SIGTERM | First signal sets shuttingDown=true; second forces exit 1 |
| DoS via huge input | Zod length caps: 2MB html/css, 4KB phrases, 128 chars IDs |
| Credentials in error logs | Redact Bearer tokens / `api_key=` / `sk-*` / `password=` in `redactErrorMessage` |
| Tool input/output bodies in logs | Logger logs byte count only, never the body |

## Smoke transcript (live subprocess)

Saved at `sidecoach/mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`. Highlights:

```
CLIENT->SERVER: initialize (protocolVersion 2024-11-05)
SERVER->CLIENT: serverInfo={name:"sidecoach-mcp-server", version:"0.1.0"}
CLIENT->SERVER: tools/list
SERVER->CLIENT: 10 tools, each with description + JSON-schema inputSchema
CLIENT->SERVER: tools/call sidecoach_list_modes
SERVER->CLIENT: 5 modes (forge/kiln/bloom/canvas/trim) with chains
CLIENT->SERVER: tools/call sidecoach_resolve_keyword phrase="please polish the homepage"
SERVER->CLIENT: match={kind:"verb", name:"polish"}
CLIENT->SERVER: tools/call sidecoach_get_flow_metadata flowId="flowJ_tactical_polish"
SERVER->CLIENT: full flow metadata incl. modelConfig preferredTier=opus
CLIENT->SERVER: tools/call sidecoach_get_flow_metadata flowId="flowZZZ_unknown"
SERVER->CLIENT: isError=true, code=INVALID_INPUT, message="unknown flowId..."
STDERR (proves stdout/stderr separation): structured JSON log with code=INVALID_INPUT
```

## Files created

- sidecoach/mcp-server/DESIGN.md (10-section design memo, ~580 lines)
- sidecoach/mcp-server/package.json + tsconfig.json
- sidecoach/mcp-server/src/index.ts (executable entry + signal wiring)
- sidecoach/mcp-server/src/server.ts (uniform guard + tool registration)
- sidecoach/mcp-server/src/errors.ts (5-code taxonomy + redaction)
- sidecoach/mcp-server/src/logger.ts (stderr-only structured JSON)
- sidecoach/mcp-server/src/schemas.ts (10 Zod input shapes + length caps)
- sidecoach/mcp-server/src/registries.ts (one-shot startup load)
- sidecoach/mcp-server/src/keyword-resolver.ts (TS port of bash hook logic)
- sidecoach/mcp-server/src/tools/ (10 handler files + types.ts + index.ts)
- sidecoach/mcp-server/__tests__/ (harness.ts + run-tests.ts + unit/4 + integration/2 + fault-injection/3 + smoke.sh + SMOKE_TRANSCRIPT.txt)
- sidecoach/mcp-server/README.md (install + 2 settings.json snippets + tool catalog + env vars + troubleshooting)
- sidecoach/.mcp.json (project-level auto-discovery)

## How to enable in Claude Code

Either add the `mcpServers.sidecoach` block to `~/.claude/settings.json` (the
README has the snippet) OR rely on the project-level `sidecoach/.mcp.json`
the install dropped. Restart the session so the host re-spawns the MCP
server and reads the config.

## Non-trivial design decisions worth flagging

1. **Output-schema validation is TypeScript-only, NOT runtime Zod.** Outputs
   come from sidecoach's own typed APIs (PolishValidationReport,
   DomainValidationReport, etc.). Adding runtime Zod on outputs would
   double maintenance with no protocol-correctness gain. Decision approved
   in checkpoint with team-lead. Revisit if we see drift between API and
   what callers expect.

2. **Separate npm package, not scripts inside parent.** The MCP SDK + zod
   are runtime deps the parent doesn't need; the executable shebang script
   is awkward to graft onto the parent's library build; integration tests
   spawn subprocesses, which slow down `npm test`. Isolation keeps both
   sides fast.

3. **Registries loaded once at startup, never re-read per request.** A
   per-request read would open a TOCTOU race during deploys. Acceptable
   cost: a `flows.ts` edit requires a server restart for the new flow to
   appear via `sidecoach_get_flow_metadata`. Documented in failure-modes
   table.

4. **`sidecoach_run_benchmark` and `sidecoach_run_flow` rejected as tools.**
   Benchmarks are >30s + side-effecting (write baselines) - belongs in CLI,
   not RPC. Direct flow execution needs a full FlowExecutionContext shape
   that doesn't round-trip cleanly through JSON-RPC - orchestrator is the
   right caller.

## Out-of-scope follow-ups (filed for later, not in T-0018)

- Wire `install.sh` to auto-merge the .mcp.json snippet into
  `~/.claude/settings.json` mcpServers. Today the user reads README and
  copies manually.
- File-watcher reload of registries (vs. restart). Low priority - restart
  cost is seconds.
- Add `sidecoach_run_benchmark` once benchmarks support streaming progress
  + bounded duration.
