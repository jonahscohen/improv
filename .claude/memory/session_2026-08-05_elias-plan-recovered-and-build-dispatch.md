---
name: ELIAS plan recovered from transcript, build dispatched
description: The 2026-08-05-elias-mode.md plan was never saved to disk by its executor; recovered verbatim from the 319eeed3 transcript, restored, and handed to a build teammate
type: project
relates_to: [session_2026-08-05_frontier-guard-teammate-default-gap.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

**What ELIAS is:** "Explain Like I'm A Stakeholder" - a toggleable response MODE (default OFF, opt-in via `~/.claude/.elias-enabled`) that reshapes replies for a non-technical stakeholder (PM, account manager, director, client): outcome first, plain language, timeline/risk/cost stated, no code/paths/commands/identifiers. Built as a three-hook trio (`elias-mandate.sh`, `elias-toggle.sh`, `elias-detect-stop.sh`) modeled byte-for-byte on the existing `concise-*` grounding-cluster trio, with the marker polarity INVERTED (concise is default-ON via a DISABLE marker; ELIAS is default-OFF via an ENABLE marker).

**Recovery (2026-08-05):** The `elias-planner` teammate (see [[session_2026-08-05_frontier-guard-teammate-default-gap.md]]) produced a full 8-task plan and handed it to an `opus-executor` to write to `docs/superpowers/plans/2026-08-05-elias-mode.md`. That write never landed on disk - the plans dir had no elias file. Recovered the plan VERBATIM from the opus-executor spawn prompt embedded in transcript `319eeed3-802f-47bd-aca5-5e73b46aba13.jsonl` (the full file content was passed between `---BEGIN FILE CONTENT---`/`---END FILE CONTENT---`). Scanned clean (0 emdash, 0 emoji, 822 lines), restored to the canonical path. Stamp `821d51fd` matches current HEAD, so no plan drift - line numbers in the plan are trustworthy as-is.

**Plan shape (8 tasks):** T1-T3 create the three hooks; T4 makes concise + ELIAS compose (two surgical inserts into `concise-detect-stop.sh`: volume relaxation 300->400 word cap, and symmetric cross-gate deferral so exactly one Stop block lands per burst); T5 wires four files (cluster-wirings.json, install.sh:2193 grounding list, browser-tree.json x3 spots); T6 three new test suites + 5 cases added to test-concise-detect-stop.sh; T7 README count bumps (71->74 total, Guardrails 39->42, grounding 7->10) + concise-touchpoint sweep; T8 beats + Codex/independent-review gate. D5: enforcement ships in phase 1 but scoped to artifact SHAPE (fence/path/command/backticked-idents), NOT a jargon wordlist (deferred to phase 2 - a wordlist fires hardest on ruleset rule 4 compliance).

**Dispatch:** handed to a named build teammate to execute task-by-task per the plan's verify clauses; the plan mandates superpowers:subagent-driven-development / executing-plans and each task carries a runnable `-> verify:`.

**Lead independent verification (2026-08-05, post-build):** re-ran the gate myself, did NOT trust the builder's report. Confirmed green independently: HEAD still 821d51fd with NOTHING committed (all changes in working tree); 3 hooks present + `chmod +x`; R1 silent-when-off PASS and injects-when-on-with-event-threaded PASS (the load-bearing check); four suites elias-mandate 13/0, elias-toggle 27/0, elias-detect-stop 33/0, concise 50/0 (was 45, exactly +5 - the ELIAS-off regression contract holds); hook-registry-guard --audit + --audit-data rc0; cluster-wirings.json + browser-tree.json valid JSON; README 74 total / Guardrails 42 / grounding (10); builder's extra touchpoint install.sh:2037 "(10 grounding hooks)" confirmed fixed.

**One open decision surfaced to Jonah (Codex High finding, NOT yet resolved):** the concise + ELIAS burst flags are not atomic ACROSS the two Stop hooks. The plan's D2c/R2 cross-gate deferral assumes SEQUENTIAL Stop-hook execution ("whichever runs first owns the burst"); Claude Code's documented default runs same-event hooks in PARALLEL, so on the FIRST burst where both modes are on AND the reply violates both gates, both gates can read "no flag" simultaneously -> one DOUBLED block. Self-heals on retry (both flags then exist). Narrow trigger (ELIAS is opt-in; both must be on; reply must violate both). The robust fix (a single shared atomic claim file) breaks Jonah's explicit D6 "no shared library / no shared mechanism" constraint, so the builder correctly did NOT implement it. My recommendation: ACCEPT as a documented known-edge (benign + self-healing) rather than break D6. Also flagged: plan Section 11's `install.sh --dry-run --only config` verify clause is mislabeled (grounding resolves under --only grounding, and --dry-run prints component keys not hook names) - a plan-doc bug, packaging proven equivalent 3 other ways; not an impl gap.

**Committed + pushed (Jonah, 2026-08-05):** on Jonah's explicit "commit and push", staged everything and landed one commit on `main` (ELIAS trio + tests + composition edits + wiring + README + the plan doc + beats), pushed to origin. Per the commit-overcaution feedback, did NOT withhold parts or negotiate authorship - the pre-existing `cmux-claude-launch.sh` CLAUDE_CODE_SUBAGENT_MODEL fix and prior-session beats rode along in the same commit, noted in one line of the commit body.

**Files touched:** docs/superpowers/plans/2026-08-05-elias-mode.md (restored); build produced 6 hook files + 2 beats + edits to concise-detect-stop/test, cluster-wirings, browser-tree, install.sh, README (all committed).
