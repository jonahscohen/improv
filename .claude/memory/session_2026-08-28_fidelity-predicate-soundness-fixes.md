---
name: fidelity equivalence_holds soundness fixes (font-family, asset-url, border-radius)
description: Fixed the 2 over-match soundness bugs the concurrent-commit left live in the gate, plus removed border-radius from the box predicate; Codex-clean
type: project
relates_to: [session_2026-08-28_fidelity-gate-concurrent-commit-and-rollout-miss.md, session_2026-08-28_fidelity-gate-per-repo-disable.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review + tests
confidence: high
---

Jonah: "fix the gate so we can proceed with it back on, because the agent needs to stay on the rails." The fix is to make the gate CORRECT (reject over-matches), not lenient - the pre-existing ppai items it blocks are mostly data problems (authored-not-verbatim cqw readings, a real 0.42px card deviation) the gate SHOULD flag; loosening it would be the opposite of on-the-rails.

Fixed the real gate defects the 2026-08-28 concurrent-commit left live (the peer's 5 predicates rode into a commit unreviewed; 2 had over-match holes):
1. **font-family** was `all(figma_family in dom_stack)` - accepted the design font ANYWHERE in the stack, so `Inter` vs `Georgia, Inter` passed though it renders Georgia. Now requires the Figma families to LEAD the stack in order: `dl[:len(fl)] == fl`.
2. **asset-url** had a bare `pd.endswith(pf)` that let `mylogo.png` match `logo.png`. First fix (boundary suffix) still cross-matched `icons/logo.png` vs `theme/icons/logo.png` (Codex HIGH). Final: exact normalised path, OR a BARE filename (no `/`) equal to the other side's trailing segment - a cross-directory suffix is rejected (suffix != identity).
3. **border-radius** removed from the box-shorthand `[t,r,b,l]` predicate - its shorthand is corner-order (TL TR BR BL) with an optional `/` for elliptical radii, not edge-order. border-width stays (it IS edge-order).

Codex: two rounds. Round 1 found the asset cross-dir HIGH + a rare font-family quoted-comma edge (documented as a known limitation - the threat model is lazy-opt-out, not a determined forger - not a full CSS parser) + a stale docstring (fixed). Round 2 on the fold: "No findings. The asset-url fold is clean." Tests: test-figma-gate.sh 90/90 (rule 4b covers every predicate positive+negative, including the two soundness-fix negatives and the cross-dir block), ledger + optout siblings green.

Still true: the ppai gate remains DISABLED via .figma-fidelity.disabled (Jonah's disarm). A clean re-arm needs ppai-pm's data half - cover the newly-armed UGC nodes (14550/14490/14494/14980/14238/14270/14263; the peer says it has the measured values ready) and re-record the cqw checks as verbatim computed px (they then match via numeric_match, no predicate needed) - plus Jonah's accept-or-fix on the card's 0.42px. These are data/design, not gate code.

Files: claude/hooks/figma-fidelity-stop.sh, claude/hooks/test-figma-gate.sh, this beat + MEMORY.md.
