## Blocking changes from my v2 review

**1) Relabel as pilot or add a non-floor objective endpoint — CLOSED.**  
v3 relabels the study as a **pilot** throughout and explicitly adopts the reasoning that, on this substrate, there is no usable independent objective confirmatory endpoint. It no longer pretends the design can support a confirmatory efficacy claim, so the core honesty problem is fixed even though the design remains weak.

**2) Fix arm G so T-vs-G isolates selection, matching note budget — NOT CLOSED.**  
v3 fixes the obvious **24-notes-vs-8-notes** asymmetry, which is good, but the new G still does **not cleanly isolate selection** because it keeps the true page-specific findings while only scrambling the teaching. That means G still contains a large amount of page-matched diagnostic information, so T-vs-G is no longer “selection alone” in any strong sense and may be driven toward a near-zero contrast by construction.

**5) Do not reuse the parent trial’s arm-C pages — CLOSED.**  
v3 regenerates 17 fresh starting pages from the payload-free wrapper, freezes them before arm construction, and explicitly withdraws the prior defense of reuse. That directly closes the specific contamination problem I identified, even though broader ecosystem coupling remains.

---

## (a) New arm G as a derangement: does it isolate page-match?

**Not cleanly.** It isolates **one narrow component** of page-match—whether the 8 taught notes correspond to this page’s failures—but it does **not** isolate “selection” in the fuller operational sense, because G still receives the same true page-specific measured findings block as T.

That matters because the findings block is itself highly informative. If G sees “here is what is wrong on this page,” then even with mismatched teaching, a competent producer can often repair the page directly from the findings, use general design skill, or infer the right fix from the finding text alone; in that world, the added value of the matched 8 notes may be small, so **T-vs-G may be near-zero by construction**.

So yes: **holding the findings identical leaks page-match back into G**. It likely **shrinks the very contrast M1a is supposed to measure**, perhaps enough to make M1a largely uninformative about whether the selector matters in practice.

The tradeoff is real: if you deranged the findings too, you would inject false statements about the page and create an unfairly bad comparator. But the fact that the alternative is worse does **not** mean the current contrast is clean; it means you are stuck between a biased-against-G design and a design where **G retains much of the treatment’s page-specific signal**.

Ways G still fails to isolate page-match cleanly:

- **Findings are page-specific guidance.** They are not inert scaffolding; they tell the producer what to inspect and often imply what to do.
- **Mismatch severity is uncontrolled.** Some deranged note sets will be almost as relevant as the true set; others will be wildly irrelevant. A seeded derangement avoids self-matches, but it does not equalize semantic distance.
- **Notes may be generic.** If many of the 8 selected notes are broad craft advice, swapping them across briefs may barely change usefulness.
- **Producer inference can bridge the gap.** Given true findings plus general competence, the producer may reconstruct the needed repairs without the matched notes.
- **Measured findings may dominate the brief.** If the findings are the most salient block, the swapped notes become a weak perturbation rather than the key manipulation.

So my plain answer is: **no, this does not cleanly isolate page-match**. It is better than v2’s uncapped all-24-note G, but it likely makes **M1a conservative to the point of low informativeness**, because the comparator still gets most of the page-specific signal.

---

## (b) Fresh starting pages: any new problem?

**Yes, one new problem appears, though it is not fatal.** The fresh pages’ actual defect profile is now unknown at preregistration time, while section 3.2’s axe-floor argument leans on the **old parent arm-C pages** as a proxy for what this substrate will look like.

That is acceptable for a **pilot** if described honestly, and v3 mostly does describe it honestly. But the floor claim is now weaker than before: it is no longer “we know this substrate is at floor,” only “the best pre-data proxy from a closely related generation process suggests it is probably at floor.”

So the new issue is not outcome-peeking; it is **proxy uncertainty**. If the fresh pages turn out to have materially more unnamed axe violations than the old pages, then the rationale for saying objective endpoints were dead-on-arrival will look overstated in hindsight.

I would not call this blocking, because preregistration necessarily uses proxies for not-yet-generated artefacts and you do disclose the fresh pages’ profiles regardless of result. But I would call the current language a bit too confident whenever it says unnamed axe **is** at the floor, rather than **appears likely to be at the floor on the basis of the closest available pre-data proxy**.

---

## (c) Pilot label and whether this is worth 85 cells

**The pilot label is honest.** v3 no longer dresses this up as confirmatory, and it plainly states that the evidence rests on one blind judge at n=17 with no independent objective efficacy endpoint.

But honesty of labeling is not the same as value for budget. **Given everything here, I do not think this trial is worth running at 85 producer cells.**

Why not:

- **M1a is likely attenuated toward zero by construction.** G gets the same true findings, so the treatment’s incremental advantage may be too slight to show anything useful.
- **M1b is low-evidentiary.** G vs P is still design advice versus filler; a positive result would tell you little beyond “relevant content beats irrelevant content.”
- **Power is poor.** At n=17, with one judge, you are only well-powered for very large effects.
- **No objective confirmatory support exists.** Even as pilot evidence, a one-judge forced-choice result on 17 items is thin.
- **The likely outcomes are not decision-rich.**  
  - If null/null: unsurprising, hard to interpret, and maybe just low power.  
  - If G>P but T≈G: maybe the content helps but selection doesn’t—or maybe M1a was neutralized by shared findings.  
  - If T>G: interesting, but still on a small noisy base with one judge.

So plain answer: **yes, the pilot labeling is honest; no, I do not think this is a good use of 85 cells.** If the budget exists, I would spend it on a redesign with a more decision-useful contrast or on collecting a substrate where an independent objective endpoint is actually live.

More concretely, better uses of the budget would be:
- build a comparator that withholds both matched findings and matched notes without injecting falsehoods, if possible;
- use externally sourced starting pages or a substrate with non-floor objective measures;
- add more judges rather than more elaborate arm structure;
- or run a simpler two-arm pilot aimed at the single question you most care about.

---

**NO-GO**

- **BLOCKING:** Arm G still does not let **T vs G** cleanly identify the value of selection/page-match, because holding the true findings identical leaks the key page-specific information into G and likely compresses M1a toward a near-null contrast.  
- **NON-BLOCKING:** Soften section 3.2/1.1 language to make clear that the axe-floor argument now rests on the old pages as a pre-data proxy, not on known properties of the fresh pages themselves.