---
name: CC feature-tracker BUILT (learning-researcher Phase 2)
description: Propose-only Claude Code feature-tracker on the shared scheduled-research spine - version-diff precheck + untrusted-fenced fetch + inert proposal engine + launchd job. Never edits the harness.
type: project
relates_to: [session_2026-08-23_cc-feature-tracker-design.md, session_2026-08-23_learning-researcher-framework-plan.md, session_2026-08-23_scheduled-research-runner-built.md, session_2026-08-23_taste-miner-built.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (test-cc-tracker.sh 32/0) + live npm precheck + codex cross-model review
confidence: high
---

# CC feature-tracker built (Phase 2, propose-only, human-gated)

Collaborator: Jonah. Built as a teammate on the committed foundation (bddbea14 / cdb530f2),
relayed to team-lead. Implements session_2026-08-23_cc-feature-tracker-design.md exactly on the
shared runner claude/hooks/lib/scheduled-research-run.sh. DISCOVERS + PROPOSES autonomously;
NEVER edits the harness.

## What was built

- **Engine** `claude/hooks/lib/cc-tracker.py` (self-contained python3 stdlib, explicit exit-code
  contract 0/2/4/5/6/70). Subcommands: `precheck` (version-diff run/skip gate for SRR_PRECHECK_CMD;
  prints run/skip, exit 0; fetch/corrupt-cursor -> NON-ZERO so the runner fails loud, never a
  silent skip; on "run" records the resolved latest into `<cursor>.pending`), `resolve-latest`,
  `advance-cursor` (SRR_ADVANCE_CMD; pending -> cursor, falls back to fresh resolve), `fetch`
  (fetch CHANGELOG+npm as UNTRUSTED DATA -> untrusted-fenced delta + version map + heuristic
  first-pass inventory skeleton), `propose` (flow's typed inventory JSON -> one inert
  `<version>-<slug>.md` per opportunity + a `proposal_cc-features_<date>.md` queue beat; refuses
  any write target outside the quarantine + beats dir), `harness-surfaces` (read-only inventory).
- **Wrapper** `claude/hooks/cc-tracker-daily.sh` - THIN, exports SRR_* and execs the shared runner
  (prefers the deployed lib, falls back to the repo copy). SRR_PROMPT points a headless
  `claude -p` at the flow doc.
- **Flow doc** `claude/docs/cc-track-flow.md` - the /cc-track flow (fetch -> comprehend ->
  opportunity-map additive+redundancy -> propose), with the untrusted-data containment rules.
  Realized as a doc + directive, NOT a registered skill (avoids the skill-audit / component-browser
  surfaces); promoting it to a first-class /cc-track skill is a clean follow-up.
- **Plist** `claude/launchd/com.yesand.cc-tracker-daily.plist` - instantiated from the template
  (daily 03:00, RunAtLoad false, Background), this machine's paths; install.sh templates it for
  other machines. NOT bootstrapped (user's deploy step).
- **Quarantine** `claude/proposals/cc-tracker/` (README + 2 engine-written sample proposals: the
  Concise-output-style redundancy retire + the SessionEnd additive teardown) + the sample queue
  beat. Sample inventory fixture: `claude/hooks/lib/cc-tracker.sample.json`.
- **Test** `claude/hooks/test-cc-tracker.sh` - 32 fail-loud sandboxed assertions.

## Wiring (kept every gate green)

Why: `cc-tracker-daily` is a LAUNCHD-SCHEDULED runner, not a settings.json event hook, so the
`beats-reflect-weekly` precedent governs - NOT the general "wire it in browser-tree + app-wirings"
recipe. How: added `cc-tracker-daily) return 0 ;;` to hook-registry-guard.sh `_is_excluded`
(launchd-scheduled, no event to toggle); deployed via a bare `link_or_copy` in a new install.sh
14b block (wrapper + engine + shared runner lib) that also templates the plist for placement.
It is deliberately absent from browser-tree.json / app-wirings.json (there is no event to toggle -
the exact "tree offers a toggle nothing installs" anti-pattern the guard warns against). The
tool-index generator only indexes `sidecoach/bin/sidecoach-*`, so a hooks-tree engine does not
touch it. Coexists with the parallel cmux-tracker teammate (both exclusions + both install blocks
present; all gates green with both).

## Safety (3 fail-closed layers, verified)

STRUCTURAL: nothing imports/sources/execs `claude/proposals/cc-tracker/` content (the only
references are the runner's find-EXISTENCE success predicate, which reads mtime not content, and a
doc comment). HARNESS: the engine's `propose` refuses any write target outside the quarantine +
beats dir (exit 2), neutralizes crafted slugs/versions, and never touches hooks/settings/skills.
UNTRUSTED: CHANGELOG/npm text is fenced (fence longer than any inner backtick run) and never
followed as an instruction.

## Verification (proof)

- `test-cc-tracker.sh`: 32 passed, 0 failed.
- LIVE npm precheck: latest=2.1.241; cursor==latest -> skip (exit 0); cursor==2.1.100 -> run (exit 0).
- Sample proposal lands in the inert quarantine (engine's real code path).
- `bash -n` clean: wrapper, guard, install.sh, test. `plutil -lint` OK (this machine + a
  templated foreign-machine plist).
- Gates GREEN after edits: test-hook-registry 94/0, test-component-browser 147/0, harness-mirror
  45/0, installer-manifest PASS, install-hook-deploy PASS, install-skill-deploy PASS,
  deactivate-status PASS, hook-deploy-currency 15/0, `npm run build` exit 0.
- Codex cross-model review run on the diff (real codex-cli 0.142.5), ALL findings folded + re-verified.

## Codex findings folded (safety hardening)

Real Codex review surfaced 10 findings on the safety-critical paths; all folded, then the whole
unit re-verified (38/0). Critical: `--beats-dir` now contained under the repo (realpath) and
`--beat-date` validated as YYYY-MM-DD; the quarantine is now an EXACT symlink-safe realpath match
to `claude/proposals/cc-tracker` (a substring/symlink escape is refused). High: a cursor inside
the repo tree is refused (write-path-into-harness); `advance-cursor` FAILS LOUD (exit 6) instead
of re-resolving when `.pending` is missing (re-resolve could advance past an unfetched release);
`fetch` requires the npm latest to appear in the CHANGELOG (stale/disagreeing sources -> exit 5);
`_version_key` is now SemVer-correct (2.1.9 < 2.1.10, prerelease < release) and precheck runs ONLY
when latest > seen (a rollback skips, never advances backward). Medium: the wrapper now prefers
the REPO runner (version-consistent), the success predicate excludes README.md (a touch cannot
fake success), inventory versions are validated, and rendered fields are control-char-stripped.
Six new test assertions cover the new guards.

## Files touched

NEW: claude/hooks/lib/cc-tracker.py, claude/hooks/lib/cc-tracker.sample.json,
claude/hooks/cc-tracker-daily.sh, claude/hooks/test-cc-tracker.sh, claude/docs/cc-track-flow.md,
claude/launchd/com.yesand.cc-tracker-daily.plist, claude/proposals/cc-tracker/README.md +
2 sample proposals, .claude/memory/proposal_cc-features_2026-08-23.md.
EDIT: claude/hooks/hook-registry-guard.sh (exclusion), install.sh (14b deploy block).
