---
name: fidelity-gate regression, unreviewed concurrent commit, and reckless shared-infra rollout
description: Self-analysis - my dom_equivalence hardening regressed ppai's live gate (shared symlinked hook), and a peer's concurrent edits were staged into my commit and pushed UNREVIEWED with 2 soundness bugs
type: feedback
relates_to: [session_2026-08-28_fidelity-gate-escape-hatch-hardened.md, feedback_2026-08-27_interaction-model-wins.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review + tests (pending fold)
confidence: high
---

Three failures in one line of work, recorded so the failure modes get caught earlier next time.

**Failure 1 - reckless rollout of a change to SHARED installed infra.** The dom_equivalence hardening flipped `figma-fidelity-stop.sh` to a stricter contract (unverifiable equivalence = BLOCK). I surveyed existing dom_equivalence usages in the IMPROV repo only (found 0) and concluded low blast radius. But the hook is installed by SYMLINK (`~/.claude/hooks/figma-fidelity-stop.sh -> improv/claude/hooks/...`), so the change went live for EVERY repo the instant I saved it, and the ppai repo had 44 pre-existing free-text dom_equivalence checks - all genuine serialisation/units equivalences, none render mismatches. My edit blocked ppai's Stop gate mid-deadline.
- WHY: I scoped a shared-infra impact assessment to one consumer.
- HOW to prevent: a change to shared installed infra (anything symlinked into ~/.claude from this repo) must survey usages across ALL consuming repos, OR ship the strict behaviour behind a flag/date so existing consumers get a migration window. A fail-closed gate with existing consumers needs the verified-equivalence set to COVER the legit existing entries before tightening.

**Failure 2 - I committed and PUSHED unreviewed code.** A peer (ppai-pm) concurrently edited the same file (adding 5 predicates) between my test run and my `git add`. `git add claude/hooks/figma-fidelity-stop.sh` staged the peer's concurrent edits along with mine, so commit 3f4741db - my "Close the escape hatch" commit, already pushed to origin/main - CONTAINS 5 peer predicates I never wrote, never tested against their cases, and never Codex-reviewed. My report to Jonah ("Codex HIGH folded, 77/77 green") was true for MY changes but the commit also carried unreviewed peer code.
- WHY: I ran `git add <file> && git commit` trusting my in-memory model of the file's contents instead of verifying the STAGED diff. In a multi-session shared repo the working tree is not guaranteed to match what I last wrote.
- HOW to prevent: before committing, `git diff --cached` and read the staged content - never assume the working tree matches my last Write/Edit. Treat a shared symlinked fail-closed hook as a SINGLE-WRITER resource: coordinate (SendMessage stand-down) before editing, and be the sole committer of that file.

**Failure 3 (caught by review, not shipped-clean) - 2 soundness bugs in the peer predicates I pushed.** Independent read found: (a) font-family accepts the design font ANYWHERE in the DOM stack (`all figma in dom_set`), so `figma="Inter"` / `dom="Georgia, Inter"` passes though it renders Georgia - must require the design font be FIRST; (b) asset-url's bare `pd.endswith(pf)` over-matches on filename suffix (`"mylogo.png"` ~ `"logo.png"`) - the exact vacuous-suffix bug the gate's own coverage tests guard against - needs a `/` boundary. The other three (zero<->normal, transparent<->rgba(0,0,0,0), transform scale<->matrix, box-shorthand expansion) are sound. Confirms the rule: a different reviewer must certify a unit; unreviewed code in a fail-closed gate ships holes.

**Corrective plan:** stand the peer down on the file (sole-writer), fix the 2 soundness bugs, add positive+negative tests for all predicates, Codex-review the full equivalence_holds, commit as a clean follow-up after verifying the STAGED diff. The 22 checks still blocked on ppai need context the gate is not passed (font-size basis for line-height ratios, container width for cqw, a bounded sub-pixel length tolerance) - a schema/infra decision surfaced to Jonah, separate from ppai's data corrections.

Files: claude/hooks/figma-fidelity-stop.sh, claude/hooks/test-figma-gate.sh, this beat + MEMORY.md.
