---
name: sidecoach-devcorpus-commit-decision
description: The taste DEV CORPUS HTML must be COMMITTED (frozen shared artifact), not gitignored - caught a false "corpus missing" conclusion + re-capture
type: decision
relates_to: [session_2026-06-24_sidecoach-decoupling-gate.md, session_2026-06-24_sidecoach-batch2-regression-ruling.md]
---

Collaborator: Jonah Cohen.

The architect (after committing the batch-2 reverts, 44fe4177) reported: "the dev corpus is NOT on disk in this worktree (0 captures, no manifest)... ST0 needs a fresh dev-corpus capture." It was about to RE-CAPTURE.

## I verified the filesystem - the architect's claim is FALSE
- 22 dev HTML files ARE on disk (sidecoach/eval/corpus/dev/*.html: calcom, clerk, dub, ... = the same 22 I gated for disjointness).
- dev-manifest.json IS on disk (5322 bytes) AND git-tracked.
- We share ONE worktree (git worktree list = single tree, /Users/spare3/Documents/Github/improv @ sidecoach-phase2-reimplement, HEAD 44fe4177 = the architect's own commit). So not a cross-tree issue.
- The dev HTML is GITIGNORED (git check-ignore confirms) and 0 are tracked. So the architect mis-concluded "missing" from a git-aware check (git ls-files/status) that cannot see gitignored files. The captures persisted fine ("22/25" = 22 on disk, 3 failed of 25).

## Decision: COMMIT the dev corpus HTML (un-gitignore), do NOT re-capture
**Choice:** un-gitignore + commit the 22 dev HTML so the corpus is a frozen, shared, content-addressable artifact - exactly like the frozen-90 corpus HTML (90 files, already committed/tracked = the precedent).

**Alternatives considered:**
- Keep gitignored + re-capture when needed: rejected. Live-site captures are NOT deterministically regenerable (sites change); the manifest's content-shas pin what WAS captured but cannot reproduce those exact bytes later. "Regenerable so gitignore" is false for a live-web corpus.
- Re-capture now (the architect's plan): rejected. Would overwrite the 22 verified captures with fresh non-deterministic ones -> different content-shas -> INVALIDATES my disjointness gate -> Codex would label a different corpus than the one gated. Also wasteful Playwright CPU, contending with the running milestone collect.

**Why this one:** a corpus that is the SHARED GROUND TRUTH (independent lead gates it, Codex labels it, detectors developed against it) must be frozen + reproducible + identical for everyone. Committing the bytes is the only way. The gitignore directly caused this confusion (the architect couldn't "see" its own corpus). ~22MB (~1MB x 22 self-contained) is acceptable and matches the frozen-90 precedent.

**Revisit when:** corpus size becomes a real repo problem (then a committed compressed archive, still tracked, not gitignored loose files).

## Net
STOP the re-capture. Commit the existing 22 captures. The disjointness gate I verified still holds (same files). Proceed to Codex-label the EXISTING 22 + coverage map. ST1 held.

## RESOLVED - architect applied the ruling
Architect confirmed the 22 files + manifest (failed 3 = webflow/render/warp), owned the error (root cause: ran `ls corpus/dev` from sidecoach/ but corpus is under eval/corpus/ = wrong-path glob trusted as ground truth, gitignore hid them from git views; its own earlier probe used eval/corpus correctly and it didn't reconcile the contradiction - self-analysis written to its beat). Applied the fix: eval/.gitignore now un-ignores /corpus/dev/ and KEEPS /corpus/.shots/ ignored. That derived-vs-source distinction is exactly right: screenshots are DETERMINISTICALLY derived from the committed HTML (regenerate identically) so gitignore is fine; the HTML is a NON-deterministic live capture so it must be committed. No recapture. Will commit the 22 HTML when the collect finishes.

Files: sidecoach/eval/corpus/dev/*.html (22, un-gitignored, commit pending collect-finish), sidecoach/eval/corpus/dev-manifest.json (tracked), eval/.gitignore (dev/ un-ignored, .shots/ kept ignored).
