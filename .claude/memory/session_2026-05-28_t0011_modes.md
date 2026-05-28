---
name: T-0011 modes-as-positioning naming pass
description: Five sticky modes (forge, kiln, bloom, canvas, trim) shipped as the higher-level layer above verbs - magic-keyword triggerable via the T-0008 hook
type: project
relates_to: [session_2026-05-28_omc-research-synthesis.md]
---

T-0011 shipped. Sidecoach now has a third command surface above verbs and phase commands: 5 sticky one-word "shape of work" modes (analogs of OMC's autopilot/ralph/ultrawork, design-coded).

## Five modes shipped

| Mode | Shape of work | Verb chain |
|---|---|---|
| `forge` | Build new from raw to working | shape -> craft -> polish |
| `kiln` | Fire-harden for production | audit -> critique -> harden -> adapt -> polish |
| `bloom` | Add joy, color, motion, personality | colorize -> delight -> animate -> polish |
| `canvas` | Live in-browser visual iteration | live -> colorize -> polish -> critique |
| `trim` | Strip a busy UI back to essentials | quieter -> distill -> clarify -> polish |

The FlowId chains (the deduped union of each verb's flowIds in execution order) live in `sidecoach/src/modes.ts`. The verb chains (consumed by the bash hook) live in `claude/hooks/sidecoach-modes.json`. Both files are the source of truth - the TypeScript registry for orchestrator dispatch, the JSON for the hook.

## Brainstorm reasoning (why these five)

Constraints: one word each, sticky, no collision with the 22 verbs or OMC's six modes, evocative of *direction* not just phase, cover distinct shapes of work.

I leaned on material/craft metaphors because sidecoach's whole vocabulary is design-coded. OMC went process-coded (autopilot, ralph, ultrawork). Going material-coded gives sidecoach distinct positioning - the names *feel* like design vocabulary in a way "autopilot" doesn't.

Picked over rejected:
- **forge** beat smith (too archaic, surname collisions), buildout (business jargon), rampup (process-coded), make (too generic)
- **kiln** beat gauntlet (too adversarial), shipit (jokey, not sticky), finalize (generic process language). Kiln also enforces ordering metaphorically - you only fire after shaping. That's exactly the constraint we want.
- **bloom** beat spark (too generic), glowup (memey, dated), vivify (too literary), zest (food-coded)
- **canvas** beat studio (too workspace-coded), prowl (too predator-coded), tinker (implies small/aimless work)
- **trim** beat prune (implies discarding), shave (too informal), declutter (two words), purify (overloaded)

Also considered but dropped: scout/compass for "pre-build research" - rejected because the existing `shape` verb already covers the pre-build planning case, and the underlying flows (font-research, component-research, reference-inspiration) live inside craft. Adding a sixth mode that overlaps with shape would dilute the vocabulary. Five is the right size: each covers a *distinctly different* shape of work.

The mode arc is also narrative: a fresh feature can move forge -> bloom -> kiln (build, beautify, harden). A tired existing UI can move trim -> bloom -> kiln. Canvas is the in-browser loop you reach for when the design is already real and you're refining live.

## Hook precedence

When a prompt fires both a mode and a verb (`forge and polish the homepage`), the mode wins. Rationale: the mode's chain already names the verb, so emitting the mode is strictly more information. The hook emits both `<mode>NAME</mode>` and `<chain>verb1,verb2,...</chain>` tags so the receiving session has the full sequence.

Multi-mode tie-break uses registry order: forge, kiln, bloom, canvas, trim. Ordered by expected frequency in fresh project work.

## Why: bypassing the skill-trigger layer is still the right call

T-0008's UserPromptSubmit hook was the architecture decision; T-0011 just adds a second registry that the same hook consumes. The 2026-05-20 finding (skills don't auto-trigger reliably) means hooks are the only durable enforcement layer. Adding modes at the hook layer means they share the same sanitization (code fences, inline backticks, URLs, XML, transcript markers) and the same informational-framing suppression as verbs. Free for both.

## How: shape of the change

1. `sidecoach/src/modes.ts` - new Mode interface + MODES registry. Each mode has name, description, oneLineExplanation, verbChain (verb-id strings), and chain (FlowId array, deduped union of verb flowIds in execution order). getMode/getModeChain/getModeVerbChain helpers.
2. `claude/hooks/sidecoach-modes.json` - mirrors modes.ts for the bash hook. Each entry has mode, pattern, description, oneLineExplanation, chain (verb-ids).
3. `claude/hooks/sidecoach-keyword.sh` - now reads both registries. Match function factored out to handle either registry. Mode matches checked first; on hit, emits additionalContext naming the mode + the verb chain. Verb fallback unchanged.
4. `claude/hooks/test-sidecoach-keyword.sh` - 13 new mode tests added (5 mode-fires + 3 word-boundary + 3 informational + 1 mode-over-verb precedence + 1 multi-mode tie-break). 87/87 PASS overall.
5. `claude/skills/sidecoach/SKILL.md` - new "Modes" section near the top, third command surface added to the intro paragraph, modes table.
6. `marketing-site/sidecoach.html` - new "Modes" section between Verb commands and Why-it-exists, code block showing all five mode invocations.
7. `install.sh` - extended sidecoach component to also symlink sidecoach-keyword.sh + sidecoach-verbs.json + sidecoach-modes.json (previously T-0008 was hand-symlinked).
8. `TASKS.md` - T-0011 moved under Done.

## Verification

- 87/87 tests pass in test-sidecoach-keyword.sh (74 existing verb tests still pass + 13 new mode tests)
- tsc --noEmit clean from sidecoach/
- Smoke tested every mode end-to-end via direct hook invocation (forge, kiln, bloom, canvas, trim all emit correct <mode> + <chain> tags)
- Verb-only smoke test still passes (`polish the button` -> `<verb>polish</verb>` unchanged)
- Mode + verb in same prompt smoke test passes (`forge and polish the homepage` -> mode wins, emits forge chain)

## Files touched

- sidecoach/src/modes.ts (new, 175 lines)
- claude/hooks/sidecoach-modes.json (new)
- claude/hooks/sidecoach-keyword.sh (mode loading + precedence logic)
- claude/hooks/test-sidecoach-keyword.sh (mode test cases + helper)
- claude/skills/sidecoach/SKILL.md (Modes section)
- marketing-site/sidecoach.html (Modes section)
- install.sh (symlink the registries)
- TASKS.md (T-0011 -> Done)
- ~/.claude/hooks/sidecoach-modes.json (symlink to repo)
