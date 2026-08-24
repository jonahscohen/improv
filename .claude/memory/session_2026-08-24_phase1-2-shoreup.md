---
name: Phase 1+2 shore-up - ingest symlink containment, consent overclaim, cmux installer wiring
description: The three pre-Phase-3 shore-up fixes: symlink-safe assertWithin + O_NOFOLLOW writes in taste-ingest, corrected consent-secret comment in taste-promote, and install.sh section 14c wiring cmux-tracker; miner-scheduling deferred (needs a change-detection contract)
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (ingest suite + new symlink test OK; taste-promote 90/0; cmux-tracker 33/0; component-browser 147/0; cc-tracker 38/0; sidecoach build clean; install.sh bash -n OK; plist templating dry-run 0 leftovers)
confidence: high
relates_to: [session_2026-08-24_phase1-2-review-outcome.md, session_2026-08-23_cmux-feature-tracker-built.md]
---

Executed the three shore-up tasks Jonah approved after the review (shore-up-first, then Phase 3).

1. INGEST CONTAINMENT (Codex HIGH): sidecoach-taste-ingest.js.
   - Added realResolve(p): realpaths the nearest EXISTING ancestor then re-appends the not-yet-created tail, so containment is decided on real (post-symlink) paths even before the dir exists.
   - assertWithin now uses realResolve for both root and dest (was lexical path.resolve, which missed symlink escapes). A pre-placed directory OR file symlink escaping the quarantine now throws.
   - Added writeFileNoFollow (O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW, 0600) and routed the body write + both writeJson calls (provenance/snapshot) through it + assertWithin, closing the final-file TOCTOU.
   - Regression test in taste-ingest.test.ts (1d-symlink): escaping dir symlink throws, escaping file symlink (-> real outside target) throws, normal in-root path still resolves. Ingest suite green.
   - Learned: a file symlink pointing at a NON-EXISTENT target resolves back inside root (realpath ENOENT -> walk-up), so assertWithin alone does not catch it; the O_NOFOLLOW write is what refuses that case. Both layers needed.

2. CONSENT OVERCLAIM (Codex Critical / phase-review LOW-accepted): sidecoach-taste-promote.js:97 comment. Comment-only change. Old text claimed the agent is "hook-blocked from reading OR writing" the ledger secret - false against a glob/string-concat/byte-copy by a determined same-uid agent. Rewrote to state the fences deter ACCIDENTAL access, the same-uid bypass is an accepted residual for the ADVISORY tier, and Phase 3 (blocking) must add its own human-signed, precision-gated second gate. No code changed; ledger integrity unchanged.

3. CMUX INSTALLER WIRING (phase-review MEDIUM): install.sh section 14c, symmetric to cc-tracker 14b. link_or_copy cmux-tracker-daily.sh + scheduled-research-run.sh into ~/.claude, mkdir the cursor/log dirs, and template com.yesand.cmux-tracker-daily.plist (rewrites author repo+home via the same SENTINEL approach as cc; dry-run verified 0 leftover author paths). Engine runs from SRR_REPO_ROOT (not copied - no ~/.claude fallback path for it, matches the wrapper). Gotcha: my first comment named claude/proposals/cmux-tracker, which tripped cmux-tracker.py verify-inert (install.sh is in HARNESS_SCAN_FILES - a harness surface must not reference the quarantine); reworded to not name the path. cc-tracker's section avoids naming its proposals path for the same reason.

DEFERRED (surfaced to Jonah, NOT silently wired): the taste-MINER has no scheduled wrapper/plist and no run/skip+cursor contract (sidecoach-mine.js is one-shot: mine/precheck-less). Scheduling it as the 3rd spine adapter needs a new change-detection precheck+advance (like the trackers have) - a small DESIGN task, not "wire the existing thing." Did not invent that contract under the shore-up banner.

INDEPENDENT CODEX REVIEW of the shore-up diff (229s) found 2 more, same local-same-uid threat class as the original symlink finding:
- HIGH CONFIRMED (folded): hard-link bypass - O_NOFOLLOW blocks symlinks but NOT hard links, so a pre-placed hard link at dest + O_TRUNC would truncate the outside inode. FOLD: writeFileNoFollow now unlinks the name first (drops the link without following/truncating the shared inode) then O_EXCL|O_NOFOLLOW-creates a fresh inode. Exported it and added a pointed test: a hard-linked outside file keeps its content, dest gets a new inode, and a symlinked dest is not written through. Green.
- MEDIUM PLAUSIBLE (accepted): an ACTIVE same-uid process could swap an intermediate DIRECTORY to a symlink between assertWithin and open. Out of the untrusted-REMOTE-content threat model (such a process writes anywhere directly); documented as an accepted residual in the writeFileNoFollow comment, and the "no TOCTOU" overclaim removed.
Codex also confirmed good: the symlink fixes, no ENOENT-on-realpath regression, re-ingest overwrite still works, the consent comment, and the install wiring (bash -n + plutil -lint + templating simulation all clean, section does not wire the quarantine).

VERIFIED (whole unit): ingest suite OK (dir-symlink + file-symlink + hard-link + symlink-no-write-through), sidecoach build 0, taste-promote 90/0, component-browser 147/0, cmux-tracker 33/0, cc-tracker 38/0.

Files: sidecoach/bin/sidecoach-taste-ingest.js, sidecoach/src/__tests__/taste-ingest.test.ts, sidecoach/bin/sidecoach-taste-promote.js, install.sh (+ rebuilt sidecoach/dist).
