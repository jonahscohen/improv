---
name: sidecoach
description: Design orchestration system replacing Impeccable. 36 flows, 23 commands. Use for all design work: /sidecoach craft <feature>, /sidecoach shape <feature>, /sidecoach polish <target>, /sidecoach audit <target>, /sidecoach animate <target>, /sidecoach critique <target>, /sidecoach teach, /sidecoach list. Also triggers on: brand verification, component research, font pairing, motion patterns, design tokens, accessibility audit, responsive design, typography, clone/implement a design, colorize, delight, bolder, overdrive, quieter, distill, clarify, optimize, harden, adapt, live iteration, onboarding flows.
---

# Sidecoach - Design Intelligence Orchestration

Sidecoach is the design workflow layer built into this Claude Code installation. It provides 36 intelligent flows covering every phase of design work, replacing Impeccable with full orchestration, memory, and validation.

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

### Research and Strategy
| Command | What it does |
|---|---|
| `/sidecoach teach` | Guided setup: creates PRODUCT.md and DESIGN.md via brand verification |
| `/sidecoach shape <feature>` | Plans design approach before building; runs exploration and rapid iteration |

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
| `/sidecoach list` | Shows all available flows grouped by phase |

## Mandatory Workflow Gates

These are not optional:

1. **Before any new feature:** run `/sidecoach teach` if no PRODUCT.md exists with real content
2. **Before implementing:** run `/sidecoach shape <feature>` to get the design plan
3. **After implementing:** run `/sidecoach audit <target>` + `/sidecoach critique <target>` + `/sidecoach polish <target>`
4. **Before shipping:** run `/sidecoach harden <target>`

## Using Output Correctly

**guidance:** Each item is a concrete, ordered step. Do not paraphrase, skip, or reorder. Execute them exactly.

**checklist:** Every item is pass/fail. A failing checklist item means the task is not done. Fix it before moving on.

**artifacts:** These are reference data from the Sidecoach knowledge base (components, tokens, motion patterns, fonts). Use them verbatim as source material. Never substitute your own invention.

## Project Setup Requirements

Sidecoach reads two files from the project root:
- `PRODUCT.md` - brand identity, users, register, anti-references, strategic principles
- `DESIGN.md` - color tokens, typography, components, spacing

If either is missing, run `/sidecoach teach` first. Sidecoach without project context produces generic output.
