---
name: fidelity predicates - font-family webfont-alias + asset theme-relative path
description: Re-arm surfaced 16 equivalence failures on pre-existing ppai components; added a sound webfont-alias font predicate and restored the asset /-boundary suffix (an over-tightening reversal)
type: project
relates_to: [session_2026-08-28_fidelity-predicate-soundness-fixes.md, session_2026-08-28_fidelity-gate-per-repo-disable.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review + tests
confidence: high
---

Jonah re-armed the ppai gate (`rm .figma-fidelity.disabled`). ppai-pm covered its 7 newly-armed UGC nodes (17 checks, passing), so the coverage gate cleared and the per-check ladder exposed 16 equivalence failures - ALL on pre-existing non-UGC components, none on the UGC page. Categorized: 6 font-family (webfont alias), 5 background-image (theme-relative path), 2 cqw->px, 2 sub-pixel, 1 stroke-scale.

Two of those categories were genuine gate work; built both, Codex-clean:

1. **font-family webfont-alias.** A CSS stack leads with the design family's slugified webfont id ("Freight Sans Condensed" behind "freight-sans-condensed-pro"). Base case is still the sound LEADER rule; added a fallback: a SINGLE figma family present in the stack, where every entry before it is that same typeface's slug or slug + a FORMAT/EDITION suffix (`pro/web/webfont/variable/vf/std`). Codex flagged nothing high/medium; on its notes I EXCLUDED `display`/`text` - those are optical-size cuts (different glyph designs, like `Neue`), not delivery-format aliases. Still blocks `Georgia`/`Inter`, `Helvetica Neue`, `-display` cuts, `Arialic`, `sans-serif`.

2. **asset theme-relative path (a reversal I owe).** My earlier over-tightening (to close a Codex HIGH: exact-path or bare-filename only) false-FAILED ppai's real case - a theme-relative `assets/img/card-arrow.svg` vs the served `.../themes/ppai/assets/img/card-arrow.svg`. Restored the `/`-boundary suffix (`pd.endswith('/'+pf) or pf.endswith('/'+pd)`) alongside exact + bare-filename. The `/` boundary still blocks `mylogo.png` vs `logo.png` and `down-arrow.svg` vs `arrow.svg`; it DELIBERATELY re-accepts a same-tail different-root collision (`icons/x` vs `theme/icons/x`) - impossible for one asset in one project, and the real theme-vs-served shape is exactly this. A documented residual for the lazy-not-adversarial threat model, not thrashing: exact-only was wrong for real theme paths.

test-figma-gate.sh 94/94 (rule 4b now covers webfont-alias pass + Neue/display/Georgia negatives, theme-relative pass + down-arrow negative); ledger + optout siblings green.

**NOT gate work (handed off):** the remaining 5 of 16 are ppai data or Jonah's call. The 2 cqw checks record the AUTHORED `38.9313cqw`, not a verbatim getComputedStyle reading (which resolves to px) - ppai re-records the verbatim px and they match via numeric_match, no predicate. The card 225 vs 224.578 is a real 0.42px design simplification (Jonah accepts or it gets matched). The button 48 vs 47.969 is a 2-quantum layout diff (accept or re-record). The logo stroke 3 vs 11.6 is SVG userspace-vs-render scale - ppai investigates (real miss vs viewBox scale). These are correctly blocked; the gate is on the rails.

Files: claude/hooks/figma-fidelity-stop.sh, claude/hooks/test-figma-gate.sh, this beat + MEMORY.md.
