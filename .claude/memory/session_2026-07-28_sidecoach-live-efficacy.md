---
name: Does sidecoach actually work? Measured the detection engine and the flow surface against real pages
description: Split verdict. The detection engine is REAL - objective detectors score P0.889-1.000 / R0.647-1.000 on 89 held-out real pages, and all 22 rendered rules fire. The FLOW surface is not - all 20 verbs return byte-identical canned output for a path target. Also found and fixed a false "clean, grade A" on any JS app that renders an empty shell. Taste detectors are weak: marketing-buzzword precision falls 0.839 (tuning) -> 0.304 (held-out).
type: project
relates_to: [session_2026-07-27_route-intent-live-efficacy.md, session_2026-07-25_taste-revisit-honest.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: shipped CLIs only (sidecoach-detect / sidecoach-monitor), 138 real captured pages, 12 non-fixture repo pages, 54 authored probes, npm test 168 -> 169 suites, 5 guard mutations caught, Codex review (codex-cli 0.142.5, 15 findings, all folded)
confidence: high
---

Collaborator: Jonah. The question was whether SIDECOACH works, measured the way
`session_2026-07-27_route-intent-live-efficacy.md` measured the router: drive the
SHIPPED user-facing path with inputs nobody chose to make the tool look good, and
never accept a green suite as the answer.

## Verification baseline (Team Rule 9, probed BEFORE anything changed)

- `npx tsc --noEmit` in `sidecoach/` exits 0.
- `npm test` exits 0: **168 suites passed**.

A real, runnable, green baseline exists.

## Verdict

**The detection engine works. The flow surface wrapped around it does not.**

This is NOT a repeat of the router result, and saying so plainly matters: the prior
expected another green-and-dead classifier. The objective detectors score P 0.889 to
1.000 with R 0.647 to 1.000 against the corpus' own ground truth on 89 held-out real
pages. That is a working product. What is canned is the flow layer, which is also the
layer this repo's CLAUDE.md mandates as the "primary read path".

## Finding 1 (CRITICAL) - every verb returns canned output for a path target

`sidecoach-monitor "/sidecoach <verb> <target>" --json` is the invocation SKILL.md
documents. Ran all 20 verbs against an empty HTML file and a page deliberately loaded
with defects (1.03:1 contrast, h1 -> h4 skip, 6px justified text, 404 image, 12x10px
button, buzzword copy, Times body).

**All 20 verbs produced identical findings, identical guidance, and identical grades
for both.** The only delta in the whole JSON was `generatedAt`, `reportId` and the ms
timers, confirmed by a line-by-line diff of the sorted JSON.

`/sidecoach audit` returns the same 2 findings for an empty file, the broken page, a
real page, a directory, and the repo's own `known-defect` fixture:

    performance:has_optimization_guidance | Domain validation: 1/2 rules passed
    domains-needs-testing                 | domains-needs-testing = 7 (target 7)

Neither is about the target. The first is the flow grading its OWN guidance text. The
second fires when the value EQUALS its target, which is not a defect. The rendered
report then tells the user to "resolve the performance:has optimization guidance issue
on the affected element" - there is no affected element.

Grades are per-verb constants regardless of input: shape F, clarify F, critique C,
harden C, audit B, animate B, delight B, extract B, A for the other twelve.

Codex confirmed the mechanism in source: a non-URL target is stored as
`metadata.commandTarget` and the generic handlers run project/context flows instead of
scanning it (`sidecoach-orchestrator.ts` ~885 and ~918).

## Finding 2 - the audit IS real, but only for a URL target

Given a URL the audit renders and genuinely scans:

| target | verdict | findings |
|---|---|---|
| empty page over HTTP | clean, grade A | 0 |
| deliberately broken page over HTTP | blocked, grade F | 4 (skipped-heading, 3x low-contrast) |

So the engine IS wired into the audit flow; it is reached only when the target string
is a URL. A path, file, or directory silently skips the render and emits the canned
payload with no warning that nothing was scanned. Verified for directories AND explicit
file paths.

This matters because CLAUDE.md and SKILL.md both instruct `/sidecoach audit <target>`
with a component or page path, and SKILL.md line 177 states the audit "renders the page
and runs the detection engine". For the documented, mandated invocation shape, it does
not.

**Scope correction (Codex F2, verified):** this is a FLOW-surface defect and does NOT
extend to `bin/sidecoach-detect.js`. Given a local `.html` file, detect renders it via
`file://` and runs all four lenses - my earlier read was an artifact of my own
`--no-render` flag. `detect ../reference/index.html` returns 8 findings across static
and rendered lenses. The one real coverage seam in detect: a URL target skips the static
lenses, a directory needs an explicit `--render-url`, and only a single-file target gets
everything by default.

## Finding 3 (CRITICAL, fixed here) - an empty render was reported "clean"

`tilt-lab/app/index.html` and `lotus/src/ui/index.html` are JS-mounted apps whose
`<body>` is 34 and 25 bytes. The render blocks/strips the bundle, so the scanner sees an
empty document. Both returned:

    lens objective: ran, 0 finding(s)
    lens subjective: ran, 0 finding(s)
    verdict: clean          exit 0

The CLI's own help states the opposite contract: "A lens that did not run is NEVER clean
- a partial scan with zero findings is inconclusive." Here the lenses DID run, on
nothing, so the availability guard never engaged. Each detector has a content floor
(`TYPO`/`TYPEFACE_MIN_CONTENT_CHARS` = 200, `SUB11_MIN_CHARS` = 150) that correctly
keeps it quiet, and that silence was reported upward as a clean bill of health. The
floors inverted into a false pass. **Any single-page app audited through sidecoach got
"clean, grade A".**

`session_2026-07-25_taste-revisit-honest.md` recorded the hermetic-render/JS gap as a
recall problem. What it missed is that the gap also manufactures a green verdict.

**Fixed.** Why: the fail-closed contract already existed and was documented; this was a
hole in it, not a new policy. How: a judgeability probe in `scanRenderedLive` marks BOTH
lens families unavailable, propagating through the existing discipline to `inconclusive`
+ exit 3.

Four properties, each one a folded Codex finding and each mutation-tested:
- **Consulted LAST, and only on an all-zero scan** (F8). The detectors run first, so a
  CSS-only page whose defect is a body-level glow/dot-grid/stripe still reports it. The
  guard can never suppress a finding.
- **Visible text only** (F12). `innerText` is the rendered-text projection;
  `textContent` is consulted only when innerText is unavailable, so hidden nodes,
  `<template>` bodies and no-JS fallbacks cannot clear the guard.
- **Geometry-bearing visuals only** (F11). A zero-size or unrendered image is not
  content. `iframe`/`object`/`embed` are excluded deliberately - our lenses never look
  inside them, so their presence is not evidence anything here can be judged.
- **Probe failure fails closed** (F13) with its own distinct reason. "We could not tell"
  is not a clean bill of health.

Also fixed the user-facing message (F15): a page that navigated but painted nothing was
being described as "did not render", which points at the wrong remedy. It now names the
empty-shell case and suggests auditing a server-rendered URL or a same-origin build.

Verification: both SPA pages exit 3; **0 of 138 real pages changed** versus the original
pre-fix run; all 22 probes and all 7 exact-spec probes unchanged; suite 168 -> 169
green; five mutations (guard deleted, probe-failure direction flipped, findings ignored,
geometry check dropped, textContent fallback restored) each caught by their own
assertion.

## Finding 4 - the objective lens is genuinely strong on real pages

Page-level, against the corpus' own objective ground truth, 89 held-out real pages:

| detector | precision | recall | positives |
|---|---|---|---|
| skipped-heading | **1.000** (32/32) | **1.000** (32/32) | 32 |
| broken-image | **1.000** (5/5) | **1.000** (5/5) | 5 |
| low-contrast | 0.889 (40/45) | **1.000** (40/40) | 40 |
| gray-on-color | 0.786 (11/14) | 0.647 (11/17) | 17 |

This is the strongest evidence in the whole session and it is the part I nearly missed
by focusing on the taste classes. The repo's `referee-independence` test (green in the
suite) asserts the objective scanner shares no code with the eval referee, which is a
real mitigation against the labels and the detector being the same thing twice.

## Finding 5 - the taste lens is much weaker, and one class is inert

Against pre-existing independent codex screenshot labels, 89 held-out real pages:

| detector | held-out P | held-out R | dev P | dev R |
|---|---|---|---|---|
| tiny-text | **1.000** (15/15) | 0.231 (15/65) | 1.000 (11/11) | 0.234 (11/47) |
| marketing-buzzword | **0.304** (7/23) | 0.875 (7/8) | **0.839** (26/31) | 0.839 |
| nested-cards | 0.400 (2/5) | 0.286 (2/7) | 0.900 (9/10) | 0.333 |
| numbered-section-markers | n/a (0 fires) | **0.000** (0/3) | n/a (0 fires) | **0.000** (0/3) |

- **tiny-text generalizes.** P 1.000 on BOTH corpora, R ~0.23 on both. Precision-first,
  working as designed, and the design holds off its tuning set.
- **marketing-buzzword does not.** Precision falls 0.839 -> 0.304 moving from the tuning
  corpus to held-out; 16 of 23 held-out fires are labeled false. Hand-adjudicated three:
  MDN at 1.6/100 words ("seamless, transformative, efficient"), Rust at 2.2/100
  ("supercharge, empower, robust, scalable, smart, integrated, productivity,
  efficient"), Vercel docs at 1.4/100 ("ai-powered, sophisticated, optimize, automate").
  The list counts ordinary technical vocabulary as marketing puffery. The source comment
  records the threshold as frozen on dev "NEVER on held-out knowledge (frozen-90 is
  spent)" - so nobody had measured this. Now measured. Per Codex F5 this is a
  **generalization failure**; calling it proved overfitting would need evidence the dev
  labels shaped the threshold while held-out stayed comparable, which I did not gather.
- **numbered-section-markers is inert** - 0 fires against 6 labeled positives across both
  corpora. This CONFIRMS the near-zero-real-recall concern in the taste-revisit beat for
  this class. The scanner's own comment already predicts it (CSS counter content does not
  serialize), so the honest read is that it is documented-weak rather than silently
  broken.

**Correction on "never fired" (Codex F6).** Three detectors never fired on any of 138
real pages: `justified-text`, `extreme-negative-tracking`, `numbered-section-markers`.
Only the third is a recall failure. The other two have **ZERO labeled positives** in the
corpus - there was nothing to catch, so silence is correct and their real-world recall
remains unmeasured, not zero. I nearly reported all three as failures.

## Finding 6 - default-typeface fires 31/90 held-out and 0/48 dev

The source comment says the dev maximum default-stack share is 0.058 and the threshold
"fires on ZERO of them". True, and a property of that corpus's composition: dev is 48
modern SaaS marketing sites, all carrying custom webfonts. The held-out corpus includes
Wikipedia, Hacker News, Bootstrap examples and archived 2012-2018 pages, which genuinely
do run on system stacks, and it fires on 34% of them.

No independent labels exist for this class, so precision is UNMEASURED. It also fired on
4 of 12 real repo pages for `system-ui`, `-apple-system` and `ui-monospace`, where
choosing the system stack for an internal tool or docs page is a deliberate typographic
decision rather than the absence of one. Flagged as a population question for a design
call, not asserted as wrong.

## Finding 7 - 12 non-fixture repo pages

First test was pages built for their own purposes, never as sidecoach fixtures: 154
findings across 12 pages (low-contrast 76, tiny-text 73, default-typeface 4,
skipped-heading 1). The contrast and heading findings adjudicate as genuine - 1.00:1 on
a `code` element in `reference/index.html` is text painted its own background colour.

Output-quality problem visible at this scale: **page-level judgments are emitted per
element.** One page produced 20 `tiny-text` findings each repeating the same page-level
parenthetical "(30% of content text <=13px)", and another produced 35 identical
"2.91:1 (need 4.5:1)" lines. The typography-extremes classes emit at most one finding per
page; `tiny-text` and `low-contrast` do not, so the list a user reads is mostly
duplicates.

## Finding 8 - all 22 rendered rules fire, but this is white-box evidence

Wrote 22 pages, one per rule, each exhibiting the defect its rule NAMES, before reading
any detector source. **13 of 22 fired.** A 25-page blind threshold sweep rescued 2
(`all-caps-body` and `marketing-buzzword` needed more text); reading the documented
constants and building exact-spec probes rescued the other 7. Final: 22 of 22.
`sidecoach-detect` and the audit path agreed on every probe.

**Codex F3 is right that this is a weaker claim than it looks.** Once I read the
constants, the probes became "can I satisfy the implementation's predicates" - that is
threshold reachability and wiring, not field liveness. The real-page numbers above are
the evidence for whether the thresholds are well chosen; this claim only establishes
that no rule is unreachable.

One documented scope gap: `broken-image` fires only on an `<img>` with a missing or empty
`src`, deliberately, because the render aborts external subresources so load-failure
would flag every external image. It still scored P/R 1.000 on the held-out corpus, so the
corpus' notion of a broken image agrees with the detector's.

## Determinism

One page (`dub`) differed between two full 138-page passes. It was then stable 6/6, a
25-page x 3-pass check found 0 instability (0 of 75 page-runs), and the final post-fold
pass matched the original exactly (0/138 differences). So a rare render race exists,
observed once, well under 1%. The live path navigates with `waitUntil: 'domcontentloaded'`,
which does not wait for webfonts, and that is the likely cause. Not chased further.

## Methodology caveats (Codex findings 1, 3, 4, 5, 6 - folded)

- **The codex labels are an independent PROXY, not ground truth** (F1). They measure
  agreement with one model's rubric on a screenshot basis, and carry that model's taste
  bias, the corpus' selection bias, and blind spots for motion, interaction states,
  responsive/dark-mode variants and shadow DOM. Every taste number above should be read
  as "agreement with the labeler", not "correct".
- **Reproducing the source's own dev figure validates less than it appears** (F4). It
  proves I hit the same scorer, threshold and data slice that produced the comment. It
  does not validate the labels, the denominator, the render transform or the corpus
  split - if the original number came from the same harness, both can share a bug.
- The objective numbers rest on the corpus' own labels too, mitigated but not eliminated
  by the green `referee-independence` test.

## What I did NOT test

- **Whether sidecoach improves the output** (Codex F7, the biggest gap). Nothing here
  measures whether a design pass run through sidecoach is better than one without it.
  Every number is detector accuracy, not product value.
- Flow HANDLER internals. I drove the two shipped front doors only. The duplicate-handler
  bug in `session_2026-07-26_flow-redundancy-evaluation.md` is neither confirmed nor
  refuted here.
- The `sidecoach_lane` MCP path named in SKILL.md. No sidecoach MCP server is registered
  in `~/.claude/settings.json` or `~/.claude.json`, so it was unreachable.
- Static-lens precision, multi-viewport, dark mode, and interaction states.
- Precision for the 11 implemented classes with no labels (including default-typeface),
  and recall for the 16 labeled classes with no shipped detector.

## Known residual gaps in the fix (design calls, deliberately not taken)

- **The guard does not wait for mount** (Codex F9). It probes immediately after
  `domcontentloaded`, so a same-origin app that mounts after async data or a frame is
  called inconclusive. Fail-closed, so it errs safe, but adding a settle policy is a
  threshold decision with a scan-time cost and belongs to the lead.
- **A broken shell that paints "Loading..." or a spinner still clears the guard** (F10),
  after which the detector floors can again produce clean. The zero-threshold was chosen
  so no legitimately small page is demoted; catching a stuck-loading shell needs a
  different signal (mount detection), not a bigger threshold.

## Self-analysis

My first probe set produced "9 of 22 detectors never fire", which would have been a
dramatic and WRONG headline. The failure mode: I wrote probes from rule NAMES and assumed
a name implies its trigger condition. `thin-border-wide-shadow` sounds like "thin border,
big shadow" and actually means a spread radius >= 6px at >= 4x the border;
`extreme-negative-tracking` sounds per-element and is a page-share threshold. Rule names
describe the DEFECT, not the MEASUREMENT.

The second near-miss was the same shape: I was about to report three never-firing
detectors as failures when two of them had zero positives in the corpus to catch.

The generalisable rule, and the mirror image of the router lesson: **real inputs are how
you find a detector that never fires; the detector's own definition, and the ground
truth's positive count, are how you tell a dead detector from a bad probe or an absent
defect.** Testing blind is necessary and is not sufficient.

Third: my first version of the guard test injected the very result it asserted, so
deleting the guard would have passed it. Codex caught it (F14). I had run mutations on
the PREDICATE and concluded the test was non-vacuous, without noticing the mutations
never touched the call site. A mutation proof is only as good as the region it mutates.

## Files touched

- `sidecoach/src/validators/rendered-live-scan.ts` - judgeability guard
  (`inPageRenderIsEmpty`, `EMPTY_RENDER_REASON`, `UNPROBEABLE_RENDER_REASON`), consulted
  after the detectors and only on an all-zero scan
- `sidecoach/src/sidecoach-orchestrator.ts` - empty-shell headline distinct from
  "did not render"
- `sidecoach/src/__tests__/empty-render-guard.test.ts` - new, 28 assertions, drives the
  real `scanRenderedLive` through its launcher seam; 5 mutations caught
- `sidecoach/scripts/run-tests.ts` - registered the new suite
- this beat + MEMORY.md index. No commit made.
