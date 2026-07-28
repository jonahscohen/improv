---
name: curate
description: Own the personal design-reference catalog at `~/.claude/design-references/` in both directions - CAPTURE a reference into it, and RECALL matching references out of it during a UI build. Invoke this skill when the task involves `/curate`, "save this reference", "curate this pattern", "add to references", "remember this UI / pattern", "save this UI", or a URL/screenshot pasted WITH explicit save intent (do not invoke on every URL paste). Also invoke it for recall - before building a UI surface (sidebar, list, table, command palette, animation, page transition, empty state, loading state, micro-interaction, layout, dashboard, feed), on "how does <company> do X", "what should this feel like", and on inspiration or pattern lookup - to grep the catalog for matching category/pattern/feel tags and surface the 0-5 best matches, staying SILENT when nothing scores. Capture walks an interactive 5-step wizard via AskUserQuestion (source -> auto-tag proposal -> why-interesting -> slug -> save) and writes `<slug>/ref.md` with YAML frontmatter (title, category, patterns, feel, source, url, screenshot, saved date). Strict Category vocabulary lives at `_vocab/categories.txt`; Pattern and Feel are free-form.
---

# Curate (the personal design-reference catalog)

One skill owns the personal catalog at `~/.claude/design-references/` in both directions:

- **Mode A - Capture.** Save a reference the user saw in the wild into the catalog.
- **Mode B - Recall.** Surface matching references back out of it during a UI build.

Recall was a separate skill (`design-references`) until 2026-07-28. It was retired into this
one: it had zero invocations, and splitting read from write across two skills meant the
catalog had two chances to not be selected instead of one. The read behaviour is preserved
in full below - the merge absorbed the behaviour, not just the file.

**Nothing invokes this skill for you.** No hook calls the Skill tool, so recall runs only
when you choose to run it. Do not wait for it to fire on a UI task; reach for it.

## When to invoke

**Mode A (Capture)** - trigger on:

- Explicit invocation: `/curate` typed by the user
- Phrases with save intent: "save this reference", "curate this pattern", "add to references", "remember this UI", "remember this pattern"
- A URL or screenshot pasted alongside save intent ("here's a cool sidebar pattern - save it as a reference")

Do NOT trigger on every URL paste or screenshot drop. The user must signal save intent.

**Mode B (Recall)** - trigger on:

- Building a UI component, layout, animation, page section, or interactive feature
- "What should X feel like?", "how does <company> do Y?", "I want this to feel <adjective>"
- Brand-voice-driven design decisions where PRODUCT.md feel words might match catalog Feel tags
- Explicit inspiration or pattern lookup requests
- Whenever `component-gallery-reference` or `fontshare-reference` is in play AND the task involves a one-off detail those catalogs do not cover

Stay silent (do not surface) on:

- Backend, infrastructure, build tooling, or non-UI tasks
- The catalog has no relevant matches - silence beats noise here, always
- The user explicitly asked for a fresh look without prior references

## Mode A: the 5-step capture wizard

Use the AskUserQuestion tool at each step that has discrete choices - the user prefers multiple-choice prompts over free-form input when capturing. Free-form input is fine for the "why interesting" body and the URL paste.

### Step 1: Source

Ask:
> "What is the source of this reference?"
- URL (you will paste it next)
- Screenshot (already in chat or file path)
- Description only (no asset, you will describe it)
- Mixed (URL + screenshot + description)

Collect the actual source data based on the selection. Save screenshots to a temp path you will move into the reference folder in Step 5.

### Step 2: Auto-tag proposal

Read the source: WebFetch the URL if available, examine the screenshot if pasted, parse the description otherwise. Propose:

- **Category** (single value from the strict vocab at `~/.claude/design-references/_vocab/categories.txt`). Current starting vocab: `list`, `navigation`, `command-palette`, `inline-edit`, `page-transition`, `loading-state`, `empty-state`, `detail-reveal`, `layout-transition`, `notification`, `data-display`, `gesture`, `interactive-element`, `overlay`. Read the file at capture time - new categories may have been added by previous curate runs.

  If nothing in the vocab fits the reference, ask the user via AskUserQuestion:
  > "No existing category fits. What do you want to do?"
  - Add a new category (you propose a name, user approves)
  - Force-fit to closest existing category (name it)
  - Cancel capture
  
  If the user approves a new category, append it to `~/.claude/design-references/_vocab/categories.txt` before completing Step 5.

- **Patterns** (multi-value, free-form). Behavior / technique. Examples to seed thinking: `stagger-reveal`, `optimistic-update`, `drag-to-reorder`, `intersection-trigger`, `glass-blur`, `chromatic-aberration`, `parallax-depth`, `slash-command`, `inline-validation`, `scroll-driven`, `streaming-text`, `hold-to-reveal`, `gesture-dismiss`, `momentum-scroll`. Reuse existing pattern strings if a similar reference is already in the catalog - check first via `grep "patterns:" ~/.claude/design-references/*/ref.md` for consistency.

- **Feel** (multi-value, free-form). Personality words. Examples: `snappy`, `calm`, `premium`, `tactile`, `editorial`, `industrial`, `playful`, `ambient`, `sharp`, `glassy`, `warm`, `mechanical`, `playful`, `quiet`. If the current project has a `PRODUCT.md` at the root, read it and propose Feel words that match its brand-voice vocabulary so the catalog stays alignable with project briefs.

Present the proposed tag set via AskUserQuestion as a confirm-or-edit gate:
> "Tags look right?"
- Yes, save as proposed
- Edit category
- Edit patterns
- Edit feel
- Edit everything

If the user picks an edit option, collect the corrections and re-present until they accept.

### Step 3: Why interesting

Ask for a 1-3 sentence note explaining what is worth remembering about this pattern. Frame it as: "what would you tell future-you about this reference, so a future build can borrow the right detail?"

Examples to seed if the user is stuck:
- "The stagger only fires on first-mount via IntersectionObserver - scrolling back up does not re-stagger. Feels intentional rather than performative."
- "Hover-detail reveals AFTER 80ms of hover hold, not immediately. Avoids accidental triggers and feels considered."
- "Selected row gets a subtle left-border accent that animates in 60ms AFTER the row itself lands. Decoupled timing makes the hierarchy clearer."

If the user genuinely cannot articulate yet, ask once more before saving with a TODO. Empty-body references are dead weight in the catalog - push gently for one observation.

### Step 4: Slug

Propose a folder name in the shape `<source-or-descriptor>-<feature>-<date>`. Examples:
- `linear-inbox-stagger-2026-05-20`
- `vercel-deploy-stream-2026-05-20`
- `raycast-action-panel-2026-05-20`

Ask via AskUserQuestion:
> "Slug for the folder?"
- Use proposed: `<slug>`
- Let me edit the slug
- Make it shorter
- Make it more descriptive

If the slug already exists in the catalog, append `-2`, `-3`, etc. - do NOT prompt for interactive merge; users should never lose a reference to a name collision.

### Step 5: Save

Create `~/.claude/design-references/<slug>/`. Write:

1. `ref.md` with this exact frontmatter shape:

```yaml
---
title: "<one-line human title>"
category: <single value from vocab>
patterns: [<list of strings>]
feel: [<list of strings>]
source: "<short identifier like 'linear.app' or 'description-only'>"
url: "<full URL or empty string>"
screenshot: "<filename in this folder or empty string>"
saved: <YYYY-MM-DD>
---

<body: the "why interesting" content from Step 3, plus any technical
detail observed during capture (timings, easing, edge cases). 1-3
paragraphs at most.>
```

2. If a screenshot was provided, move/save it into the folder as `<slug>-001.png` (or appropriate extension). Update the `screenshot:` field with the bare filename.

3. If a new category was approved in Step 2, append it to `~/.claude/design-references/_vocab/categories.txt`.

Report what was saved with the folder path:
> "Saved to ~/.claude/design-references/<slug>/. The catalog now has N total references. Recall (Mode B below) will surface this on future UI builds matching its tags."

## Mode B: Recall (catalog consultation)

Surface relevant references from the catalog when working on UI.

### The principle

The catalog is the user's eye - patterns they saw in the wild that no public index captures. It only earns its place in the workflow if it surfaces signal, never noise. Better to stay silent than to surface low-relevance matches; the user will stop trusting it the first time it volunteers something tangentially related.

**Check the catalog size before leaning on this.** As of 2026-07-28 it holds 2 references. A grep over 2 entries will usually and correctly return nothing. That is not a malfunction - it is the reason recall stopped being its own skill. Recall is worth running because it is nearly free, not because it is likely to hit.

### Step 1: Extract query signal from the task

From the user's current task, identify candidate tag matches across the three axes:

- **Category** (map task surface to the strict vocab; read `~/.claude/design-references/_vocab/categories.txt` if uncertain about current vocab):
  - "sidebar" / "side panel" / "rail" / "app shell" -> `navigation`
  - "command palette" / "cmd+k" / "quick actions" -> `command-palette`
  - "feed" / "list" / "inbox" / "queue" -> `list`
  - "cell editing" / "inline edit" / "contenteditable" -> `inline-edit`
  - "route change" / "view transition" -> `page-transition`
  - "skeleton" / "streaming" / "progress" -> `loading-state`
  - "zero data" / "first run" / "onboarding shell" -> `empty-state`
  - "hover detail" / "expand inline" -> `detail-reveal`
  - "split pane" / "resize" / "drawer pull" -> `layout-transition`
  - "toast" / "snackbar" / "banner" / "undo" -> `notification`
  - "table" / "dashboard" / "metric" -> `data-display`
  - "drag" / "swipe" / "scroll-driven" -> `gesture`
  - "button" / "toggle" / "slider" with novel behavior -> `interactive-element`
  - "modal" / "popover" / "drawer" with novel behavior -> `overlay`

- **Patterns** (multi-value, free-form): which behaviors are mentioned or implied? "smooth reveal" suggests candidates like `stagger-reveal`, `intersection-trigger`. "drag to reorder" maps directly. Extract liberally.

- **Feel** (multi-value, free-form): what voice words appear in PRODUCT.md (if present at the project root) or in the user's brief? PRODUCT.md is the canonical feel source when it exists. If absent, infer 2-3 feel words from the brief ("premium dev tool" -> premium, sharp).

### Step 2: Grep the catalog

The catalog is at `~/.claude/design-references/`, one folder per reference, each holding a `ref.md` with YAML frontmatter (and optionally a screenshot).

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

For the top-scoring references, Read the full `ref.md` to extract title, source/URL, the why-interesting body (the load-bearing content), and the screenshot filename if any.

Filter out references whose body contains a TODO or unfinished note - they are dead weight.

### Step 4: Surface to the user

Present matches in compact form. For each:

```
**<Title>**
Source: <url or 'description only'>
<Body paragraph - quoted or faithfully paraphrased, never reduced to bullet>
Screenshot: <folder-path>/<filename> (Read if helpful)
```

Group by relevance score. **If 0 matches scored 3 or higher, stay silent** - do not surface low-relevance noise, and do not announce that you searched and found nothing.

Do NOT include raw YAML frontmatter in the surfaced output. Translate to natural language.

When matches are surfaced, frame them as starting points, not prescriptions:

> "I found N relevant references in your catalog. They are starting points - check whether the spirit matches the brand-voice for this project before borrowing the detail."

### Where recall sits among the reference layers

1. **component-gallery-reference** - external curated catalog (60 component types, 95 design systems). Standard component skeletons, semantic markup, a11y patterns.
2. **fontshare-reference** - external curated catalog (typefaces). Type selection and brand voice.
3. **curate recall** (this mode) - the personal one-off catalog. Patterns the public catalogs under-index: novel animations, distinctive interactions, brand-specific details captured in the wild.

When all three apply to one task: `component-gallery-reference` first (get the standard skeleton right), then curate recall (layer in the personal-eye detail), then `fontshare-reference` if type is in scope. Then `sidecoach` for brand strategy and `tactical-polish` for tactical polish.

Recall never overrides component-gallery-reference's accessibility guidance. The catalog captures aesthetic patterns; a11y semantics come from the gallery.

## What this skill does NOT do

- Does not modify the catalog in Mode B. Recall is read-only consultation.
- Does not validate that the source URL still resolves (no link checking).
- Does not deduplicate references against existing entries by content similarity; same-source URLs get unique slugs via the `-2` suffix logic.
- Does not surface low-relevance matches just to seem responsive.
- Does not paraphrase a "why interesting" body in a way that loses the specific detail. The body is the load-bearing part; quote faithfully.

## Anti-patterns to avoid

- Do not run the CAPTURE wizard on every URL or screenshot in chat. The user must explicitly signal save intent. (Recall has no such gate - it is read-only and silent when it finds nothing.)
- Do not surface every reference in the catalog on recall. Top 0-5 by relevance, or silence.
- Do not surface a reference whose body contains a TODO or "describe later" placeholder.
- Do not run recall on backend or non-UI tasks just because the user mentioned a UI-adjacent word.
- Do not invent new Category values silently. The strict vocab is the load-bearing axis for retrieval; surface every "no fit" case to the user and let them approve adding a new category.
- Do not propose Pattern or Feel tags that are obvious synonyms of tags the catalog already uses. If existing references use `snappy`, do not propose `crisp` or `tight` for a similar feel - reuse `snappy`. Run a quick grep against the catalog before finalizing.
- Do not save references with empty bodies. The "why interesting" paragraph is what makes the reference useful later; push once more for an observation before accepting a TODO placeholder.
- Do not skip the AskUserQuestion confirm gates. The user explicitly chose the multiple-choice wizard shape; respect it.
