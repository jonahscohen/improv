---
name: Phase 3a lead acceptance - runnable-detector verified, test-isolation flake fixed, ReDoS residual under review
description: Lead verification of phase3a-detector's runnable-detector (data-driven patternSpec interpreter): read the security core, fixed a non-hermetic dry-run test the concurrent miner exposed, flagged the ambiguous-alternation ReDoS residual to Codex
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: read the two new security files; miner suite 60/60 UNPINNED after the isolation fix; pinned full + Codex in flight
relates_to: [session_2026-08-24_phase3-design.md, session_2026-08-24_phase3a-runnable-detector.md]
---

phase3a-detector delivered Phase 3a (steps 1-4 of the Phase 3 plan): the RUNNABLE-detector machinery, ADVISORY only (no mined rule becomes blocking). Lead verification:

READ THE SECURITY CORE MYSELF (not rubber-stamped):
- src/validators/pattern-spec.ts: types + FIXED numeric-predicate allowlist (cubic-bezier-overshoot, font-family-count, min-source-lines - OUR code, candidate only names one + threshold) + the STATIC ReDoS screen (screenRegexSource) + compileGuarded + screenPatternSpec (miner reuse). Sound: rejects nested unbounded quantifiers/star-height>=2, backrefs, over-long/over-complex; handles char classes, escapes, (?:/(?=/(?<name> prefixes, {n,m} forms.
- src/validators/checks/pattern-interpreter.ts: interpretPatternSpec CheckFn, fail-closed at EVERY gap (unknown engine/predicateId, unsafe/invalid regex, missing evidence -> inconclusive; no defect -> pass; empty applicability -> notApplicable). Input capped MAX_SCAN_LEN. No authored code executed - only regex DATA compiled + allowlisted predicates selected by id. Structural inertness preserved (pattern-spec.ts is a leaf).

TEST-ISOLATION FLAKE FIXED (the concurrent process exposed a real latent bug): the runPipeline dry-run over findings-representative.json (sidecoach-mine.test.js:184) read the REAL, mutable data/audit-history.jsonl, so the concurrent scheduled miner growing it crossed rules' fire thresholds and inflated strengthenExisting 1->3. Pinned SIDECOACH_AUDIT_HISTORY to a nonexistent file for that block -> hermetic (fixture-only counts). Proven: miner suite now 60/60 UNPINNED (was failing 1 unpinned).

REDOS RESIDUAL (flagged by the executor, under Codex review NOW): the screen is STATIC (no re2 installed, sync CheckFn can't be pre-empted in-process). It catches the nested-quantifier family but NOT ambiguous-alternation ReDoS like (a|a)*, bounded only by the 200k input cap - which does NOT bound a ~40-char (a|a)* on a crafted input. The interpreter runs in the write-gate on every .html/.css edit, so a ReDoS spec would hang the gate (a DoS on the user's own editing, even at the advisory tier). NOTE: not yet LIVE-exploitable in Phase 3a (no mined patternSpec rule is promoted to a live RULES entry yet), but the machinery must be sound before any patternSpec rule goes live. Awaiting Codex's mitigation rec (worker-thread hard timeout vs re2 dependency vs stronger screen); will implement per "no cut corners" before accepting.

CODEX ROUND (Phase 3a) verdict: HIGH ambiguous-alternation ReDoS CONFIRMED exploitable (^(a|aa)*$ on "a"*40+"b" exceeded a 3s child timeout; MAX_SCAN_LEN does not bound it - needs tens of bytes). LOW: malformed flags (123 / unsupported char) sanitized to '' instead of rejected -> loses case-insensitivity -> false pass. Confirmed good: no code execution, nested-quantifier screen sound, miner files preflight errors, inertness holds.

FOLDS (phase3a-detector, both done + 188/188 green):
- ReDoS: re2 (linear-time engine) added as an OPTIONAL dependency; compileGuarded compiles UNTRUSTED regexes via re2, FAIL-CLOSED (re2 unavailable OR SIDECOACH_DISABLE_RE2 seam OR bad syntax => error => interpreter inconclusive, never a native-RegExp fallback). execCapped = capped global re2 exec loop w/ zero-width guard. Interpreter builds NO native RegExp from candidate source (applicability .test, defect scan + locate via execCapped; OUR predicate regexes stay native). screenRegexSource downgraded to preflight diagnostic. re2 rejects lookaround/backrefs (fail-closed; static tells don't need them). Verified: ^(a|aa)*$ and (a+)+$ on huge inputs return bounded verdicts under an 8s hard-timeout child (re2 ~0ms); re2-disabled seam => inconclusive.
- flags: validateFlags REJECTS non-string / out-of-allowlist / duplicate flags (error, filed/inconclusive), never a silent drop.
I read the re2 integration myself (loadRe2/validateFlags/compileGuarded/execCapped) - correct + fail-closed.

FINAL Codex confirm of the fold: Fold 1 (ReDoS via re2) CLEAN - candidate regex flow goes through compileGuarded/re2 for applicability + defect scan + location; no native new RegExp from candidate source; re2-unavailable => inconclusive; lookaround/backref rejection fail-closes. Fold 2 had ONE residual (Low): validateFlags(null) returned {flags:''} instead of rejecting (a supplied non-string) -> a null-flag false pass. FIXED (fold 2b, my 1-line change): validateFlags now rejects null (only undefined/'' = genuinely no flags). Verified against DIST at runtime: null -> REJECT, undefined -> ok. Inertness holds.

ACCEPTED + COMMITTED. Final pinned full suite = 188 suites passed with the null fix compiled into dist (confirmed the compiled validateFlags rejects null). Phase 3a is ADVISORY-only (no mined rule blocks). Committed the 45-file Phase 3a set (code + tests + fixtures + re2 optionalDependency + rebuilt dist + tools.md + beats), EXCLUDING the concurrent process's sidecoach/data/* and sidecoach/.claude/memory/ churn. Not pushed (Jonah: keep it local). phase3a-detector stood down.

NEXT: Phase 3b (steps 5-7 of the Phase 3 design): the held-out PRECISION harness (P>=0.90 + minimum-denominator REFUSAL, shared negatives not synthetic-only), the SECOND human-signed enforce gate (sidecoach-taste-enforce CLI + enforce-confirm arm hook + separate enforcement-ledger.jsonl with its own HMAC chain), and the runtime invariant test (every blocking mined-taste rule must have a ledger entry + passing precision record). This is the tier that lets a proven rule actually BLOCK - the security-critical half, like the promote gate.

COORDINATION LESSON (mine): I ran a full `npm test` (bczszouie) while phase3a-detector was mid-edit on the same tree -> it compiled half-written code -> 9 spurious suite failures (TS2339 in pattern-interpreter.ts). NOT a regression. Rule: never run a competing build while a teammate is editing the same working tree; serialize on their "standing by".
