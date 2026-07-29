# Pre-registration v3: does the WIRED `polish` payload improve the output? (PILOT)

Authored against commit `a732459a`. **v3, frozen before any page in this sub-trial exists.**
Collaborator: Jonah.

**Two adversarial GPT-5.4 design reviews ran before any data existed and both are committed
verbatim** at `codex-review-polish-v1.md` (**NO-GO**, 7 required changes) and
`codex-review-polish-v2.md` (**GO WITH CHANGES**, 3 blocking). v3 folds every one. Nothing in the v1
or v2 design is defended; where a review rejected an argument, the argument is withdrawn rather than
restated.

**This is a PILOT, not a confirmatory trial** (v2 review, blocking change 1). The review's reasoning
is adopted in full: the only objective endpoint available on this substrate is at the floor
(section 3.2), so the study's evidence rests on one blind preference judge at n=17, and a design like
that cannot carry a confirmatory efficacy claim in either direction. No measure in this document is
labelled confirmatory. `M1a`/`M1b` are the PRIMARY pilot measures; a positive result here is a reason to
run a bigger trial, not a finding that the payload works.

## 0. What question this answers

`../RESULTS.md` ran a three-arm trial on the `craft` payload and returned a measured null: the
payload reliably improved what sidecoach measures and did not improve what a blind judge saw. Six
polish rule classes went to exactly zero on all 17 treated pages, and those six were verbatim the
rule names the payload enumerated. A model handed a list of rule names satisfies the rule names.

Measured 2026-07-28 on `polish` specifically: the payload named rules and taught nothing. Its
executive report filled the "After" column - the column whose only job is to say what to DO - with
`resolve the <rule name> issue on the affected element`, twelve rows of it on one real target, each
closed by `it undercuts the finished result`. The craft that belonged there was already written in
this repo (`claude/skills/tactical-polish`, `src/design-laws.ts`) and nothing referenced it.

The wiring turns that payload into a brief that states what good looks like and why before it reports
what was found, with the notes SELECTED by the rules that failed on the page in front of it.

**The estimand, stated as narrowly as the design actually supports** (v1 review, change 6). v1 claimed
to ask "does the content help". It could not: its treatment bundled design content, page-specific
targeting, and diagnostic grounding against a comparator that had none of the three. This version
splits the bundle into two comparisons that each hold one factor fixed:

| comparison | held constant | isolates | reads as |
|---|---|---|---|
| **G vs P** | prompt length | **content** | does the payload's craft content help at all? |
| **T vs G** | content source, note count, payload shape, and the measured findings | **page-match** | does selecting the teaching by THIS page's failures add anything? |

A null on **G vs P** would say the craft content itself does not move an independent judge - much more
important to know than another round of wiring, and the outcome this design most expects. A null on
**T vs G** with a positive G vs P would say the corpus helps and the selection machinery is decoration.
Both are real results, and a pilot-scale null is not proof of absence (section 5).

## 1. Unit and population

**Unit:** one page-improvement task. Input: an existing page plus the brief it was built from. Output:
an improved page. This is what `polish` is FOR; run in a directory with no page its findings are empty
and there is nothing to teach, which would test a payload nobody ships.

**Population, frozen:** the 17 template-conforming briefs in `../../eval/corpus/briefs/`
(**authored by Codex in a prior commit**, so the trial author could not have shaped them). The
population filter is `../lib/briefs.mjs:isTrialBrief`, reused unchanged so it cannot be quietly
widened here.

**Starting pages: 17 FRESH pages generated for this sub-trial** into `pages/START/`, one per brief,
from a frozen prompt containing the parent trial's committed payload-free wrapper and the brief and
nothing else. They are sha256-frozen at `results/starting.json` before a single arm prompt is built,
and `build-arms.mjs` re-verifies every one against that freeze and exits 8 on a mismatch.

### 1.1 Why the starting pages are regenerated, and what that does NOT fix

v2 of this document reused the parent trial's arm-C pages and argued that regenerating them "would only
move the coupling". **The v2 review rejected that argument and it is withdrawn.** The review's
distinction is correct and v2 collapsed two different threats into one: *ecosystem coupling* (payload,
scanner and substrate all come from the same world) is not the same threat as *reuse of prior
experimental products* (dependence on one specific arm's outputs, that arm's wrapper and model quirks,
and possible enrichment for pages that happen to be amenable to detector-led patching). Regeneration
does not touch the first. It removes the second outright, and the second is a real and separable
problem. So the pages are regenerated.

**What regeneration does not fix, carried into every claim:** the fresh pages still come from the same
producer model family and the same brief corpus, so ecosystem coupling remains in full. The review's
wording is adopted: "least contaminated is not uncontaminated." Breaking that would need externally
sourced pages, which is a different corpus and a different trial. **This measures efficacy on pages
from this ecosystem, not efficacy in general.**

The v2 sentence calling the two trials "comparable" because the instrument is shared is also withdrawn:
same instruments, different task unit, different substrate. This is a RELATED test, not a clean rerun
with one factor changed.

**Reported, not gated:** the fresh pages' axe and `sidecoach-detect` defect profiles are recorded
alongside the parent arm-C pages' profiles, so a reader can see whether the new substrate is unusually
rich or unusually poor in detector-fixable defects. It is a descriptive disclosure and no analysis
branches on it.

**Producer:** one fresh Claude Code subagent per cell, sonnet, identical tier in all arms, given a
path to its arm's prompt file and nothing else.

## 2. Arms

85 cells = 17 fresh starting pages + 17 briefs x 4 arms. Within a brief, the task wrapper, the brief block and the starting-page
block are byte-identical across arms; the ONLY difference is the appended payload block, and
`build-arms.mjs` recovers those three blocks from the ASSEMBLED text of all four arms and refuses to
write anything if they differ (exit 4).

| arm | appended payload | isolates |
|---|---|---|
| **C** control | none | the floor |
| **P** placebo | length-matched NON-DESIGN block (`../lib/placebo.mjs`, unchanged) | prompt length, density, salience |
| **G** mismatched craft | the SAME payload with the SAME findings, but its 8 taught notes selected by a DIFFERENT page's failures | design content with the page-match broken |
| **T** treatment | the shipped wired `/sidecoach polish <page>` `guidance` payload, verbatim | design content WITH page-specific selection |

**Arm G is the v1 review's change 2 and the v2 review's blocking change 2, and it is the single
biggest improvement to this design.** v1's only comparator carried no design advice, so the review was
right that T vs P asks whether "a page-specific, detector-conditioned design memo outperforms an
equally long irrelevant block" - a much lower bar than the prose claimed. `../RESULTS.md` had itself
named this gap: "the informative comparison is against equally long good generic design advice, which
nobody has run."

### 2.1 Arm G, and why v2's version of it was wrong

**v2 built G as all 24 craft notes, page-agnostic. The v2 review rejected that and was right.** T is
capped at 8 taught notes, so an uncapped 24-note G is not "the same content without targeting" - it is
MORE content. A T-vs-G null under that construction would be uninterpretable: it could mean selection
adds nothing, or it could mean an 8-note cap loses to an overcomplete comparator. The review's words:
"arm G partly breaks the interpretation you want."

**v3's arm G is a DERANGEMENT, and it isolates page-match alone.** For each brief, G receives the
treatment payload for that brief with exactly one substitution: the craft brief's 8 taught notes are
replaced by the 8 notes the shipped selector chose for a DIFFERENT brief, under a seeded derangement in
which no brief receives its own. Everything else - the wrapper, the brief, the starting page, the
measured findings block, the note count, the section structure, the sentence source - is identical to T.

Held constant by construction, not by argument: content source, note count, payload shape, and the
findings. Varied: whether the taught notes match the failures actually on this page. That is
selection, and nothing else.

**Why the findings block stays IDENTICAL in G.** Deranging the findings too would put false statements
about the page in the prompt (a ban at a line number that does not exist), which is an actively
HARMFUL comparator biased toward T - the same trap `../lib/placebo.mjs` documents for word-shuffled
payloads. Holding the measurement constant and varying only the teaching is the only version of this
contrast that does not disadvantage the comparator with falsehoods.

**What G vs P then reads as:** the full wired payload, with its teaching mismatched to the page,
against an equally long non-design block. It remains a test of whether the payload's content helps at
all, and it remains a low bar because P carries no design advice. Stated, not glossed.

### 2.2 The treatment payload is page-specific, and that is checkable

The 17 T payloads differ from each other because selection differs. `build-arms.mjs` reports the
distinct-payload count and **exits 9 if fewer than 12 of 17 payloads are distinct** - v1 review change
4(c) noted that "void if the count is 1" left a hole where near-generic payloads could still be
claimed as page-specific. The threshold is fixed here, before data.

The payload is obtained by running the **installed** `sidecoach-monitor` in a per-brief working
directory containing the starting page and a mechanically derived PRODUCT.md, and pasting its stdout
JSON `guidance` array with no edit. stdout is redirected to a FILE, never read through a pipe: the
monitor spawns a Chrome grandchild that inherits stdio and a piped read truncates (measured at 8178 of
188893 bytes in the parent trial). A truncated payload would silently shrink the treatment.

## 3. Measures

| id | measure | independence | role |
|---|---|---|---|
| **M1a** | blind forced-choice preference, **T vs G**, source level | different vendor and model | **PRIMARY (pilot)** |
| **M1b** | blind forced-choice preference, **G vs P**, source level | same | **PRIMARY (pilot)** |
| M1c | blind preference, **T vs P** | same | descriptive: the parent trial's contrast, for continuity only |
| M1d | blind preference, **P vs C** | same | secondary: the pure prompt-length effect |
| **A1** | axe-core 4.12.1 violations per page | Deque, zero shared code, pinned | **HARM CHECK ONLY** - see 3.2 |
| M3 | `sidecoach-detect` findings | **sidecoach's own scanner** | secondary, OWN EXAM, asymmetric, **BARRED from the headline** |
| D1 | edit magnitude vs the starting page, per arm | mechanical | diagnostic, never an outcome |

The judge prompt is **`../judge-run.mjs`'s prompt, reused verbatim**, including its instruction not to
reward length, file size or CSS-rule count. Reusing it removes the freedom to pick a judging
instrument after seeing the parent trial's answer. Arm labels never reach the judge; pages are PAGE A
/ PAGE B in the side order fixed by a seeded assignment written before any judging call, and
`judge-prompt.mjs` refuses to redraw an assignment that exists.

### 3.1 The judge model, and a transport substitution recorded in the open

The pre-registered judge is **GPT-5.4**. The pre-registered TRANSPORT is
`~/.claude/hooks/codex-review.py`, which on 2026-07-29 returns **exit 4 on every call** because the
Codex subscription hit its usage limit until Aug 3; `codex-review.py --smoke` fails identically, so
this is the backend and not the invocation. `gpt-call.mjs` reaches the SAME model over the OpenAI API
and is used instead. This changes the transport and holds the reviewer identity the design named. It
is not the same-model Claude fallback the standing verification rule permits when Codex is genuinely
unreachable - that would be a step down and is not needed.

The model is **pinned at gpt-5.4** even though the API also serves gpt-5.5 and gpt-5.6, because the
parent trial's judge was GPT-5.4 and changing the judge between the two trials would confound the
comparison this sub-trial exists to make.

**Independence of vendor is not independence of style preference** (v1 review, change 6). If the
payload induces a recognisable "this looks designed" shape, a judge trained on similar data may reward
conformity to a shared aesthetic prior rather than express preference. This design cannot separate
those, and every claim carries that caveat.

### 3.2 axe cannot be a primary measure here, and the reason is a measurement, not a preference

v1 made total axe violations a primary measure. The review's change 1 called that circular - three of the
24 polish rules are accessibility rules axe also checks, so a treatment win could come entirely from
subject-matter overlap - and required either the unnamed-rules-only subset or demotion.

**The unnamed-only option was tested against the closest available pre-data PROXY and appears to be
at the floor.** The v3 review's correction is adopted: because the starting pages are regenerated (1.1),
their defect profile is not known at pre-registration time, so this is a proxy argument and not a known
property of the substrate under test. With the axe rule universe pinned by ID
(section 3.3), the 17 parent arm-C pages - built from the SAME briefs by the SAME producer model under
the SAME payload-free wrapper the fresh starting pages use, and therefore the best available pre-data
estimate of what this substrate looks like - carry **28 total axe violations, of which 2 are unnamed**
(`listitem` x1, `dlitem` x1); **15 of 17 pages have zero unnamed violations**. A measure whose input is
0.12 per page cannot detect an improvement in either direction: it would return all ties by
construction. The same count is re-reported on the fresh starting pages as a disclosure (1.1), and if they carry
materially more unnamed violations than the proxy, this section's rationale is overstated in hindsight
and the results document must say so.

This is a pre-data derivation, and the distinction matters: the numbers are properties of pages that
are INPUTS to this trial's task, measured in a prior trial, not outcomes of this one. No page produced
by this sub-trial exists.

Therefore, per the review's own option 3:

- **M1a and M1b are the primary family. axe is not in it.**
- **A1 becomes a one-sided HARM CHECK**: it reports whether a treated page is measurably LESS
  accessible than its comparator. A worsening is a finding; an improvement is reported as descriptive
  and, given the overlap, carries no efficacy claim. Both the total and the named/unnamed split are
  reported regardless of what they show.

The cost is stated plainly, in the v2 review's own terms rather than softened: **this trial has no
independent objective outcome measure**, its evidence rests entirely on one blind preference judge at
the power in section 5, and the floor is a property of THIS hand-chosen substrate rather than an
immutable fact about the intervention - a different substrate might not be at floor. That is why the
study is labelled a pilot. The weakness is not hidden
behind an axe number that could not have moved.

### 3.3 The axe rule universe, pinned by ID before any data (v1 review, change 7)

axe-core 4.12.1 exposes **105 rules**, enumerated by `pin-axe-rules.mjs` and frozen at
`axe-rule-universe.json`. Membership is defined by explicit ID list, never by a residual "everything
else" resolved at reporting time. `measure-axe.mjs` exits nonzero if the live rule set differs from
the frozen universe.

The **payload-nameable** set (33 IDs) is deliberately OVER-inclusive: any rule whose subject matter
the polish craft notes arguably touch is classified as nameable, which shrinks the unnamed set and
makes any unnamed-set claim harder for the treatment, not easier. It is: `color-contrast`,
`color-contrast-enhanced`, `link-in-text-block`, `target-size`, `nested-interactive`,
`scrollable-region-focusable`, `focus-order-semantics`, `tabindex`, `skip-link`, `bypass`,
`heading-order`, `page-has-heading-one`, `empty-heading`, `p-as-heading`, `avoid-inline-spacing`,
`meta-viewport`, `meta-viewport-large`, `css-orientation-lock`, `blink`, `marquee`,
`no-autoplay-audio`, `meta-refresh`, `meta-refresh-no-exceptions`, `region`, `landmark-one-main`,
`landmark-unique`, `landmark-banner-is-top-level`, `landmark-complementary-is-top-level`,
`landmark-contentinfo-is-top-level`, `landmark-main-is-top-level`, `landmark-no-duplicate-banner`,
`landmark-no-duplicate-contentinfo`, `landmark-no-duplicate-main`.

### 3.4 M3's reading rule is asymmetric, and fixed now

M3 is sidecoach grading work produced under sidecoach's guidance. **Null or negative** M3 is strong
evidence against improvement. **Positive** M3 is weak and is barred from the headline and the verdict.
Unchanged from the parent trial.

## 4. Analysis plan

- Two-sided tests throughout.
- **M1a / M1b**: exact binomial sign test vs p=0.5 on **decided** comparisons; ties excluded from the
  test. Clopper-Pearson exact 95% CI.
- **Tie sensitivity, fixed now** (v1 review, change 4): alongside each primary result the analysis
  reports one pre-specified sensitivity in which **every tie is assigned to the comparator arm**
  (against the treatment). It is the conservative direction, it needs no discretion, and it is
  reported whatever it shows. A tie rate at or above 60% is reported as a degeneracy note; it does
  **not** modify the family. The parent trial's round-2 review returned NO-GO on exactly such an
  outcome-dependent path and none exists here.
- **Multiplicity**: Holm-Bonferroni over the FIXED primary family **{M1a, M1b}**, family-wise alpha
  0.05, fixed here and never chosen from the data. Holm is applied even though the study is a pilot,
  because two primary comparisons without a correction is the more common way to manufacture a result.
- **A1 harm check**: exact Wilcoxon signed-rank on paired per-brief differences, reported for T-vs-G,
  G-vs-P and T-vs-P, with the named/unnamed split. Percentile bootstrap 95% CI (seed 20260729) and
  Cohen's d_z alongside. The registered test is the Wilcoxon; quoting the CI instead because it is
  more flattering is the post-hoc measure-swap this document forbids.
- **Drop rule**: a cell that fails to generate, or fails the self-containment check, invalidates its
  **whole quadruple**, so every comparison stays balanced. Drops are named in the record. **Per-arm
  failure counts are reported** so a treatment that induces more breakage cannot hide inside a
  complete-case analysis (v1 review, change 4(e)).
- **Blinding leaks, fixed now** (v1 review, change 3): a page that names sidecoach, the placebo's
  vocabulary, the craft corpus or the trial's scaffolding is **RETAINED** in the primary analysis -
  excluding on a post-generation property is exactly the discretion this rule removes - and a fixed
  sensitivity analysis excluding every pair containing a leaked page is reported alongside. Leaks are
  never stripped from the artefact, because stripping would edit the page under measurement.
- **Null declaration**: if neither M1a nor M1b survives Holm, the headline is **"no detectable
  improvement on this task at this n, in a pilot with no independent objective endpoint"**, with the section 5 power statement attached. The narrowing is
  a statistical necessity, not a defence: the review flagged that this phrasing can become a way to
  avoid admitting a damning replication of the parent pattern, so the results document must state, in
  the same breath, whether the parent's pattern (improves the own exam, not the judge) recurred.

## 5. Power, stated before the data

n = 17. The exact sign test needs **13 of 17** wins to reject at two-sided 0.05, and reaches 80% power
only at a true win rate of about **0.813**. At a plausible 0.65 it has roughly **24%** power.
`../power.mjs` computes this and touches no data.

A non-significant result licenses **"no large effect detected"** and nothing stronger. With axe demoted
to a harm check (3.2), this is a pilot resting on one preference judge, and it is underpowered for any
effect short of large.

## 6. How this design can return a null, and where it is still tilted

Can return a null:

1. **Both primary measures are forced choices against comparators that are matched on length,
   and for M1a on content as well.** Nothing in the pipeline advantages T or G. The identical
   instrument returned 7 win / 10 loss for the craft payload, against it.
2. **The judge never learns the arms**, sides are fixed by a committed seed before any judging call,
   and the assignment cannot be redrawn.
3. **The judge is instructed not to reward length or rule count** - the specific way a
   checklist-following page could win on volume rather than quality.
4. **axe is no longer in the family**, so the one measure with mechanical overlap between treatment
   content and outcome can no longer produce a win at all (3.2).
5. **T vs G holds design content constant**, so the easiest win available to v1's design - design
   advice versus no design advice - is not available on the primary contrast at all.

Still tilted, or simply unresolved, and reported rather than fixed:

- **Style-template detectability.** Unresolved and unresolvable here. Named in 3.1.
- **Relevance asymmetry survives on M1b** (G vs P is design content versus irrelevant filler). That
  is the intended contrast, but a G win over P is a win over filler and the report must say so.
- **T vs G may now be tilted AGAINST the treatment**, and that is deliberate. G carries the same
  measured findings as T, so a producer in arm G still knows exactly what is wrong with the page and
  only lacks teaching matched to it. The v2 review's observation stands in the new form: the selection
  contrast is the harder of the two for T to win, and a T-vs-G null is therefore weak evidence against
  selection rather than strong.
- **The improve-an-existing-page unit favours local patching** (v1 review, change 2). Producers may
  preserve most of the page and patch locally, and a findings-derived payload is well suited to local
  patching while a judge may weigh holistic coherence. The design therefore tilts toward finding
  detector-facing improvements that a judge does not see - which is the parent trial's exact pattern.
  D1 measures edit magnitude so a "changed more" explanation is visible.
- **Ecosystem coupling in the starting artefacts.** Accepted, not fixed (1.1).
- **The author chose the transform, the payload field, the wrapper, the comparators, the judge and the
  measures.** "I did not author the treatment" is not the same as "I did not determine the result."

## 7. Integrity mechanisms

- Arm integrity enforced from the assembled text, not asserted (exit 4).
- Starting pages generated for this sub-trial and frozen by sha256 before any arm prompt exists;
  re-verified at build time (exit 8).
- Payload distinctness gate (exit 9).
- Live axe rule set verified against the frozen universe (nonzero exit on drift).
- Artefact freeze verified: `collect.mjs` records a sha256 per generated page and `--verify` re-checks
  every one. That check caught a real incident in the parent trial - producer subagents relaunched
  after the runtime's concurrency cap rejected earlier spawns completed LATE and rewrote four pages
  after they had been measured and judged, which no statistic would have revealed. **Rule adopted
  here: a rejected spawn is distinguished from a completion before any relaunch, and no cell is
  relaunched while an earlier spawn for it may still be alive.**
- Every tool fail-closed with a distinct exit code per failure class, and no success line on partial
  work.

## 8. What is frozen by this document

The population, the fresh-starting-page procedure and its residual limitation, the four arms and their construction, the arm-G derangement,
the payload source and extraction method, the distinctness threshold, the judge model and prompt, the
seeded side assignment, the primary family {M1a, M1b} and its Holm correction, the demotion of
axe to a harm check, the pinned axe rule universe and its nameable subset, the tie sensitivity, the
leak-retention rule and its sensitivity, the drop rule with per-arm failure reporting, M3's asymmetric
reading, and the null-declaration rule.

No number in section 3 or 4 may be changed after a single page of this sub-trial exists.
