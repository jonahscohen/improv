# Motion Review

The review protocol for animation and motion code. Where [animations.md](animations.md) teaches how to BUILD motion, this file defines how to JUDGE it. Use it when reviewing a diff that touches animation, when auditing existing motion, or when someone asks "does this animation feel right?"

Posture: motion that merely runs is not motion that passes. A transition that works but feels sluggish, grows from the wrong origin, fires on every keystroke, or drops frames is a regression. Default to flagging; approval is earned.

## First question: should this animate at all?

Frequency decides before craft does.

| How often the user sees it | Ruling |
| --- | --- |
| 100+ times a day (keyboard shortcuts, command-palette toggle) | No animation. Ever. |
| Tens of times a day (hovers, list navigation) | Remove it or reduce it drastically |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare or first-time (onboarding, celebration, empty states) | Delight is allowed |

Keyboard-initiated actions never animate: they repeat hundreds of times daily, and animation makes the interface feel slower than the user's hands. Valid reasons for motion are spatial continuity, state indication, feedback, explanation, or preventing a jarring change. "It looks cool" is only valid in the rare/first-time row.

## The ten standards

Every animation in the diff is measured against these. A violation is a finding.

1. **Justified.** It answers "why does this animate?" with one of the valid purposes above.
2. **Frequency-appropriate.** Per the table. High-frequency motion is a block, not a nit.
3. **Responsive easing.** Entering and exiting elements ease out. `ease-in` on UI is a block: it is slowest at the exact moment the user is watching. Built-in CSS keywords are weak; prefer a strong custom curve (see the curve set below).
4. **Inside its duration budget.** UI motion stays under 300ms (per-element budgets below). Slower needs a stated reason.
5. **Physically plausible.** Popovers, dropdowns, and tooltips scale from their trigger via `transform-origin`, never from center (modals are the exemption; they belong centered). Nothing enters from `scale(0)`; things arrive from `scale(0.9-0.97)` plus opacity, because nothing in the physical world appears from nothing.
6. **Interruptible where rapid.** Anything triggered in bursts or driven by gesture (toasts, toggles, drags) uses transitions or springs that retarget from current state. Keyframes restart from zero and stutter under rapid fire.
7. **GPU-only properties.** `transform` and `opacity`. Animating `width`, `height`, `margin`, `padding`, `top`, or `left` re-runs layout every frame.
8. **Accessible.** `prefers-reduced-motion` handled (gentler, not zero: keep opacity and color, drop movement). Hover motion gated behind `@media (hover: hover) and (pointer: fine)` so touch taps do not fire false hovers.
9. **Asymmetric where deliberate.** Actions the user commits to (press-and-hold, destructive confirm) run slow on the deliberate phase and snap on the response. Symmetric timing on a hold interaction is a finding.
10. **Cohesive.** Motion matches the product's register: playful surfaces may bounce, dashboards stay crisp. When motion cannot be made to feel right, the strongest fix is deletion.

## Flag on sight

- `transition: all`
- `scale(0)` entrances, or pure fades with no initial transform
- `ease-in` anywhere on UI
- Any animation on a keyboard shortcut or 100+/day action
- UI duration over 300ms with no stated reason
- `transform-origin: center` on a trigger-anchored popover/dropdown/tooltip
- Keyframes on toasts, toggles, or anything added rapidly
- Layout-property animation (`width`/`height`/`margin`/`padding`/`top`/`left`)
- Motion-library position shorthands (`x`/`y`/`scale` props) on motion that runs while the page is busy - they animate on the main thread and drop frames under load; use the full `transform` string, which stays hardware-accelerated
- Driving a child's transform by updating a CSS variable on the parent (style recalc across every child; set `transform` directly on the element)
- Looping animation (marquee, pulse, float, shimmer, orbit) with no off-screen pause via `animation-play-state` + IntersectionObserver
- `requestAnimationFrame` loop with no stop condition (element removed, off-screen, settled, or tab hidden)
- Animated blur above `8px` (`filter: blur()` past the blur budget - expensive to composite, especially in Safari)
- Missing reduced-motion handling on movement
- Ungated `:hover` motion
- Symmetric enter/exit on press-and-release interactions
- Everything-at-once group entrances where a stagger belongs

## Fix hierarchy

Prefer earlier moves over later ones:

1. **Delete it** (high-frequency, purposeless, or keyboard-triggered).
2. **Reduce it** - shorter, smaller transform, fewer animated properties.
3. **Fix the easing** - `ease-in` to `ease-out` or a strong custom curve.
4. **Fix the origin** - correct `transform-origin`; replace `scale(0)` with `scale(0.95)` + opacity.
5. **Make it interruptible** - keyframes to transitions; springs for gestures.
6. **Move it to the GPU** - layout props to `transform`/`opacity`; shorthand props to full transform strings; WAAPI for programmatic control at CSS performance.
7. **Split the timing** - slow the deliberate phase, snap the response.
8. **Polish** - a light blur to mask a rough crossfade, a stagger for groups, `@starting-style` for JS-free entry.
9. **Gate it** - reduced-motion and hover/pointer media queries; tune personality to the product.

## Reference values

**Easing decision order.** Entering/exiting: `ease-out`. Moving or morphing on screen: `ease-in-out`. Hover and color: `ease`. Constant motion (marquee, progress): `linear`. Default when unsure: `ease-out`.

**House curve set.** Named tokens, not hand-rolled per component:

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);   /* UI enter/exit */
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1); /* on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);        /* sheet/drawer feel */
--ease-swap: cubic-bezier(0.2, 0, 0, 1);              /* icon/content swap (see animations.md) */
```

**Duration budgets.**

| Element | Budget |
| --- | --- |
| Button press feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-500ms |
| Marketing/explanatory surfaces | May run longer, deliberately |

Perceived performance is part of the budget: a faster spinner makes the same wait feel shorter, and skipping the tooltip delay after the first one makes a whole toolbar feel faster.

**Press feedback.** `scale(0.96)` on `:active` with `transition: transform` around 150ms ease-out - the established house value (see animations.md; never below 0.95).

**Springs.** Use for drag with momentum, interruptible gestures, and elements that should feel alive. Duration/bounce configs are easier to reason about than raw physics; keep bounce subtle (0.1-0.3) and reserve visible bounce for drag-to-dismiss and playful surfaces. Springs carry velocity through interruption, which is why they beat keyframes for anything a user can reverse mid-motion. For decorative pointer-tracking, interpolate through a spring rather than binding directly to pointer position.

**Interruptible entry without JS.**

```css
.toast {
  opacity: 1; transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}
```

**Stagger.** Two scales, deliberately different: per-item list staggers run 30-80ms between items; semantic section staggers (hero, then subhead, then card grid) run ~100ms per chunk (see animations.md). Longer inter-item delays read as slowness. Stagger is decorative - never block interaction while it plays.

**Transforms worth knowing.** `translate` percentages are relative to the element's own size, which is what makes `translateY(100%)` a dimension-independent off-screen position for toasts and drawers. `scale()` scales children too - a feature for press feedback. `clip-path: inset(t r b l)` animates reveals, hold-to-confirm fills, seamless active-tab color swaps (duplicate + clip), and comparison sliders.

**Blur budget.** One rule set for every animated or transitional blur, so the numbers agree wherever blur appears:

- Transitional blur that ANIMATES stays at or under `8px`. Animated blur is one of the most expensive filters to composite, especially in Safari, so the ceiling is firm.
- Small static or crossfade-masking blur sits in the `2-4px` sweet spot - enough to soften an edge or bridge a rough state change, cheap enough to animate freely.
- Anything approaching `20px` is reserved for non-animated decorative backdrops (a frosted panel, a dimmed background). Never animate a blur that large.

**Crossfade masking.** When two overlapping states refuse to read as one transformation no matter the easing, a small transitional `filter: blur(2px)` (inside the 2-4px sweet spot above) bridges them. It is a soft-focus mask, not a heavy blur - stay within the blur budget; animated blur past `8px` is expensive, especially in Safari.

**Gestures.** Dismiss on velocity, not just distance (a flick past ~0.11 px/ms should dismiss even if short). Damp drags past natural boundaries with rising resistance instead of a hard stop. Take pointer capture when a drag starts so it survives leaving the element. Ignore additional touch points once a drag is active.

## Output format

Two parts, in order.

**Part 1 - findings table.** One markdown table, one row per issue, following the tactical-polish before/after format (see SKILL.md) with a Why column:

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms var(--ease-out-strong)` | `all` animates unintended properties off-GPU |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | nothing appears from nothing |

**Part 2 - verdict.** Remaining commentary grouped by impact tier, highest first, empty tiers omitted: feel-breaking regressions; motion that should be deleted; performance; interruptibility and timing; origin, physicality, and cohesion; accessibility. Close with an explicit **Block** (any feel-breaking regression, high-frequency/keyboard animation, `scale(0)` or `ease-in` on UI, or an easy GPU fix declined) or **Approve**.

Cite `file:line`. Pull exact values from this file rather than approximating.

## When feel is uncertain

Slow the animation 2-5x (or use the DevTools animation inspector) and check that coordinated properties stay in sync, easing does not end abruptly, and the origin is right. Step frame-by-frame for timing drift. Test gestures on a real device over LAN, not a desktop pointer. And re-watch with fresh eyes the next day - imperfections invisible during a build session surface immediately after one.
