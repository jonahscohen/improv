---
name: curate
description: Capture a one-off design reference into the personal `~/.claude/design-references/` catalog. Triggers on `/curate`, "save this reference", "curate this pattern", "add to references", "remember this UI / pattern", "save this UI", and when the user pastes a URL or attaches a screenshot WITH explicit save intent (do not trigger on every URL paste). Walks an interactive 5-step wizard via the AskUserQuestion tool: source -> auto-tag proposal -> why-interesting -> slug -> save. Writes `~/.claude/design-references/<slug>/ref.md` with YAML frontmatter (title, category, patterns, feel, source, url, screenshot, saved date) and a body explaining what is worth remembering. Strict Category vocabulary lives at `~/.claude/design-references/_vocab/categories.txt`; Pattern and Feel are free-form. Capture flow is conversational - propose, let user approve or edit at every step.
---

# Curate (design reference capture)

Capture a design reference the user has seen in the wild into the personal catalog at `~/.claude/design-references/`. The catalog grows over time and is consulted by the sibling skill `design-references` on future UI build tasks.

## When to invoke

Trigger on:

- Explicit invocation: `/curate` typed by the user
- Phrases with save intent: "save this reference", "curate this pattern", "add to references", "remember this UI", "remember this pattern"
- A URL or screenshot pasted alongside save intent ("here's a cool sidebar pattern - save it as a reference")

Do NOT trigger on every URL paste or screenshot drop. The user must signal save intent.

## The 5-step wizard

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
> "Saved to ~/.claude/design-references/<slug>/. The catalog now has N total references. The `design-references` skill will surface this on future UI builds matching its tags."

## What this skill does NOT do

- Does not surface references during normal UI builds. That is the sibling skill `design-references`.
- Does not validate that the source URL still resolves (no link checking).
- Does not deduplicate references against existing entries by content similarity; same-source URLs get unique slugs via the `-2` suffix logic.

## Anti-patterns to avoid

- Do not auto-trigger on every URL or screenshot in chat. The user must explicitly signal save intent.
- Do not invent new Category values silently. The strict vocab is the load-bearing axis for retrieval; surface every "no fit" case to the user and let them approve adding a new category.
- Do not propose Pattern or Feel tags that are obvious synonyms of tags the catalog already uses. If existing references use `snappy`, do not propose `crisp` or `tight` for a similar feel - reuse `snappy`. Run a quick grep against the catalog before finalizing.
- Do not save references with empty bodies. The "why interesting" paragraph is what makes the reference useful later; push once more for an observation before accepting a TODO placeholder.
- Do not skip the AskUserQuestion confirm gates. The user explicitly chose the multiple-choice wizard shape; respect it.
