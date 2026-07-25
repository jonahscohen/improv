# Taste-engine scope: what the rendered subjective scanner can and cannot see

_As of commit e65c6bcc. Collaborator: Jonah._

This is the standing scope statement for the rendered taste-detection engine
(`src/validators/subjective-rendered-scanner.ts`). It records a deliberate architectural
decision (2026-07-25): the engine is scoped to **declared / static idioms** and is
knowingly blind to **script-driven idioms**. Read this before adding a taste class,
quoting an A5a number, or comparing recall against the reference detector.

## What the engine is

A precision-first detector for rendered "taste" defects. It renders an HTML string in a
hermetic Playwright context and reads the computed-style tree, the DOM structure, and the
declared `@keyframes` / `animation` rules. Each class follows a single-source split: one
in-page scorer walks the tree once and returns a raw score; Node applies the firing
thresholds, so the calibration harness sweeps exactly what ships.

It emits the Stage 4 rendered taste classes:

- **Typographic (4):** extreme-negative-tracking, all-caps-body, oversized-h1, sub-11px-ui.
- **Structural (7):** thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay,
  first-viewport-overflow, decorative-dot-grid, soft-radial-glow, image-hover-transform.
- **Motion / marker (2):** marquee, numbered-section-markers.

Thirteen classes, plus the earlier subjective classes (tiny-text, nested-cards,
marketing-buzzword, default-typeface). All Stage 4 classes are audit-only findings
(`ruleId: null`): the audit surfaces them, but no validator-owned decision rule consumes
them.

## The ceiling: hermetic render strips scripts

The render is **hermetic** by design: `stripScripts: true` removes every `<script>` before
`setContent`, and `abortExternal: true` blocks all non-`data:`/`about:` requests. This is
what makes the engine deterministic. It also means the only page the engine ever sees is
the one the markup and CSS declare on their own. Anything a script would have built at
runtime never exists in the tree the scorer walks.

Consequence, stated plainly:

- **Visible to the engine (declared / static):** computed styles, DOM geometry, declared
  `@keyframes` and `animation` shorthand, pseudo-element content, inline and linked CSS.
  The engine is strong here, and precision-first: its operating points sit below the
  near-universal tasteful band so competently built pages do not trip it.
- **Invisible to the engine (script-driven):** a marquee assembled by JS, a blinking caret
  driven by `setInterval`, content injected after load, class toggles that only a runtime
  applies. These live in behavior the stripped scripts would have produced, so they are
  structurally absent from the tree. No threshold tuning can recover them; they are not a
  miscalibration, they are out of scope.

The reference detector ("oracle") runs scripts and therefore out-recalls this engine on the
script-driven idioms. That gap is the accepted cost of determinism, not a defect to close by
tuning.

## Decision: accept static-only scope

Two options were weighed (Jonah, 2026-07-25):

1. **Accept static-only, document it (chosen).** Keep the deterministic hermetic render and
   scope the engine honestly to declared/static idioms. The script-driven classes it misses
   are minor idioms where the reference detector only marginally leads. No new failure modes.
2. **Add a scripts-on render variant (rejected).** A second render path that runs scripts
   would surface JS idioms, but it reopens the non-determinism the hermetic render
   deliberately closed: flaky A5a labels and flaky CI. The recall gained does not justify
   reintroducing that instability.

**Revisit when:** a script-driven idiom becomes a high-frequency, high-value defect that the
static scope provably cannot approximate, AND a way exists to run scripts without
reintroducing label/CI non-determinism (for example a pinned, seeded, time-frozen render).
Until both hold, static-only stands.

## Pulled classes (2026-07-25)

Two Stage 4 classes were removed from the product because the A5a grade proved they cannot
work in the real world without destroying precision:

- **tight-leading** - a construct mismatch. The detector measures a computed line-height
  ratio; the independent labeler judges perceived line *density*. No line-height threshold
  separates crowded-real from the browser default, so the class fired only on constructed
  fixtures and false-fired or missed on real pages.
- **blinking-cursor** - a script-driven idiom, invisible per the ceiling above. A real
  blinking caret is almost always JS-driven; a `@keyframes`-only detector sees the rare
  declared case and misses the common one, and firing from keyframes alone costs precision.

Both are reversible from git if a materially better approach appears. The historical Codex
labels for them remain in the corpus as record; the A5a grader no longer scores them.

## A5a grading posture

A5a grades this engine head-to-head against the reference detector using independent Codex
present/absent labels (recall on constructed positives, precision on real negatives). The
honest tiering as of the 2026-07-25 pass:

- **Certify (real precision, real or defensible recall):** all-caps-body, sub-11px-ui,
  numbered-section-markers, repeating-stripe-gradients, decorative-dot-grid, oversized-h1
  (recall modest but beats the reference detector after the H1_VW_RATIO revisit).
- **Audit-only (precision-strong, recall structurally bounded):** the remaining structural
  classes and marquee. Surfaced in the audit, not promoted to a decision rule.

The engine's identity is precision-first on declared/static idioms. Its recall in the wild
is bounded by the ceiling above, and that is reported, not hidden.
