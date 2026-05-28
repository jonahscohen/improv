---
name: T-0014 sidecoach terminal CLI shipped
description: sidecoach/bin/sidecoach.js terminal CLI mirroring the /sidecoach slash surface by reusing the compiled dist verb->flow source of truth; resolver-only dispatcher
type: project
relates_to: [session_2026-05-28_task-queue-team-deploy.md, session_2026-05-28_t0018_mcp_server.md]
---

Collaborator: Jonah. Shipped by teammate `t0014-cli` (task-queue-0528), verified + integrated by lead.

## What shipped
`sidecoach/bin/sidecoach.js` - terminal CLI mirroring the `/sidecoach` slash-command surface. Node built-in `process.argv` parsing (no commander - matches the sibling `bin/sidecoach-*.js` scripts). Surface: 22 verbs + 5 composite modes (forge/kiln/bloom/canvas/trim) + teach/document setup + `list` + `help [verb|mode]`. Executable shebang, chmod +x.

## Source-of-truth reuse (the key design point)
The CLI does NOT duplicate the verb->flow mapping. It `require()`s the compiled `dist/` modules that the in-session orchestrator and the MCP server already consume: `dist/slash-command-router` (parseSlashCommand), `dist/verb-command-registry` (VERB_REGISTRY/getVerbEntry), `dist/modes`, `dist/flows`, `dist/model-routing`. For verbs it literally constructs `"/sidecoach <verb> <target>"` and calls `parseSlashCommand()` - the same function the slash command uses - so the CLI cannot diverge from the slash surface. `craft` resolution was cross-checked byte-for-byte against `getVerbEntry('craft').flowIds` (IDENTICAL).

## Resolver-only (documented limitation)
Full flow execution needs an in-session `FlowExecutionContext` (model dispatch, project context, browser) that does not exist at a terminal. So the CLI is a faithful resolver+dispatcher: it resolves a verb/mode to its flow chain and prints the plan (chain order, per-flow model tier, phase, guidance) then exits 0 with a "run `/sidecoach <verb>` in a session to execute" note. `help` and `list` are fully offline/standalone.

## Distribution
install.sh: chmod +x the bin, symlink to `~/.local/bin/sidecoach` with a PATH warning if `~/.local/bin` is not on PATH; install manifest line updated. `package.json` got a `bin` field.

## Verification (lead re-ran independently)
- node --check clean; `bash -n install.sh` clean; package.json valid JSON.
- `help` exit 0 (lists 22 verbs grouped by phase + 5 modes + setup), `list` exit 0, `craft "a pricing page"` exit 0 (resolves the full 9-flow chain with model tiers), unknown verb `frobnicate` exit 1 (lists valid verbs/modes). NOTE the earlier pipe-masked exit check was a false alarm - real exit codes confirmed via `>/dev/null; echo $?`.
- Mapping suites green: slash-command 15/15, sprint8-verb-parity 202/202, t12-model-routing 54/54, router-registry-branch + list-command-taxonomy PASS.

## Follow-up filed (T-0027)
Teammate flagged `dist/modes.js` STALE vs `src/modes.ts` + `claude/hooks/sidecoach-modes.json`: compiled MODE_LIST has 5 modes but source defines 6 (adds `ralph`). CLI reads dist (faithful to the actual execution surface, and matches the 5 modes in the task brief), so not a T-0014 bug. Filed T-0027 to `npm run build` and surface `ralph` everywhere. Did NOT rebuild dist here to avoid pulling unrelated stale src into the T-0014 commit.

## Files
- NEW sidecoach/bin/sidecoach.js
- MOD sidecoach/package.json (bin field), install.sh (chmod + symlink + manifest)
