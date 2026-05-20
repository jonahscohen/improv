---
name: Personal design-references catalog + curate wizard
description: New 2-skill system that lets Jonah capture one-off design patterns seen in the wild and have them auto-surface on future UI builds. Strict Category, loose Pattern + Feel. /curate captures, design-references retrieves.
type: project
relates_to: [session_2026-05-19_fontshare-reference-skill.md, session_2026-05-19_second-fix-gate-v2.md, reflection_2026-05-19.md]
---

## What shipped (2026-05-20)

Jonah's question: "what if there are one-off components I've seen in the wild that nobody's thought of yet - can I feed them to you?" The answer is a personal design-reference catalog modeled on component.gallery and fontshare-reference but sourced from Jonah's eye.

Six rounds of multiple-choice decisions locked the shape:
1. **Tag strictness**: Hybrid - strict Category vocab, loose Pattern + Feel
2. **Asset storage**: One folder per reference (self-contained units)
3. **Auto-tag**: Claude proposes all tags, user approves/edits at every step
4. **Category vocab**: Ship the 14 starting categories as-is (list, navigation, command-palette, inline-edit, page-transition, loading-state, empty-state, detail-reveal, layout-transition, notification, data-display, gesture, interactive-element, overlay)
5. **Capture trigger**: Slash command (`/curate`)
6. **Other defaults**: vocab grows by approval; dedup via `-2`/`-3` slug suffix; periodic pruning is a v2 concern

## System architecture

Two sibling skills + one data directory:

| Piece | Path | Role |
|---|---|---|
| `curate` skill | `claude/skills/curate/SKILL.md` (source) + `~/.claude/skills/curate/SKILL.md` (active) | Capture wizard. Triggers on `/curate`, "save this reference", etc. 5-step flow via AskUserQuestion: source -> auto-tag proposal -> why-interesting body -> slug -> save. |
| `design-references` skill | `claude/skills/design-references/SKILL.md` + active mirror | Retrieval. Auto-triggers on UI build keywords. Greps catalog for category/pattern/feel matches against task context + PRODUCT.md voice words. Surfaces 0-5 most relevant references. Stays SILENT on no matches. |
| Catalog dir | `~/.claude/design-references/` | One folder per reference: `<slug>/ref.md` + optional screenshot |
| Vocab file | `~/.claude/design-references/_vocab/categories.txt` | The 14 strict Category values; new additions require explicit user approval via curate |

## Reference record shape

```yaml
---
title: "Linear inbox staggered reveal"
category: "list"                              # single value, strict vocab
patterns: [stagger-reveal, intersection-trigger]  # multi, free-form
feel: [snappy, premium, focused]              # multi, free-form
source: "linear.app/inbox"
url: "https://linear.app/inbox"
screenshot: "linear-inbox-stagger-001.png"
saved: 2026-05-20
---

<body: 1-3 sentence "why interesting" paragraph - the load-bearing
part of the record. Frontmatter for retrieval; body for the why.>
```

## Retrieval scoring

When the `design-references` skill auto-fires on a UI build:
- Category match: +3
- Each Pattern match: +1
- Each Feel match: +1
- Source match (user named the company): +3
- Top 0-5 references with score >= 3 are surfaced
- 0 matches at score >= 3 → silent

## install.sh wiring (5 spots)

For portability across machines:
- Line 10: header comment lists new skills
- Line 74: skills component picker description
- Line 92: file list shown to user during selection
- Line ~744: deactivate_skills() removes both new skill dirs but PRESERVES the user's catalog data (only removes skills, never user-captured references)
- Lines ~1559+: install block creates both skill dirs and seeds the empty catalog + vocab file (only if catalog doesn't already exist - preserves data across reinstalls)

## CLAUDE.md design stack updated

Added `References: design-references (personal catalog, auto-consults) + /curate (capture wizard)` row between `Typography` and `Tactical` in the design stack diagram (source `claude/CLAUDE.md`; installed picks it up on next install).

## Second-fix-gate v2 validation (passive)

v1 had fired 3 times during yesterday's 5-edit fontshare install.sh scaffold (false positives). v2 (built yesterday with additive-detection + warn-once-per-window) fired ONCE during today's 5-edit install.sh scaffold for this catalog, then went silent. v2 behavior matches design.

## What's intentionally NOT in v1

- No `/curate-audit` skill yet (Feel-tag synonym detection, stale-reference flags). Add when the catalog has enough entries to need it.
- No `superseded_by` field on references. Designs that read dated will need this eventually; not now.
- No automatic OCR or vision-based auto-tagging of screenshots. Capture wizard relies on Claude examining the screenshot at capture time, not on stored ML features.
- No retrieval signal weighting beyond the simple category/pattern/feel scoring. If certain references should rank higher (recently-saved, frequently-surfaced, manually-pinned), that's a v2 concern.

## Files touched

- `claude/skills/curate/SKILL.md` (new)
- `claude/skills/design-references/SKILL.md` (new)
- `~/.claude/skills/curate/SKILL.md` (active copy)
- `~/.claude/skills/design-references/SKILL.md` (active copy)
- `~/.claude/design-references/_vocab/categories.txt` (vocab seed)
- `install.sh` (5 edits for portability)
- `claude/CLAUDE.md` (design stack row added)

## Collaborator

Jonah
