---
name: retiring design-build and design-references, and what had to be preserved
description: Jonah's ruling executed - design-build deleted, design-references merged into curate. The 2026-05-20 orchestration finding was moved out of the deleted file into this beat and into sidecoach before deletion. Measured that install.sh's hardened prune CANNOT remove either retired skill on any deploy shape in use, because it walks direct children of ~/.claude/skills and both skills are real directories.
type: project
relates_to: [session_2026-07-28_skills-never-fire.md, session_2026-07-26_orphan-improv-skill.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: six suites re-measured on the final tree (hook-registry 75/1 three consecutive runs, component-browser 139/0 -> 138/1 by the deliberate cross-owner registry handoff, installer-manifest pass, install-prune-skills 44/0, bin-parity 18/0 gate, settings-wire-parity 21/0 gate); prune verified empirically in a sandboxed temp HOME against a scratch git repo across three deploy shapes with a positive control; reference/index.html and README.md verified in a real browser with real input; six Codex wrapper rounds across three units, all exit 0
confidence: high
---

Collaborator: Jonah. 2026-07-28. Authored against HEAD 363458ea.

## The ruling

Jonah: eighteen skills of which twelve never fire is worse than six that work.

- **`design-build` - DELETE.** 0 invocations in two months. 1 matched prompt, 0 genuinely
  eligible. Built in May to fix description-based selection not firing, and then never
  fired itself.
- **`design-references` - MERGE into `curate`.** 0 invocations. Its catalog holds TWO
  entries, so a grep over it cannot help. `curate` already writes that catalog and is the
  natural home for reading it.

Evidence is `session_2026-07-28_skills-never-fire.md` (417 transcripts, 743 genuine
prompts, corrected floor 728). Sanity-checked before deleting, not re-derived: that beat's
per-skill table records design-build as class E (failed fix, redundant, 1 matched / 0
genuine / 0 fired) and design-references as class C (1 matched / 0 genuine / 0 fired), and
its recommendations name exactly these two actions. `ls ~/.claude/design-references/*/ref.md`
returns 2, confirming the catalog size independently.

## What was preserved, and where

**1. The 2026-05-20 orchestration finding.** This is the part that matters more than the
deletion. `design-build/SKILL.md` was the only durable carrier of a finding that is TRUE,
was independently reconfirmed twice today, and predicts the failure this repo keeps
rediscovering. Losing it means someone rebuilds design-build in six months for the same
reason. Recorded here verbatim in substance:

> The 2026-05-20 marketing-site build was the first time the design pipeline ran on a real
> UI task. Two structural findings came out of the retrospective:
>
> (a) **Description-based skill selection did not happen reliably.** Of the 9 pipeline
> steps, only 2 ran. `component-gallery-reference`, `design-references` and `icon-source`
> were never selected from their frontmatter descriptions during the build.
> `tactical-polish` only ran because the agent had read it recently.
>
> (b) **The QA triad (`/sidecoach audit + critique + polish`) never ran.** CLAUDE.md
> requires it, but it is a manual or orchestrated step, not an automatic one. The only live
> automatic coverage is `sidecoach-taste-gate.sh`: on `.html`/`.css` writes under a
> directory containing DESIGN.md it runs the anti-pattern ban sweep, and on an edited
> `.html` (plus the project's `styles.css` when present) it also runs the taste validator.
> That is a SUBSET of `/sidecoach audit`. Nothing invokes `/sidecoach critique` or
> `/sidecoach polish`, and audit coverage outside a DESIGN.md project stays manual.

The finding outlived its fix. design-build was built in May to solve (a) and (b) by being an
explicit orchestrator, and it recorded the diagnosis in its own line 14. It then fired zero
times in two months, which means the orchestrator shape did not solve the selection problem
either - it only moved the dependency from "the model selects six skills" to "the model
selects one skill", and the model did not select that one either. **The lesson to keep is
not "build an orchestrator" - it is that a step nothing mechanically invokes does not run,
and wrapping N un-invoked steps in one un-invoked step does not change that.** The only
coverage that has ever demonstrably fired is the hook (`sidecoach-taste-gate.sh`), because
a hook is the one thing in this harness that runs without being chosen.

It is also preserved in `claude/skills/sidecoach/SKILL.md`, which inherits the orchestration
role and is the file a future session actually reads when it reaches for a pipeline.

**2. What design-references claimed to do, folded into `curate`.** Merging the file was not
enough; curate had to gain the surfacing behaviour or explicitly decline it. design-references
claimed a read path: extract category/pattern/feel signal from the task, grep
`~/.claude/design-references/*/ref.md`, score (category +3, each pattern +1, each feel +1,
source +3), read the top 0-5 in full, surface them with title / why-interesting body / URL /
screenshot, and stay SILENT below a score of 3. `curate` now carries that as a second mode
(Recall) alongside its capture wizard, including the scoring table, the silence rule, the
TODO-body filter, and the "starting points, not prescriptions" framing. The one thing not
carried over is the claim that it happens on its own - see below.

**3. Two build gotchas that existed NOWHERE else in the repo.** Found by grepping every
substantive claim in the deleted file against the surviving skills before trusting the
review to catch it. Most of design-build's body was delegation - the fontshare reflex-reject
typeface list is in `fontshare-reference`, the 16 tactical rules are in `tactical-polish`,
the icon protocol is in `icon-source`. Two things were not anywhere:

- **`cdn.skypack.dev` fails SILENTLY on `lenis`; use `esm.sh`.** No console error, no
  exception, just no smooth scroll. `grep -rn skypack claude/` returned nothing outside the
  file being deleted.
- **Reveal-on-scroll must fail VISIBLE.** `[data-reveal] { opacity: 0 }` with a JS reveal
  renders the page permanently blank if the JS never runs, with no error anywhere - and the
  most likely reason the JS never runs is the CDN gotcha directly above it. The fix is
  inverted progressive enhancement: visible by default, hidden only under a `.js` class that
  JS itself sets. `grep -rn data-reveal claude/` also returned nothing else.

Both moved into `claude/skills/motion-reference/SKILL.md` under "Gotchas - the ones that
bite", where the Lenis content already lives, along with the Lenis-hijacks-verification note
(that one was partly covered by the global CLAUDE.md scroll-verification rule, but not from
the building side). **This is the concrete answer to "is anything of value being lost":
yes, two things were, and they were caught by checking rather than by assuming the
orchestrator was pure delegation.**

## The measured finding: the prune cannot remove either skill

Requirement from the lead was to VERIFY that `install.sh`'s hardened prune actually removes
these two, not to assume it. **It does not, on any deploy shape in use.** Measured, not
reasoned.

`prune_broken_skill_symlinks` walks `for link in "$dir"/*` over the DIRECT CHILDREN of
`~/.claude/skills`, and skips anything that is not a symlink (`[ ! -L "$link" ] && continue`).
Both retired skills are deployed as REAL DIRECTORIES containing their `SKILL.md`:

    ~/.claude/skills/design-build/         drwxr-xr-x   real directory
    ~/.claude/skills/design-build/SKILL.md -rw-r--r--   real file, 13593 bytes

The prune's own hard safety rule - "Symlinks only. A real file or real directory is never
touched" - means the direct child is skipped before any shape or git-provenance check runs.
This is the same mechanism `session_2026-07-26_orphan-improv-skill.md` hit with the `improv`
orphan, which it recorded as "the orphan was a real file, which is exactly why the installer
would never have cleaned it". Today's hardening added `~/.claude/hooks` as a second prune
directory and replaced location-inference with shape + git provenance; it did not change the
symlink-only or direct-children-only rules, so the gap survived the hardening untouched.

Sandbox proof, in a temp HOME against a scratch git repo where the skills were committed and
then retired in a second commit (so git provenance genuinely reads "retired"), across the
three deploy shapes that exist in the wild:

| shape | what it is | prune verdict |
|---|---|---|
| A: real dir + real file | what is live on this machine right now | **not a candidate** - direct child is a real dir |
| B: real dir + per-file symlink | what `install_bundled_skill` writes today in symlink mode | **not a candidate** - direct child is still a real dir; the dangling link is one level deeper |
| C: whole-directory symlink | legacy shape from older installs | candidate; removed in apply mode |

Only shape C is reachable, and no current install path produces it: `install_bundled_skill`
does `mkdir -p "$_ibs_dst"` and then routes each FILE through `link_or_copy_data`, so the
skill directory is always real and only its contents can be links.

Consequence, which is the part that has a deployment tail: once the component keys are
removed from `install.sh`, `deactivate_design_skill` can no longer remove them either
(`install.sh:2967` and `:2970` are the only paths that `rm -rf` these directories, and they
are reachable only through the component keys being retired). So removing the registrations
without a cleanup path converts a retired skill into a permanent orphan on every machine
that installed it, exactly like `improv`. Reported to the lead for `coverage-gaps`, who owns
`install.sh`; not edited here.

## Codex review (gpt-5, exit 0, 213.3s) - all findings folded

Prompt asked the primary question first and concretely: is anything of value being lost.
Verdict: *"Yes, something of value is being lost, but mostly from `design-build`, not
`design-references`."*

- **The merge is clean.** Codex checked every element I claimed to carry over and confirmed
  all seven present in `curate` with line numbers: scoring table, 0-5 cap, silence-below-3,
  TODO-body filter, category mapping, layering order, a11y deference. It also ruled the
  frontmatter widening bounded - recall triggers are UI-surface scoped and capture still
  requires explicit save intent.
- **The preserved 2026-05-20 finding is faithful.** Verified against the deleted original on
  both halves, including the exact `sidecoach-taste-gate.sh` coverage description.
- **It independently confirmed the two gotchas** (`cdn.skypack.dev` silent failure on
  `lenis`, `data-reveal opacity:0`) as *"not preserved in this diff"*. I had already found
  and fixed those before the review returned - the review reviewed the pre-fix diff - so
  this is corroboration by two independent paths rather than a catch I missed. Worth
  recording because it is the one part of this unit where assuming would have destroyed
  something: an orchestrator LOOKS like pure delegation, and mostly is, which is exactly why
  the unique 10% is easy to throw away.
- **Category C, real losses I had not addressed:** the two AskUserQuestion gate wordings and
  a build-log note. **Folded selectively, and the selection is the judgment call:** the
  QA-findings checkpoint is now in sidecoach's QA gate section, because that gate SURVIVES
  and the wording is directly reusable. The strategy-direction gate wording was deliberately
  NOT preserved - it gates a pipeline that no longer exists, and `/sidecoach craft` owns
  direction approval now. The "note no gallery match in the build log" discipline is
  subsumed by the standing per-task beat rule. Codex flagged these correctly and explicitly
  allowed for the case where retired orchestrator mechanics are not wanted; that is the case
  for two of the three.
- **Dangling references outside the diff**, which Codex was right to raise and which are not
  mine to edit - reported to the lead, listed below.

### Codex re-review of the folded diff (exit 0, 196.6s) - 4 findings, all folded

Round 2 confirmed the gotchas are now faithful and correctly placed (it checked the `esm.sh`
import form and the Lenis package name against current upstream docs), and that `curate`
reads as one skill with two modes - *"a visible transplant scar because Mode B is long, but
the intro, trigger split, and shared 'does not do' section make it coherent rather than
stapled."* Four things it caught:

1. **A stale count I introduced.** `browser-tree.json` still tagged the group
   `11 design-pipeline skills` after I removed two leaves, and the word "design-pipeline"
   now contradicted CLAUDE.md's new "no separate design-pipeline skill". Fixed to
   `9 design skills`, and verified programmatically that the tag matches the actual leaf
   count rather than trusting my own arithmetic twice.
2. **The fail-visible pattern slightly overclaimed.** Setting the `.js` class on the first
   line covers "the script never ran at all" but NOT an exception thrown after the class is
   set and before the reveal is wired. Now says exactly that, with the `catch`-and-remove
   remedy. This is the better version of the gotcha than the one design-build carried.
3. **The strategy-gate call was defensible but under-argued.** Codex would only sign off "if
   `/sidecoach craft` or `shape` really owns approval at runtime". It does -
   `/sidecoach shape <feature>` is gate 3 of the Mandatory Workflow Gates - so the sidecoach
   QA section now says so explicitly rather than leaving a reader to wonder where direction
   approval went.
4. **The skipped-QA accounting was a real soft loss.** design-build required recording
   "QA triad SKIPPED because <reason>". "Subsumed by session beats" was reasonable but weak,
   because the beat rule does not say to record a NEGATIVE. Added one line to the sidecoach
   QA gate: an unrecorded skip is indistinguishable from a gate that passed, which is
   precisely the condition that produced the 2026-05-20 finding in the first place.

## Registry removal is a two-owner change, and the guard proved it

`claude/hooks/browser-tree.json` lost both leaf keys. That alone turns
`test-component-browser.sh` RED (139/0 -> 138/1, `FAIL every component bucketed`), because
its completeness check reads every `KEYS+=(...)` array out of `install.sh` and asserts each
key appears in the tree. With the tree entries gone and `install.sh` untouched:

    MISSING: ['design-build', 'design-references']

Exactly those two, nothing else. **This is the registry guard working, not a regression I
introduced blindly** - it is the half-registration defect class doing what it exists to do
across an ownership boundary. `install.sh` belongs to `coverage-gaps`, so the hunk is
handed over rather than applied.

The hunk was PROVEN on a temp copy, not just described. `DESIGN_SKILL_KEYS` and its five
index-parallel arrays (`TITLES`, `DESCS`, `FILES`, `DIRS`, `PICKS`) all go 11 -> 9 in
lockstep; after that the bucketing check returns `MISSING: []` and `bash -n` is clean.
Beyond the arrays, the same retirement has to reach: the header comment listing the skills
bundle, the two `skills` bundle strings (DESCS + FILES), the two `status` cases, the two
`deactivate` dispatch lines, the bundle install list, and the two a la carte install blocks.

**Two things in that hunk are judgment calls, not mechanical deletions, and they are why it
is a handoff and not a patch:**

1. **The catalog seeding must move, not die.** The a la carte `design-references` block is
   what seeds `~/.claude/design-references/_vocab/categories.txt`. `curate` now owns the
   catalog in both directions, so the seeding belongs on the `curate` path. Deleting the
   block without moving it leaves recall pointed at a vocab file that a fresh install never
   creates.
2. **Deleting the deactivate cases removes the only cleanup path that works.** The two
   `rm -rf "$CLAUDE_DIR/skills/design-{build,references}"` lines are the ONLY code anywhere
   that can remove these directories from an installed machine, because the prune cannot
   (measured above). Remove the component keys and those lines together and every machine
   that ever installed them keeps them forever, exactly like the `improv` orphan in
   `session_2026-07-26_orphan-improv-skill.md`. A retirement needs a one-shot cleanup that
   outlives the component key, or the orphan is permanent.

## ONE guard bug producing TWO false positives (corrected by the lead)

`hook-registry-stop.sh` blocked with "skill(s) in claude/skills/ are never deployed by
install.sh: sidecoach, voice-output". Both flag identically against HEAD 363458ea's
install.sh, so neither is caused by this unit, which only REMOVED two names from the
enumerated set. **Both are FALSE POSITIVES with the same single cause.**

`hook-registry-guard.sh --audit-skills` treats a skill as deployed only if install.sh
contains a `claude/skills/<name>` path literal or `copy_bundled_skill <name>`.
**`copy_bundled_skill` does not exist** - `grep -c copy_bundled_skill install.sh` returns
**0**. The function was renamed to `install_bundled_skill`
(`session_2026-07-28_skill-deploy-verify.md`). So the guard is one rename behind the
installer and cannot see the modern deploy path at all:

- **`voice-output`** is deployed by the bundle loop
  `for _skill in ... voice-output; do install_bundled_skill "$_skill"; done`. Invisible to
  the guard twice over: dead function name, and the loop passes a variable.
- **`sidecoach`** is deployed by a direct call, `install_bundled_skill sidecoach`, at
  **install.sh:6522 at HEAD** (6776 in the working tree). Verified with
  `git show 363458ea:install.sh`, so it is not something a sibling added mid-session.
  Invisible for the same reason: dead function name.

There is no missing deploy line. The flagship skill is not shipping nowhere, and the
2026-05-20 finding preserved into `sidecoach/SKILL.md` reaches other machines normally. The
only fix is `hook-registry-guard.sh --audit-skills`, routed to `vacuous-sweep`. **Adding a
deploy line for either skill would be packaging theatre against a blind check.**

### What I got wrong, because the shape of it matters

I originally reported this as one real defect plus one guard bug, and recommended
`coverage-gaps` add a sidecoach deploy line. That would have sent an agent on a substantial
wrong fix; the lead verified before routing it, which is the only reason it did not land.

**The slip: I proved the instrument was blind, then trusted its other reading.** I correctly
established that the guard recognises exactly two shapes and that one of them names a
function that no longer exists. Having established that, I accepted its `sidecoach` reading
as evidence of a real gap instead of as another output from a device I had just shown to be
broken. I even wrote the sentence containing the answer - that it "only ever saw design-build
and design-references because their DIRS entries happened to match the path regex, not
because it understood the loop" - and did not turn it on the finding sitting next to it.

**The rule to carry: once a measurement device is shown to be broken, every reading from it
is suspect, including the ones that fit your expectations.** A broken instrument is dangerous
rather than merely useless precisely because it fails in the confident direction - it hands
you a specific, plausible, actionable defect. The check that would have caught this was one
grep for the deploy call, which is the same grep I had already run for `voice-output` and did
not think to re-run for the finding I believed. The lead notes this matches three of his own
probe failures today, so the failure mode is structural, not personal.

## The user-facing page (second unit, lead reassigned it to me)

I had reported `reference/index.html` as "not mine". The lead made it mine, on the grounds
that reporting a user-facing falsehood and leaving it is the pattern being corrected today.
Correct call: the page was the single most visible carrier of the claim.

It mentioned `/design-build` seven times (six links, two `design-orchestrator` anchors) and
`design-references` six times. And the headline claim was never true even when the skills
existed: the page said design-build *"solves both"* the non-firing problem and the QA-triad
problem, when the measured answer is that it fired zero times and therefore solved neither.

**What the page now says instead.** Not a deletion of the links - a replacement of the
model. The retired `#design-orchestrator` section became `#design-orchestration`, "How it
actually gets orchestrated", and its answer is: operationally, by you, deliberately. No hook
mechanically invokes a design skill; skills DO get selected (Sidecoach regularly is), but
selection is a judgment call every time, not a guarantee you can build a process on. It then
states what runs mechanically (the taste gate, and only the taste gate), what is the
reader's obligation (shape before, the triad after), the AskUserQuestion gate on findings,
and the rule that a skip must be written down. The retirement is stated in the open with its
evidence rather than quietly erased.

**Other contradicted claims found in the same sweep**, which is the part the lead was right
to demand - a page honest about two skills and wrong about four others is not fixed:

- `tactical-polish` "auto-triggers on UI keywords" - false, and the most costly one on the
  page, since it is the layer with 8 genuinely eligible occasions and 0 fires. Now says
  invoke it yourself, and says why it is the most-skipped layer.
- The peer-skills section said the four peers "route in independently when needed". Same
  false mechanism, softer wording. Now: you invoke them; they do not route themselves in.
- `/sidecoach live` was listed as a command. The live verb and canvas mode were removed
  2026-07-23. Now noted as removed, pointing at Justify for visual iteration.
- "Twenty-three commands" for sidecoach. Actual surface is 26 flows behind 21 verb commands
  plus natural-language intent.
- "10 Anthropic Skills + catalog seed" on the component card. **This was already wrong
  before I touched it** - the body listed 11 - and my merge would have left it wrong in the
  other direction. Now 9, matching both the body and the post-retirement installer list.

**Verified visually, not structurally-only.** Served it on `serve.py 4831` and drove it in
Chrome with real input: clicked the Design nav link, clicked the renamed sidebar anchor,
wheel-scrolled the main column through all seven layers, and wheel-scrolled the sidebar's
own region. The renamed `#design-orchestration` anchor resolves and the scrollspy highlights
it. No dangling anchors, no duplicate ids, no unclosed tags, no console errors.

**A blank screenshot that was not a defect, and how I avoided reporting it as one.** Three
separate screenshots came back completely black. The reflex reading was the exact failure I
had just documented in `motion-reference` an hour earlier - a reveal-on-scroll stuck at
`opacity: 0`. It was not. The page's smooth scroll animates over a long distance on a deep
link, and a screenshot taken mid-flight catches an empty region. Waiting 3-4 seconds and
re-shooting showed the content every time, and `read_console_messages` showed zero errors.
**Having a fresh, vivid failure mode in mind made me likelier to see it, not likelier to
diagnose it correctly** - the wait-and-recheck cost ten seconds and was the difference
between a real finding and a fabricated one.

**Codex on the page: two rounds, both exit 0 (254.5s, 243.0s), 9 findings, 8 folded and 1
REFUTED.** Round 1 caught a count I had broken and an ambiguity I had introduced: the
component card still said "10 Anthropic Skills" while the body listed 9, and
"No skill in this stack fires on its own" was too categorical, since Sidecoach demonstrably
does get selected. It also caught that I had dropped the `styles.css` companion from the
taste-gate description. Round 2 caught the vocab example (`inline-affordance` where the
skill's documented starting vocab uses `inline-edit`) and that "hooks can nudge and
validate" understated Sidecoach's hook-assisted daemon routing. All folded.

**The one I did not fold, because I checked it.** Codex claimed my "only design coverage
that happens without being chosen" was too broad, citing `sidecoach-detect.sh` as a second
PostToolUse scanner wired in `app-wirings.json`. It is wired there - and it is also listed
in `browser-tree.json`'s `default_off_hooks`, and it is NOT registered in this machine's
live `settings.json`. So on a stock install the claim was correct. Codex read the wiring
table without the default-off list. I kept the claim, added "by default" and a sentence
naming `sidecoach-detect` as a default-off second scanner, so the page is precise for both
the stock and opted-in cases. **Recording this because the reflex on a cross-model finding
is to fold it - the reviewer is usually right, and the two rounds here prove it - but
"usually right" is not "right", and the check cost one grep.**

## README.md (third unit)

Ten mentions of the retired skills, and a WORSE version of the falsehood the reference page
carried: an 8-step "How the layers stack on a real build" list in which every single layer
"triggers" or "fires" by itself. That list was the most misleading passage in the repo,
because it read as a specification of automatic behaviour rather than as marketing.

Rewritten so every one of the 8 steps is something the reader does, under a lead that states
the operating model plainly ("The stack is deliberate, not automatic"), followed by what
actually is mechanical (the one hook), with the corpus evidence moved to the end as
supporting material rather than the opener. Codex's tone note drove that ordering and was
right: a README is a front door as well as a manual, and leading with the measurement made a
working system sound broken.

Same sweep as the reference page, and it found more:

- The summary said **"six skills"** with a 6-row layer table while the detailed sections were
  already numbered **1-7** with Tokens as 6. **A pre-existing internal contradiction**, not
  something the merge caused. Aligned to seven, matching both the detailed sections and the
  reference page.
- `tactical-polish` "auto-triggers on UI keywords" - same false claim as the reference page.
- `design-references` as the retrieval skill, in three places.
- Counts: "10 design + peer skills", "bundles 10 skills", "adds an 11th skill", and a
  `tactical-polish` **"14-point checklist"** where the detail section says sixteen. The
  skills table itself lists 9 rows, so the stated counts disagreed with the table beneath
  them.
- Front-door copy still called Design "the 6-layer pipeline".
- "Twenty-three commands" for sidecoach.
- The `inline-affordance` vocab example, same as the reference page.

**A contradiction BETWEEN the two documents, which only surfaced by reviewing them
together.** Codex caught that the README put `/tactical-polish` during implementation
(step 7, before QA) while the reference page put it after the QA triad. Both were partly
right and the docs disagreed: the sixteen rules are applied DURING construction, and the
checklist is gate item 4 AFTER the triad, verifying they landed. Both documents now say
exactly that. Worth recording as a method note: **reviewing two documents in one diff found a
defect that reviewing either alone could not**, because neither was internally wrong.

Also corrected in both: the taste-gate wording said "an existing `.html`/`.css` file", which
misreads for a newly-created file since the hook is PostToolUse and the write has already
happened; now "the written target". And the component.gallery example count was a hard
`2,672` that had already drifted to 2,671 upstream - replaced with "roughly 2,700" so it
stops rotting.

**Verified in the browser** the same way as the reference page: served, clicked through, and
confirmed the House 3 sidebar now reads seven numbered layers ending in
"7. Tactical (tactical-polish)" with no orphaned orchestrator entry.

Codex on the README: 2 rounds, both exit 0 (162.3s, 154.8s), 11 findings, all folded. It
independently confirmed the seven-layer table matches the seven detailed sections in order
and owner across both documents, and verified the measurement numbers against
`session_2026-07-28_skills-never-fire.md` rather than taking them from me.

**Pre-existing taste-gate findings, declared not fixed.** The gate fires on every write to
this file and reports 9 findings: 5 `fabricated-svg`, 2 `translatey-in-hover`, 2
`hex-in-interactive-state`. All 9 are present at HEAD in inline SVG and in `styles.css`,
which a text edit to prose cannot reach. `fabricated-svg` is a global-rule violation
(icons must be sourced verbatim from an approved library) and is worth its own unit; it is
not in scope for a capability-claims pass and I am not silently absorbing it.

## Deployment reality on this machine right now

Measured, not assumed:

| skill | deploy shape | status of my edit |
|---|---|---|
| `sidecoach` | SKILL.md is a SYMLINK | **live immediately** - the preserved finding is in effect now |
| `curate` | SKILL.md is a COPY | **inert** until `install.sh` re-runs |
| `motion-reference` | SKILL.md is a COPY | **inert** until `install.sh` re-runs |
| `design-build` | real dir, real file | **STILL INSTALLED** - deleted from the repo, still on disk |
| `design-references` | real dir, real file | **STILL INSTALLED** - deleted from the repo, still on disk |

So on this machine at this moment the model can still read both retired skills, and the two
skills that absorbed their content are still serving the pre-merge text. That is the same
copy-vs-symlink trap `session_2026-07-28_skills-never-fire.md` recorded ("anyone editing
skill text must re-install or the change is theatre"), and it is why the `install.sh`
handoff is not optional bookkeeping - until it lands and the installer re-runs, this
retirement exists only in the repo.

## Suites, before and after

**Tree state for every number below**, because the lead measured two of them differently and
was right to ask: HEAD `363458ea`, working tree with 5 agents writing concurrently and
`claude/hooks/` carrying 4 modified files (`browser-lib.sh`, `browser-tree.json`,
`test-hook-data-parity.sh`, `test-route-intent.sh`). Re-measured after the reference-page
unit, same tree.

| suite | before | after (re-measured) |
|---|---|---|
| test-hook-registry.sh | 75 passed, 1 failed (exit 1) | 75 passed, 1 failed (exit 1) - unchanged |
| test-component-browser.sh | 139 passed, 0 failed (exit 0) | 138 passed, 1 failed (exit 1) - the handoff above |
| test-installer-manifest.sh | PASS (exit 0) | PASS (exit 0) |
| test-install-prune-skills.sh | 44 passed, 0 failed (exit 0) | 44 passed, 0 failed (exit 0) |
| test-bin-parity.sh (gate) | 18 passed, 0 failed (exit 0) | 18 passed, 0 failed (exit 0) |
| test-settings-wire-parity.sh (gate) | 21 passed, 0 failed (exit 0) | 21 passed, 0 failed (exit 0) |

Both acceptance gates hold at exit 0. The lead measured `test-component-browser` at 139/0
and `test-hook-registry` at 76/0. Both of mine reproduce (hook-registry three consecutive
runs, all 75/1), and neither disagreement is noise:

- **component-browser 138/1 is deterministic and causal, not flaky.** The bucketing check
  returns exactly `MISSING: ['design-build','design-references']` - my browser-tree edit
  against an unpatched `install.sh`. It goes green the moment the handoff lands. A 139/0
  reading is simply a measurement taken before the browser-tree edit.
- **hook-registry's failure is NOT about hook deletion, which is why it moves.** The row is
  `deleted hook stops blocking`, asserting the Stop hook exits 0 once a fixture hook is
  removed. But `hook-registry-stop.sh` blocks if ANY of its three classes is non-empty, and
  the unmanaged-SKILLS class is non-empty right now: the live ack key reads
  `H:|D:|S:sidecoach|voice-output|U:`. So the row fails on the SKILLS class, not on anything
  about hooks, and it flips to green whenever the ack file already happens to hold the
  current key - which is why a 76/0 reading is real and not a mismeasurement.
  **It goes green when `vacuous-sweep` fixes the `--audit-skills` regex**, because both
  entries in that class are false positives from the dead `copy_bundled_skill` name. It is
  NOT waiting on a deploy line; there is no deploy line to add. (I first wrote that it was
  waiting on `coverage-gaps` - that was the same wrong inference corrected above, propagated
  one step further. Worth noting that a single bad premise produced two confident downstream
  claims in different sections, which is how one unverified reading turns into a pattern
  rather than an isolated error.)

## Self-analysis: the sandbox that proved nothing

My first prune sandbox reported "0 removable" and I nearly wrote that up as "the prune
cannot remove any of the three shapes". It was wrong for a boring reason: I set `REPO_DIR`
as an environment variable, and `install.sh` **recomputes `REPO_DIR` from its own script
location at source time**, so every comparison ran against the REAL repo instead of my
scratch one. The shape check then failed for the trivial reason that the sandbox path is not
the real path, and I would have reported a correct conclusion supported by a measurement
that could not have shown otherwise.

I caught it only because I traced the run instead of accepting a result that agreed with my
prior. That is the tell worth keeping: **the sandbox returned exactly the answer I expected,
and that is precisely when the harness itself needs checking.** A negative result from a
harness that was never proven capable of producing a positive one is not evidence. The fix
was to add a control - the legacy whole-directory symlink shape, which SHOULD be pruned - and
only trust the negatives once that control came back positive. Shapes A and B are dead
because the control proved the harness works, not because the run printed zero.

## Files touched

- `claude/skills/design-build/SKILL.md` (DELETED - finding preserved in sidecoach + this beat)
- `claude/skills/design-references/SKILL.md` (DELETED - behaviour merged into curate)
- `claude/skills/curate/SKILL.md` (Mode A Capture + Mode B Recall; description widened to cover recall)
- `claude/skills/sidecoach/SKILL.md` (2026-05-20 finding preserved under the QA gate; design-stack diagram updated)
- `claude/skills/motion-reference/SKILL.md` (cross-reference repointed to curate Recall)
- `claude/CLAUDE.md` (design-stack section: no orchestrator skill, curate owns the catalog both ways)
- `claude/hooks/browser-tree.json` (both leaf keys removed; group tag corrected 11 -> 9)
- `README.md` (8-step auto-fire list rewritten, 6-vs-7 layer contradiction resolved, 5 stale counts fixed)
- `reference/index.html` (the public page: orchestration section replaced, section 4 merged
  to `/curate`, four other measurement-contradicted claims fixed, one count corrected that
  was already wrong before this unit)
- `.claude/memory/session_2026-07-28_skill-retirement.md` (this beat)
- `.claude/memory/MEMORY.md` (index line)

NOT touched, reported instead - every remaining `design-build` reference in the repo, so
nothing is left implicit:

- `install.sh` (owned by `coverage-gaps`) - the proven hunk above.
- **`reference/index.html` - the loudest one.** The public reference site ADVERTISES
  `/design-build` as a headline capability: a sidebar link, a `#design-orchestrator`
  section, and the claim that it *"solves both"* the non-firing and QA-triad problems. That
  claim was never true - the skill fired zero times - and the page is now selling a skill
  that does not exist. This is the highest-value follow-up in the list because it is
  user-facing.
- `sidecoach/reference/_extracted/local-skills/design-build/INTEGRATION.md` (owned by
  `taste-precision`) - a snapshot of the deleted skill. Notably it already predicted this
  outcome, listing "Subsumption: sidecoach absorbs design-build's phase ordering" as one of
  two futures.
- `SIDECOACH_AUDIT_REPORT.md` and
  `docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html` - historical
  records; correct to leave as-is.
- `beats/.build/beats.db` and `beats.jsonl` - generated index, rebuilds itself.

No commit.
