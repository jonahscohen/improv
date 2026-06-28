---
name: sidecoach
description: The design orchestration system for Improv. 26 flows, two parallel command surfaces (phase commands + 22 verb commands), plus teach/document setup commands and a help command. Use for all design work: /sidecoach craft <feature>, /sidecoach shape <feature>, /sidecoach polish <target>, /sidecoach audit <target>, /sidecoach animate <target>, /sidecoach critique <target>, /sidecoach teach, /sidecoach document, /sidecoach list, /sidecoach help <verb>. Also triggers on: brand verification, component research, font pairing, motion patterns, design tokens, accessibility audit, responsive design, typography, clone/implement a design, colorize, delight, bolder, overdrive, quieter, distill, clarify, optimize, harden, adapt, live iteration, onboarding flows.
---

# Sidecoach - Design Intelligence Orchestration

For a single-page reference covering every verb and flow at a glance, see [CHEATSHEET.md](./CHEATSHEET.md).

Sidecoach is the design workflow layer built into this Claude Code installation. It provides 26 intelligent flows (post-T-0015 cull, 2026-05-28) covering every phase of design work, with full orchestration, memory, and validation.

Three command surfaces share the same flow chains:
- **Phase commands** - sidecoach native vocabulary grouped by phase (research / craft / review / special).
- **Verb commands** - 22 verb commands that mirror the canonical design verb vocabulary 1:1 and route to the same underlying flows. The orchestrator appends per-verb guidance (canonical reference sections plus sidecoach extensions) so output speaks the verb language while keeping sidecoach's validators, BuildReport, taste validation, and memory.
- **Natural-language intent detection** - the primary surface, and the one to lead with. You describe a design task in plain English and the intent detector classifies it to the right flow (asking a single clarifying question when two are a close call), then runs it to convergence with checkpointing. Exposed to the model as the MCP tools `classify_intent` / `list_lanes` / `sidecoach_lane`, so the same plain-language request works in the CLI, desktop, or an IDE sidebar. This replaced the retired one-word mode keywords.

## Dependent capabilities

Sidecoach delegates specialized work to dependent tools. Treat these as part of sidecoach, not separate detours:

- **tilt-lab** (`/tilt-lab` skill) - generative and shader BACKGROUNDS. When a flow produces a hero or section that wants an animated, shader, or gradient backdrop, that is sidecoach's job, fulfilled through tilt-lab: audition and tune the effect stack in the workbench, export the self-contained embed, and mount it with `mountStack` behind the content (absolute, reduced-motion-aware, with the design tokens the flow already established). `craft`, `bloom`, `animate`, and `overdrive` are the verbs most likely to reach for it. Do not hand-write a background shader when tilt-lab can supply a tuned, faithful one.

## Natural-language intent detection (this replaced modes)

The old one-word mode keywords (`forge`/`kiln`/`bloom`/`canvas`/`trim`/`ralph`) are RETIRED. Jonah's call (2026-06-12): they were optimized for hook-detectability, not for how a person actually talks - "kiln this release" is not a sentence anyone types. Do not reintroduce magic keywords that fail the say-it-out-loud test.

The replacement is intent detection: you write what you want in plain language and sidecoach figures out which design task you mean.

- An intent detector (`sidecoach/src/intent-detector.ts` / `lane-classifier.ts`) scores the request across tiers (strategy/research, execution, polish/QA, special, refinement) and picks the best-matching flow, keeping runner-up candidates.
- When two are a close call, sidecoach asks a single clarifying question rather than guessing. A one-question confirm is a pathway to specificity, not a violation of the no-lazy-questions rule.
- The matched task runs to convergence (`lane-runner.ts` + `lane-convergence.ts`): it loops until the quality checks pass or it stalls/caps, and checkpoints progress (`lane-checkpoint-store.ts`) so a crash never loses or double-applies work.
- It is exposed to the model as MCP tools - `classify_intent`, `list_lanes`, `sidecoach_lane` - so the same plain-language request works in the CLI, desktop, or an IDE sidebar.

Source of truth: `sidecoach/src/lanes.generated.ts` (generated task registry), `intent-detector.ts` / `lane-classifier.ts` (classification), `claude/hooks/sidecoach-lanes.json` (the hook lexicon). The legacy `modes.ts` / `sidecoach-modes.json` and the old MCP `list_modes` / `resolve_keyword` survive ONLY as a deprecated feed and are slated for deletion - do not document them as a feature.

## Invoking the Engine

**QUIET INVOCATION (this is the user experience - treat it as a hard rule).** When you run Sidecoach for the user, the run must be QUIET: one command, then the panel, nothing else.
- Run exactly ONE command (the monitor, below). Do NOT wrap it in greps, file reads, `cat`/`ls`, or exploratory/extra calls - a normal Sidecoach run is a SINGLE call. The detection happens inside the engine; you do not investigate around it.
- Print ONLY the panel (`renderedPanel`) VERBATIM. Do NOT also print the JSON, the guidance list, the build report, or a recap of the findings.
- Do NOT narrate. No "let me run sidecoach", no play-by-play of what you're doing, no postamble explaining or summarizing the panel afterward. The panel IS the explanation - let it stand alone.
- The `guidance`/`checklist`/`buildReport` drive YOUR OWN execution silently; never surface them to the user as prose.
- The single monitor call itself still renders in the transcript (that is harness behavior, not yours to hide). But everything around it - narration, greps, extra commands, JSON dumps, summaries - is yours to suppress, and you must.

**Before doing any design work**, run the Sidecoach engine and use its output as your implementation plan:

```bash
node /Users/spare3/Documents/Github/improv/sidecoach/bin/sidecoach-monitor.js "/sidecoach <command> <target>"
```

The monitor's **default output is the clean, low-noise panel** - what the user should see. Running it bare (no flag) prints that panel and nothing else; for `/sidecoach audit <url>` the panel is a final REPORT - the verdict, the findings grouped by category and rule, and the concrete priority fixes (full selector + metric). Surface that panel VERBATIM: do not rebuild it, wrap it in prose, or summarize it.

For your OWN execution add `--json` to get the full machine-readable result. It carries the same rendered panel under `renderedPanel` (so you print it for the user from the SAME run - no re-render) plus the structured fields you act on:
- `renderedPanel: string` - the clean panel; PRINT THIS VERBATIM to the user.
- `guidance: string[]` - YOUR ordered steps to execute; act on them, do NOT paste them to the user as prose.
- `checklist: object[]` - every item must pass before you report done; failures are blockers.
- `buildReport` / `audit` - structured findings, per-lens outcomes, verdict, grade.
- `artifacts: object[]` - reference data (components, tokens, motion patterns); use verbatim.
- `detectedFlow` - confirms which flow matched.
- For the lane path (`sidecoach_lane`), each `start` / `advance` result carries `.panel` too - print that snapshot after each op so progress shows live.

**Template for every invocation** (one run: print the panel for the user, act on the structured fields yourself):

```bash
RESULT=$(node /Users/spare3/Documents/Github/improv/sidecoach/bin/sidecoach-monitor.js "$UTTERANCE" --json)
echo "$RESULT" | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (r.renderedPanel) console.log(r.renderedPanel);   // the panel the user sees - print verbatim
  // r.guidance / r.checklist / r.buildReport drive YOUR work; do not paste them as prose.
"
```

## Commands

### Entry-command routing (pick one before writing code)

| User's intent | Command |
|---|---|
| Net-new feature or page, build from scratch | `/sidecoach craft <feature>` |
| Plan the design only, no code yet | `/sidecoach shape <feature>` |
| Add motion, color, personality, or boldness | `/sidecoach animate`, `colorize`, `delight`, `bolder`, `overdrive` |
| Tone down a loud or over-stimulated UI | `/sidecoach quieter` or `distill` |
| Fix typography, spacing, layout, responsive, copy, perf | `/sidecoach typeset`, `layout`, `adapt`, `clarify`, `optimize` |
| Production-ready sweep (errors, i18n, edge cases) | `/sidecoach harden` |
| First-run flows, empty states, activation | `/sidecoach onboard` |
| Pull reusable tokens and components into the design system | `/sidecoach extract` |
| Iterate visually on elements in a live browser | `/sidecoach live` |

When unsure, run `/sidecoach list` for the full menu. Once an entry command is loaded, let its reference file drive. Do not improvise around it.

### Setup and Strategy
| Command | What it does |
|---|---|
| `/sidecoach teach [brief]` | Brief-driven hybrid setup: parses what's in the brief, asks targeted questions only for the gaps, writes PRODUCT.md. Refuses to overwrite a real existing PRODUCT.md unless `forceOverwrite` is set. |
| `/sidecoach teach --deep [brief]` | Deep-interview mode (T-0023, closes OMC gap #5): extends the taxonomy from 5 to 9 fields (adds problem, success metrics, business model, technical constraints, brand voice), runs vague-answer detection that demotes low-effort answers ("developers", "modern", "professional") to low confidence and surfaces a sharper follow-up question, reports an ambiguity score across 4 weighted dimensions (goal/constraints/criteria/context) with weakest-dimension targeting, validates the written PRODUCT.md structurally before returning, and hands off to `/sidecoach document` when DESIGN.md is missing. Use for any new project where the brief is more than a sentence or two; standard teach is fine for established projects with a known shape. |
| `/sidecoach document` | Generates Google-spec DESIGN.md from project HTML/CSS: YAML token frontmatter plus the six-section body in canonical order. |
| `/sidecoach shape <feature>` | Plans design approach before building; runs exploration and rapid iteration |
| `/sidecoach list` | Shows both phase commands and the 22 verb commands grouped by phase |
| `/sidecoach help <verb>` | Shows registry detail for a verb: description, phase, reference path, flow chain, parity checklist, sidecoach parity-plus additions |

### Implementation
| Command | What it does |
|---|---|
| `/sidecoach craft <feature>` | Builds new component from scratch: tokens, implementation, motion |
| `/sidecoach layout <target>` | Restructures spatial relationships and visual hierarchy |
| `/sidecoach typeset <target>` | Refines type system; font pairing, scale, readability |
| `/sidecoach animate <target>` | Implements production animation with exponential easing and reduced-motion support |
| `/sidecoach extract <target>` | Extracts design tokens from existing implementation into DESIGN.md |

### Polish and Refinement
| Command | What it does |
|---|---|
| `/sidecoach polish <target>` | 16-point tactical refinement (concentric radius, optical alignment, scale-on-press, etc.) |
| `/sidecoach colorize <target>` | Color refinement and palette application |
| `/sidecoach delight <target>` | Adds personality, micro-interactions, and joy |
| `/sidecoach bolder <target>` | Increases visual weight, contrast, and presence |
| `/sidecoach overdrive <target>` | Amplifies design to maximum expressive effect |
| `/sidecoach quieter <target>` | Reduces noise and visual complexity |
| `/sidecoach distill <target>` | Extracts and preserves only essential elements |
| `/sidecoach clarify <target>` | Makes design language explicit and unambiguous |

### QA and Validation
| Command | What it does |
|---|---|
| `/sidecoach audit <target>` | 5-dimension technical audit: a11y, performance, theming, responsive, anti-patterns |
| `/sidecoach critique <target>` | Independent design review: heuristics, cognitive load, emotional journey |
| `/sidecoach optimize <target>` | Performance and efficiency improvements |
| `/sidecoach harden <target>` | Production-readiness: error states, edge cases, i18n, a11y |
| `/sidecoach adapt <target>` | Responsive design across all breakpoints |

### Special
| Command | What it does |
|---|---|
| `/sidecoach live <target>` | Live browser iteration and real-time refinement |
| `/sidecoach onboard <target>` | First-run flows and activation patterns |

## Verb commands (22 commands)

Every verb routes to a sidecoach flow chain and the orchestrator appends the verb's canonical guidance plus sidecoach's parity-plus extensions. Same flows underneath - different vocabulary on top.

- Shape and strategy: `shape`, `onboard`
- Build: `craft`, `animate`, `bolder`, `colorize`, `delight`, `layout`, `overdrive`, `typeset`, `clarify`
- Review: `audit`, `critique`, `polish`, `harden`, `adapt`, `optimize`
- Tone: `quieter`, `distill`
- Docs: `document`, `extract`
- Tactical: `live`

Type `/sidecoach list` to see all commands organized by phase (phase commands plus the 22 verbs). Type `/sidecoach help <verb>` for the registry detail on any specific verb.

## Mandatory Workflow Gates

These are not optional:

0. **Diagnosing existing UI IS an audit (not a freeform read).** When asked to look at, review, diagnose, or critique an existing page or component ("what's wrong with this", "how does it look", "it feels off", "is the copy real or fluff"), run `/sidecoach audit <target>` (plus `/sidecoach critique <target>`) as the FIRST step, before forming an opinion. It does NOT require a pending build or change - the audit renders the page and runs the detection engine, catching objective and taste defects a human read misses. A freeform eyeball read is the opinion; the audit is the measurement. This is sidecoach's primary read path, not "upstream of" it.
1. **Before any new feature:** run `/sidecoach teach <brief>` if no PRODUCT.md exists with real content. Pass whatever you know about the project in the brief; the handler parses what's there and asks targeted questions for the rest.
2. **If DESIGN.md is missing and the project has CSS:** run `/sidecoach document` to scan the codebase and write a Google-spec DESIGN.md.
3. **Before implementing:** run `/sidecoach shape <feature>` to get the design plan.
4. **After implementing:** run `/sidecoach audit <target>` + `/sidecoach critique <target>` + `/sidecoach polish <target>`.
5. **Before shipping:** run `/sidecoach harden <target>`.

## Using Output Correctly

**panel (the progress surface - keep the run quiet):** the monitor's DEFAULT output is the clean rendered panel, and `--json` carries the same string as `renderedPanel` (plus `.panel` on each `sidecoach_lane` start/advance result). For audits it is a final report (verdict, findings grouped by category + rule, priority fixes); for other flows it is the route/flow/verdict card. PRINT IT VERBATIM. It is the only progress output the user needs. Do NOT also dump the verbose JSON or the markdown Build Report, paste the guidance steps as prose, or narrate each flow as it runs - that mid-run verbosity is exactly what the panel replaces. Surface the panel, do the work quietly, surface the final panel. The detailed findings (in `buildReport` / `audit`) stay available via `--json` only if the user asks for detail.

**guidance:** Each item is a concrete, ordered step. Do not paraphrase, skip, or reorder. Execute them exactly - act on them, do not paste them at the user.

**checklist:** Every item is pass/fail. A failing checklist item means the task is not done. Fix it before moving on.

**artifacts:** These are reference data from the Sidecoach knowledge base (components, tokens, motion patterns, fonts). Use them verbatim as source material. Never substitute your own invention.

## Project Setup Requirements

Sidecoach reads two files from the project root:
- `PRODUCT.md` - brand identity, users, register, anti-references, strategic principles
- `DESIGN.md` - color tokens, typography, components, spacing

If `PRODUCT.md` is missing or a stub (under 200 characters, contains `[TODO]` markers), run `/sidecoach teach` and pass a brief in the same utterance. The teach handler parses what the brief contains and asks targeted questions only for the remaining gaps; it does not generate a generic boilerplate file. Teach refuses to overwrite a real existing PRODUCT.md unless the request includes `forceOverwrite`.

If `DESIGN.md` is missing and the project already has HTML and CSS, run `/sidecoach document`. It scans the project for color tokens, font families, type sizes, and spacing tokens, then writes a Google-spec DESIGN.md (YAML token frontmatter plus the six-section markdown body in canonical order).

Sidecoach without project context produces generic output.

## DESIGN.md format (Google spec)

When writing or updating a project's `DESIGN.md` (via `/sidecoach document`, `/sidecoach extract`, or by hand), conform to the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec:

- **YAML frontmatter** for tokens: colors, typography, rounded, spacing, components with `{token.path}` references.
- **Markdown prose body** for rationale.
- **Sections in canonical order:** Overview, Colors, Typography, Layout, Elevation, Shapes, Components, Do's and Don'ts.

After writing or modifying the file, run `npx @google/design.md lint DESIGN.md` and resolve every error or warning (broken token references, WCAG contrast failures, schema violations) before reporting done. Generated UI code must reference tokens via the `{path.to.token}` form rather than hard-coding hex values, so the design system stays the single source of truth.

## QA Gate Triad (for substantive UI changes)

The global Verification Protocol still applies. In addition, any substantive UI change (new feature, redesign, significant component edit) must pass this full pipeline before reporting completion:

1. **`/sidecoach audit <target>`** - 5-dimension technical scan (a11y, performance, theming, responsive, anti-patterns). Address all Critical and High findings.
2. **`/sidecoach critique <target>`** - design review via independent sub-agents (AI-slop detection, Nielsen heuristics, cognitive load, emotional journey). Address anything above "minor".
3. **`/sidecoach polish <target>`** - final alignment pass against the project's design system. Must run last.
4. **`make-interfaces-feel-better` 16-point checklist** - concentric radius, optical alignment, shadows over borders, interruptible animations (transitions over keyframes on interactive states), split/staggered enters, subtle exits, contextual icon animations, tabular nums, font smoothing, balanced text wrap, image outlines, scale-on-press, skip animation on page load / `initial={false}` on AnimatePresence, no `transition: all`, sparse `will-change`, 40x40 hit areas. Record changes in its before/after table format grouped by principle.
5. **`npx @google/design.md lint DESIGN.md`** - if the project has a DESIGN.md, lint must pass with zero errors and warnings.

Trivial edits (one-line copy tweak, named-token swap) can skip the gate. Anything where the aesthetic result is in question must run all five. "I'll skip polish because it probably looks fine" is not a valid judgment.

## Tactical layer (make-interfaces-feel-better)

Sits between Sidecoach's strategy (PRODUCT.md, register, anti-references) and DESIGN.md's tokens. Auto-triggers on UI keywords (border radius, animation, optical alignment, hover state, tabular numbers, etc.) and supplies 16 specific tactical rules with exact values: `scale(0.96)` on press, concentric border radius (`outer = inner + padding`), icon swaps via opacity+scale+blur, image outlines `rgba(0,0,0,0.1)` never tinted, hit areas at least 40x40px, `transition: all` banned, `font-variant-numeric: tabular-nums` on dynamic numbers, `text-wrap: balance` on headings. Full reference at `~/.claude/skills/make-interfaces-feel-better/`.

Apply during implementation, not as a separate pass. If the skill auto-triggers, follow it and address every applicable item from the checklist. If you're modifying UI but the skill did NOT auto-trigger, manually invoke `/make-interfaces-feel-better` before reporting done. When summarizing UI changes in PR descriptions or session memory, use the skill's before/after table format grouped by principle.

## What sidecoach is NOT for

Backend logic, non-UI refactors, build-tool work, infrastructure changes. Do not load `/sidecoach` for those.

## Where sidecoach sits in the design stack

```
Orchestrator:  /design-build (runs strategy -> research -> type -> motion -> build -> QA as ONE sequence)
Strategy:      /sidecoach (23 commands, PRODUCT.md + DESIGN.md)
Research:      component-gallery-reference (60 types, 95 systems)
Typography:    fontshare-reference (fontshare.com catalog, integrates with sidecoach's reflex-reject list)
References:    design-references (personal catalog, auto-consults) + /curate (capture wizard)
Motion:        motion-reference (GSAP + Lenis canonical patterns)
Tactical:      make-interfaces-feel-better (16 CSS polish rules)
Social:        /social-media (13 platforms, specs + validation)
Effects:       /visual-effects (14 shaders + 25 FX + post-processing)
Icons:         /icon-source (8 libraries, selection protocol)
Team:          /design-team (16 roles, 4-phase sprints, CD review gate)
Tokens:        DESIGN.md (Google spec, linted)
Brand:         PRODUCT.md (register, users, anti-references)
Verification:  cmux + Chrome MCP + QA gate pipeline
```
