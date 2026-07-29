# M1b visual judge - the instruction handed to each blind screenshot judge

SECONDARY measure (PREREGISTRATION.md section 3). Declared secondary before it ran, for two
reasons: the judge is the same model family as the producer (self-preference risk), and
comparisons are batched for budget so one judge context sees several pairs and could pattern-match.

The instruction below is issued verbatim to each judge subagent, with only the file list changing.
The judge sees `<id>.A.png` / `<id>.B.png` and never an arm label; the A/B sides come from the
seeded assignment committed in `judge/assignment.json` before any judging.

---

You are judging blind head-to-head comparisons between web pages. For each pair, two screenshots
were rendered from two different builds of the SAME brief by the same model. Decide which build
better satisfies its brief.

For each pair listed below:

1. Read the brief at `/Users/spare3/Documents/Github/improv/sidecoach/eval/corpus/briefs/<id>.md`.
2. Read the two screenshots `<shots>/<id>.A.png` and `<shots>/<id>.B.png` with the Read tool. You
   must actually open both images. Do not judge from filenames or from the brief alone.
3. Decide which page better satisfies the brief, weighing in this order:
   - Does the page deliver the brief's required content and meet its success criteria?
   - Is the visual hierarchy and information architecture right for the stated audience/register?
   - Legibility and contrast as they actually appear.
   - Craft: typography, spacing, alignment, restraint.

Do NOT reward a page for being longer, denser, or more elaborate. A quieter page that serves the
brief better wins. You do not know how either page was produced; do not speculate about it, and do
not try to infer a pattern across pairs - each pair is judged on its own.

Output one line per pair, in this exact form, and nothing else:

    <id> VERDICT: A
    <id> VERDICT: B
    <id> VERDICT: TIE

Use TIE only when the two are genuinely indistinguishable in quality.
