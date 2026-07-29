**Bottom Line**
As written, this is worth running only as a pilot, not as a decisive efficacy trial. A positive result would not cleanly show “sidecoach improves output”; it would show “adding this long sidecoach-derived prompt suffix changes outputs, and one judge/axe liked them more.” The prompt-length/content confound is severe enough that the headline claim is not identifiable.

**1. Confounds**
The “I author neither arm’s design content” defense is not sound.

The hidden author channel is everything around the content:

- You choose the PRODUCT.md transform.
- You choose which sidecoach output field is appended.
- You choose the wrapper.
- You choose the producer model and generation protocol.
- You choose source-level judging rather than visual judging.
- You choose M1/M2/M3 and the asymmetric interpretation.
- You choose exclusions, self-containment rules, and leak checks.
- You choose to give only treatment a long additional prompt.

Even if every word in treatment originates from the shipped binary, your choices determine what the binary sees and how its output is injected.

The prompt-length confound is real and large. Treatment gets much more instruction, more salience, more reminders, more constraints, and probably more “take this seriously” pressure. A treatment win is therefore not interpretable as sidecoach-specific.

The missing arm is a **length-matched placebo suffix**:

- Same wrapper + brief.
- Same approximate token count, formatting, and assertive checklist style as sidecoach.
- No sidecoach-specific detector-aligned guidance.
- Ideally generated mechanically before outputs, from generic neutral design/process text or shuffled/non-applicable guidance.

Then the key comparison is not treatment vs bare control; it is **sidecoach vs length-matched placebo**. Bare control can remain useful, but it cannot carry the efficacy claim.

**2. Can It Produce A Null?**
It can technically produce a null: M1 can split, M2 can show no accessibility difference, M3 can fail. So it is not structurally incapable of returning null.

But it is structurally vulnerable to a flattering positive because M1 may reward verbosity, completeness, and checklist coverage visible in source. Since treatment explicitly encourages more states and implementation detail, M1 is not independent of the intervention’s obvious signature.

Also, section 6 has a mistake: “M3 can come back positive” is not a falsification path. Positive M3 is the compromised favorable outcome. The falsifying path is **M3 null or negative**.

Reverse problem: yes, it may also be rigged toward null or failure. If the sidecoach payload is 629 lines or otherwise bloated, it may distract, dilute the brief, overconstrain the model, or cause generic overproduction. A null could mean “the intervention was badly packaged,” not “guidance cannot help.”

**3. Measures**
M1 is load-bearing. M2 is narrow but legitimate if accessibility is part of claimed quality. M3 is mostly decoration.

M1 has the biggest claim burden, but source-only judging is weak for design quality. It may reward CSS volume, named states, semantic-looking markup, and visible effort rather than rendered quality.

M2 is valid only as “axe accessibility violations.” It is not design quality. It may be degenerate if most pages have zero violations. If many pairs are 0 vs 0, Wilcoxon loses useful information and the result becomes mostly a count of rare failures. Pre-register how many zero-difference pairs make M2 non-informative.

M3’s asymmetric rule is mostly legitimate, but only if you are disciplined. Positive M3 should not support the headline. Null/negative M3 is meaningful embarrassment. Calling that asymmetry up front is fine; using positive M3 in the narrative anyway would be a dodge.

**4. N And Power**
n=20 is underpowered for anything except a huge effect. The pre-reg admits this, which is good.

Is it worth running? As a **pilot**, yes. As a confirmatory trial, barely.

A significant M1 result like 16/20 after Holm would support: “On this corpus, with this producer, this judge, and this prompt injection, sidecoach produced a large apparent preference effect.”

It cannot support: “sidecoach generally improves model output,” “the skill improves visual design,” or “sidecoach guidance is better than an equally long generic prompt.”

A non-significant result can only support: “no large detectable improvement under this setup.” It cannot rule out moderate usefulness.

**5. What I Would Change**
Given the 40-generation cap, I would not run 20 bare-control/treatment pairs. I would run a smaller but cleaner 3-arm design:

- 13 briefs x 3 arms = 39 generations.
- Arms: bare control, length-matched placebo, sidecoach.
- Primary comparison: sidecoach vs placebo.
- Secondary comparison: placebo vs bare control, to estimate the “longer prompt/helpful checklist” effect.

Other achievable fixes:

- Judge rendered screenshots or screenshots + source, not source alone.
- Use at least two independent judging passes if possible, even if from the same model with shuffled order and fresh context.
- Pre-register a compact human-readable rubric: brief fit, visual hierarchy, accessibility, responsiveness, interaction states, polish.
- Make M1 produce forced preference plus short rationale, but test only preference.
- Treat M2 as secondary unless the brief explicitly values accessibility.
- Keep M3 diagnostic only; never favorable evidence.
- Pre-register that if axe has too many tied zero pairs, M2 is reported descriptive only.

If you cannot add the length-matched placebo arm, I would not call this an efficacy test. I would call it a pilot comparing “bare prompt” against “bare prompt plus sidecoach payload,” with a major unresolved prompt-length confound.
