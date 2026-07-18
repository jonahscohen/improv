---
name: verify-before-done flag SESSION-KEYED + nudge reigned in (the real all-projects fix)
description: The verify flag was ONE global file leaking across every concurrent session/project; keyed it per-session across all 6 consumers and throttled the per-edit nudge to once-per-episode
type: project
relates_to: [session_2026-07-17_verify-hook-message-matches-flag.md, feedback_hooks_prefer_false_positives.md, decision_hook_system_architecture.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (6 suites green 11/93/51/148/15/11) + live E2E probe across all 6 consumers + Codex review (2 findings folded)
confidence: high
---

Jonah, 2026-07-18 (furious): "fix verify-before-done.sh NOW. been fucking up all projects for the past couple of days. delaying work and making a mess."

## Root cause (why yesterday's fix did NOT fix it)

Yesterday (2026-07-17, [[session_2026-07-17_verify-hook-message-matches-flag]], commit 84432079) responded to "reign that hook in" by changing ONLY the nudge WORDING. That beat literally says "ARMING IS UNCHANGED." So the two things that actually hurt were never touched:

1. **The flag was ONE GLOBAL file** `~/.claude/.needs-verification`, NOT session-keyed. Its sibling gates were already keyed (`.memory-dirty.<session>` on 2026-07-17, `.screenshot-pending.<session>`), but this one was left global. So a `.css` edit in project A armed "visual" globally, it only clears on a screenshot, and then a commit of front-end files in project B (or any concurrent cmux pane) got BLOCKED by bash-guard. THAT is "fucking up all projects." The stuck flag was armed on this box right now (05:04, "visual") from an unrelated edit.
2. **The per-edit nudge fired on every code edit in every project** (.ts/.py/.go/.sh/...), a wall of "You MUST verify" text after each one. That is "bothering everyone / making a mess." Proven live twice this session: the hook fired "CODE DEPLOYED. Take a screenshot" on a pure `grep`/`sed`/`echo` diagnostic (a literal `->` arrow matched the `"> "` redirect indicator, then `.tsx`/`.css` substrings in filenames armed visual).

Jonah ruled (AskUserQuestion): reign in surgically - keep the commit-time UI gate, kill the leak and the nag.

## The fix

**A. Session-key the flag across ALL 6 consumers** (`~/.claude/.needs-verification` -> `~/.claude/.needs-verification.<session_id>`). All-or-nothing: bash-guard warns that if a writer and a reader disagree on the path the gate FAILS OPEN. Every consumer now derives the key with the byte-identical sanitizer `re.sub(r"[^A-Za-z0-9._-]","_", session_id) or "global"` (matching bash-guard's existing `_SESSION_KEY`):
- verify-before-done.sh (arm/read/clear) - keyed the single `verify_flag =` line (all uses flow through it)
- verify-before-done-stop.sh (Stop block) - added `import re`, keyed
- verify-clear.sh (chrome-screenshot clear) - added `import re`, keyed
- verify-manual.sh ("verified" clear) - bash, derives key from the prompt payload
- second-fix-gate.sh (reads flag as a precondition) - keyed (already imported re)
- bash-guard.sh (commit block, line 1584) - used the existing `$_SESSION_KEY`

**B. Once-per-episode nudge** (verify-before-done.sh, both emit sites - arm_and_report and the Write/Edit branch): capture `prev = flag_content()` before `set_flag`, emit the additionalContext ONLY when `flag_content() != prev`. So the FIRST edit that arms (or a code->visual UPGRADE) nudges; every later edit while already armed is SILENT. `set_flag` is untouched, so the flag still arms identically and the Stop hook + commit gate (the real teeth) fire exactly as before. Recall preserved by construction; only the repeat nag is dropped.

**C. Cleared the stuck orphaned global flag** and this session's false-armed flag (armed "visual" by test/probe Bash token-matching, zero rendered UI changed).

## Verification (proven, not claimed)

- Baseline green FIRST, then all 5 suites green after: test-verify-before-done 93, test-nudge-debounce 51 (was 46; +5 reign-in rows), test-bash-guard-commit 148 (incl. NEW cross-session isolation block), test-verify-visual-gate 15, test-second-fix-gate 11.
- Live E2E probe with real session ids: (1) SID1 edit writes ONLY `.sess-one`, `.sess-two` absent; (2) cross-session STOP - SID1 blocks on its own debt, SID2 ALLOWS (the leak is closed); (3) once-per-episode - 1st nudged, 2nd SILENT, flag still visual; (4) verify-manual clears only SID1; (5) verify-clear screenshot clears the keyed flag.
- Codex cross-model review (gpt-5.5, high effort) run on the diff; findings folded (see below).

## Tests added/changed

- test-bash-guard-commit.sh: NEW "gate 2 CROSS-SESSION ISOLATION" block (session A armed -> B commit ALLOWED, A commit still BLOCKED). Paired both directions so a neutered gate cannot pass.
- test-nudge-debounce.sh: reworked sticky-visual to assert the FLAG stays visual (the real invariant) not the repeated nudge; +5 reign-in rows (first arms nudges, second silent, flag still armed, code->visual upgrade re-nudges).
- test-verify-before-done.sh: assert_fires now resets the flag per-case (once-per-episode makes arming stateful) + end-of-suite cleanup. All flag refs -> `.global` bucket.
- test-verify-visual-gate.sh, _tests/test-second-fix-gate.sh: flag refs -> `.global` (payloads carry no session_id).

## Self-analysis (mid-edit failure I caused)

My FIRST edit to verify-before-done.sh broke the hook: I wrote a comment containing "bash-guard's" - the apostrophe closed the `python3 -c '...'` single-quoted shell string, syntax error on a LIVE symlinked hook. Root cause: I know this file deliberately uses `chr(39)` to avoid literal single quotes, yet I dropped an apostrophe into a comment without checking the quoting constraint. Signal missed: "am I writing inside a single-quoted shell block?" is a pre-write check I skipped. Fix was immediate (rewrote apostrophe-free) and I added a note in the comment itself warning future edits. Lesson pinned: any text added inside a `python3 -c '...'` hook block must be apostrophe-free.

## Why this shape (vs alternatives)

- NOT "disable the hook" / NOT "nudge-only, never block": Jonah chose surgical reign-in - the commit-time UI gate has real value; only the global leak + the constant nag are the pain.
- NOT staleness-expiry on the flag: session-keying is the codebase's own established pattern (`.memory-dirty`, `.screenshot-pending`), correct rather than hacky, and closes concurrent-session leakage that expiry cannot.
- The `"global"` fallback bucket is what makes the test suites safe against the real $HOME: session-less test payloads land on `.global`, which no live (UUID-keyed) session reads.

## Codex cross-model review - 2 findings folded (both legit)

1. **HIGH: bash-guard key NOT byte-identical.** bash-guard used `str(get("session_id",""))`; the six flag consumers use `str(... or "")`. For `{"session_id": null}` bash-guard read `.needs-verification.None` while the writers wrote `.global` - the exact writer/reader path split that FAILS the gate OPEN. Real sessions always send a UUID so it cannot fire today, but byte-identical derivation is the whole correctness basis, and bash-guard's own comment says missing/empty -> "global". Fix: add `or ""` to bash-guard's `_SESSION_KEY` derivation. Proven with a matrix: writer==guard for None/""/0/False/UUID/slash. (This also aligns the shared `_SESSION_KEY` used by `.memory-dirty` and `.screenshot-pending`.)
2. **MEDIUM: the cross-session test hand-CREATED the flag** instead of arming through the real writer, so it could not catch a writer/reader key mismatch. Fix: NEW `test-verify-session-isolation.sh` (11 assertions) - arms via the real verify-before-done.sh with session=alpha, then proves stop + bash-guard + verify-clear + verify-manual + second-fix-gate all act on that SAME keyed file, and that session=beta sees NONE of it. This test would have caught the null/falsy mismatch.

Codex "No Finding" confirmed: no live unkeyed reader/clearer remained (old refs were stale comments / a `.bak` / an unused var); once-per-episode preserves arming; python3 -c quoting clean; `bash -n` passes.

## Self-analysis #2 (a real bug I hit writing the new test)

`test-verify-session-isolation.sh` failed on the stop-hook assertion and I spent several cycles on it. The hook was PROVEN correct the whole time (raw output blocked); the bug was in the TEST: `"$(stop "{\"a\":1,\"b\":2}")"` let bash BRACE-EXPAND the inline `{a,b,c}` JSON (the outer quotes were consumed by the nested command substitution), splitting the payload so the hook got garbage -> json.load failed -> `{}` -> allow. It only bit the two `$(stop "...")` sites; every other consumer takes a direct call or a variable. Root cause: I inlined escaped-quote JSON inside a nested command substitution. Fix + lesson pinned: build JSON payloads as VARIABLES and pass `"$var"` - brace expansion never applies to a variable-expansion result. Debugging win: I followed the protocol (reproduce success first) - a standalone repro blocked, which correctly told me the bug was in the test harness, not the hook, and stopped me from "fixing" a hook that was never broken.

## Files touched

- claude/hooks/verify-before-done.sh, verify-before-done-stop.sh, verify-clear.sh, verify-manual.sh, second-fix-gate.sh, bash-guard.sh
- claude/hooks/test-verify-before-done.sh, test-nudge-debounce.sh, test-bash-guard-commit.sh, test-verify-visual-gate.sh, _tests/test-second-fix-gate.sh
- claude/hooks/test-verify-session-isolation.sh (NEW - end-to-end cross-consumer agreement + isolation, folds Codex Medium)
