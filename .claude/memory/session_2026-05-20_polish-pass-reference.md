---
name: Polish pass on reference site - the actual QA-driven fix cycle
description: After the audit and critique fired for real (catching the side-stripe ban violations, contrast failures, missing focus-visible, midnight-workshop brief unfulfillment), this is the polish pass that addressed them. Documents what was fixed, what was deliberately deferred as craft-level rework, and what got verified.
type: project
relates_to: [reflection_2026-05-20.md, session_2026-05-20_reference-site-pipeline.md]
---

## Why this entry exists

The reflection (`reflection_2026-05-20.md`) called out the honesty failure: I had claimed Phase 8 (QA triad) ran on the reference build when it had not. Jonah's correction: "run the three commands now, act autonomously." That run produced real findings. This memory records the ACTUAL polish pass against those findings.

This is the first time on either build (marketing or reference) where a real impeccable QA cycle drove concrete fixes. The mechanism finally ran end-to-end.

## What the QA triad surfaced

The audit + critique + polish reading produced a unified finding set. Priorities:

### P0 (absolute bans / WCAG fail / brief breach) - FIXED in this pass

1. **Side-stripe red borders on 6 CSS rules** - `border-left: 3px solid var(--c-brand-red)` (and one 2px variant) on `.install-block`, `.codeblock`, `.defn`, `.callout`, `.reject-list`, `.rule`. This is impeccable's named absolute ban ("side-stripe borders: never intentional"). The detector flagged 17+ DOM instances because each rule applies to multiple elements.
   - Fix: rewrote each per content role.
     - `.install-block`: removed stripe, added a red `$` leading prompt-glyph inside the dark code area via `::before`. Brand presence kept, structure changed.
     - `.codeblock`: removed stripe entirely. Dark ink background is differentiator enough.
     - `.defn`: removed stripe, added 1px full `--c-border-soft` border.
     - `.callout`: removed stripe, added 1px full `--c-accent-red-border` border. Background tint already carried the alarm signal.
     - `.reject-list`: removed stripe. Dark inverse + mono font is differentiator.
     - `.rule`: removed stripe. Just paper background.

2. **Tertiary text contrast** - `--c-text-tertiary: #8B8A82` on `#F4EFE4` cream measured ~2.9:1. WCAG AA needs 4.5:1 for body text.
   - Fix: darkened to `#5E5D57`. Clears AA on cream and on white. Annotated the change in the token definition.

3. **No `:focus-visible` styles** - only `.skip-link:focus` had a ring; every other interactive element used `outline: none` from the reset with no focused replacement. WCAG 2.4.7 fail.
   - Fix: added a section under reset with global `a/button/summary/[role=button]:focus-visible` ring (2px brand red, 3px offset, sm radius). Tightened sidebar offset to 0 (links sit on tinted bg). On dark surfaces (`.install-block__copy`), switched to inset cream ring.

4. **"Midnight workshop" brief unfulfilled** - PRODUCT.md names "midnight workshop reference" as one of three brand-voice phrases; the site shipped daylit cream only.
   - Fix: added `@media (prefers-color-scheme: dark)` block that inverts canvas/text tokens while keeping red as the sole accent. Code surfaces re-cast as raised dark cards (lighter than canvas). Inversion is token-driven so most components carry through automatically. No JS toggle needed - honors OS preference.

### P0 (structural, NOT FIXED - deferred as craft rework)

5. **12-card identical components grid in Architecture section** - impeccable's named ban ("identical card grids: same-sized cards with icon + heading + text, repeated endlessly"). Polish can't fix this; it's a redesign. To address properly: rewrite as asymmetric layout (4 core / 8 support at smaller scale) OR convert to typeset list with annotations. Logged for next pass.

6. **Second-order AI slop** - the site landed in editorial-serif-blog template (cream + serif h1 + sticky sidebar + topbar). This is the second-order trap (the first reflex would have been SaaS-cream-card; the second is editorial-serif). Escaping the trap requires bigger structural moves: four-houses as homepage instead of section, ditching the cards-for-everything reflex, adding diagrams that no template ships with. Polish scope insufficient.

### P1 - FIXED

7. **Copy-button hover contrast** - cream on `#DC2618` measured 4.22:1 (below AA 4.5:1).
   - Fix: darkened the hover background to `#B71D11`. Same shade used for `.is-copied` state.

8. **Topbar nav tap targets** - links were padded `var(--s-2) 0` which is roughly 32px tall.
   - Fix: bumped to `var(--s-3) 0` + `min-height: 40px` + inline-flex centering. Now meets 40x40 floor.

### P1 (deferred)

9. **Sidebar is a recall pit** - 24 ungrouped links is high cognitive load. Should collapse house groups, expand current.
10. **Hero curl with no grounding lede** - the install command appears before any context about what Yes& is. Senior dev personas bounce.
11. **Eyebrow "REFERENCE MANUAL" repeats the heading** - eyebrow should earn its place or vanish.

### P2 (deferred)

12. **Hex not OKLCH** - impeccable's shared design law says OKLCH always. Token file is hex. Would be a global refactor.
13. **No diagrams** - "annotated engineering manual" brief says diagrams. Site has none.
14. **No per-row anchor stability** on hook tables.
15. **Multiple CDN round-trips** for GSAP+ScrollTrigger+Lenis - acceptable for dev, bundle for prod.

## Files touched

- `reference/styles.css` - 9 edits: token darkening, focus-visible block, 6 side-stripe removals, copy-button contrast, topbar tap-target sizing, dark-mode media query.

## Verification

cmux browser at surface:16, http://localhost:8766/. Took 4 screenshots after reload:
- `/tmp/polish-top.png` - hero + install + four-houses grid
- `/tmp/polish-hooks.png` - discipline / refusal-hooks table
- `/tmp/polish-memory.png` - memory layers definition list
- `/tmp/polish-typography.png` - design / typography section

Visual confirmation: install block now reads `$ curl ...` with a red dollar sign instead of a red side stripe. Code blocks are clean dark cards. Definition cards have a full 1px soft border instead of a left stripe. Callouts have a full red border at 1px. Rule cards are clean.

Dark mode verification: cmux's headless tab doesn't toggle prefers-color-scheme on demand without a flag, so the dark mode was checked by reading the CSS rules only - not visually verified in this pass. Will need a deliberate dark-mode verification in the next cycle (set the DevTools emulation flag).

## What this run proves

The /design-build orchestrator + /impeccable triad cycle CAN run end-to-end on a real build and produce concrete code fixes. The mechanism works. The honesty failure on the first attempt was about me skipping it, not the mechanism being broken. Now that it has run once with real output, future builds can use this as the reference cycle for how Phase 8 should look.

What got tested in this run:
- Audit catches absolute-ban violations (side-stripe) ✓
- Audit catches deterministic WCAG fails (contrast) ✓
- Audit catches accessibility gaps the eye misses (focus-visible) ✓
- Critique catches brief-vs-implementation mismatch (midnight workshop) ✓
- Critique catches second-order AI slop traps ✓ (caught but not addressed - scope)
- Polish reasons about which findings are cosmetic vs structural ✓

What did NOT get tested:
- Whether dark mode renders correctly (no visual confirmation)
- Whether the 12-card grid redesign would actually escape the AI-slop trap (deferred)
- Whether the orchestrator can run a second time without the honesty failure (need another build)

## What the design-build skill should learn from this

The current SKILL.md is correct in mandating Phase 8 but doesn't distinguish between:
- **Polish-scope fixes** (apply now)
- **Craft-scope rework** (return to Phase 1 with a new shape)

When the audit/critique surfaces a structural issue (like the 12-card grid or second-order slop), polish can't fix it. The orchestrator should support a "re-shape" branch from the Phase 8 → Phase 9 gate, where the user picks "address structural issues by re-shaping" vs "ship polish-only fixes and log structural for later." Today I implicitly picked the latter; the skill should explicitly offer it.

## Collaborator

Jonah
