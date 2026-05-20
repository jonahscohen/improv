---
name: verify-before-done.sh accepts test/probe clearing patterns
description: Extended verification off-ramp for server-only code (no UI to screenshot); also identified memory-nudge Read-matcher fix for orchestrator
type: project
relates_to: [reflection_2026-05-19.md, session_2026-05-05_memory-nudge-hook.md]
---

# Verify hook: server-only off-ramp + memory-nudge wiring report

## What

Implemented findings #1 and #2 from `reflection_2026-05-19.md`.

### Task 1 - verify-before-done.sh clearing patterns extended

Edited `claude/hooks/verify-before-done.sh` (canonical source). Added the following clearing triggers on top of the existing cmux-screenshot, localhost-curl, and .png/.jpg-Read patterns:

- **Test runners** (matched as tokens, not substrings): `npm test`, `npm run test`, `yarn test`, `pnpm test`, `npx vitest`, `npx jest`, `npx mocha`, `npx playwright test`, bare `vitest`/`jest`/`mocha`, `pytest`, `python -m pytest`, `python3 -m pytest`, `python -m unittest`, `go test`, `cargo test`, `rspec`, `rake test`, `bun test`, `deno test`.
- **Node test/probe scripts**: `node -e ...` (inline eval) and `node <path>` where the path basename contains `test`/`probe`/`check`/`verify`/`spec`. Dev-server invocations (`node server`, `node ./server`, `node src/server`, etc.) are explicitly excluded so starting a dev server does NOT count as verification.
- **External curl/wget probes** (non-localhost): require a port (`:NNNN`) or http(s)://host/path to count as verification intent. Bare `curl https://example.com` does not clear; `curl https://example.com:9224/health` does.
- **Reads of /tmp/ stdout-capture files**: Read tool on `/tmp/*` or `/private/tmp/*` whose basename contains `test`/`probe`/`verify`/`check`/`spec`/`stdout`/`stderr`/`output`/`.log`/`server.log` clears the flag.

Smoke-tested all 9 representative inputs - 7 expected-clear cases all cleared, 2 expected-stay-set (read-only `ls`, code Write) stayed set. Output matches before/after intent.

### Task 2 - memory-nudge Read matcher (REPORT-ONLY, no edit)

The wiring lives in **installed** settings.json (`~/.claude/settings.json`), NOT in the repo's `claude/settings.json` (the repo file has no PostToolUse hooks block at all - that's a drift I flagged in the report below). 

- Current matcher (`~/.claude/settings.json`, line 183): `"matcher": "Write|Edit|MultiEdit|Bash|Read"`
- Proposed matcher: `"matcher": "Write|Edit|MultiEdit|Bash"`
- This affects BOTH `memory-nudge.sh` AND `verify-before-done.sh` (they share the same matcher block, lines 181-196). `verify-before-done.sh` self-handles Read (only clears on .png, no nag emitted), so dropping Read from the shared matcher is still safe for it - it just won't fire on Reads at all.
- No script change needed to `memory-nudge.sh`. Pure wiring fix.

### Unexpected findings

1. **The repo's `claude/settings.json` does NOT contain the PostToolUse memory-nudge / verify-before-done wiring.** That entire block exists only in `~/.claude/settings.json`. So the source-vs-installed drift identified in reflection finding #5 is concrete here: the installed copy has hooks the repo doesn't. The orchestrator will need to either (a) edit installed settings.json directly, or (b) reconcile by adding the PostToolUse block to repo settings.json first.
2. **`memory-nudge.sh` shares its matcher with `verify-before-done.sh`** in a single hooks array. Dropping Read from the matcher drops it for both, which is what we want - `verify-before-done` doesn't usefully fire on Read either (it self-gates).
3. **The python -c block in the hook is single-quoted in bash**, so any literal `'` in the python code breaks the shell parse. First edit attempt had this bug; fixed with `chr(39)` substitution. Future hook editors: keep this in mind.

## Why

Per reflection finding #2: server-only edits (e.g. `improv/server/ws-server.ts`) set the `.needs-verification` flag but had no honest clearing path - UI-shaped clearers only. The hook was training screenshot theatre or stalling commits. Now external probes, test runs, and stdout-capture Reads all clear the flag honestly.

Per reflection finding #1: memory-nudge firing on Read produced 7+ false-positive "dirty state" nags during the very task that fixes it. The Read matcher is wrong - reading a file does not change anything.

## How

- Replaced `is_verification_command` with a regex-based token matcher for the runner list, with a node-script heuristic that excludes dev-server patterns.
- Extended the Read handler to clear on /tmp/ capture-file basenames.
- Used `chr(39)` to avoid literal `'` in single-quoted python heredoc.
- Smoke-tested with 9 cases via stdin-piped JSON to the script.

## Files touched

- `claude/hooks/verify-before-done.sh` (extended docstring + `is_verification_command` + Read handler)

## Collaborator

Jonah
