---
name: Marketing microsite - first pipeline run retrospective
description: What actually fired in the design pipeline when I ran it on a real build for the first time. The site works. Some layers fired smoothly, some didn't fire at all. Honest data for tuning the process.
type: project
relates_to: [session_2026-05-20_marketing-site-pipeline-test.md]
---

## What got built

A local marketing microsite at `marketing/` in the dotfiles repo. Single page, scroll-based, editorial-serif aesthetic on-brand to Yes&. Served on `http://localhost:8765/`. Files: `index.html`, `styles.css`, `main.js`, `PRODUCT.md`, `DESIGN.md`, `assets/`.

## What actually fired in the pipeline vs what's documented

The README claims an 8-step "how the layers stack on a real build" sequence. Here's what really happened:

| Layer | README claim | What actually happened |
|---|---|---|
| **PRODUCT.md / DESIGN.md** | Pre-step; check exists | I WROTE them at the start, derived from README brand voice + logo observation. Worked smoothly. |
| **1. /oracle shape** | Reads PRODUCT.md, proposes brand direction | NEVER invoked as a skill. I did the strategy mentally + captured in PRODUCT.md. |
| **2. component-gallery-reference** | Triggers for standard components | NEVER auto-fired. I built hero/nav/cards/footer from convention. |
| **3. design-references** | Triggers in parallel, greps catalog | NEVER fired. The 1 reference (unlumen-kbd) wouldn't have matched anyway. |
| **4. fontshare-reference** | Triggers for type decisions | Did the WORKFLOW mentally - picked Source Serif 4 + Hanken Grotesk + JetBrains Mono, validated against reflex-reject list. The skill's reject list was load-bearing - I caught myself almost picking Inter before remembering. |
| **5. motion-reference** | Triggers for animation | Applied the canonical GSAP + Lenis 3-line glue snippet from the skill verbatim. Also applied the SSR / cleanup / ScrollTrigger.refresh gotchas. The skill earned its place. |
| **6. icon-source** | Peer skill for icons | Not invoked. I didn't end up needing icons - the design is pure type + color. |
| **7. make-interfaces-feel-better** | Tactical polish during impl | Applied DURING construction, not as a separate pass: scale(0.96) on press, text-wrap balance on headings, pretty on body, concentric radius (xl outer + md inner), tabular nums setup, no transition: all, image outlines never tinted. About 10 of the 14 rules ended up in the CSS. |
| **8. /oracle audit + critique + polish** | QA gate | NEVER invoked. The site shipped without the documented QA triad. |

## The honest read

Of the 8 documented pipeline steps, **2 fired as skills the way the README claims** (fontshare-reference's reject list was load-bearing in my decisions; motion-reference's canonical patterns were lifted verbatim). The other 6 either didn't fire or fired only as "I-remembered-the-thing" mental shortcuts, not as the skill auto-triggering.

`make-interfaces-feel-better` is the interesting case - it didn't AUTO-TRIGGER but I applied its 14-point rules DURING the build because I'd read the skill recently. The auto-trigger description matches UI keywords; my work counted, but the keyword routing didn't show me the rules - I remembered them.

The QA gate (`/oracle audit + critique + polish`) genuinely never ran. The site went from "done" to "live" with no design-review step.

## Friction points the build surfaced

1. **The progressive-enhancement reveal pattern is brittle.** I used `data-reveal` with `opacity: 0` default and JS to animate to visible. When the CDN ES modules failed silently (skypack didn't resolve `lenis` properly), the entire page was invisible. Fixed by inverting: items visible by default, hidden only when JS confirms `.js` class is on `<html>`. **Lesson**: never make critical UI dependent on JS without a zero-JS fallback path.

2. **Lenis + cmux verification conflict.** Lenis hijacks native scroll, so cmux's `scroll` command does nothing on a Lenis-equipped page. Had to disable Lenis with a flag toggle to verify the page renders past the hero. Re-enabled after. The motion-reference skill's "Lenis breaks native scroll-into-view" gotcha applies here too. **Lesson**: build a verification mode that turns Lenis off, OR use click-based nav verification (which I did once cmux scroll failed).

3. **Skypack ESM imports unreliable.** First version used `cdn.skypack.dev` for GSAP / ScrollTrigger / Lenis - one of them failed silently. Switched to `esm.sh` which resolved correctly. **Lesson**: esm.sh > skypack for ESM CDN. Future motion-reference patterns should specify esm.sh.

4. **Hero entrance race with Lenis init.** With Lenis enabled, the hero entrance animation occasionally fails to fire on cold load (3-4 second blank screen before content appears). The fail-safe `setTimeout` reveal at 4s catches it but the perceived load is bad. **Lesson**: hero entrance should NOT depend on Lenis being initialized. Initialize Lenis after the hero is on-screen.

## What worked smoothly

- **DESIGN.md tokens → CSS variables** was a one-to-one mapping. Writing tokens once, referencing them everywhere via `var(--c-brand-ink)` etc. is the right structure.
- **The fontshare-reference reflex-reject list** legitimately changed my decisions. I almost reached for Inter. The skill stopped me.
- **The motion-reference 3-line glue snippet** worked verbatim - copy-paste-go.
- **PRODUCT.md as a constraints file** kept me from drifting into Vercel-monochrome or AI-product-hype lanes. The anti-references section was load-bearing.

## What I'd cut or change

- The `data-reveal` pattern as currently designed has too much surface area to fail. Either commit to "always visible, animate on scroll" (no opacity:0 default) OR commit to a guaranteed-fire JS init that doesn't race.
- The pipeline's auto-trigger mechanism (description keyword matching) isn't actually catching skills consistently. Several skills that should have auto-fired (component-gallery-reference, design-references, icon-source) didn't.
- The QA gate (oracle audit/critique/polish) needs to be a literal pre-commit hook, not a README claim. If we're serious that it runs at QA time, it should mechanically block a "done" claim.

## Files touched (the build)

- `marketing/index.html`
- `marketing/styles.css`
- `marketing/main.js`
- `marketing/PRODUCT.md`
- `marketing/DESIGN.md`
- `marketing/assets/yes-and-logo-light.webp` (copy)
- `marketing/assets/yes-and-logo-dark.webp` (copy)
- `marketing/assets/favicon.svg`

## How to run

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/marketing
python3 -m http.server 8765
# Open http://localhost:8765/
```

(A python3 http.server is currently running in background, PID 22526.)

## Collaborator

Jonah
