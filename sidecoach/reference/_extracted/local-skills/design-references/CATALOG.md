# design-references - Sidecoach Integration & Catalog Inventory

Source: `/Users/spare3/.claude/skills/design-references/SKILL.md`
Catalog: `/Users/spare3/.claude/design-references/`

## What this skill provides

A consultation skill that reads the user's **personal one-off pattern catalog** at `~/.claude/design-references/`. The catalog is the user's eye - patterns they saw in the wild that no public index (component.gallery, fontshare) captures. The sibling `curate` skill writes entries; this `design-references` skill reads them.

The principle: silence beats noise. The skill only earns trust if it surfaces signal. Better to return zero references than to surface tangentially-related matches.

## Catalog structure

```
~/.claude/design-references/
├── _vocab/
│   └── categories.txt              # strict category vocabulary
└── <slug>/                         # one folder per reference
    ├── ref.md                      # YAML frontmatter + body
    └── <screenshot>                # optional, filename referenced in frontmatter
```

### Reference frontmatter schema

```yaml
---
title: "Human-readable name"
category: "<from _vocab/categories.txt>"   # strict, one value
patterns: [pattern-name, pattern-name]     # free-form array
feel: [feel-word, feel-word]               # free-form array
source: "site name or 'description only'"
url: "https://..."                         # optional
screenshot: "filename.png"                 # optional, "" if none
saved: 2026-MM-DD
---

Body paragraph(s) explaining what is worth remembering. This is the
load-bearing content - the "why interesting" text.
```

## Current category vocabulary (from `_vocab/categories.txt`)

The strict category list. Adding a new category requires explicit user approval through the `curate` skill.

```
list
navigation
command-palette
inline-edit
page-transition
loading-state
empty-state
detail-reveal
layout-transition
notification
data-display
gesture
interactive-element
overlay
inline-affordance
```

15 categories. Sidecoach should match task surface to one of these when querying.

## Catalog inventory (full enumeration)

**As of 2026-05-25: 1 reference in the catalog.**

The catalog is essentially empty. The user built the infrastructure (vocab, schema, /curate skill) but has only captured one reference so far. This is a real gap that sidecoach should surface as feedback when the skill returns no matches.

### Reference 1: `unlumen-kbd-keycap-2026-05-20`

```yaml
title: "Unlumen kbd - realistic keycap treatment"
category: inline-affordance
patterns: [realistic-keycap, inset-shadow, double-border]
feel: [tactile, mechanical, quiet]
source: "ui.unlumen.com"
url: "https://ui.unlumen.com/docs/ui/unlumen/kbd"
screenshot: ""
saved: 2026-05-20
```

**Body:**
> The realistic-keycap aesthetic is a 3-trick combo: thicker bottom border (`border-b-2`), inset shadow (`shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]`), and monospace type. The thicker-bottom border is the load-bearing illusion - it sells 3D depth without a real drop shadow. Cheap, no transforms, no compositing layer.
>
> Component ships in two variants (single Kbd, multi-key Shortcut with customizable separator) and three sizes (sm/md/lg). Uses `select-none` to prevent text selection - which makes sense for a UI-affordance role rather than a content role.

## How sidecoach should query this skill

### The matching algorithm (from the skill workflow)

1. Extract from the user's task:
   - Candidate **category** (map UI surface vocabulary to vocab list, e.g., "sidebar" → `navigation`)
   - Candidate **patterns** (free-form behavioral words, e.g., "smooth reveal" → `stagger-reveal`)
   - Candidate **feel** words (from PRODUCT.md if it exists, otherwise from the user's brief)

2. Grep `~/.claude/design-references/*/ref.md`:
   ```bash
   grep -l "^category: <match>" ~/.claude/design-references/*/ref.md
   grep -l "<pattern-name>" ~/.claude/design-references/*/ref.md
   grep -l "<feel-word>" ~/.claude/design-references/*/ref.md
   ```

3. Score each match:
   | Match | Score |
   |---|---|
   | Category match | +3 |
   | Each Pattern match | +1 |
   | Each Feel match | +1 |
   | Source match (user named the company) | +3 |

4. **Surface threshold: score ≥ 3.** If no reference scores 3 or higher, return silence.

5. Top 0-5 references presented in compact form with Title, Source, faithful body paraphrase, Screenshot path.

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to do with matches |
|---|---|---|
| **Flow D (design-references)** | ALWAYS on entry | Already the primary integration point |
| **Flow A (brand-verify)** | After PRODUCT.md feel words are extracted | Cross-match feel words against catalog |
| **Flow B (component-research)** | Alongside component-gallery-reference | Surface personal-catalog patterns that public catalogs under-index |
| **Flow E (motion-patterns)** | When motion is in scope | Match against patterns like `stagger-reveal`, `page-transition` |
| **Flow tactical-polish** | When refining a built UI | Match against `inline-affordance`, `detail-reveal`, etc. |

### Query shape (what sidecoach's flow handler should produce)

```typescript
{
  source: 'design-references',
  catalogPath: '~/.claude/design-references/',
  vocabPath: '~/.claude/design-references/_vocab/categories.txt',
  query: {
    category: 'navigation',                              // mapped to vocab
    patterns: ['stagger-reveal', 'side-panel'],          // free-form
    feel: ['quiet', 'premium', 'sharp'],                 // from PRODUCT.md
    sourceCompany: null,                                  // if user named one
  },
  surfaceThreshold: 3,
  maxResults: 5,
  expectedOutput: 'ReferenceMatch[]',
}
```

### Anti-patterns sidecoach must respect

- **Do NOT surface low-relevance matches.** If no match scores ≥ 3, return silence. The catalog's value is the curator's trust in the skill.
- **Do NOT surface references whose body contains TODO or "describe later".** They are dead weight - filter them out before scoring.
- **Do NOT auto-trigger on backend or non-UI tasks** just because a UI-adjacent word appears.
- **Do NOT paraphrase the body in a way that loses the specific detail.** Quote faithfully - the body is the load-bearing part.
- **Do NOT override component-gallery's a11y guidance.** The personal catalog captures aesthetic patterns; ARIA/semantic markup still comes from component-gallery.

## What's missing - the elephant in the room

**The catalog has 1 entry.** The infrastructure is built but it has not been used. Sidecoach should:

1. Treat empty/sparse results as a feature, not a bug. Stay silent on no-match.
2. When sidecoach completes a build and the user clearly synthesized a novel pattern, **nudge the user** to run `/curate` to capture it: "This sidebar pattern with the inline-edit row could be worth capturing - run /curate to save it."
3. Do NOT auto-curate. The curate skill is interactive (5-step wizard) by design - the user's voice in the body text is the value.

### Sidecoach can also help grow the catalog

In Flow D (design-references) and during QA passes, sidecoach can detect "this build pattern is novel enough to be worth saving" and surface a soft nudge. Heuristics for nudging:
- The build pattern doesn't match any reference (no hits at score ≥ 1) AND it solved a specific design problem cleanly
- The user described the pattern enthusiastically in chat (positive feedback)
- The pattern took multiple iterations to land (high-effort = high-value to remember)

## Integration with other skills

The skill's own integration notes (verbatim):

1. **component-gallery-reference** - external curated catalog (60 component types, 95 design systems). Use for standard component skeletons, semantic markup, a11y patterns.
2. **fontshare-reference** - external curated catalog (typefaces). Use for type selection and brand voice.
3. **design-references** (this skill) - personal one-off catalog. Use for patterns the public catalogs under-index.

Application order when all three trigger:
- component-gallery-reference first - get the standard skeleton right
- design-references next - layer in personal-eye detail
- fontshare-reference if type is in scope
- Then oracle/sidecoach for brand strategy, make-interfaces-feel-better for tactical polish
