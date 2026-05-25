---
name: design-references
description: Consult the personal design-reference catalog at `~/.claude/design-references/` when building UI. Auto-triggers on UI build tasks (building a sidebar, list, table, command palette, animation, page transition, empty state, loading state, micro-interaction, layout, dashboard, feed), brand-voice-driven typography, "how does <company> do X", "what should this feel like", inspiration lookup, pattern lookup. Greps the catalog for matching category/pattern/feel tags against the task context and against PRODUCT.md voice words if present. Surfaces 0-5 most-relevant references with title, why-interesting body, source URL, and screenshot path. Stays SILENT if no good matches - the catalog is the user's curated eye for one-off patterns that public catalogs (component.gallery, fontshare) under-index, and noisy surfacing destroys trust in it. Use even when the user does not mention references explicitly - if a build maps to anything in the catalog, surface it.
---

# Design References (catalog consultation)

Surface relevant references from the user's personal catalog at `~/.claude/design-references/` when working on UI. The catalog is curated via the sibling skill `curate`.

## The principle

The catalog is the user's eye - patterns they saw in the wild that no public index captures. It only earns its place in the workflow if it surfaces signal, never noise. Better to stay silent than to surface low-relevance matches; the user will stop trusting the skill the first time it volunteers something tangentially related.

## When to invoke

Auto-trigger on:

- Building a UI component, layout, animation, page section, or interactive feature
- "What should X feel like?", "how do <company> do Y?", "I want this to feel <adjective>"
- Brand-voice-driven design decisions where PRODUCT.md feel words might match catalog Feel tags
- Explicit inspiration or pattern lookup requests
- Whenever component-gallery-reference or fontshare-reference is triggered AND the task involves a one-off detail those catalogs do not cover

Stay silent (do not trigger) on:

- Backend, infrastructure, build tooling, or non-UI tasks
- The catalog has no relevant matches (silence beats noise here, always)
- The user explicitly asked for a fresh look without prior references

## Workflow

### Step 1: Extract query signal from the task

From the user's current task, identify candidate tag matches across the three axes:

- **Category** (map task surface to the strict vocab; read `~/.claude/design-references/_vocab/categories.txt` if uncertain about current vocab):
  - "sidebar" / "side panel" / "rail" / "app shell" → `navigation`
  - "command palette" / "cmd+k" / "quick actions" → `command-palette`
  - "feed" / "list" / "inbox" / "queue" → `list`
  - "cell editing" / "inline edit" / "contenteditable" → `inline-edit`
  - "route change" / "view transition" → `page-transition`
  - "skeleton" / "streaming" / "progress" → `loading-state`
  - "zero data" / "first run" / "onboarding shell" → `empty-state`
  - "hover detail" / "expand inline" → `detail-reveal`
  - "split pane" / "resize" / "drawer pull" → `layout-transition`
  - "toast" / "snackbar" / "banner" / "undo" → `notification`
  - "table" / "dashboard" / "metric" → `data-display`
  - "drag" / "swipe" / "scroll-driven" → `gesture`
  - "button" / "toggle" / "slider" with novel behavior → `interactive-element`
  - "modal" / "popover" / "drawer" with novel behavior → `overlay`

- **Patterns** (multi-value, free-form): which behaviors are mentioned or implied? "smooth reveal" suggests candidates like `stagger-reveal`, `intersection-trigger`. "drag to reorder" maps directly. Extract liberally.

- **Feel** (multi-value, free-form): what voice words appear in PRODUCT.md (if present at the project root) or in the user's brief? PRODUCT.md is the canonical feel source when it exists. If absent, infer 2-3 feel words from the brief ("premium dev tool" → premium, sharp).

### Step 2: Grep the catalog

The catalog is at `~/.claude/design-references/`, with one folder per reference. Each folder contains a `ref.md` with YAML frontmatter (and optionally a screenshot file).

Find candidate matches:

```bash
# Category match
grep -l "^category: <match>" ~/.claude/design-references/*/ref.md

# Pattern match (patterns array is one line - grep for the bare string)
grep -l "<pattern-name>" ~/.claude/design-references/*/ref.md

# Feel match (same shape)
grep -l "<feel-word>" ~/.claude/design-references/*/ref.md
```

Score each matching reference:

| Match | Score |
|---|---|
| Category match | +3 |
| Each Pattern match | +1 |
| Each Feel match | +1 |
| Source match (user named the company - "how does Linear do X") | +3 |

### Step 3: Read the top 0-5 matches in full

For the top-scoring references, Read the full `ref.md` to extract:

- Title
- Source / URL (if any)
- Why-interesting body (the load-bearing content)
- Screenshot filename (if any)

Filter out references whose body contains a TODO or unfinished note - they are dead weight.

### Step 4: Surface to the user

Present matches in compact form. For each:

```
**<Title>**
Source: <url or 'description only'>
<Body paragraph - quoted or faithfully paraphrased, never reduced to bullet>
Screenshot: <folder-path>/<filename> (Read if helpful)
```

Group by relevance score. If 0 matches scored 3 or higher, stay silent - do not surface low-relevance noise.

Do NOT include raw YAML frontmatter in the surfaced output. Translate to natural language.

When matches are surfaced, frame them as starting points, not prescriptions:

> "I found N relevant references in your catalog. They are starting points - check whether the spirit matches the brand-voice for this project before borrowing the detail."

## Integration with other skills

This skill is the personal-catalog layer of the design stack:

1. **component-gallery-reference** - external curated catalog (60 component types, 95 design systems). Use for standard component skeletons, semantic markup, a11y patterns.
2. **fontshare-reference** - external curated catalog (typefaces). Use for type selection and brand voice.
3. **design-references** (this skill) - YOUR personal one-off catalog. Use for patterns the public catalogs under-index: novel animations, distinctive interactions, brand-specific details captured in the wild.

When all three trigger on the same task, the order of application is:
- `component-gallery-reference` first - get the standard skeleton right
- `design-references` next - layer in the personal-eye detail
- `fontshare-reference` if type is in scope - lock the type system
- Then `sidecoach` for brand strategy, `make-interfaces-feel-better` for tactical polish

## What this skill does NOT do

- Does not capture new references. That is the sibling skill `curate`.
- Does not modify the catalog. Read-only consultation.
- Does not validate source URLs.
- Does not surface low-relevance matches just to seem responsive.
- Does not paraphrase the "why interesting" body in a way that loses the specific detail. The reference's body is the load-bearing part; quote faithfully.

## Anti-patterns

- Do not surface every reference in the catalog. Top 0-5 by relevance, or silence.
- Do not surface a reference whose body contains a TODO or "describe later" placeholder.
- Do not auto-trigger on backend or non-UI tasks just because the user mentioned a UI-adjacent word.
- Do not let this skill override component-gallery-reference's accessibility guidance. The catalog captures aesthetic patterns; a11y semantics come from the gallery.
