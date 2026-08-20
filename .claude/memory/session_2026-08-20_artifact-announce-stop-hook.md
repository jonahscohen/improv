---
name: artifact-announce-stop hook - open-what-you-announce backstop
description: New Stop hook that blocks the turn when Claude's closing message announces a deliverable location while the file sits closed/unopened; plus Rule 11 codified
type: project
relates_to: [session_2026-08-20_artifact-open-officedoc-blindspot.md, session_2026-08-19_artifact-open-reflag-diagnosis.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex
confidence: high
---

Jonah (via the ppai-pm blind-spot report) chose "fix loop + ignore" for the office-doc blind spot AND added: build a hook that catches Claude SAYING "the file is on your desktop" and forces it open. Built both.

**RULE 11 codified** in claude/RULES.md Verification Protocol (the install-appended source): "Open the deliverable, do not just render it" - a FILE deliverable is not delivered until OPENED in its app for the user; verification renders you Read are for YOU, opening the file is for the USER. Notes the artifact-open mandate provably cannot see a script-written file (path not in the command), so this is a standing habit, not a hook guarantee. Live on next config refresh; the hook is the live teeth now.

**NEW HOOK claude/hooks/artifact-announce-stop.sh** (Stop event). Reads the assistant's LAST transcript message; if it uses DELIVERY framing (on your desktop / saved to <path> / file is at) AND names a deliverable that EXISTS on disk AND was NOT presented this session AND is not internal, it Stop-'block's telling Claude to `open` it. Fire-once (stop_hook_active), fail-open on every error, shares the `.artifact-surface-disabled` kill switch. REGISTERED for real: cluster-wirings.json + browser-tree.json (hooks list + desc + owner=verification) + install.sh verification cluster + live ~/.claude/settings.json Stop array (active immediately). 21-case suite incl. false-positive controls + a ReDoS-timing guard.

**CODEX HARDENING (7 rounds - a blocking gate must be near-zero false-positive):** each fold made it tighter.
1. Proximity binding: a candidate file must sit within WINDOW=90 chars of a delivery cue (was: cue anywhere + path anywhere = blanket false-block).
2. Read is NOT a discharge - only an actual `open`/Artifact publish presents the file (matches Rule 11; also drops the failed-Read correlation problem).
3. Hardened `open` parser (clear.sh's whole-command anchor) so `open --x;true /f` is not credited.
4. SUCCESS-CORRELATION: an open/Artifact counts only if its matching tool_result is not is_error (keyed by tool_use_id); a failed open no longer clears the block. Missing result credits (cannot occur at Stop) to avoid over-block.
5. ReDoS #1: FILE_RE body bounded {0,120} AND run only inside cue windows (was quadratic, 6.6s at 32k).
6. ReDoS #2: PATH_RE body bounded {1,200} (was unbounded, 14.8s at 80k slash-heavy). 43k/85k messages now scan in ~0.09-0.11s.
7. Quoted-spaced-path recall (QPATH_RE, delimiter-bounded). REASONED DECISION (not blind fold): UNQUOTED absolute paths WITH SPACES stay a DELIBERATE safe-direction MISS - a bare spaced path has no decidable end in prose; guessing risks a wrong-path resolution or a FALSE block, worse than a miss for a blocking gate. Codex agreed: SHIPPABLE, no P0, miss is acceptable, keep it documented.

SELF-ANALYSIS: my first cut was too loose (cue+path anywhere) and the shown-skip semantics (Read-clears) were wrong. Lesson reinforced across the session: for a BLOCKING gate, every heuristic must be gated to near-zero false-positive, and "identity" needs the right key (mtime for the reflag ledger, tool_use_id+is_error here, cue-proximity for announce). Bound every unbounded regex quantifier in a hook that reads arbitrary assistant text.

VERIFICATION: 4 artifact/announce suites 65/25/12/21 = 123 green; hook-registry audit 94/0 (UNMANAGED fixed by the install.sh add); ReDoS timing proven; 7 Codex rounds, final SHIPPABLE.

**FLAGGED (pre-existing, NOT mine):** test-component-browser.sh has 2 failures at PRISTINE HEAD (worktree-confirmed): "stage_all install clears opposite pending" + "apply_pending_plan multi-hook off-list .sh suffix" - both JUSTIFY-component packaging drift (justify's hook set vs the test's hardcoded off-list), unrelated to this change. Worth a separate fix.

NOT COMMITTED. Files: claude/hooks/artifact-announce-stop.sh (new), test-artifact-announce-stop.sh (new), cluster-wirings.json, browser-tree.json, install.sh, claude/RULES.md.
