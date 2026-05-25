---
name: sidecoach
description: The design orchestration system for claude-dotfiles. 36 flows, two parallel command surfaces (phase commands + 22 verb commands), plus teach/document setup commands and a help command. Use for all design work: /sidecoach craft <feature>, /sidecoach shape <feature>, /sidecoach polish <target>, /sidecoach audit <target>, /sidecoach animate <target>, /sidecoach critique <target>, /sidecoach teach, /sidecoach document, /sidecoach list, /sidecoach help <verb>. Also triggers on: brand verification, component research, font pairing, motion patterns, design tokens, accessibility audit, responsive design, typography, clone/implement a design, colorize, delight, bolder, overdrive, quieter, distill, clarify, optimize, harden, adapt, live iteration, onboarding flows.
---

# Sidecoach - Design Intelligence Orchestration

Sidecoach is the design workflow layer built into this Claude Code installation. It provides 36 intelligent flows covering every phase of design work, with full orchestration, memory, and validation.

Two command surfaces share the same flow chains:
- **Phase commands** - sidecoach native vocabulary grouped by phase (research / craft / review / special).
- **Verb commands** - 22 verb commands that mirror the canonical design verb vocabulary 1:1 and route to the same underlying flows. The orchestrator appends per-verb guidance (canonical reference sections plus sidecoach extensions) so output speaks the verb language while keeping sidecoach's validators, BuildReport, taste validation, and memory.

## Invoking the Engine

**Before doing any design work**, run the Sidecoach engine and use its output as your implementation plan:

```bash
node /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/bin/sidecoach-monitor.js "/sidecoach <command> <target>"
```

Parse the JSON result and act on it:
- `guidance: string[]` - execute these steps in order; they are instructions, not suggestions
- `checklist: object[]` - every item must pass before you report done; failures are blockers
- `artifacts: object[]` - reference data (components, tokens, motion patterns); use verbatim, do not invent alternatives
- `detectedFlow` - confirms which flow matched; log it for transparency

**Template for every invocation:**

```bash
RESULT=$(node /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/bin/sidecoach-monitor.js "$UTTERANCE")
echo "$RESULT" | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (r.guidance) r.guidance.forEach((g,i) => console.log((i+1)+'. '+g));
  if (r.checklist) { console.log('\nChecklist:'); r.checklist.forEach(c => console.log('- [ ] '+c.item)); }
"
```

## Commands

### Setup and Strategy
| Command | What it does |
|---|---|
| `/sidecoach teach [brief]` | Brief-driven hybrid setup: parses what's in the brief, asks targeted questions only for the gaps, writes PRODUCT.md. Refuses to overwrite a real existing PRODUCT.md unless `forceOverwrite` is set. |
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

1. **Before any new feature:** run `/sidecoach teach <brief>` if no PRODUCT.md exists with real content. Pass whatever you know about the project in the brief; the handler parses what's there and asks targeted questions for the rest.
2. **If DESIGN.md is missing and the project has CSS:** run `/sidecoach document` to scan the codebase and write a Google-spec DESIGN.md.
3. **Before implementing:** run `/sidecoach shape <feature>` to get the design plan.
4. **After implementing:** run `/sidecoach audit <target>` + `/sidecoach critique <target>` + `/sidecoach polish <target>`.
5. **Before shipping:** run `/sidecoach harden <target>`.

## Using Output Correctly

**guidance:** Each item is a concrete, ordered step. Do not paraphrase, skip, or reorder. Execute them exactly.

**checklist:** Every item is pass/fail. A failing checklist item means the task is not done. Fix it before moving on.

**artifacts:** These are reference data from the Sidecoach knowledge base (components, tokens, motion patterns, fonts). Use them verbatim as source material. Never substitute your own invention.

## Project Setup Requirements

Sidecoach reads two files from the project root:
- `PRODUCT.md` - brand identity, users, register, anti-references, strategic principles
- `DESIGN.md` - color tokens, typography, components, spacing

If `PRODUCT.md` is missing or a stub (under 200 characters, contains `[TODO]` markers), run `/sidecoach teach` and pass a brief in the same utterance. The teach handler parses what the brief contains and asks targeted questions only for the remaining gaps; it does not generate a generic boilerplate file. Teach refuses to overwrite a real existing PRODUCT.md unless the request includes `forceOverwrite`.

If `DESIGN.md` is missing and the project already has HTML and CSS, run `/sidecoach document`. It scans the project for color tokens, font families, type sizes, and spacing tokens, then writes a Google-spec DESIGN.md (YAML token frontmatter plus the six-section markdown body in canonical order).

Sidecoach without project context produces generic output.
