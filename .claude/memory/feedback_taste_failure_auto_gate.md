---
name: Recognize real taste failures automatically - red-as-text contrast antipattern + the missing QA gate
description: Jonah - "how do I make you recognize real taste failure before I even have to mention it?" I shipped a WCAG contrast antipattern (brand red as readable text, 3.26:1 dark / 4.23:1 light) because I declared "done" without running sidecoach's a11y/contrast checks. The capability exists; the blocking gate does not.
type: feedback
relates_to: [session_2026-06-15_sidecoach-proof-of-concept.md, feedback_mode_words_unnatural.md]
---

Jonah (2026-06-15), pointing at the active chapter link, the cross-links, and an
install paragraph: "Antipattern much? ... How do I make you recognize real taste
failure before I even have to mention it? Why can't we do what Oracle does
automatically?"

THE ANTIPATTERN I SHIPPED: brand red (#DC2618) used as readable TEXT - the active
sidebar link, the .ref-xlink cross-links, the hero eyebrow. Objective WCAG: red text
is 3.26:1 on the dark canvas and 4.23:1 on the cream canvas - BOTH below the AA 4.5:1
floor for normal text. Cream/ink text is 13.79:1. So red-as-text is a textbook
low-contrast accessibility antipattern.

FIX (root cause, not the symptom): brand red is an ACCENT only - the active-indicator
bar, underlines, the ampersand mark - NEVER the color of readable text or a text-link.
- .ref-chapter-link[aria-current] text -> var(--text-primary) (red stays the left bar).
- .ref-xlink text -> var(--text-primary) with a red border-bottom carrying the link
  affordance. Both now 13.79:1.
- STILL OPEN: .page-hero__tag eyebrow is red small text site-wide (same antipattern) -
  flagged to Jonah, not unilaterally restyled (shared brand class across all pages).

THE REAL ANSWER to "why didn't you catch it automatically": the package ALREADY has
the checker - sidecoach's static-a11y color-contrast rule and the browser-evidence
collector (the rendered-page contrast/tap-target/spacing checker, proven green: 55
suites). It did not get caught because I declared the page "done" WITHOUT running the
QA gate against the rendered page - I faked the gate. The capability exists; the
ENFORCEMENT does not.

HOW TO MAKE IT AUTOMATIC (the durable fix): make the a11y/contrast/anti-pattern check a
BLOCKING GATE on UI work - a hook that runs sidecoach's checks (or the browser-evidence
collector) against the rendered page and blocks "done"/commit until clean, exactly the
way bash-guard blocks emojis and em-dashes. That converts "I should run sidecoach" into
"I cannot ship without sidecoach passing." That is the difference between a tool that
CAN catch a taste failure and a system that ALWAYS does. PROPOSED next build.

THE ACTUAL TASTE FAILURE (Jonah showed Oracle's rule): "Side-tab accent border -
thick colored border on one side of a card - the most recognizable tell of AI-generated
UIs." I had red left-stripes on the .ref-callout boxes AND the active sidebar link. I
chased contrast and walked past the AI-slop tell. Sidecoach HAS this exact rule
(anti-pattern.side-stripe-borders, one of 6 absolute bans) - so it CAN do what Oracle
does - BUT it did not fire because:
1. DETECTOR GAP (now fixed): scanForAbsoluteBans's `targetable` regex only matched class
   names STARTING with card/callout/etc (\.callout\b), so namespaced/BEM names like
   `.ref-callout`, `.tool-card` slipped through. A tokenized real design system was
   invisible to it. Fixed: match the keyword ANYWHERE in a class token
   (\.[\w-]*(?:card|callout|...)[\w-]*). After the fix the full sweep caught 2 findings:
   .ref-callout side-stripe (styles.css) AND the index .stats grid as a hero-metric-
   template (a SECOND ban I'd never have looked for - the payoff of running the whole sweep).
2. I only ran ONE check (taste-check), not scanForAbsoluteBans (all 6 bans) - "xyz instead
   of the whole alphabet" (Jonah's mock). The fix: run the FULL ban sweep + validator set,
   never a single check.

THE BIGGER MISS (the point behind every correction): I run one evaluator reactively after
Jonah points at something, instead of running sidecoach's ENTIRE evaluation proactively
before reporting. The only way to "catch taste failures before he mentions them" is to run
the complete sweep (scanForAbsoluteBans + taste + a11y/contrast + polish) on every UI build,
every time, and to wire it as a blocking gate (the auto-gate above) so it cannot be skipped.

FIX APPLIED to the page: removed the side-stripe from .ref-callout (bg tint + radius only)
and the active .ref-chapter-link (fill + semibold weight, no stripe, no red text).

SELF-ANALYSIS: I keep needing Jonah to point at failures because I report "done" before
running the real evaluators, and when I do run them I cherry-pick one. Discipline alone has
failed repeatedly; the fix is mechanical enforcement (the gate) + always run the FULL sweep.

Collaborator: Jonah.
