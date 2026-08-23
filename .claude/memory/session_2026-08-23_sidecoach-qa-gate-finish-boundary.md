---
name: Sidecoach QA-gate finish-boundary rung
description: New Stop hook blocks "done" on a substantive design change until the sidecoach QA gate (audit->critique->polish) provably ran; closes the one enforcement gap
type: project
relates_to: [decision_verify_hook_quoted_mention_arming.md, session_2026-08-20_artifact-announce-stop-hook.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Built the sidecoach QA-gate finish-boundary rung. Collaborator: Jonah.

## Grounding finding (what already existed)

Enforcement for design work was already mostly built, across three boundaries:

- Craft floor: an unconditional PreToolUse craft gate on design writes.
- Taste battery: `sidecoach-taste-gate.sh` (PostToolUse) fails CLOSED, running the
  detect engine's static + rendered lenses on the edited `.html`/`.css` under a
  DESIGN.md project.
- Orchestrator engagement: `sidecoach-orchestrate-edit.sh` (PostToolUse) injects the
  audit -> critique -> polish QA-gate directive on every substantive design edit and
  says "do not declare done until the gate is clear."
- Screenshot gate: `verify-before-done-stop.sh` (Stop) blocks "done" on an
  unverified VISUAL change until a real screenshot clears its flag.

## The one genuine gap

The orchestrate-edit QA-gate directive is a WRITE-time nudge. Nothing at Stop
verified it was honored, so the audit -> critique -> polish review could be silently
skipped (the tactical-polish-0/8 hole). There was a screenshot gate but no
"did the review actually run" gate.

## The fix (finish-boundary teeth)

- ARM (edited `sidecoach-orchestrate-edit.sh`): at the genuine-engagement point
  (after `touch_cooldown()`, past every `bail()`), also write
  `~/.claude/.needs-qa-gate.<SESSION_KEY>` containing the target basename.
  SESSION_KEY derivation is byte-identical to verify-before-done / verify-manual.
- GATE (new `sidecoach-qa-gate-stop.sh`, Stop): blocks "done" while that flag is
  armed unless it sees PROOF the gate ran this session since the arm - a sidecoach
  audit/critique/polish Skill tool_use (the un-gameable primary), or an assistant
  text block carrying the full gate signature (sidecoach/QA-gate marker + all three
  verbs + a findings/severity token). Clears instead when the tree provably holds no
  dirty design file (fail-closed tree-corroboration, DESIGN exts) or the user
  overrides. Full 4-layer anti-loop (stop_hook_active, once-per-burst
  `.qa-gate-blocked.<key>`, atomic noclobber claim, fail-open `trap 'exit 0' EXIT`).
  Cross-gate deferral: stays silent when verify-before-done-stop will block the same
  burst (its flag == 'visual' AND a visual file is dirty) so the two never
  double-block.
- OVERRIDE (new `qa-gate-manual.sh`, UserPromptSubmit): "qa done" / "qa gate done" /
  "skip qa" / "qa override" / "gate override" / "looks good" / "verified" as the
  whole message removes the flag. Mirrors verify-manual.sh.

**Why (escalation-ladder fork):** a twice-failed mandate that is NOT mechanizable at
the write boundary (you cannot force a multi-step review to run from a PostToolUse
hook) gets a finish-boundary ARTIFACT gate - block "done" until evidence the pass
ran - not more injected prose. This rung is the first instance. Documented in
claude/CLAUDE.md's Sidecoach mechanical-coverage paragraph.

**How (evidence, not mention):** the clear condition is deliberately hard to satisfy
by merely mentioning the words (a real Skill invocation, or a co-occurrence of all
three verbs with structure tokens, both timestamped after the flag mtime), and
deliberately cannot become a permanent trap (tree-clean and the user override are
always-available escapes).

## Registration

Live source of truth is `~/.claude/settings.json` (siblings register there). Added
`sidecoach-qa-gate-stop.sh` to Stop right after verify-before-done-stop.sh, and
`qa-gate-manual.sh` to UserPromptSubmit right after verify-manual.sh. JSON re-validated.
Both new hooks symlinked into `~/.claude/hooks/` (per-file symlink convention).

## Verified

- `bash -n` clean on all three scripts.
- Live demo (fake HOME + real dirty git repo): armed + dirty design + no evidence ->
  block; immediate second stop -> silent (anti-loop); QA Skill evidence -> clear +
  flag removed; "qa done" override -> flag removed; stop_hook_active -> silent; tree
  with no dirty design file -> clear; no armed flag -> silent. All passed.
- ARM live: a substantive Write of markup -> flag written with basename "landing.html";
  a trivial one-line edit -> no arm.
- qa-gate-qa teammate's suite `test-sidecoach-qa-gate-stop.sh` green.

## Cross-model review + folded findings

A different-model Codex review (deterministic wrapper `codex-review.py`, real Codex,
176s) surfaced 7 findings; 6 folded and re-verified, 1 flagged to the lead:

1. CRITICAL - text-fallback evidence did not require an ASSISTANT-authored entry, so
   the arm hook's own injected directive (which names sidecoach + audit->critique->
   polish + Critical/High/minor) could clear the gate on the next Stop with no QA
   run. Fix: `evidence_since` requires `type=="assistant"` and skips isSidechain/isMeta.
2. HIGH - prose fallback was satisfiable by a planning sentence. Fix: reject
   future/intent framing (`_INTENT_RE`) and require a completion-implying result
   token (`_RESULT_RE`) on top of marker + all-3-verbs.
3. HIGH - `scan_tree` used `decode("utf-8","replace")`, so an undecodable path never
   raised. Fix: strict `decode()`, exception -> fail closed. Unit-tested with stubbed
   non-UTF8 git output.
4. HIGH (NOT changed - raised to lead) - a single QA-verb Skill tool_use clears the
   whole three-stage gate. This is the SPEC's literal clear condition, so it stands;
   the design call (keep spec-literal vs require all three stages) belongs to the
   orchestrator.
5. MEDIUM - gate bash SESSION_KEY mapped "."/".." to "global" while arm/override did
   not (key drift). Fix: gate uses `re.sub(...) or "global"` identically; verified
   byte-identical across arm/gate/override for ".", "..", "", slashed, null.
6. MEDIUM - arm scope was broader than gate scope (arm on docs/*.test.* wrote a
   self-clearing flag). Fix: arm skips the same non-app paths the gate skips.
7. MEDIUM - naive (tz-less) timestamps were localized, so old evidence could clear a
   fresh flag. Fix: `parse_ts` rejects tz-naive stamps.

Independent same-context Claude review: teammate qa-gate-qa's falsification suite
`test-sidecoach-qa-gate-stop.sh` (55 cases) passes green against the hardened hook -
its SIDE-GAMING and ANTI-REPLAY sections independently corroborate fixes 1, 2, 7.

## Verifier findings + lead rulings folded (round 2)

Teammate qa-gate-qa's adversarial pass surfaced C/B/D; the lead ruled on those plus
Codex finding 4. All folded and re-verified (teammate suite now 65/65):

- C (HIGH) - lead ruling option (a): DROP the text-signature clear path ENTIRELY. A
  gate the agent can clear by writing "ran the gate, no findings" with zero tool calls
  is not a gate. Clears now ONLY via: an un-forgeable sidecoach Skill tool_use,
  fail-closed tree-clean, or the manual override. Removed `text_has_signature` and its
  regexes; `evidence_since` is Skill-tool_use-only.
- Finding 4 (lead) - REQUIRE ALL THREE stages: audit AND critique AND polish Skill
  tool_uses must all be present since the arm (order not enforced). A single verb no
  longer clears the gate - that was the polish-skip hole. `evidence_since` unions the
  verbs across Skill invocations and clears only on the full set.
- B (MEDIUM) - once-per-ARM, not once-per-session: the burst flag stores the arm-flag
  mtime it blocked on; a newer arm (a fresh substantive edit) supersedes it and
  re-blocks once. Content-compare, not the burst flag's own file mtime (which a
  future-dated arm defeats).
- D (LOW) - deferral now yields to verify-before-done on NV=='visual' AND (visual_dirty
  OR tree_uncertain), so a non-git / unreadable tree does not double-block. Guard
  preserved: qa-only (no visual flag) on a non-git tree still fail-closed blocks.

Both CLAUDE.md clear-condition lines updated to match (all three stages; no prose path).

## Packaging (distribution wiring)

The hook-registry gate flagged both hooks as UNMANAGED (would not install on another
machine). Wired them: browser-tree.json (member hooks list + hook_desc + hook_owner
"sidecoach"), app-wirings.json (Stop / UserPromptSubmit events), install.sh (sidecoach
copy loop + both install_app_hooks lines), and updated the 3 sidecoach hook-list
expectations in test-component-browser.sh. Registry now reports both MANAGED.

Pre-existing failures observed in the working tree, NOT caused by this unit (proven -
they fail with my tree additions removed): `elias-detect-stop.sh` does not parse
(bash -n), and two justify packaging-drift assertions in test-component-browser.sh
(stage_all opposite-pending; multi-hook off-list). Flagged to the lead.

## Failure-mode self-analysis (per protocol)

The Critical (finding 1) was a real miss: I mirrored verify-before-done's transcript
scan but did not carry over its `type`/role discipline to the NEW text-signature path
I added - I filtered by content-block type ("text"/"tool_use") without filtering by
ENTRY type ("assistant"), so a hook-injected context entry with a text block slipped
through. Root cause: I reasoned about the block shape and forgot the entry provenance.
Caught by the cross-model pass, which is exactly why the produce-and-verify mandate
requires a different model to certify. Lesson: when a gate's clear-condition scans a
transcript, provenance (who authored the entry) is load-bearing, not just content shape.

## Files touched

- claude/hooks/sidecoach-orchestrate-edit.sh (arm)
- claude/hooks/sidecoach-qa-gate-stop.sh (new, gate)
- claude/hooks/qa-gate-manual.sh (new, override)
- ~/.claude/settings.json (register both; backup at settings.json.bak.qagate)
- claude/CLAUDE.md (mechanical-coverage paragraph + escalation-ladder fork)
- ~/.claude/hooks/{sidecoach-qa-gate-stop,qa-gate-manual}.sh (symlinks)
