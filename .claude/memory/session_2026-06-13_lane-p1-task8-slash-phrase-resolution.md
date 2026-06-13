---
name: Lane P1 Task 8 - /sidecoach phrase resolution union + near-miss suggester
description: Added resolveSidecoachPhrase (ROUTE/CLASSIFY/OUT_OF_SCOPE/UNKNOWN) + a NET-NEW Levenshtein near-miss suggester to slash-command-router.ts. Took the plan's FALLBACK (duplicate classifier into engine lane-classifier.ts) because tsc TS6059 blocks the cross-package re-export. All 3 classifier copies guarded by the parity corpus.
type: decision
relates_to: [session_2026-06-13_lane-p1-task7-ts-mirror-parity.md]
---

Collaborator: Jonah

Implemented **Task 8 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 4 engine files.

## Cross-package decision (the key call) - took the plan's FALLBACK

The plan's main path (Step 1) was: move the classifier core into `sidecoach/src/lane-classifier.ts` and make `keyword-resolver.ts` (mcp-server) re-export it via `export * from '../../src/lane-classifier'`.

**Alternatives considered:**
- Canonical single module (mcp re-exports from engine): rejected.
- Duplicate the core into the engine + guard with the parity corpus (the plan's fallback): CHOSEN.

**Why the fallback:** I probed empirically. The cross-package import (`mcp-server/src` importing `../../src`) RESOLVES + type-checks under `ts-node`, BUT `tsc` (which mcp-server's `build` script runs: `"build": "tsc && chmod +x dist/index.js"`) REJECTS it with **TS6059** ("File '.../sidecoach/src/...' is not under 'rootDir' '.../mcp-server/src'"). Both packages have `rootDir: ./src` + isolated `include`. So the canonical path would break `npm run build` in mcp-server. The team lead pre-authorized the fallback for exactly this case.

**How:** created `sidecoach/src/lane-classifier.ts` as a full copy of the keyword-resolver lane block (identical function bodies, same laneSanitize/laneIsInformational names). `keyword-resolver.ts` is UNCHANGED (keeps its Task 7 copy). The engine's slash-command-router imports `{ loadRegistry, evaluateLane }` from `./lane-classifier` (engine-local, no cross-package). To guard the new third copy, added `sidecoach/src/__tests__/classifier-parity.test.ts` that runs the ENGINE classifyIntent against the SAME shared corpus -> all three copies (engine TS, mcp TS, Python) are proven decision-identical and cannot drift.

**Revisit when:** if the repo adopts a shared workspace package or tsconfig path-mapping so both packages can import one module within-rootDir, collapse the duplicate back to canonical (Step 1) and delete the engine copy + its parity test.

## resolveSidecoachPhrase (spec section 10)

Union ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN:
- known verb/phase-command first token -> ROUTE {command} (typed command wins outright).
- free phrase: evaluateLane all lanes. Under explicit address, SCOPE_UNKNOWN (no negatives) counts as routable -> route-grade (score>=route_floor && margin>=route_margin) -> ROUTE else CLASSIFY.
- positive negative evidence (OUT_OF_SCOPE lane, no routable evidence) -> OUT_OF_SCOPE + one-line redirect.
- no lane evidence at all -> UNKNOWN + a NET-NEW near-miss suggestion (Levenshtein over verb keys + SLASH_COMMANDS keys + lane labels, <=2 edits -> "did you mean /sidecoach <closest>?"; else undefined).
NET-NEW machinery (none existed before, verified): firstToken, knownCommandNames, matchKnownCommand, levenshtein (two-row), nearMissSuggestion. parseSlashCommand is UNCHANGED (wiring resolveSidecoachPhrase into it is not in Task 8 scope).

## Verification (Step 0 anchors all confirmed live)

- parseSlashCommand entry, getVerbEntry/VERB_REGISTRY imported, SLASH_COMMANDS module const, unknown branch returns {isCommand:false, reason:'Unknown command: /<cmd>'}, no pre-existing near-miss. All confirmed.
- TDD: slash-phrase.test.ts failed first with TS2305 (resolveSidecoachPhrase not exported) - right reason; passes after impl ("slash-phrase: OK").
- Adversarial (verified directly, suggestion STRING asserted): "polsih button" -> UNKNOWN, suggestion "did you mean /sidecoach polish?"; "build the API from scratch" -> OUT_OF_SCOPE + redirect; "make this production-ready" -> ROUTE lane_ship (proceeds under explicit address); "foo" -> UNKNOWN, no suggestion/lane/command (typo never becomes a route/interview).
- engine classifier-parity: 19 cases OK; mcp-server classifier-parity: 19 cases OK; python parity: 19; python classifier suite: 35/35. All three classifier copies + Python agree.
- tsc --noEmit on the engine: no errors in lane-classifier.ts or slash-command-router.ts.
- model-router-guard: pure regex/logic, no LLM/network.

## Files touched

- sidecoach/src/lane-classifier.ts (new - engine classifier copy)
- sidecoach/src/slash-command-router.ts (modified - +resolveSidecoachPhrase + near-miss helpers + lane-classifier import)
- sidecoach/src/__tests__/slash-phrase.test.ts (new)
- sidecoach/src/__tests__/classifier-parity.test.ts (new - engine parity guard for the duplicated copy)
