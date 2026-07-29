# PRE-REGISTRATION v3 (FROZEN) - does sidecoach improve the output, or only run?

Authored against commit `8ae761a4` (`git rev-parse --short HEAD` at authoring time).
Collaborator: Jonah.

**Frozen before any page was generated, any measurement was taken, and any judge was run.**
This design was put to Codex (GPT-5.4) TWICE before any data existed. Round 1 rejected it for a
fatal confound; round 2 returned NO-GO on one remaining item. Both verdicts are preserved
verbatim at `codex-review-v1.md` and `codex-review-v2.md`; the changes they forced are listed in
section 9. Round 2's single blocking change is folded, so this v3 is the GO design. Nothing below may be changed once data collection begins.
Anything added after that point is labelled EXPLORATORY and may not carry the headline.

## AMENDMENT 1 (PRE-DATA, 2026-07-28) - the population is 17 briefs, not 20

Recorded BEFORE any page was generated, any measurement taken, or any judge run. Nothing in this
amendment can have been influenced by a result because no result exists.

**What happened.** `build-arms.mjs` refused to run (exit 2) on `real-govuk-addresses.md`: the
three `real-govuk-*` briefs do not conform to the fixed neutral template the other 17 use. They
carry no `title`, `register`, `audience`, `goal`, `requiredContent`, `constraints` or
`successCriteria` field - they are raw scraped GOV.UK Design System pattern pages.

**Why they are excluded rather than adapted.** Two structural reasons, neither about the result:

1. Supplying the missing fields would mean **I author the brief**, which is the contamination the
   whole design is built to avoid, and would additionally feed my words into the mechanical
   PRODUCT.md and therefore into the sidecoach arm alone.
2. The pre-existing `_spec.md` already says to avoid exactly these: *"Briefs abstracted from a
   design-system pattern carry that system's implied 'right answer' (e.g. the GOV.UK style) and
   BIAS the generative head-to-head -> avoid."* The corpus author flagged them as a capped,
   caveated minority. Excluding them follows the corpus's own rule.

**Consequences, stated in full:**

- n = **17 briefs x 3 arms = 51 generated pages**.
- The population loses its `plain/government` aesthetic stratum. The remaining 17 still span all
  five registers and the other aesthetic styles.
- Power falls. Recomputed by `power.mjs --n 17`:

| measure | alpha | criterion | MDE at 80% power |
|---|---|---|---|
| M1 sign test | 0.05 | >= 13 of 17 wins | true win rate **0.813** |
| M1 sign test | 0.025 (Holm step 1) | >= 14 of 17 wins | true win rate **0.855** |
| M2 paired delta | 0.05 | - | Cohen **d_z = 0.648** |
| M2 paired delta | 0.025 (Holm step 1) | - | Cohen **d_z = 0.713** |

Power at a true win rate of 0.65 is now **23.5%**; at 0.70, **38.9%**. The pilot framing in
section 8 holds with more force, not less.

## 0. The question

Every measurement in this repo establishes whether a sidecoach component FIRES. The detection
engine's precision and recall are measured (`session_2026-07-28_sidecoach-live-efficacy.md`,
`session_2026-07-28_taste-precision.md`). The flow layer's rendering is measured. Nobody has
compared work produced WITH sidecoach against work produced WITHOUT it. Codex raised this as
finding F7 of the live-efficacy review and it was never closed.

> When a model builds a page from a fixed brief, does adding the guidance sidecoach emits
> produce a measurably better page than not adding it - **and better than adding an equally
> long block of instruction that contains no design content at all?**

The second half of that sentence is the whole reason v2 exists.

## 1. Unit of output

**One self-contained HTML page built from one committed brief.** This is what `/sidecoach craft`
claims to produce, it is producible repeatedly, and the repo already carries a brief corpus for
exactly this purpose.

**Brief set (frozen):** the 20 non-calibration briefs in `sidecoach/eval/corpus/briefs/*.md`
(`ls *.md | grep -v '^_' | grep -v '^calib-'`).

Why this set and not one I write:

- The briefs were authored by **Codex**, not by me, and are committed in a **prior commit**
  (`2bbeabd4`), long before this trial. I cannot have shaped them toward a result.
- `_spec.md` (also pre-existing) froze the sourcing discipline: solution-agnostic, no tool names,
  no language pointing at either tool's idioms, diversified across five registers and five
  aesthetic styles.
- The three `calib-*` briefs are **excluded**: `_spec.md` records them as architect-authored
  with an a-priori expected winner, which is exactly the contamination this trial avoids.

n = **17 briefs x 3 arms = 51 generated pages** (see AMENDMENT 1 - the three `real-govuk-*` briefs do not conform to the corpus template and are excluded, pre-data).

Codex proposed 13 briefs x 3 arms to stay inside 40 generations. **Rejected: n is the scarce
resource here and 13 pairs is nearly powerless** (the sign test would need 11 of 13). Paying 60
generations to keep n = 20 on the primary comparison is the better trade and is affordable
because pages are produced by subagents, not a metered API.

## 2. The three arms

The lead's trap, stated plainly: *if you author both the treatment and the control prompt, you
choose the result.* Codex's sharper version: even if every treatment word comes from the shipped
binary, **the treatment prompt is far longer than the control prompt, so a treatment win could be
a length/salience effect and nothing to do with sidecoach.** That confound alone makes a 2-arm
result uninterpretable. Hence three arms:

| arm | prompt | isolates |
|---|---|---|
| **C** control | wrapper + brief | the floor |
| **P** placebo | wrapper + brief + length-matched NON-DESIGN instruction block | length, density, salience |
| **S** sidecoach | wrapper + brief + the shipped engine's `guidance` payload, verbatim | design content |

- **PRIMARY comparison: S vs P.** This is the efficacy claim. It asks whether sidecoach's design
  content beats an equally long block of instruction that cannot possibly help with design.
- **SECONDARY comparison: P vs C.** This estimates the pure prompt-length effect and is the
  number that says whether the primary comparison was necessary.
- S vs C is computed and reported for completeness and **cannot carry the headline**, because it
  is exactly the confounded comparison v1 was rejected for.

Assembly rules enforced by `build-arms.mjs`, which **exits 4** if any is violated:

| part | who wrote it | identical across arms? |
|---|---|---|
| task wrapper | me, ONCE | yes - byte-equality asserted |
| the brief | Codex, prior commit | yes - copied verbatim, sha256 recorded |
| appended payload | S: the shipped binary. P: `lib/placebo.mjs`. C: none | this is the manipulation |

Every rendered prompt is written to `arms/` and committed, so the exact text each arm saw can be
re-read and argued with.

### 2.1 The placebo, and the fact that I wrote it

Codex asked for a length-matched placebo "generated mechanically before outputs, from generic
neutral design/process text". I could not find a way to produce one with zero authorship:

- Word-shuffling the sidecoach payload yields gibberish, which is an *actively harmful* placebo
  and biases toward sidecoach.
- The vendored external references under `sidecoach/reference/_extracted/external/` are real
  design advice AND are part of the corpus sidecoach's own guidance derives from, so they are
  neither neutral nor independent.

**So I authored the placebo seed, and that is the weakest link in this trial. It is stated here
rather than discovered later.** `lib/placebo.mjs` mechanically tiles a committed seed of
**software-engineering** guidance (testing, error handling, documentation, version control,
dependency hygiene) - deliberately orthogonal to page design - matching the sidecoach payload's
line count, CHARACTER count (within 2%, converging onto the target from above rather than onto a ceiling - characters, not words, because a first version matched words exactly while leaving a 28% character gap), imperative voice, sectioned/bulleted structure,
and its "these are your ordered steps" framing.

Direction of bias, stated in advance and **corrected by Codex's second pass**: calling the
placebo "orthogonal" is too strong. Testing, error handling, documentation and dependency hygiene
do bear on the quality of a built page, so the placebo may help arm P slightly on implementation
quality - which biases **against** sidecoach. Working the other way and more strongly, the
placebo contains no design advice at all, so **S's bar is easier than it would be against real
generic design advice.** Net: **S vs P tests sidecoach's design content against irrelevant
instruction of the same size**, a weaker bar than "against equally good generic design advice",
and the result must be worded that way.

### 2.2 PRODUCT.md (a real decision, recorded because it moves the result)

`sidecoach-monitor` reads `PRODUCT.md` from the working directory. With none present it emits 160
guidance lines whose first seven are an error telling you to create one; with sidecoach's own
`PRODUCT.md` present it emits 629 lines including that project's brand personality. Neither is
right: the first tests a configuration SKILL.md itself calls invalid ("Sidecoach without project
context produces generic output"), and the second would inject *sidecoach's* branding into a
medical intake form.

`/sidecoach teach` cannot resolve this - it is interactive and stops to ask for
`brandPersonality`, `antiReferences` and `strategicPrinciples`, which are design content I would
then be authoring for one arm only.

**Decision: a mechanical, committed transform (`lib/product-md.mjs`) that copies brief text
VERBATIM into PRODUCT.md slots** - register, users <- audience, purpose <- goal,
brandPersonality <- the brief's own `brand-tone-in-words` constraint. It invents nothing; every
word originates in the brief, which **all three arms see in full**. `antiReferences` and
`strategicPrinciples` are left absent rather than invented. The generated files are committed.

### 2.3 Producer

All three arms are produced by a **Claude Code subagent** - the real deployment surface for a
Claude Code skill - one fresh context per page, no producer seeing any other page or arm. **The
model tier is identical across arms** (`sonnet`, fixed, chosen so n = 20 is affordable). The
claim is about that tier; generalisation to a top-tier producer is a stated limitation.

## 3. The measures

The lead's constraint: *the engine's own detectors are NOT a fair judge of work produced under
its own guidance.* So the confirmatory measure is independent of sidecoach, and the engine's own
scanner is demoted with an asymmetric reading rule fixed in advance.

### M1 (CONFIRMATORY) - blind paired preference by an independent model

Judge: **Codex / GPT-5.4** via `~/.claude/hooks/codex-review.py` - different model, different
vendor, no shared code with sidecoach. It receives the brief and two pages and picks the one that
better satisfies the brief.

- **Blinded:** arm labels stripped; pages presented as `PAGE A` / `PAGE B`.
- **Order randomised** per comparison by seed **20260728**, via a deterministic PRNG in
  `judge-prompt.mjs`, written to `judge/assignment.json` **before any judging call is made**.
- **Leak check:** every page is scanned for `sidecoach`, `guidance`, `checklist`, `PRODUCT.md`,
  `DESIGN.md` (case-insensitive) and for the placebo seed's distinctive terms. Any hit is
  reported and the affected comparison is reported both included and excluded.
- **Forced choice** plus a one-line rationale. **Only the preference is tested**; the rationale
  is recorded for reading, never scored.
- **Comparisons run:** S vs P (20) and P vs C (20). S vs C is NOT judged - it is the confounded
  comparison and spending judge budget on it would invite it into the narrative.
- **Test:** two-sided **exact binomial** sign test vs p = 0.5 on decided comparisons. Ties
  excluded and counted.

Limitation fixed in advance (Codex's, adopted verbatim): Codex reads HTML **source**, not a
screenshot, so M1 cannot see rendered appearance and may reward CSS volume, named states and
visible effort over visual quality. That bias points **toward the sidecoach arm**, whose payload
demands eight interaction states. An S-vs-P win on M1 alone is read with that discount.

### M1b (SECONDARY) - blind paired preference on RENDERED SCREENSHOTS

Because M1 cannot see the page, a second judging pass views 1280x1600 Playwright screenshots of
the same pairs (S vs P only, 20 comparisons) through a Claude subagent with a fresh context that
did not produce any page. Same blinding, same committed assignment.

Declared SECONDARY, not confirmatory, for two reasons stated before it runs: it is the **same
model family as the producer** (self-preference risk), and comparisons are **batched 5 per judge
context** for budget, so a judge can see several pairs at once and could pattern-match.

### M2 (CONFIRMATORY) - axe-core violations

**axe-core 4.12.1** (Deque; industry-standard WCAG engine) run in Playwright Chromium over the
rendered page via `file://`. Zero shared code with sidecoach; its rule set predates this repo.
Outcome: **violation count per page**, paired by brief, on the S-vs-P contrast.

- **Test:** two-sided **Wilcoxon signed-rank** on the paired difference (S - P), plus the mean
  paired difference with a **bootstrap 95% CI** (10,000 resamples, seed 20260728). Lower is
  better; a negative mean favours sidecoach.
- **Degeneracy reporting (v3, per Codex's second pass):** the zero-difference (tie) count is
  reported alongside the test, and if **>= 60% of pairs tie** M2 is additionally described as
  degenerate so the reader knows the test carried little information. **The confirmatory family
  and M1's alpha do NOT change as a result.** v2 had M2 dropping out of the family on a high tie
  rate; Codex called that an outcome-dependent analysis path even though pre-registered, and it
  is removed. The Holm family is fixed as {M1, M2} whatever the tie rate turns out to be.
- Limitation: axe measures accessibility, not design quality. An M2 win means "more accessible",
  and will be reported in exactly those words.

### M3 (SECONDARY, own-exam, ASYMMETRIC by pre-registration)

`sidecoach-detect` finding count on the rendered page. This is the engine grading work produced
under its own guidance, so its evidential value is declared unequal **before the data exists**:

- A **null or negative** M3 (sidecoach pages no cleaner, or dirtier, on sidecoach's own scanner)
  is **strong** evidence against improvement. It cannot be blamed on an unsympathetic measure.
- A **positive** M3 is **weak** evidence and **may not appear in the headline or the verdict**,
  because guidance naming the same rules the scanner checks can raise the score without improving
  the page. Codex's warning is adopted literally: using a positive M3 in the narrative anyway
  would be a dodge.

## 4. Analysis plan, multiplicity, and the null

- Confirmatory family = {M1 (S vs P), M2 (S vs P)}, **Holm-corrected**. The family is FIXED and
  does not change for any observed statistic, including M2's tie rate.
- Two-sided throughout. Family-wise alpha = 0.05.
- **Null declaration rule:** if no confirmatory measure survives Holm, the reported result is
  *"no detectable improvement on this task at this n"*, stated as the answer, not as a
  disappointment, and not rescued by adding measures.
- **Post-hoc rule:** any measure, exclusion, subgroup or transformation introduced after the
  first measurement runs is labelled EXPLORATORY in the results and in the beat.
- **Failed generations:** a page that fails to generate or fails the self-containment check
  invalidates its **whole triple** (all three arms for that brief dropped), so every comparison
  stays balanced. Realised n is reported and the analysis is run only at the realised n. Dropped
  briefs are listed by id.

## 5. Minimum detectable effect (computed BEFORE data, `power.mjs --n 20`)

| measure | alpha | criterion | MDE at 80% power |
|---|---|---|---|
| M1 sign test | 0.05 | >= 15 of 20 wins | true win rate **0.799** |
| M1 sign test | 0.025 (Holm step 1) | >= 16 of 20 wins | true win rate **0.842** |
| M2 paired delta | 0.05 | - | Cohen **d_z = 0.597** |
| M2 paired delta | 0.025 (Holm step 1) | - | Cohen **d_z = 0.657** |

Power at plausible moderate effects is poor: at a true win rate of 0.65 the sign test has
**24.6%** power; at 0.70, **41.6%**.

**This trial can only detect a LARGE effect.** A non-significant result means "sidecoach does not
produce a large improvement on this task at this n" and does NOT mean "sidecoach does not help".
Codex's framing is adopted: **this is a pilot, not a decisive efficacy trial**, and the report
must say so.

## 6. How this trial can come back negative (corrected per Codex)

A study that cannot come back negative is not a study.

- **M1 (S vs P) can land at or below 0.5.** The judge never sees which page is which and the
  assignment is seeded and written before any judging call.
- **M2 can come back positive** - sidecoach pages carrying MORE axe violations. axe is not ours
  and cannot be tuned.
- **M3 null or negative is the falsifying path.** v1 wrongly listed "M3 can come back positive"
  as a falsification route; Codex corrected it. A positive M3 is the compromised *favourable*
  outcome, not a falsification.
- **P vs C can be significant while S vs P is not** - the most informative negative available
  here: it would mean any apparent benefit of sidecoach is a prompt-length effect.
- **The realised n can collapse** if generations fail, in which case the honest report is
  "infeasible at this budget" with the failure counts.

## 7. Threats accepted and NOT mitigated

1. **One draw per cell.** Generation is stochastic; pairing removes brief-to-brief variance but
   not draw-to-draw variance. Part of any observed delta is generation noise.
2. **Single judge per measure, single pass.** No inter-judge agreement statistic is affordable;
   M1 is one model's rubric, a proxy exactly as the codex screenshot labels are a proxy elsewhere
   in this repo. M1b's disagreement with M1 is the only cross-check available and is descriptive.
3. **Source-level judging** for the confirmatory measure. See M1's limitation.
4. **Producer tier.** Sonnet, not the top tier used for real design work.
5. **The treatment payload is near-constant across briefs.** Measured before freezing: with no
   PRODUCT.md present, two different briefs produced a **byte-identical** `guidance` array
   (160 lines, 7637 chars). With the brief-derived PRODUCT.md it varies only through the brief
   text it echoes. So this trial largely measures *a fixed prompt suffix*, not per-brief
   intelligence - which is itself a finding about what sidecoach delivers.
6. **A null may indict the packaging, not the idea** (Codex): a 600-line payload can distract,
   dilute the brief, or overconstrain. "Sidecoach as currently packaged did not help" is the
   supportable null; "design guidance cannot help" is not.
7. **I authored the placebo.** See 2.1.

## 8. What a result can and cannot support (fixed in advance, Codex's wording adopted)

A significant S-vs-P win supports: *on this corpus, with this producer tier, this judge and this
injection, sidecoach's payload produced a large apparent preference effect over a length-matched
irrelevant payload.* It does NOT support "sidecoach generally improves model output", "sidecoach
improves visual design", or "sidecoach beats equally good generic design advice".

A non-significant result supports only: *no large detectable improvement under this setup.* It
does not rule out moderate usefulness.

## 9. Changes v1 -> v2, each forced by the Codex design review

| Codex finding | change |
|---|---|
| prompt-length confound makes the headline unidentifiable; needs a length-matched placebo | third arm P added; **primary comparison changed to S vs P**; S vs C demoted and not judged |
| the "I author neither arm" defence is not sound - the author still picks the transform, the field, the wrapper, the judge, the measures | 2.1 and 2.2 now state each authored choice and its bias direction instead of claiming neutrality |
| section 6 mis-listed "M3 positive" as a falsification path | corrected; M3 null/negative is the falsifying path |
| M2 may be degenerate if most pages have zero violations | explicit >= 60% tie degeneracy rule, fixed in advance |
| source-only judging is weak for design quality | M1b rendered-screenshot pass added as a declared secondary |
| n = 20 is a pilot, not a confirmatory trial | section 8 added; "pilot" wording required in the report |
| 13 briefs x 3 arms to fit 40 generations | rejected - 60 generations to keep n = 20; rationale in section 1 |

### Round 2 (the NO-GO item and the two corrections), v2 -> v3

| Codex finding | change |
|---|---|
| **BLOCKING:** dropping M2 from the confirmatory family on an observed tie rate is an outcome-dependent analysis path even when pre-registered | removed. Holm family is fixed as {M1, M2} regardless of tie rate; the tie count is reported descriptively only |
| calling the placebo "orthogonal" to page design is too strong - testing/error-handling/docs advice does bear on a built page | 2.1 reworded: the placebo may help P slightly (biasing against S), while the absence of design advice makes S's bar easier; net effect stated |
| S vs P is identifiable; remaining issue is comparator weakness, not non-identifiability | recorded as the standing caveat in sections 2.1 and 8 rather than a fix |
