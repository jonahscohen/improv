---
name: Sidecoach Stage 3b - real detect hook path
description: claude/hooks/sidecoach-detect.sh advisory PostToolUse wrapper over the Stage 3a detect CLI, honest count + fail-open decision
type: project
relates_to: [session_2026-07-23_sidecoach-detect-cli-stage3a.md, session_2026-07-23_sidecoach-upgrade-plan.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests / codex-review
confidence: high
---

Stage 3b SHIPPED (not committed): `claude/hooks/sidecoach-detect.sh` + `claude/hooks/test-sidecoach-detect.sh`. Productizes the Stage 3a `sidecoach/bin/sidecoach-detect.js` CLI as a harness hook - the REAL scanner path, replacing the fake hook that was removed for reporting a false clean.

**The load-bearing split: honest COUNT, permissive DECISION.**
- Count is the CLI's fail-closed verdict. A scan that did not run is `inconclusive`, NEVER `clean`. The hook never fabricates a clean.
- Decision is fail-OPEN. Only CLI exit 0 (verdict clean) is silent (`{}`). Every other outcome - findings (exit 1), inconclusive render (exit 3), load/IO error (exit 2), timeout, missing build, missing CLI, unparseable stdout - surfaces as an EXPLICIT not-clean advisory via `hookSpecificOutput.additionalContext`, and the hook ALWAYS exits 0. Advisory only: reports to context, never auto-fixes, never blocks the edit.
- This is exactly the bug the removed fake hook had: it conflated "could not scan" with "clean". Here, silence can only ever mean a scan really ran and really found nothing.

**Why (design rationale):**
- Advisory-not-block: a PostToolUse hook that blocked on an inconclusive render would wedge unrelated edits every time Playwright hiccups. Fail-open decision keeps the harness usable; honest count keeps the report truthful. The two are independent axes and must not be blurred.
- Exit 0 always (not exit 2 for findings): PostToolUse exit 2 is the blocking signal in Claude Code. Findings therefore surface via `additionalContext` + exit 0, matching the existing `sidecoach-taste-gate.sh` advisory pattern. The "documented advisory code" is exit 0; the case distinction lives in the additionalContext payload.

**How (mechanics):**
- Reads the standard PostToolUse stdin envelope; acts only on Write|Edit|MultiEdit.
- Scope filter: local file must exist and carry a plausibly-UI extension (html/htm/css/scss/sass/less/tsx/jsx/vue/svelte/astro); anything else is skipped silently (CLI never invoked). `/node_modules/` paths skipped. An `http(s)://` target is forwarded to the CLI as a URL scan (the CLI is target-agnostic) - the normal edit path only ever passes local file paths, so the URL branch is inert in prod and is how the inconclusive verify check is exercised end to end.
- CLI resolution is SCRIPT-RELATIVE and portable: `os.path.realpath` on the hook's own path (follows the ~/.claude/hooks symlink into the repo), then `<repo>/sidecoach/bin/sidecoach-detect.js`. NO hardcoded home dir (the exact bug just fixed in SKILL.md). Overrides: `SIDECOACH_DETECT_CLI`, `SIDECOACH_DIR`. Tunables: `SIDECOACH_DETECT_TIMEOUT` (default 90s), `SIDECOACH_NODE`.
- Portable timeout via Python `subprocess.run(timeout=)` (macOS ships no coreutils `timeout`/`gtimeout`; confirmed absent). Logic lives in a `python3` heredoc off a thin bash stdin-reader, matching house style (`sidecoach-taste-gate.sh`, `api-drift-detector.sh`).

**Verify (all real, this session):**
- Empirically confirmed the CLI contract first: defect .html -> exit 1 verdict blocked; clean .html -> exit 0 verdict clean; `http://127.0.0.1:1` -> exit 3 verdict inconclusive (fails fast, net::ERR_UNSAFE_PORT, ~1s).
- `bash claude/hooks/test-sidecoach-detect.sh` = 34 passed, 0 failed, exit 0. Two tiers: STUB tier (node stub stands in for the CLI via SIDECOACH_DETECT_CLI, covers the 0/1/2/3 + malformed translation matrix, engine-independent, includes the explicit "inconclusive output != clean {}" assertion) and LIVE tier (real CLI over the real known-defect + known-good fixtures + the unroutable URL; skips loudly if sidecoach/dist is unbuilt).
- The 5 plan/spec verify checks pass: (1) defect fixture -> advisory names gradient-text, exit 0; (2) clean fixture -> silent {}, exit 0; (3) unroutable URL -> exit 0 + INCONCLUSIVE, not clean, not block (real CLI independently confirmed exit 3); (4) .md -> silent {}, exit 0; (5) the test itself passes asserting both exit code AND inconclusive-distinct-from-clean.

**Constraints honored:** touched ONLY `claude/hooks/` (new script + test); did NOT modify the CLI, sidecoach/src, eval, package.json, or any other hook (three teammates editing sidecoach/ concurrently). NOT auto-registered into settings.json - registration left to Jonah (see registration note in the report / test header).

**Codex cross-model review** (deterministic wrapper `~/.claude/hooks/codex-review.py`, real Codex gpt-5.5, 106.4s, exit 0). Confirmed the two load-bearing positives: CLI path resolution is portable (realpath, no hardcoded home), and 2/3/timeout/missing-CLI/missing-node all emit advisory + exit 0 with no blocking decision. 6 findings; folds:
- P1 (fixed) - malformed-but-JSON findings on exit 1 (`findings: null` / string / non-dict items) crashed the hook -> non-zero exit -> would break fail-open. Normalized `findings` to a list-of-dicts; exit 1 never crashes and never collapses into a clean silence. Regression stub added.
- P2 (fixed) - non-list `unavailableReasons` (e.g. `123`) crashed `reasons_from` the same way. Guarded to a list. Regression stub added.
- P2 (fixed) - python3 missing exited non-zero before any advisory. Added a bash-level guard that emits a not-clean advisory and exits 0 (preserves BOTH invariants; strictly better than a raw 127). Proven live by running the hook under a PATH with no python3.
- P2 (fixed) - the TEST computed its own paths without following symlinks (unlike the hook); running it through a `~/.claude/hooks` symlink would resolve the CLI wrong. Now realpath-resolves `$0`.
- P1/P2 (evaluated, NOT changed - defended) - Codex read the scope-skip silences (non-UI ext, non-edit tool, no file on disk, node_modules) as false cleans. They are not: the scanner is never invoked, so nothing is being certified - a not-in-scope skip is categorically different from a scan that ran and could not certify (which IS surfaced as not-clean). Non-UI-silent is also an explicit spec requirement; converting scope-skips to advisories would both violate the spec and spam context on every non-UI edit. Strengthened the code comments to make the distinction explicit rather than change behavior. (Prior teammate beat noted this Codex reviewer can over-flag; evaluated critically, folded the four real robustness bugs, held the two that would regress the spec.)

Re-verified after folding: `bash claude/hooks/test-sidecoach-detect.sh` = 38 passed, 0 failed (was 34; +4 malformed-payload / crash-class regressions). All 5 spec verify checks still pass.

**Registration note (left to Jonah, deliberately NOT auto-registered):** to activate, add a PostToolUse hook in settings.json matching `Write|Edit|MultiEdit` that runs `claude/hooks/sidecoach-detect.sh` (deployed at `~/.claude/hooks/sidecoach-detect.sh`). It reads the standard PostToolUse stdin envelope and is advisory (always exit 0). Tunables: SIDECOACH_DETECT_TIMEOUT (default 90s), SIDECOACH_NODE, SIDECOACH_DETECT_CLI / SIDECOACH_DIR overrides. Not registered mid-session because arming a live PostToolUse hook could disrupt the running session.

Files touched:
- claude/hooks/sidecoach-detect.sh (new)
- claude/hooks/test-sidecoach-detect.sh (new)
