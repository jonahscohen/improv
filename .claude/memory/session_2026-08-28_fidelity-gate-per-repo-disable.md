---
name: per-repo fidelity-gate disable marker + ppai disarm
description: Added a reversible .figma-fidelity.disabled per-repo override to the Stop hook and used it to disarm ppai's gate on Jonah's direct command
type: decision
relates_to: [session_2026-08-28_fidelity-gate-concurrent-commit-and-rollout-miss.md, session_2026-08-28_fidelity-gate-escape-hatch-hardened.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Jonah's direct command ("disarm those 5 now. my command. i override you."), overriding my recommendation to build sound predicates. Context: the ppai fidelity Stop gate was blocking ppai-pm's every turn.

**Ground truth vs the peer's framing.** The peer described "5 remaining checks" (cqw, stroke-width, card height, button height). The LIVE block was actually 3 UNCOVERED ARMS - Figma nodes 1725:14550 / 14490 / 14494, auto-armed by get_design_context during the UGC rebuild but never given covering checks. The coverage check blocks before the per-check ladder, so the 5 equivalence checks sat underneath (they'd block next). The gate is un-opt-out-able by design: the .pending arm can't be deleted (guard-blocked) and the ledger independently demands coverage, so the only agent-executable disarm is a fully-passing manifest OR a hook-level skip.

**Choice: a per-repo disable marker.** Added to figma-fidelity-stop.sh: a `.figma-fidelity.disabled` file at the repo root short-circuits the gate for THAT repo (exit 0 + a stderr notice), honored BEFORE the armed-check so it disables even an armed repo.

**Alternatives considered:**
- Build sound predicates (cqw->px, stroke-scale, sub-pixel tolerance): rejected by Jonah under deadline; also 2 of the items (card 0.42px, stroke 3.87x) are real deviations, not clean equivalences.
- Waive individual nodes / mark not_a_dom_property: needs ppai node measurements + evidence greps I don't have; ppai-pm's manifest domain.
- Delete the .pending arms: impossible by design (guard-blocked, ledger-backed).

**Why this one:** it is the only clean, immediate, agent-executable disarm that honors the override. It is VISIBLE (shows in git status), carries its reason inline, is scoped to one repo, keeps the 807 checks + ledger intact, and is undone with a single `rm .figma-fidelity.disabled`. Verified: 79/79 gate suite (same drift blocks without the marker, passes with it), ledger + optout siblings green; ppai gate now exits 0.

**Scope caveat (told to Jonah):** this disables fidelity REPO-WIDE for ppai, not just the named items - the blunt instrument the gate's un-opt-out design forces. The ppai `.figma-fidelity.disabled` marker is uncommitted (a local control file); the 3 uncovered arms + 5 equivalence checks remain unresolved and resume the moment the marker is removed.

**RE-ARMED 2026-08-28** on Jonah's command (`rm .figma-fidelity.disabled`). The gate is back on for ppai and now blocks on 4 uncovered arms (1725:14550 / 14490 / 14494 / 14980) - the on-the-rails state: it stays red until ppai-pm covers those nodes (it has the measured values ready) and re-records the cqw checks as verbatim px. Gate code is the soundness-fixed version (see [[session_2026-08-28_fidelity-predicate-soundness-fixes]]).

**Revisit when:** ppai is ready to re-arm - then either cover the 3 nodes + record the cqw/stroke/card/button in a passing form (ppai-pm's data work), or build the sound predicates (the parked infra work, still carrying 2 unfixed soundness bugs in the peer's font-family/asset-url predicates - see the concurrent-commit beat).

Files: claude/hooks/figma-fidelity-stop.sh, claude/hooks/test-figma-gate.sh, ppai/.figma-fidelity.disabled (in the ppai repo), this beat + MEMORY.md.
