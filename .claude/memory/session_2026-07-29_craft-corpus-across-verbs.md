---
name: Craft instruction extended from one verb to all 26, plus an unconditional craft floor
description: Generalized the polish-craft teaching corpus across every live flow handler and added a PreToolUse craft floor that loads before any UI edit with no verb required
type: project
relates_to: [session_2026-07-28_installed-live.md, session_2026-07-29_craft-review-folded.md]
author_human: Jonah
author_model: claude-opus-4.6
machine: spare3
source: session
verified: tests + executed-payload harness + live hook invocation
confidence: high
---

# Craft instruction across every verb, and a floor that cannot be routed around

## The measured starting point

`grep -rl --include='flow-handler*.ts' polish-craft src | grep -v __tests__ | wc -l` returned **1**.
One of 26 flow handlers taught anything. Ten handlers imported `src/design-laws.ts`, but what they
pulled out were defect DESCRIPTIONS - the rule's own name restated. The clearest example was flowK's
payload: five lines reading `Dimension 1: Accessibility (WCAG compliance, semantic HTML, keyboard
nav)`. Each names a domain and its parenthetical lists what will be looked at. None states what good
looks like. flowL printed `CRITIQUE_RULES` as `<name> (weight: <n>): <description>` - a rubric, which
tells a reviewer what to look for and never what the good answer is.

Reproduced independently with a harness that EXECUTES each handler and reads its guidance
(`scripts/prove-craft-briefs.ts`): 1/26 teaching, 0/26 citing a source, 0/26 naming failing rules.

## What was built

Four new modules plus one hook, in dependency order:

1. **`src/craft-probe.ts`** - the measurement that makes selection real. Invents no detector: wires
   `product-rule-registry.RULES` + `validators/checks` + `validators/project-collector` behind one
   cached call, so any flow can ask "which rules in MY domain fail on this project?". Static source
   only - it never renders, and a rule needing computed styles or DOM geometry returns `inconclusive`,
   reported separately and NEVER as failed. 60 registry rules evaluated; a deliberately broken fixture
   produces 21 real failures with measured messages, severity and finding class.

2. **`src/craft-corpus.ts`** - the engine plus craft notes for the 36 registry rules `polish-craft`
   did not cover. `registryCraftGaps()` now returns **0**: every rule the probe can fail has teaching
   content, enforced by test.

3. **`src/craft-laws.ts`** - 76 domain-law notes across 12 domains (typography, color, spatial, motion,
   responsive, interaction, writing, critique, reflex, research, composition, tokens), mined from
   `reference/_extracted/` - bencium MOTION-SPEC and RESPONSIVE-DESIGN, typeui typography-principles,
   refactoring-ui, and the tactical-polish set. These are for flows that run BEFORE there is an
   artifact to measure, where "nothing failed" is not a useful payload.

4. **`src/craft-flow.ts`** - one policy, two shapes. `check` flows teach what failed and teach nothing
   when clean. `produce` flows teach the up-front standard and additionally enumerate any failures in
   their domain. Findings are UNCAPPED; the cap applies only to how many notes are TAUGHT, so the
   brief withholds an explanation, never a finding.

5. **`src/craft-floor.ts` + `bin/sidecoach-floor.js` + `claude/hooks/sidecoach-craft-floor.sh`** -
   the floor (see below).

## Result

**26/26** live flow handlers emit a craft brief with Good/Why/Do, **26/26** cite an in-repo source,
**26/26** put TEACH before CHECK, 24/26 name failing rules inline in the shared format (flowJ names
them in its own pre-existing format; flowC's three scoped rules need a live render on the fixture).

Every property of the reference implementation preserved: teach-then-check ordering, real values not
instructions to add a value, a `source:` field, selection by rules that actually FAILED, hardest
first, cap disclosed in the payload, a clean page getting no brief, detector half untouched.

## The floor, and why it is a separate mechanism

The scoreboard loss was not depth. The comparison implementation's craft floor **loads before every
UI edit**, so no routing decision can miss it; ours reached one handler and depended on a verb being
chosen correctly to reach even that. Breadth still depends on correct routing. A floor does not.

A skill cannot close that gap - a skill loads when the model chooses to load it, which is the same
dependency. A UserPromptSubmit hook cannot either, because a UI edit inside a long build turn happens
many turns after the prompt. The only layer that fires on the edit itself is **PreToolUse on the
write**, which is what shipped: `Write|Edit|MultiEdit`, UI extensions only, injecting 15 floor notes
and 10 refusals-with-replacements as `additionalContext`, registered in both `claude/settings.json`
and the live `~/.claude/settings.json` with a 15s timeout.

Proven live: a `Write` of `/tmp/noverb-project/hero.css` with no sidecoach verb anywhere in the
payload injects 11,712 characters, `permissionDecision` absent (it never blocks), stderr empty.

The two mechanisms are kept visibly separate, which the payload states in its own first two lines.
The floor says `This is a FLOOR, not findings ... not because any sidecoach verb ran and not because
anything was measured`, and points at `sidecoach audit` for real findings. Asserted by test in both
directions: the floor never emits the findings header, and neither brief mode calls itself a floor.

**One source of truth:** the floor SELECTS from the same note corpus the briefs use, so a fix to a
note improves both surfaces and neither can drift. `floorCoverageGaps()` fails a test if a floor key
stops resolving.

## Two bugs found by running things rather than reasoning about them

**1. The pre-filter was dead for a bash-4 reason.** `case "${FILE_PATH,,}"` is a bash-4 parameter
expansion. macOS ships bash 3.2 as `/bin/bash`, so every invocation printed `bad substitution` to
stderr, the case never matched, and every write fell through to node. The floor still worked, because
`isUiPath()` in the CLI rejected non-UI files correctly - which is exactly why it would have gone
unnoticed: right behaviour, dead optimisation, permanent hook error on every UI write. Fixed with
`tr '[:upper:]' '[:lower:]'`. Regression-covered by an explicit "emits nothing on stderr" assertion.

**2. My own test needles were wrong twice.** The hook test looked for `nothing was measured` while the
floor emits `not because anything was measured`, then for `not a defect report` while the floor emits
`Nothing here is a defect report`. Both reported a failure that was entirely the instrument's. Same
shape as the lead's `grep -vE '^\|'` prose detector that dropped every line starting with a pipe -
the lines carrying the prose. Read the raw output before believing a probe.

## Measurement integrity: the scoreboard probe now measures the wrong thing

The scoreboard row runs `grep -rl --include='flow-handler*.ts' polish-craft src`. Handlers import
`craft-flow`, not `polish-craft` directly, so that probe still returns **1** and will keep returning 1
no matter how much teaching is wired. It is measuring one module's name, not whether a payload
teaches. Three honest numbers instead:

- files importing any craft module: **21 of 26**
- handlers whose EXECUTED payload teaches: **26 of 26**
- floor loads on a UI edit with no verb: **yes**, proven live

21 not 26 because the 26 flows live in 21 files. The 5 that carry no import are correct to carry none:
`flow-handler.ts` is the base class (no handler), `flow-handlers-curate-qa.ts` and
`flow-handlers-tier5-specialized.ts` are pure re-export barrels, and `flow-handler-multi-lens-audit.ts`
and `flow-handler-design-critique.ts` are **orphans - nothing imports them**. The live flowK and flowL
come from `flow-handlers-tier3-tier4.ts`. Wiring the orphans would have produced exactly the
unreachable result the anti-drift rule warns about; the harness pins which file each flow really runs.

Also found: 7 flows (N, O, P, Q, W, Y, Z) have no typed verb routing to them, but ARE referenced by
`lanes.generated.ts` / `intent-detector.ts`, so they are reachable by natural language and were wired.

## Scope precision

Each handler declares its own domain rather than taking a whole finding class. flowR first pulled in
tabular-nums, font-smoothing and icon-swap transitions through a `polish` class filter - real defects
that are not a spacing pass's business. A payload that teaches another flow's domain is how a verb
stops meaning anything, so the broad filters were replaced with explicit rule lists.

flowM is `produce` rather than `check` on purpose, stated in code: the registry has only a handful of
statically-decidable responsive rules (hit area needs DOM geometry), so a findings-only brief would
teach almost nothing on a page with real responsive defects, and `adapt` is invoked to change the
layout rather than grade it.

## Verification

- baseline before any change: `npx tsc --noEmit` clean, `npm test` exit 0
- `npx tsc --noEmit` clean after
- `src/__tests__/craft-corpus.test.ts` - registry coverage, note substance (information content beyond
  the rule's own vocabulary), selection ordering across both corpora, proportionality, probe honesty
  (unmeasured is not clean; inconclusive is not failed), and LIVE handler wiring
- `src/__tests__/craft-floor.test.ts` - integrity, self-identification, real values, unconditionality
  (identical for clean and broken projects), refusals carry replacements, UI detection, no blending
- `claude/hooks/test-sidecoach-craft-floor.sh` - 29 assertions including fires-with-no-verb,
  never-blocks, silent-on-cooldown, silent-on-non-UI, clean stderr, malformed input exits 0
- both new suites registered in `scripts/run-tests.ts` as required
- proportionality confirmed live: flowK payload 799 chars on a clean page vs 9,093 on a broken one

## Files touched

New: `src/craft-probe.ts`, `src/craft-corpus.ts`, `src/craft-laws.ts`, `src/craft-flow.ts`,
`src/craft-floor.ts`, `bin/sidecoach-floor.js`, `scripts/prove-craft-briefs.ts`,
`src/__tests__/craft-corpus.test.ts`, `src/__tests__/craft-floor.test.ts`,
`claude/hooks/sidecoach-craft-floor.sh`, `claude/hooks/test-sidecoach-craft-floor.sh`

Modified: `src/polish-craft.ts` (brief now prints its Source line), `scripts/run-tests.ts`,
`claude/settings.json` + `~/.claude/settings.json` (hook timeout), and the 20 live handler files -
brand-verify, component-research, font-research, design-references, motion-patterns, design-tokens,
component-implementation, motion-integration, accessibility, responsive-validation,
layout-optimization, typography-excellence, ambitious-motion, curate, all-seven-qa,
landing-composition, copywriting, flow-handlers-core, flow-handlers-extended, flow-handlers-tier3-tier4.
