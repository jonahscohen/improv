**FIRST: Can this comparison produce a null at all?**

**Yes, but not cleanly.** A null is *possible* in the literal sense: T can lose to P on M1, and M2 can fail to move. But the design is **structurally tilted toward a treatment “win” on at least one confirmatory measure**, because **the treatment payload is selected from the very rule failures of the starting page, and one confirmatory outcome (M2 total axe violations) includes rule families the payload can directly name and instruct fixes for**. That is not a guaranteed win, but it is a **mechanical advantage** unrelated to broader design quality.

More bluntly: **you have built an intervention that is partly an axe-remediation checklist, then declared axe total violations confirmatory.** The named/unnamed split makes the circularity visible, but it does **not remove it from the confirmatory test**. So yes, the trial can return a null, but **if it returns a positive M2, that positive is structurally easy to obtain without the payload teaching anything generally useful**. The mechanism is **target leakage from detector to treatment content to overlapping confirmatory metric**.

There is a second, weaker tilt: **T is page-specific while P is generic nonsense-to-task**. Length matching does not equalize *task relevance*. So T vs P is not “payload content” vs placebo in a clean pharmacological sense; it is **targeted page-specific advice vs irrelevant filler**. That does not guarantee a win, but it makes one easier mechanically.

So the answer is:

- **Null possible?** Yes.
- **Rigged toward a win?** **Partly yes**, especially on **M2**, by **content/metric overlap** and by **relevance asymmetry** between T and P.

---

## 1. Is the primary comparison (T vs P) identifiable, or is there a confound the length-matched placebo does not remove?

**Not fully identifiable.** The placebo removes **length/salience/density**, but it does **not** remove the biggest confound: **page-specificity and task relevance**.

T differs from P in at least three bundled ways:

1. **Design content vs non-design content**
2. **Page-specific selected advice vs generic static filler**
3. **Diagnostic grounding in actual page failures vs no grounding**

Your stated estimand sounds like “does the payload content help?” But the actual contrast is closer to:

> does a page-specific, detector-conditioned design memo outperform an equally long irrelevant block?

That is a much lower bar.

If T wins, you will not know whether the gain came from:
- the **craft knowledge**,
- the fact that it was **about the page at hand**,
- the fact that it **named concrete remediations to active failures**, or
- merely the fact that it **focused the model’s attention on design at all**, unlike P.

The parent null does not rescue this. In the parent, the intervention still had the same broad asymmetry; it just failed anyway. A prior null is not proof of current identifiability.

### What would remove this confound?
A better placebo/comparator would be:
- **generic design advice** of equal length and tone, but **not detector-conditioned**, or
- a **shuffled payload** from another page, preserving designness and specificity-like texture while breaking page-match, or
- a **page-specific but content-scrambled** treatment preserving relevance cues without valid craft.

As written, **T vs P identifies “effect of this whole targeting package versus irrelevant text,” not “effect of the payload’s craft content.”**

---

## 2. Is the unit change from the parent trial legitimate, or does it introduce a bias the parent design did not have?

**Legitimate for product realism, but it introduces new bias.**

You’re right that `polish` is for improving an existing page, not greenfield generation. So the unit change is **product-valid**.

But it also introduces a bias absent or weaker in the build-from-brief design: **regression-to-fixable-defects on inherited artefacts**. Because the starting pages are fixed, measurable, and known to contain failures, a payload derived from those failures has an easier path than it would in generation-from-scratch.

The structural bias is:

- Start from **arm-C pages**, i.e. relatively untreated artefacts.
- Run diagnostics on them.
- Feed back targeted advice derived from those diagnostics.
- Score partly using a metric overlapping with those diagnostics.

That is much closer to a **repair loop** than a general efficacy test of design guidance.

There is also a subtler issue: improving an existing page can create **anchoring effects**. Producers may preserve much of the original page and perform local patching. A detector-derived payload is especially suited to local patching. A blind judge, meanwhile, may care about holistic coherence. That makes the trial almost preordained to repeat the parent pattern: **measured local cleanup without human-visible gain**. That’s not fatal, but it means the unit change is not neutral—it loads the dice toward finding detector-facing improvements.

So:
- **legitimate as a product test**: yes.
- **comparable to the parent as if only content changed**: not cleanly.
- **bias introduced**: yes, toward fix-the-detected-defect effects.

---

## 3. Is the M2 named/unnamed axe split adequate for the circularity it claims to handle, or is total-violations the wrong confirmatory statistic?

**No, the split is not adequate, and total violations is the wrong confirmatory statistic.**

This is the biggest flaw after the relevance confound.

You admit that three axe rules overlap with what the payload can name. Good. But then you keep **total axe violations** as confirmatory “for exact comparability.” That is the wrong priority. **Comparability to a flawed prior measure is not a defense of continued circularity.**

The split does only one thing: it makes a circular win **visible after the fact**. It does **not** prevent that circular win from driving your confirmatory result.

If the treatment reduces:
- contrast failures,
- target-size failures,
- link-in-text-block failures,

then M2 total can improve significantly even if **everything else is flat**. And because the payload is detector-conditioned, that would be an unsurprising and partly mechanical success.

If you want M2 confirmatory, the confirmatory version should be one of:
1. **Unnamed axe violations only**
2. A pre-specified **non-overlapping subset** of axe rules
3. **M1 only** as confirmatory, with M2 secondary/diagnostic
4. A **co-primary gate** where total M2 only counts if unnamed M2 is directionally consistent or significant

Right now, the split is cosmetic. It handles disclosure, not circularity.

Also: calling “everything else axe reports” the unnamed bucket is unstable if axe’s reported rule set varies across pages in sparse ways. You should pin the exact rule IDs and pre-register the membership, not define unnamed as “whatever isn’t in these three” at reporting time without a fixed universe.

**Bottom line:** total M2 should not be confirmatory here.

---

## 4. Is anything in the analysis plan an outcome-dependent degree of freedom?

**Mostly better than average, but yes, there are still some live degrees of freedom and one conceptual dodge.**

### a) “Decided comparisons; ties excluded” on M1
This is standard enough, but with n=17, ties matter. If the judge is conservative and tie-prone, excluding ties can materially change the test denominator. That’s not outcome-dependent if fixed in advance, but it is a **fragility**. You should also report a **tie-as-half** sensitivity or, better, pre-register an ordinal analysis if your judge supports it. As written, a high tie rate can make M1 uninformative while still technically confirmatory.

### b) Bootstrap CI + Wilcoxon test mismatch
You know this already and mention it. Fine. But reporting a **bootstrap CI on the mean difference** alongside a **Wilcoxon test on paired ranks** invites interpretive slippage. Not outcome-dependent, but it is rhetorically slippery. Use a CI aligned to the estimand/test, or demote the extra CI.

### c) “Void if distinct-payload count is 1”
Reasonable integrity check, but note the hidden flexibility: if payload selection mostly collapses but not fully, the trial proceeds. There’s no threshold for “sufficiently page-specific.” You can end up claiming a page-specific intervention with near-generic payloads.

### d) Blinding leak handling
“Leaks are reported, never stripped” is good, but there is no pre-registered **adjudication consequence**. If one arm leaks its identity more, do those pairs stay in M1? If yes, M1 can be contaminated and you’ll still count it. If no, you need a fixed rule. Right now that is a real degree of freedom deferred to judgment.

### e) Self-containment/drop rule
Balanced triple dropping is fine. But there’s no pre-specified handling for **systematically differential failure by arm** beyond naming drops. If T fails more often because its payload induces more breakage, complete-case analysis can bias upward. With only 17 briefs, that matters.

### f) The real dodge: “null declaration”
Your null declaration is careful, but it’s also a rhetorical escape hatch. The study is framed as asking whether the content helps; the declared null statement narrows to “no detectable improvement on this task at this n.” Fine statistically, but it can become a way to avoid admitting a practically damning replication of the parent pattern. Not a DF exactly, but a self-protective framing move.

---

## 5. Does using the parent trial's arm-C pages as the starting artefacts create a problem?

**Yes. Several.**

### a) They are not neutral natural pages
They are outputs of your exact broader system, from a prior trial, under a known wrapper and model family. They may carry stylistic regularities that interact with both the treatment payload and the judge. This is not the same as sampling ordinary pages from the intended use population.

### b) They are selected from the arm with “least contamination,” not from a fresh independent generation
That is understandable operationally, but it still creates dependency on the parent trial’s artefacts and production quirks. You are not just reusing briefs; you are reusing **products of a prior experimental arm** as the substrate of a new experiment.

### c) They may be especially amenable to detector-led patching
Arm C pages are likely to contain baseline defects your monitor is good at finding. That enriches the sample for pages where the treatment has obvious opportunities. Again, not invalid, but it biases toward detector-facing effects.

### d) Potential hidden overfitting by ecosystem, not author intent
Even if you personally did not shape those pages, the entire repo ecosystem did. The payload, scanner, and starting artefacts come from the same world. That’s not code-sharing exactly, but it is **ecosystem coupling**.

### e) Comparability claim is overstated
You say “same instrument, so the two results are comparable.” Not really. Same instruments, different task unit, and reused prior-arm artefacts. This is a related test, not a cleanly comparable rerun with one changed factor.

A stronger design would regenerate starting pages fresh, from a frozen neutral producer prompt, specifically for this subtrial, or use externally sourced pages.

---

## 6. What is the author fooling themselves about?

Several things.

### 1. That “can return a null” is the same as “is not rigged”
You devote section 6 to proving null is possible. That is too weak. A design can be perfectly capable of returning a null and still be **biased toward positive findings**. This one is.

### 2. That length matching solved the hard identification problem
It solved an easy objection from the parent trial. It did **not** solve the central confound, which is **relevant targeted design advice vs irrelevant filler**.

### 3. That reporting the named/unnamed split neutralizes circularity
It does not. It just promises to confess the circularity after using it.

### 4. That “installed binary” and frozen wrapper choices reduce the inferential problem
They improve integrity, not validity. You are very strong on operational fail-closed mechanics. That does not rescue a weak causal contrast.

### 5. That M1 is truly independent because it is another vendor/model
Independence of codebase is not independence of **style preference**. You note this, but underweight it. If the payload induces a recognizable “LLM-thinks-this-looks-designed” style, a similar-family judge can reward conformity to a shared aesthetic prior.

### 6. That arm-C starting pages are the least contaminated, therefore safely neutral
Least contaminated is not uncontaminated. They are still artifacts from the same experimental universe and may be exactly the kind of pages your detector-guided patch loop is best at gaming.

### 7. That this asks whether “that content helps”
No. As designed, it asks whether **the shipped page-specific detector-conditioned payload package** helps relative to irrelevant filler. That is broader, easier, and less interesting than the prose suggests.

---

## Verdict

**NO-GO**

Required changes:

1. **Remove M2 total axe violations from the confirmatory family.** Replace it with **unnamed/non-overlapping axe violations only**, or demote M2 to secondary and make **M1 the sole confirmatory outcome**.
2. **Replace the placebo arm P with a task-relevant comparator**, preferably equal-length **generic design advice not conditioned on the page**, or add such an arm and make the primary comparison **T vs generic-design comparator**, not T vs irrelevant software text.
3. **Pre-register handling of judge blinding leaks**: whether leaked pairs are retained, excluded, or analyzed separately, with no discretion after generation.
4. **Pre-register sensitivity handling for M1 ties**, at minimum a secondary fixed analysis that includes ties (e.g. tie-as-half or ordinal response if available).
5. **Do not use parent trial arm-C pages as starting artefacts** if you want a clean efficacy claim. Regenerate fresh starting pages under a frozen neutral prompt, or use external pages representative of deployment.
6. **Tighten the claim language**: stop describing the estimand as “whether the content helps” unless you actually isolate content from page-specific targeting and task relevance.
7. **Pin the exact axe rule universe and pre-specify the unnamed subset by rule ID**, not by a residual “everything else” description.