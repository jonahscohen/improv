---
name: Sidecoach "live" verb / lane_live / canvas mode COMPLETELY REMOVED
description: Jonah killed the Live Mode concept; scrubbed the live VERB, lane_live, canvas mode, and live.md skillRef from all product registries + docs, precision-preserving unrelated "live" language
type: project
relates_to: [session_2026-07-23_oracle-live-mode-demo.md, session_2026-07-23_oracle-v4-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (71 sidecoach suites + 297 mcp-server + 128 keyword-hook + 35 python-lane, all green)
confidence: high
---

Jonah ruled the "Live Mode" concept (element-pick -> in-browser variants, the oracle-rival axis explored in the two 2026-07-23 beats) is NOT what we want. COMPLETELY REMOVED the sidecoach `live` verb / lane / flow / mode from the product. NOT committed (team-lead reviews first).

**Why:** rival-axis fold decision reversed - Live Mode dropped entirely rather than partially adopted.

**How (precision scrub, no over-scrub):** enumerated every live-VERB identifier up front, removed, grep-verified 0 remain, and confirmed unrelated "live" language untouched.

REMOVED (live-verb identifiers):
- `verb-command-registry.ts` - the `live` verb def (+ its `${SKILL_REF}/live.md` skillRef; live.md never existed on disk - whole legacy-design-skill/reference dir is absent, so all skillRefPaths were already dangling). 22 -> 21 verbs.
- `modes.ts` - the entire CANVAS mode (its whole identity was "Live in-browser visual iteration"; verbChain led with `live`). 6 -> 5 modes.
- `sidecoach-lanes.json` - the `lane_live` block. 6 -> 5 lanes. (regenerates lanes.generated.ts/.md via `npm run build`)
- `sidecoach-verbs.json` (`live` verb) + `sidecoach-modes.json` (`canvas` mode) - the PARALLEL registries the mcp-server list-verbs/list-modes + the `sidecoach-keyword.sh` design-intent hook read. NOT in the lead's file list; found by grep - removing the verb from the engine but leaving it here = half-done.
- `sidecoach-orchestrator.ts` REFERENCE_PREFLIGHT_LANES (dropped lane_live; "all six"->"all five").
- Tests: lane-derivation.test.ts (GOLDEN+CHAINS lane_live), classifier-parity.test.ts (engine + mcp-server VERBS mirror), sprint8-registry-shape.test.ts (all22->all21, 22->21 assertion), sprint8-verb-parity comment, test_sidecoach_lanes.py (test_six->test_five lanes + VERBS mirror), test-sidecoach-keyword.sh (removed 6 now-moot `live` assertions).
- Routing golden re-captured (`routing-snapshot.mjs capture`): 23 decisions, lane_live gone from every laneScores array; NO winningLane changed (no corpus prompt ever won lane_live).
- Docs: SKILL.md (frontmatter trigger "live iteration" + 4 verb-list/count spots), CHEATSHEET.md (Section0 6->5 modes, canvas row, Tactical subsection, flowN verb cell -> (orchestrator-only), counts), sidecoach/README.md (22->21 x5 + Tactical:live), mcp-server README.md/DESIGN.md/list-lanes.ts/list-verbs.ts/get-cheatsheet.ts (lane lists + counts).

PRESERVED (precision - unrelated "live", verified still present): flowN_rapid_iteration_refined is a first-class flow reachable via `/sidecoach rapid`, `/sidecoach review`, and intent detection (iterate+round) - live was only ONE entry point; flowN + its Justify "LIVE BROWSER ITERATION" branch STAY. scanRenderedLive/rendered-live-scan (10), leaseIsLive/LIVE_OPERATIONS (4), aria-live (2), "live sources" (3), "lives inside"/"lived in" (14), slash-command-router `rapid` cmd desc "Live browser iteration with Justify" (the lead misidentified this as a `live` entry - it is the rapid/flowN Justify desc, correctly kept).

FLAGGED (not fixed): `sidecoach/mcp-server/__tests__/SMOKE_TRANSCRIPT.txt` is a git-tracked 8-line orphaned manual smoke snapshot (no test consumes it; grep found zero code refs) that still embeds stale lane_live + "22 verbs". Not hand-edited (JSON transcript, corruption risk) or regenerated (original request sequence unknown - can't reproduce faithfully). Recommend team-lead delete or regenerate. It is the ONE residual live string in the tracked tree. **LEAD: DELETED it** (git grep confirmed 0 code consumers - a true orphan); a fresh smoke snapshot can be regenerated on demand and would reflect 21 verbs / no lane_live.

NOT touched (historical records, intentionally): `.claude/memory/*` beats + `docs/superpowers/{plans,specs}/*` retain lane_live as dated records. CLAUDE.md needed NO edit - all its "live" refs are the adjective, no live-verb listing (lead asked to flag any CLAUDE.md edit; none was needed).

Baseline (before): 71 sidecoach suites + build GREEN. After: 71 sidecoach suites + build GREEN, 297 mcp-server, 128 keyword-hook, 35 python-lane, all GREEN. tsc clean (no dangling refs from removals). Independent Codex/cross-model review still owed before the lead commits.

Files: verb-command-registry.ts, modes.ts, sidecoach-orchestrator.ts, prove-references-fire.ts, sidecoach-lanes.json, sidecoach-verbs.json, sidecoach-modes.json, lanes.generated.ts, LANES.generated.md, routing/decisions.json, 4 engine test files, mcp-server {list-lanes,list-verbs,get-cheatsheet}.ts + README/DESIGN, test_sidecoach_lanes.py, test-sidecoach-keyword.sh, SKILL.md, CHEATSHEET.md, sidecoach/README.md (+ regenerated dist); LEAD also deleted mcp-server/__tests__/SMOKE_TRANSCRIPT.txt.

## Lead verification (independent, not trusting the teammate's counts)
Re-verified before accepting:
- GREP: `lane_live` = 0 in the tracked tree after deleting the orphan; live verb token = 0 in all 3 JSON registries; `canvas` MODE key = 0 in modes.json/modes.ts. The 12 remaining `canvas` hits are ALL unrelated (HTML `<canvas>` chart-a11y detection, the 2D-canvas CSS-Color-4 parser, "white/cream canvas" design vocabulary) - no over-scrub. Unrelated `live` preserved (scanRenderedLive/rendered-live-scan present).
- BUILD: `npm run build` clean - generate-lanes regenerated lanes.generated (lane_live gone), generate-validators --check OK (no drift), tsc clean (no dangling refs).
- TESTS: independently re-ran `npm test` -> **71 sidecoach suites passed, 0 failed**; all migration-harness goldens VERIFY OK, incl. the ROUTING golden (lane_live removal caused zero routing regression - the decisive check).
- Deleted the orphan SMOKE_TRANSCRIPT.txt (0 consumers).
- CODEX cross-model review run on the source diff (dist/maps excluded). Verdict: removal coherent, NO over-scrub (Codex independently confirmed the preserved uses), but 4 residual incomplete-removal findings - ALL FOLDED by the lead:
  - M1 (Medium): a SECOND parity test the teammate did not know about, `claude/hooks/test_classifier_parity.py`, still had `"live"` in its hand-built VERBS list -> removed (now matches the 21-verb registry; its 23-case corpus test passes).
  - M2 (Medium): stale "22 verbs" counts in mcp-server DESIGN.md/README.md, sidecoach-verbs.json source-comment, test-sidecoach-keyword.sh, and 3 orchestrator.ts comments -> all -> 21 (left the unrelated "22-Point Polish" and "T-0022" untouched).
  - L1 (Low): `canvas` still listed in the retired-mode-words text in SKILL.md + test-sidecoach-keyword.sh -> removed.
  - L2 (Low): orphaned `tactical` phase hint (no verb uses it after live's removal) in mcp-server schemas.ts + list-verbs.ts description strings -> removed; the stdio-transcript golden auto-regenerates on test run and came back clean.
- RE-VERIFIED after folding: sidecoach 71 + mcp-server 297 + keyword-hook 128 + python parity 36 (test_classifier_parity 1 / test_sidecoach_lanes 35), all GREEN; both tsc builds clean; `lane_live` = 0 across the whole tracked tree; guards (22-Point, T-0022, 21-verbs) intact. Not committed - regrouping with Jonah first.
