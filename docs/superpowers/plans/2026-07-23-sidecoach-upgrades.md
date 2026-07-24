# Sidecoach Upgrade Plan (regroup, staged)

**Authored against commit:** `a22d41fc`
**Date:** 2026-07-23
**Collaborator:** Jonah
**Status:** PLAN ONLY (not implementation). No code changed. Not committed.

> Stamp check before executing (Team Rule #10): if HEAD has moved off `a22d41fc`,
> re-verify the current-state claims below (file paths, scanner rule lists, CLI
> inventory, eval-harness names) before acting. A drifted plan is a hypothesis.

Codename note: the competitive rival is referred to ONLY as "oracle" throughout.
No real product name, author handle, or domain appears here (Jonah hard rule,
2026-06-26 scrub convention). Oracle's code is studied as a quality-bar, never
vendored (reimplement-and-own).

---

## 0. Grounding and scope

This plan operationalizes the four gaps we chose to pursue from the 2026-07-23
oracle v4 competitive gap analysis (`.claude/memory/session_2026-07-23_oracle-v4-gap-analysis.md`).
It is the FIFTH borrow list; the prior four never drained. The discipline this
time is: each stage ships as staged units with a RUNNABLE verify check, so the
gap converts to code instead of being re-captured a sixth time.

### What we are building (ranked)
1. (TOP) Provider-specific defect-mining loop + skill-prose ablation.
2. Integrated generative authoring, staged (palette recipe -> pre-render authorship -> outside-ranking roll -> deck presentation).
3. Unified scanner productized (one `detect` CLI + a real hook path).
4. Taste rule-count delta (cheap wins on the rendered engine).

### HARD EXCLUSION (do not plan)
No "live" / Live Mode / in-browser variant-preview feature. Jonah rejected it;
the sidecoach `live` verb is being removed in parallel. Nothing in this plan
adds a live iteration surface, an HMR variant carousel, or an interactive
in-browser variant-preview page. Where oracle's pipeline uses an in-browser
decision surface, we substitute an exclusion-safe artifact/deck (Stage 2d) and
explicitly hold the interactive browser page out of scope (see Section 6).

### Edges we PRESERVE (every stage must respect these)
- **Rendered Playwright engine** on the CI/hook path (computed styles, rendered
  WCAG over a walked tree). Oracle's CI/hook path is STATIC; they render only in
  their browser extension. Do not switch to static-only to chase their speed.
- **Fail-closed honesty.** A scan that did not run returns `inconclusive`, never
  `clean` (see `audit-rendered.ts` verdict logic). New detectors inherit this.
- **Independence discipline.** Held-out corpus, author != labeler, independent-model
  (Codex) subjective labeling, cross-model review gate. Oracle's evals are now
  real and heavy but SINGLE-VENDOR self-eval; our remaining edge is independence.
  Lean on it: any new measurement uses held-out briefs, and any new taste class
  is labeled by the held Codex pass, never by its rule author.
- **Beats memory** (cross-session/cross-machine continuity).

### Constraint: "more capable AND simpler"
Do NOT adopt oracle's ~59 deterministic rules as 59 hand-maintained rules. Adopt
the ~17 issue CLASSES. Stage 4 enumerates the classes and maps each to a rendered
detector or an honest exclusion. Rule count is a coverage gap, not an engine-truth
gap: our rendered engine already out-truths their static one; we are widening
coverage on rails we own.

### Current capability (verified at `a22d41fc`)
- Rendered scanners (Playwright): `src/validators/objective-rendered-scanner.ts`
  (5 objective rules: broken-image, skipped-heading, low-contrast, gray-on-color,
  justified-text) and `src/validators/subjective-rendered-scanner.ts` (3 taste
  rules: tiny-text, nested-cards, marketing-buzzword). Combined by
  `rendered-live-scan.ts` and surfaced through `audit-rendered.ts`.
- Static ban detectors: `src/absolute-ban-detector.ts` (5 real scanners:
  gradient-text, glassmorphism, side-stripe-borders, hero-metric-template,
  modal-as-first-thought), adapted in `src/validators/checks/anti-pattern-checks.ts`.
  `src/design-laws.ts` declares 27 anti-patterns as regex stubs; only 5 have real
  scanners.
- Generated rule registry: `src/product-rule-registry.ts` + `validators.generated.ts`
  (`getRuleById`), driven by `scripts/generate-validators.ts` (with a `--check`
  mode already wired into `npm run build`).
- Eval harness (`eval/`): Contract-6 gate. `oracle-comparator.mjs` runs oracle
  headless for A1-A4 (parity vs spec-math) + A5a (taste detection vs Codex labels);
  `buzzword-calibrate.mjs` imports the SHIPPING in-page scorer and sweeps its
  threshold (the self-improving-measurement pattern we already own, in miniature);
  `corpus/` has dev/heldout/challenge/known-good splits + neutral `briefs`;
  `power-analysis.mjs` locks N; A5b is a periodic generative head-to-head.
- CLI inventory (`bin/`): `sidecoach-monitor.js`, `sidecoach.js`,
  `sidecoach-taste-check.js`, `sidecoach-build-report.js`, `sidecoach-present.js`,
  `sidecoach-daemon.sh`. There is NO `detect` CLI (the fake one was removed).
- Font vocabulary lives in `src/fontshare-reference.ts` (name/family/fallback).

### Verification baseline (Team Rule #9 - a baseline EXISTS)
`npm run build` runs `generate-lanes` + `generate-validators --check` + `tsc`;
`npm test` runs the build then `scripts/run-tests.ts`; `eval/*.test.mjs` cover
corpus integrity and labeling. Every stage below adds its verify check on top of
this green baseline. No stage may be reported done with the baseline red.

### Cross-cutting guardrails (apply to all stages)
- **Independence:** generation/sampling uses the neutral briefs and held-out
  splits; taste classes are Codex-labeled with the author registered in
  `corpus/rule-authors.json` so the freeze gate rejects author-labeled ground truth.
- **Fail-closed:** any new scan/measure returns `inconclusive`/`available:false`
  on error, never a false clean.
- **No vendoring:** we measure OUR OWN defect distribution and build OUR OWN
  direction deck. We never persist oracle's distribution numbers, world-deck, or
  code. Oracle stays a studied comparator in `eval/` only.
- **Verbatim-copy guard:** new scanner code / skill prose / corpus passes the
  existing similarity gate vs studied oracle source and prose.
- **Cross-model review:** each stage's implementation unit clears an independent
  Codex review before it is reported done (per the produce-and-verify mandate).

---

## Stage 1 (TOP PRIORITY): Provider-specific defect-mining loop + skill-prose ablation

**Why first:** oracle's strongest DURABLE capability and the one the rest of the
field cannot easily copy. It is a self-improving MEASUREMENT loop (specific n's
and percentages), not marketing. It sits directly on rails we already own: the
eval corpus, the neutral briefs, the shipping rendered scanner, the
`buzzword-calibrate` single-source pattern, the Anthropic SDK dependency, and the
cross-model Codex substrate. We have the theater-purge CULTURE and zero mechanized
version. This is the borrow-one-thing pick.

The loop: sample each target model's real UI output -> measure the defect
DISTRIBUTION per provider with our own scanner -> compile provider-targeted
counter-rules into the skill guidance AT BUILD TIME -> ablation-test our own skill
prose and delete lines that PRIME defects.

Overall effort: MED-HIGH. Runs as a PERIODIC/release workflow (API cost + provider
keys), NOT a per-commit gate, mirroring A5b.

### Stage 1a - Provider sampling harness
- **Goal:** generate N UI pages per target model from the fixed neutral briefs.
- **Approach:** `eval/provider-sample.mjs`. Provider adapters behind one interface:
  Claude (latest, via the existing `@anthropic-ai/sdk`), gpt-5.4, and latest
  Gemini (adapters gated on the presence of each provider key; a missing key skips
  that provider, fail-closed, never fabricates output). Input = `eval/corpus/briefs`
  (held-out briefs only, for independence). Output = HTML files + a manifest
  (`provider`, `brief-id`, `model-id`, `capture-utc`, content SHA). Latest model IDs
  only (Team Rule: no legacy versions).
- **Effort:** MED.
- **Verify:** `node eval/provider-sample.mjs --provider claude --n 3 --dry-run`
  writes 3 HTML files + a manifest and exits 0; `--provider claude --n 3` with no
  key set exits nonzero with "no key" and writes nothing (fail-closed). Assert
  `manifest.pages.length === filecount`.

### Stage 1b - Defect-distribution measurement
- **Goal:** per-provider, per-rule defect fire-rate distribution (e.g. "X% of
  provider P pages fired extreme-negative-tracking").
- **Approach:** `eval/defect-distribution.mjs` runs the SHIPPING rendered scanner
  (objective + subjective + Stage 4 classes as they land) over the Stage 1a sample
  set and emits a committed JSON artifact:
  `{provider: {rule: {fired, total, rate}}}`. Reuses the exact scanner the audit
  ships (single-source, no reimplementation - the `buzzword-calibrate` integrity
  rule). Fail-closed: a page that did not render is counted as `inconclusive`,
  excluded from the denominator, and reported separately.
- **Effort:** LOW-MED.
- **Verify:** `node eval/defect-distribution.mjs --in <sample-dir>` emits a JSON
  file whose schema validates (every rule in the registry has an entry; every rate
  in [0,1]); assert non-empty and that inconclusive pages are excluded from rate
  denominators. A synthetic all-defect fixture set reports rate ~1.0 for its
  planted class.

### Stage 1c - Build-time counter-rule compilation
- **Goal:** compile provider-targeted counter-rules into the skill/orchestrator
  guidance at build time, as CLASSES (not per-page rules).
- **Approach:** `scripts/generate-counter-rules.ts` reads the Stage 1b distribution
  and emits a generated guidance module (e.g. `src/counter-rules.generated.ts`):
  for provider P, the classes P over-produces (rate above a frozen threshold)
  become "watch for <class>" guidance lines the orchestrator appends WHEN the
  active model's provider is P. Follows the existing `generate-validators.ts`
  generator + `--check` idiom so drift is caught in `npm run build`. Keep to the
  ~17 classes; never expand to a 59-line hand list.
- **Effort:** MED.
- **Verify:** `npx ts-node scripts/generate-counter-rules.ts --check` exits 0 when
  the generated file matches the distribution input and nonzero when it is stale
  (same contract as `generate-validators --check`, so it joins `npm run build`).
  A unit test asserts every emitted counter-rule class exists in the rule registry
  (no orphan guidance).

### Stage 1d - Skill-prose ablation loop
- **Goal:** find and delete skill-prose lines that PRIME defects rather than
  reduce them (self-improving prose).
- **Approach:** `eval/prose-ablation.mjs`. For each candidate guidance line (or a
  named candidate set), generate the held-out briefs WITH and WITHOUT the line via
  Stage 1a, measure the defect-rate delta via Stage 1b, and rank lines by delta.
  A line with a positive defect-delta (defects UP when the line is present) is
  flagged for deletion; a negative delta confirms the line earns its place.
  Paired over the same briefs for a clean comparison; uses held-out briefs only
  (independence). Reports a ranked ablation table; deletion is a human-reviewed
  action, not automatic.
- **Effort:** MED-HIGH.
- **Verify:** `node eval/prose-ablation.mjs --dry-run` (mocked generator, fixture
  distributions) produces a ranked report where a seeded defect-priming line
  surfaces with a positive delta and a seeded protective line surfaces negative;
  assert ordering. Live run is periodic, key-gated, and cost-logged.

---

## Stage 2: Integrated generative authoring (staged)

**Why:** the three gaps we keep re-capturing (generative / visualizer-authorship /
anti-sameness) are the same three oracle shipped as ONE integrated pipeline. We
ship it as staged, exclusion-safe units. New idioms we lack: outside-ranking roll,
rendered-before-build, contract-then-verify. We build our OWN generative substrate;
we do NOT vendor oracle's world-deck (IP + reimplement-and-own).

Overall effort: HIGH but stageable. 2a-2c are the substance; 2d is the
exclusion-safe presentation.

### Stage 2a - Palette-construction recipe
- **Goal:** a deterministic palette recipe that fills the generative gap and feeds
  our rendered-WCAG engine.
- **Approach:** `bin/sidecoach-palette.js`. Borrow the APPROACH (not code): from
  PRODUCT.md brand inputs, construct a structured palette - base + accents +
  semantic roles, each an OKLCH lightness ramp - and emit DESIGN.md token
  frontmatter with `{token.path}` references. Every text/background pair is
  WCAG-checked through the SAME rendered contrast logic the objective scanner
  already uses. Fail-closed: if any required pair falls below 4.5:1 (3:1 for large
  text), the recipe reports the failing pair and refuses to emit a "clean" palette.
- **Effort:** LOW-MED.
- **Verify:** `node bin/sidecoach-palette.js --brand <fixture>` emits a token set;
  piping it through the existing WCAG check asserts all required pairs pass; a
  fixture engineered to fail contrast makes the command exit nonzero with the
  failing pair named. `npx @google/design.md lint` passes on the emitted frontmatter.

### Stage 2b - Pre-render authorship (design board + first-surface mock)
- **Goal:** render-before-build - author a design-system board and a first-surface
  mock, RENDER them, and audit before the full build proceeds (contract-then-verify).
- **Approach:** a `shape`/`craft` sub-step that produces (1) a design board
  (tokens + type scale + component inventory) and (2) a first-surface mock as real
  HTML, renders both headless via the existing Playwright engine, and runs the
  shipping audit. The build proceeds only if the mock audit returns a real verdict
  (not `inconclusive`) and clears blocking findings. This is the "5-block build
  contract + finishing-review" idiom expressed on our rendered engine.
- **Effort:** MED.
- **Verify:** given a brief, the sub-step writes a board artifact + a mock HTML
  file, the mock renders headless, and `runRenderedAudit` returns a verdict of
  `clean`/`warnings-only`/`blocked` (never `inconclusive` on a well-formed mock);
  assert board artifact exists and verdict is present. A deliberately broken mock
  yields `blocked` and halts the build step.

### Stage 2c - Outside-ranking direction roll (OUR OWN curated deck)
- **Goal:** break model sameness by drawing a direction from OUTSIDE the model's
  own top-ranked concept, with re-roll excluding prior draws (the variance fix -
  strictly better than the unbuilt "read a log, pick differently").
- **Approach:** `bin/sidecoach-roll.js` over a SMALL curated direction deck we
  author ourselves (`src/direction-deck.ts` or a data file - our own curated
  entries, do NOT vendor oracle's ~188 worlds). Roll ranks the model's own instinct
  LAST and draws from the remainder; re-roll accepts an exclusion set and never
  redraws a used id. Deterministic under a seed for testability.
- **Effort:** MED.
- **Verify:** `node bin/sidecoach-roll.js --seed 42` is deterministic (same seed,
  same draw); a re-roll passing the prior draw in `--exclude` never returns a used
  id and never returns the model-top id; assert no-repeat over a full deck sweep
  and that the draw differs from the recorded model-top.

### Stage 2d - Direction presentation (exclusion-safe deck)
- **Goal:** present rolled directions for a decision WITHOUT an interactive
  in-browser variant surface.
- **Approach:** surface-aware presentation per the executive-report contract: on
  rich surfaces render the rolled deck as a visualizer artifact; on text surfaces
  a clean markdown deck. The user picks by responding; re-roll is a re-invocation
  of Stage 2c. No live edit surface, no variant carousel.
- **Effort:** LOW.
- **Verify:** the presenter emits a deck with N distinct directions in both surface
  modes (assert artifact HTML on rich, markdown table on text); no HTTP server, no
  injected client script, no variant-preview code path is introduced (grep the
  diff for none).

> Held out of scope (see Section 6): the fully interactive in-browser DECISION
> page. It brushes the hard exclusion (in-browser variant surface) and the roll
> works as a terminal/artifact flow without it. Flagged for a separate decision.

---

## Stage 3: Unified scanner productized (one `detect` CLI + real hook path)

**Why:** oracle's ONE registry feeds their CLI + extension + critique + evals +
edit-hooks identically. We own all the pieces (two rendered scanners, five ban
detectors, the checks registry, the generated rule registry) but they are scattered
across ~8 modules with no `detect` CLI (the fake one was removed - the replacement
must ACTUALLY render/scan, never fake a clean). Reimplement-and-own stands; this is
wiring what we already own into one product surface.

Overall effort: MED.

### Stage 3a - One `detect` CLI entry point
- **Goal:** a single command that scans any target and emits normalized findings.
- **Approach:** `bin/sidecoach-detect.js <target>`. Dispatch: a URL/host/HTML
  target -> `runRenderedAudit` (objective + subjective rendered lenses); a source
  file/dir target -> the static ban detectors + `run-validator` checks. Normalize
  to one findings shape (`{rule, severity, lens, selector|file:line, detail}`,
  the union of `RenderedAuditFinding` and the check verdicts). Inherits fail-closed:
  nothing scanned -> `inconclusive`, never `clean`. Reuses the existing
  `looksLikeUrl` discriminator already in `audit-rendered.ts`.
- **Effort:** MED.
- **Verify:** `node bin/sidecoach-detect.js eval/fixtures/known-defect/gradient-text.html`
  emits the planted finding and exits nonzero; a clean fixture emits `clean` and
  exits 0; a URL that fails to launch emits `inconclusive` (asserted in stdout JSON)
  and NOT `clean`.

### Stage 3b - Real hook path
- **Goal:** productize the scanner across the harness like oracle's edit-hooks -
  the REAL scanner, not the removed fake.
- **Approach:** a hook wrapper (`claude/hooks/sidecoach-detect.sh`) that invokes
  `bin/sidecoach-detect.js` on changed UI files and surfaces findings. Advisory,
  not blocking: the finding COUNT is honest (fail-closed verdict), but the hook
  decision is fail-open so an `inconclusive` render never wedges an unrelated edit.
  Reports findings to context; does not auto-fix.
- **Effort:** LOW-MED.
- **Verify:** running the hook script against a staged known-defect file reports
  the finding and exits with the documented advisory code; against a clean file it
  is silent and exits 0; an `inconclusive` scan does not block (exit 0 + a warning).
  Covered by a `test-sidecoach-detect.sh` alongside the other hook tests.

### Stage 3c - Registry consolidation (single source)
- **Goal:** one registry of rules feeds the CLI + hook + audit command + eval, so
  adding a rule updates every surface (oracle's "one registry feeds all").
- **Approach:** extend the existing generated `product-rule-registry` to be the
  single manifest (rule id -> detector fn -> severity -> lens -> surface support),
  and have `detect`, the hook, `audit-rendered`, and the eval scan all resolve rules
  through it. A `--list-rules` flag enumerates the registry. No new rule engine;
  this is consolidation of the source of truth.
- **Effort:** MED.
- **Verify:** `node bin/sidecoach-detect.js --list-rules` enumerates the registry;
  a test asserts every rule the rendered audit path can fire is present in the
  registry (no orphan rules) and that `npm run build`'s `generate-validators --check`
  stays green after consolidation.

---

## Stage 4: Taste rule-count delta (cheap wins on the rendered engine)

**Why:** oracle has ~59 deterministic rules vs our ~42-rule registry (only 5 of 27
anti-laws have real scanners; the rendered subjective scanner has 3 classes). This
is a COVERAGE-COUNT gap, not an engine-truth gap - theirs is static (htmlparser2 +
CSS cascade), ours is rendered Playwright. We host the missing classes on our
rendered engine. Adopt the ~17 CLASSES (constraint: not 59 hand rules), each with
a `buzzword-calibrate`-style single-source scorer + threshold swept on the dev
corpus and frozen on principle, Codex-labeled (author != labeler), and cleared
through the Contract-6 A5a gate before shipping.

Overall effort: LOW-MED per class.

The ~17 classes, mapped:

### Stage 4a - Font-family read (cheapest)
- **Goal:** flag typographic monoculture / default-stack / brand-mismatch using the
  fontshare vocabulary.
- **Approach:** read computed `font-family` across content text; classify against
  `src/fontshare-reference.ts` (default system stack, over-used Google-font
  monoculture, mismatch to the brand's committed family). Rendered class on the
  subjective scanner.
- **Effort:** LOW.
- **Verify:** a fixture on a bare system stack fires; a branded fixture does not;
  the calibration harness reports P/R on dev labels above the frozen floor.

### Stage 4b - Typographic-extreme classes
- **Classes:** extreme-negative-tracking, tight-leading, all-caps-body,
  oversized-h1, sub-11px UI text.
- **Goal:** computed letter-spacing / line-height / text-transform / h1 size vs
  viewport / interface font-size, each a rendered subjective class with a
  taste-calibrated threshold.
- **Approach:** extend `inPageSubjective` with these reads (same visibility +
  peripheral guards already in the scanner). Each threshold frozen on principle +
  dev signal, never on held-out.
- **Effort:** LOW-MED.
- **Verify:** per-class fixture fires; known-good does not; calibration P/R above
  floor; A2 precision non-regression on the known-good bucket.

### Stage 4c - Structural taste classes
- **Classes:** thin-border-wide-shadow, repeating-stripe-gradients,
  text-under-overlay, first-viewport-overflow, decorative dot/grid fields,
  soft radial-glow halos, image-hover-transform.
- **Goal:** computed-style + geometry reads on the rendered tree.
- **Approach:** rendered detectors (border-width vs shadow-spread ratio, repeated
  linear-gradient stops, text over a low-contrast image overlay, content taller
  than the first viewport, repeated small background dots/grid, large blurred
  radial glow, hover transform on images). Precision-first thresholds like the
  existing nested-cards tighten.
- **Effort:** MED.
- **Verify:** per-class fixtures + calibration; each clears A5a before shipping.

### Stage 4d - Motion/marker classes + honest exclusions
- **Detectable classes:** marquees (`<marquee>` / marquee-keyframe), blinking
  cursors (blink animation), numbered-section-markers (rendered numeric prefixes).
- **Honest EXCLUSIONS (do NOT claim a class a DOM/computed-style engine cannot
  truthfully detect - preserves the fail-closed edge):**
  - stock geometric hero ART inside a raster image (DOM-invisible; never OCR - it
    hits oracle's DOM engine equally).
  - aphoristic-cadence / theater-slop-phrase - copy-SEMANTIC, not computed-style;
    the marketing-buzzword density model is the closest we go, and expanding it is
    a separate calibrated effort, not a cheap geometry read. Mark out-of-scope
    rather than ship a low-precision guess.
- **Effort:** LOW (detectable) / zero (exclusions - a documented decision).
- **Verify:** detectable-class fixtures fire + calibrate; the exclusion list is
  recorded so no future pass claims render-detection of an undetectable class.

> Every Stage 4 class ships only after `node eval/oracle-comparator.mjs` (A5a
> detection head-to-head) shows recall >= floor and precision >= floor with no A2
> regression, and the class calibration harness reports its frozen operating point.

---

## 5. Sequencing and dependencies

- **Stage 3 (detect CLI + registry)** is a soft prerequisite for the cleanest
  version of Stages 1b and 4: a single `detect` entry and one rule registry make
  the distribution measurement and new-class wiring trivial. But Stage 1 can start
  against the existing scanners in parallel; do not serialize Stage 1 behind Stage 3.
- **Stage 4** feeds **Stage 1b** - the more classes the scanner detects, the richer
  the per-provider distribution. Land the cheap Stage 4a/4b classes early so Stage 1
  measures against a wider rule set.
- **Stage 2** is the most independent track; it shares the rendered engine (2a/2b)
  and the eval briefs (2c) but does not block the others.
- Recommended order: **3a -> 4a/4b -> 1a/1b -> 3b/3c -> 1c -> 4c/4d -> 1d -> 2a -> 2b -> 2c -> 2d.**

### Ranked stage list (headline)
1. **Stage 1 (TOP):** provider defect-mining loop + prose ablation. MED-HIGH. The durable borrow; periodic/release workflow on our eval + Codex rails.
2. **Stage 2:** integrated generative authoring, staged. HIGH (stageable): 2a palette LOW-MED, 2b pre-render MED, 2c roll MED, 2d deck LOW.
3. **Stage 3:** unified scanner productized. MED: 3a CLI MED, 3b hook LOW-MED, 3c registry MED.
4. **Stage 4:** taste rule-count delta. LOW-MED per class: 4a font LOW, 4b type-extremes LOW-MED, 4c structural MED, 4d motion + honest exclusions LOW.

---

## 6. Out of scope / deferred (explicit)

- **Interactive in-browser decision page** (Stage 2 tail): brushes the hard
  exclusion (in-browser variant surface). The roll works as a terminal/artifact
  flow (Stage 2d). Deferred for a separate decision, not planned here.
- **Live Mode fold into Justify:** DROPPED ENTIRELY (Jonah, 2026-07-23). The live
  feature was cut from Sidecoach and the whole in-browser-variant direction is not
  pursued - the Justify fold (variant preview + accept-to-source) is dead with it,
  and the throwaway demo was deleted. Not a future track.
- **Surface-purpose modes replacing the register** (oracle's minor #6): low moat,
  low effort. Note that oracle killed the register FOR CAUSE (their bias mining
  showed category-to-aesthetic recipes caused slop); if we revisit our register,
  take the four per-surface modes, not the register. Not scheduled here.
- **Adopting oracle's 59 rules as 59 hand rules** or **vendoring the world-deck:**
  forbidden by the "more capable AND simpler" constraint and reimplement-and-own.

---

## 7. Reconciliation backlog (OPEN + UNSCHEDULED from lists 1-4)

Surfaced by `docs/superpowers/plans/2026-07-23-borrow-list-reconciliation.md` (stamped
`1ea7ae73`), which buckets every gap from every prior borrow list against Stages 1-4. The
meta-finding this plan names ("fifth borrow list, prior four never drained") turns out to
UNDERCOUNT: by a strict one-beat-one-list rule there are 6 design-competitive gap lists (11
across both lineages), and the rows below are real gaps that NO stage above covers. Append
only; this is a surfaced backlog, not a re-plan. See the reconciliation doc for the full
master table, the SUBSUMED/SCHEDULED/DEAD/UNKNOWN buckets, and the `named-vibe-variants.md`
citation-drift finding (it is an `_extracted` reference file, not a gap-list beat).

MISSION-PRIMARY (the /goal's named biggest objectives; this plan adds machinery AGAINST the "simpler" half):
- Maintainability / complexity - 6+ routing impls, triplicated classifier, ~138 files/~40k SLOC (first captured 2026-06-23, rubric GAP3).
- Distributability - no plugin manifest, absolute paths, build-required, non-portable (2026-06-23, GAP4).
- Workflow simplicity - 4 parallel vocabularies (phases/verbs/lanes/NL); only lane_live was cut (2026-06-23, GAP5).

Taste / motion / responsive sophistication (documented-only, mostly since 2026-05-25):
- Visualizer AUTHORSHIP - own the guard/contract/gate, zero machinery to build the artifact; 2d only presents a deck (2026-07-16, F2).
- Heading-size-by-role table - card vs modal vs display (2026-05-25, cap-gap 13).
- Font-pairing rules - one sans + one serif (2026-05-25, cap-gap 14).
- Clamp-based fluid type-scale formulas (2026-05-25, cap-gap 15).
- Frequency-first motion matrix - should this animate at all; double-sourced (2026-05-25, cap-gap 16).
- Motion sophistication - Emil's 3 named easings, asymmetric enter/exit, Framer x/y gotcha (2026-05-25, cap-gap 17/18/19).
- iOS 100vh trap - svh/dvh/lvh (2026-05-25, cap-gap 25).
- Saturated-aesthetic lanes / 2nd-order category-reflex avoid-list (2026-05-25, cap-gap 29).
- Bencium 5-tier breakpoint table + pattern transitions (2026-05-25, absorption/cap-gap 22).
- ALWAYS-ASK protocol - ask before deciding (2026-05-25, cap-gap 34).
- hero-eyebrow accent-bold refinement (2026-06-23, rubric R1 sub).

Coverage / process (out of the oracle-taste frame but un-drained):
- Strategic Omissions / "what AI forgets" + "what never changes silently" (2026-05-25, taste-skill T4).
- fact-check (doc-claims vs code) + plan-review-vs-codebase + banned-truncation patterns (2026-07-16, F5).
- Surface-purpose modes replacing the register - already noted "not scheduled" in Section 6 (2026-07-23, v4 minor #6).
- Domain-coverage cluster - data-viz palettes, security-as-UI, notification hierarchy, empty-state taxonomy, PWA, drag-drop/command-palette catalogs, print/email, process protocols (2026-05-25, oracle_absorption).
- Lineage-B capability cluster - Forms (ZERO coverage), gesture physics, chart-type selection, CSS Scroll/View Timelines (ZERO coverage), content-resilience, URL-as-state, dark-mode device-UI, touch/mobile CSS, static remediation-mode, forced-divergence 5-axis variant taxonomy, interface-robustness stress test (2026-05-28 / 2026-06-12).

Two items could not be classified (UNKNOWN in the reconciliation doc): OMC infra gaps
(model-tier routing / stop-callbacks / persona injection) and the list-2 wiring-architecture
items (SKILL_REF/`_extracted`/flowM/responsive-foundation) - both presuppose the
pre-convergence architecture and were never re-audited; not asserting a bucket unread.
