---
name: why the shipped skills never fire - classified by cause, not by count
description: Classified all 19 shipped skills by WHY they do or do not fire, against 743 genuine human prompts mined from 417 transcripts. The headline "12 of 18 never fired" is true but its implied diagnosis is wrong - most never fired because Jonah never asked for what they do. The real, provable failure is narrow - motion-reference (7 of 7 eligible prompts missed) and tactical-polish (8 of 11 missed) - plus consolidate, which was never installed at all. Found that repo skills lose to third-party skills 13 to 63, and that 10 SKILL.md files advertise an auto-trigger mechanism that does not exist.
type: project
relates_to: [session_2026-07-28_capability-evidence-inventory.md, reflection_2026-05-20.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: 417 transcripts / 514,472 records parsed from assistant tool_use blocks (never grep -c); five-stage corpus split to 743 genuine prompts, blind-audited 24/24 with 2.0% residual leak giving a corrected floor of 728; per-skill eligibility computed from each skill's OWN declared trigger tokens and hand-labelled in full for every skill with n<=28; semantic sweep for design-team; both-directions proof of zero trigger widening on the description edits; baseline suite test-install-prune-skills.sh 22/0 before and after; Codex (gpt-5, reasoning-effort high) adversarial review, 6 findings, all folded
confidence: medium
---

# Why the skills never fire

Collaborator: Jonah. Follow-on to `session_2026-07-28_capability-evidence-inventory.md`,
which measured that 12 of 18 shipped skills had never been invoked. That beat deliberately
left the *why* open ("Whether the 12 never-invoked skills SHOULD fire ... is a product call
for Jonah"). This beat answers it, and the answer changes what should be done.

## Baseline first (Team Rule 9)

`claude/hooks/test-install-prune-skills.sh` runs and passes: **22 passed, 0 failed, exit 0**.
Re-run green after every edit here. There is no test that asserts anything about skill
*firing* - that surface has no runnable baseline, which is why it drifted this far.

## Corpus and denominator

417 transcripts, 514,472 records. Skill invocations parsed from assistant `tool_use`
blocks. Total = **76**, reconciling exactly with the prior beat's independent count.

Raw user-role text records = 2,837. A **five-stage split** left **743 genuine human
prompts (26.2%)**. Envelopes and notifications alone are 1,851 of 2,837 = **65.2%**, which
independently confirms the 65% figure the lead quoted.

**Split audit (added on Codex's finding).** A 24-record blind audit: 12 random INCLUDED
records are all unmistakably Jonah ("come on man", "site's back. thanks. i'm out later",
"Please stop. What the fuck is happening?") - 12/12 correct. 12 random EXCLUDED records are
all envelopes, task notifications or slash-command plumbing - 12/12 correct. A targeted
check then found **15 dispatch briefs (2.0%) still leaking through** on openers my regex
missed (`Teammate on the "improv" repo...`, `Independent review of...`). **Corrected
genuine floor: 728.** The leak direction is conservative: a slightly smaller denominator
makes every engagement rate below, if anything, *understated*. No "real miss" count changes.

**I got this wrong on the first pass and caught it the way the prior beat prescribed.**
My first split returned 836 "genuine" prompts. Printing the matches showed
`You are implementing Task 3...`, `You are doing a competitive/gap analysis...` and
`This session is being continued from a previous conversation...` sitting in the sample.
Second-person role-assignment openers ARE dispatch briefs, and compaction summaries are
harness text. Adding those two rules moved the denominator 836 -> 743. **Printing the
matches is the only reason I did not publish an inflated number**, exactly as the prior
beat warned.

## The finding that reframes everything

The repo ships 19 skills. Across 76 real invocations:

| source | invocations | share | distinct skills used |
|---|---|---|---|
| **repo-owned skills** | **13** | **17.1%** | 4 of 19 |
| third-party / built-in skills | 63 | 82.9% | 15 |

Skills are **not** broken in this harness. They fire 63 times. The repo's own skills
specifically lose. Any theory that blames the harness, the surface, or "skills don't
auto-trigger" is refuted by the 63.

## Per-skill classification

Eligibility is computed from **each skill's own declared trigger tokens**, never phrasings
I invented, then **hand-labelled in full** (not sampled) for every skill with n<=28.
"Genuine" = I read the prompt and judged the skill would actually have helped.

| skill | visible | matched | genuine | fired | class |
|---|---|---|---|---|---|
| motion-reference | yes | 7 | **7** | **0** | **B - real miss** |
| tactical-polish | yes | 11 | **8** | **0** | **B - real miss** |
| icon-source | yes | 28 | ~8 | 1 | **B - real miss (partial)** |
| consolidate | **NO** | 5 | ~0 | 0 | **A - never visible** |
| sidecoach | yes | 51 | ~20 | 6 | D - fires |
| justify | yes | 51 | ~30 | 5 | D - fires |
| task-list | yes | 1 | 0 | 1 | D - fires |
| design-build | yes | 1 | 0 | 0 | **E - failed fix, redundant** |
| fontshare-reference | yes | 6 | 0 | 0 | C - correctly silent |
| social-media | yes | 8 | 0 | 0 | C - no *validated* occasion |
| design-team | yes | 0 (token) / 22 (semantic) | **~2** | **0** | **B - real miss (low demand)** |
| tilt-lab | yes | 3 | 0 | 0 | C - correctly silent |
| lotus | yes | 6 | 0 | 0 | C - correctly silent |
| component-gallery-reference | yes | 1 | 0 | 0 | C - correctly silent |
| design-references | yes | 1 | 0 | 0 | C - correctly silent |
| reflect | yes | 3 | ~1 | 0 | C - correctly silent |
| voice-output | yes | 1 | 0 | 0 | C - by design, never auto-fires |
| curate | yes | 0 | 0 | 0 | C - no occasion |
| visual-effects | yes | 0 | 0 | 0 | C - no occasion |

**design-team was corrected on Codex's finding and I had graded it generously.** Its real
trigger is semantic (full pages, campaigns, multi-section builds, design-system creation),
which a token matcher structurally cannot see. A semantic sweep returned 22 candidates;
hand-labelling gives **~2 genuine occasions, not 0**. The clearest is Jonah asking to *"spin
up another agent to review the work done in R2 for homepage, each CT template and the
resources page. Not fully matching Figma."* That is precisely the multi-surface review
design-team automates, and he orchestrated it by hand instead. Low demand, but not zero -
so design-team moves from "no occasion" to a real miss. **`social-media` is likewise
relabelled "no *validated* occasion"**: its avatar/banner/thumbnail tokens are too broad to
certify health, only broad enough to show the 8 matches were all incidental.

**"12 of 18 never fired" is true and its implied diagnosis is wrong.** Eleven of those
twelve had between **zero and one genuinely eligible prompt in 743**. They are not broken
detectors; Jonah never asked for what they do. Grading them as failures would be the same
error the prior beat confessed to - judging a rate without checking the denominator.

## The real bug is narrow and it is provable

**motion-reference: 7 eligible, 7 genuine, 0 fired.** Every single match is real motion
work in Jonah's own register:

- "stagger in the purple resource cards underneath the hero, animate from bottom upward with a fade"
- "when loader is done, zoom fade in hero, THEN kick in h1 stagger"
- "pause hover: bounce the pause bars left and right in staggered format"
- "deploy an agent to add lenis smooth scroll to our site"

**This is NOT a register mismatch.** The description already contains `stagger`, `Lenis`,
`micro-interactions`. The words matched and the skill still never ran. That rules out the
route-intent explanation (lexicon encoded the wrong register) and leaves selection failure.

**tactical-polish: 8 of 11 genuine, 0 fired**, including "The badges need to be 100% border
radius" and "Something about the marketing homepage feels off" - the latter is a phrase
quoted *verbatim in its own description*.

**icon-source** shows the cost concretely. Jonah, after two failed rounds: *"this looks
terrible. can you just fucking take the lucide animated pause and play icons and use the
animations from each? please?"* Sourcing verbatim from Lucide Animated is precisely what
the skill exists to enforce. It took user frustration to reach the behavior the skill
would have supplied on turn one.

## Strongest candidate cause: the text describes a mechanism that does not exist

**Downgraded on Codex's finding.** I originally wrote this section as "root cause". That
overclaims. "No hook invokes the Skill tool" proves *hook-based* auto-triggering does not
exist; it does **not** prove that the phrase "Auto-triggers on" caused the non-firing, and
it does not rule out model-side selection working differently. The defensible claim is:
**misleading auto-trigger language coexists with observed non-firing and may contribute;
the improvement is unproven.** Read this section as the leading hypothesis, not a
demonstrated cause.

**Zero hooks invoke the Skill tool.** Verified by grep across all of `~/.claude/hooks/*.sh`.
`sidecoach-keyword.sh` only injects a self-question; it cannot invoke anything. A skill
runs only when the model chooses to call it.

Yet **10 SKILL.md files advertise "Auto-triggers on ..."**. Worse, `sidecoach/SKILL.md`
built control flow on top of the fiction:

> "If the skill auto-triggers, follow it ... If you're modifying UI but the skill did NOT
> auto-trigger, manually invoke `/tactical-polish`"

This instructs the model to *wait and see* whether a nonexistent mechanism fires. The
branch never resolves, so the fallback never runs. tactical-polish: 0 invocations. Sidecoach
is the repo's most-invoked skill and CLAUDE.md routes all design work through it, so this
one paragraph sits directly on the path of every design task.

The repo has known this since **2026-05-20**. `design-build/SKILL.md:14` says in its own
text: *"Auto-triggering by description keywords didn't fire reliably."* design-build was
built to fix it. **design-build has fired 0 times in two months.** The fix failed and
nothing checked.

## A hypothesis I tested and REJECTED

Installed skills are **copies**, not symlinks, and 6 had drifted from committed payload.
Attractive theory: the live text is stale. **It is not the cause.** I diffed the
frontmatter descriptions specifically: **the drift is entirely in bodies; not one
description differs.** The selection surface was never stale. Recording this so nobody
re-runs the theory.

## What I changed

All within `claude/skills/`, which I own.

1. **`sidecoach/SKILL.md`** - removed the dependence on the nonexistent auto-trigger.
   Now states plainly that no hook calls the Skill tool, that a skill runs only when
   invoked, and to invoke `/tactical-polish` directly. This file is **symlinked**, so it
   is live immediately.
2. **14 SKILL.md descriptions** - `Auto-triggers on` / `Triggers on` -> `Invoke this skill
   when the task/request involves`. Framing only.

**The two changes are NOT the same kind of change, and Codex was right that I blurred
them.** Change 2 is framing-only and the proofs below cover it. **Change 1 is an
operational behavior change**: "invoke `/tactical-polish` yourself before reporting done"
is a new standing instruction on every UI task, not a rename. My token-equivalence proofs
do **not** cover it, and nothing here measures its effect. It is justified as removing a
branch that waits on an impossible event, and it is a live behavior change that should be
watched - it is the one edit in this unit that could plausibly *over*-fire.

**Zero trigger widening for change 2, proven in both directions** (the lead's hard
constraint):

- Stripping the framing phrase from before/after leaves **byte-identical remainders for
  all 14 files** - 0 deltas beyond the phrase.
- Matching quoted trigger tokens sourced *from the descriptions themselves* against the
  743 prompts: **before=57, after=57, delta=0**, and **0 skills changed their matched set**.
- No token was added, so no false positive can be added. No token was removed, so no false
  negative can be added. This is true by construction, not by sampling.

## What I can prove and what I cannot

**Proven:** the auto-trigger mechanism does not exist (grep). consolidate was not installed
(absent from disk and from the live skill list). The eligible/genuine/fired counts above.
Zero widening. Baseline green before and after.

**NOT proven:** that any of this makes a skill fire more often. I changed text on the
selection surface; I did not run a controlled trial and there is no way to run one from
inside a single session. The honest defense of the rewrite is narrower and sufficient:
**the removed sentences were false**, and one of them instructed the model to wait for an
event that cannot occur. Removing a false instruction is justified whether or not it moves
the number.

**Codex's standing callout still stands and I am not closing it:** nobody has measured
whether these skills IMPROVE output, only whether they run. motion-reference firing on
"stagger in the purple resource cards" would be an engagement win and still might not be a
quality win.

## Deployment reality (blocks the fix)

`~/.claude/skills/*` are **copies**. Only 2 of my 15 edits are live: `sidecoach` (symlink)
and `consolidate` (freshly installed 04:04 today by the parallel installer unit).
**The other 13 are inert until `install.sh` re-runs.** A payload edit to a copy-installed
skill changes nothing about what the model reads. Anyone editing skill text must re-install
or the change is theatre.

## Recommendations (evidence attached, not acted on)

- **DELETE or MERGE `design-build`.** 0 fired, 0 genuine demand, and it exists solely to
  fix a problem it did not fix. It duplicates sidecoach's orchestration role, and CLAUDE.md
  already names sidecoach the single front door.
- **MERGE `design-references` into `curate`.** Its catalog holds **2 entries**. A grep over
  2 references cannot help; it is a lookup layer with nothing to look up.
- **KEEP the class-C skills.** social-media, visual-effects, tilt-lab, lotus, curate are
  spec sheets awaiting an occasion that has not arisen in 728 prompts. Zero demand is not
  evidence of a defect. Deleting them would be a measurement error in the harsh direction.
- **KEEP `design-team`, and revisit its trigger.** It has ~2 genuine occasions and 0 fires.
  Too little demand to justify a rewrite now, too much to call it unused.
- **18 skills of which 12 are dead is NOT the right framing.** It is 19 skills of which 4
  are genuinely mis-firing (motion-reference, tactical-polish, icon-source, design-team),
  1 was never installed, 1 is a failed duplicate, and 10 are idle for want of demand. Only
  the first six are actionable.

## Handoffs (not mine to edit)

- **installer-integrity:** (a) `consolidate`'s install block landed 2026-07-27 and the
  installer had not re-run, so a **live nudge hook pointed at a skill that did not exist**
  for a day. Now resolved by their re-run. (b) `claude/CLAUDE.md` states sidecoach
  "auto-triggers on design verbs" and that the four peer skills are "each auto-triggering
  on its own keywords". Both are false by the same grep. That file is theirs.
- **sidecoach-flow:** `claude/skills/sidecoach/SKILL.md` is mine and is edited; the
  `sidecoach/` engine is theirs and is untouched.

## Codex review (gpt-5, reasoning-effort high) - 6 findings, all folded

Codex was probed present (`codex-cli 0.142.5`) and completed in roughly 5 minutes with no
hang this time. Its verdict: *"mostly defensible as a diagnostic, but the author grades
generously on causality and on `design-team`."* All six findings are folded above:

1. **Causality overclaimed** - "root cause" downgraded to "strongest candidate cause";
   the no-hook grep proves hook-based auto-trigger is absent, not that the wording caused
   non-firing.
2. **The sidecoach edit is not framing-only** - it is an operational behavior change my
   token proofs never covered. Now called out separately as the one edit that could
   over-fire.
3. **413 vs 417 discrepancy** - a real factual error I had written into a LIVE file
   (`sidecoach/SKILL.md` is symlinked). Corrected to 417.
4. **The 743 denominator was unaudited** - ran a 24-record blind audit (24/24 correct) and
   found 2.0% residual brief leakage; corrected floor 728.
5. **social-media graded healthy on too-broad tokens** - relabelled "no *validated*
   occasion".
6. **design-team graded generously** - semantic sweep found ~2 genuine occasions, not 0;
   moved to a real miss.

It also noted that 13/76 is a large enough sample to establish the skew (Wilson 95% CI
roughly 10-27%, against a naive inventory share of 56%), but that the skew alone shows
repo skills were rarely invoked, **not** that wording is why. I have adopted that framing.

## Self-analysis

I nearly shipped a 836-prompt denominator with dispatch briefs in it. The failure mode was
that I wrote a splitter, saw it produce a plausible number, and moved on **without reading
its output**. Same error as the prior beat, one unit later, by a different author who had
just read the warning. The rule survives contact only if printing samples is mechanical
rather than remembered: a classifier's first output must be *examples*, never a count.

Second, and this is the one that matters: **I wrote a factual error into a LIVE file.**
`sidecoach/SKILL.md` is symlinked, so my "413 real transcripts" typo was in effect the
moment I saved it, and my own corpus said 417. I copied the number from the prior beat
instead of from my own measurement, in a sentence whose entire purpose was to cite
evidence. Codex caught it, not me. The lesson is narrow and mechanical: **a number quoted
inside a deliverable must be read back from the run that produced it**, never from memory
of an adjacent document - especially when the file is live rather than staged.

Third: my initial "action-bound descriptions fire more" hypothesis was too clean. My own
regex flagged component-gallery-reference and fontshare-reference as action-bound and both
have 0 invocations. I would have published a tidy causal story that my own data contradicts
two rows later. The surviving claim is much weaker and I kept the weaker one.

## Files touched

- `claude/skills/sidecoach/SKILL.md` (auto-trigger fiction removed; live via symlink)
- 14 `claude/skills/*/SKILL.md` descriptions (framing only, zero token change, inert until re-install)
- `.claude/memory/session_2026-07-28_skills-never-fire.md` (this beat)
- `.claude/memory/MEMORY.md` (one index line)

No installer, hook, registry or lexicon file was modified. No commit.
