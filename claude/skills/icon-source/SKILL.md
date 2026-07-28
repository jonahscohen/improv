---
name: icon-source
description: Find, select, and source icons from the approved 8-library pool with a rigorous selection protocol. Invoke this skill when the task involves "icon", "icon for", "find an icon", "which icon", "animated icon", "icon library", "svg icon", plus library names (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, Lucide Animated, Heroicons Animated). Use when the agent needs any icon during a build - enforces one-library-per-project consistency, verbatim path sourcing, and animated-vs-static selection criteria.
---

# Icon Source

Rigorous protocol for finding, selecting, and sourcing icons from the approved library pool.

## Library Pool

### Static Tier (verbatim SVG path sourcing)

| Library | ~Count | Strengths | Repo |
|---|---|---|---|
| Heroicons | 300 | Clean UI chrome, nav, actions | tailwindlabs/heroicons |
| Lucide | 1,500 | General purpose, broadest coverage | lucide-icons/lucide |
| Tabler | 5,400 | Largest set, edge-case coverage | tabler/tabler-icons |
| Bootstrap Icons | 2,000 | Familiar web conventions | twbs/icons |
| Phosphor | 7,000 (6 weights) | Weight flexibility, illustration-adjacent | phosphor-icons/core |
| Material Symbols | 3,000+ (3 fills, 7 grades) | Variable font, Android/Material convention | google/material-design-icons |

### Animated Tier (React component sourcing)

| Library | ~Count | Tech | Strengths | Repo |
|---|---|---|---|---|
| Lucide Animated | 1,000+ | React/TypeScript | Micro-interactions, state transitions | pqoqubbw/icons |
| Heroicons Animated | 300 (subset) | React/Framer Motion | Polished interactive states | heroicons-animated/heroicons-animated |

## Selection Protocol

Follow this order. Do not skip steps.

### 1. Check DESIGN.md first

If the project's design system specifies an icon library, use that library exclusively. Project consistency trumps having the "best" individual icon. If DESIGN.md names a library not in this pool, use what it says anyway.

### 2. If no project preference, match the tech stack

Check `package.json` and existing imports:
- React project with `framer-motion` or `motion` already installed? Prefer the animated libraries.
- Vanilla HTML, static site, or non-React framework? Static SVG only.
- If the project already uses icons from a specific library (grep for import paths), use the same one.

### 3. Search by semantic intent, not visual guess

Search for the concept the icon represents in its context, not a literal description of what it looks like.

| Bad search | Good search | Why |
|---|---|---|
| "house" | "home" or "home navigation" | The icon means "go home", not "building" |
| "circle with X" | "close" or "dismiss" | The action, not the shape |
| "arrow pointing right" | "next" or "forward" or "chevron-right" | The purpose in context |
| "person silhouette" | "user" or "account" or "profile" | The domain concept |

### 4. One library per project

Once the first icon is placed from a library, all subsequent icons in that project come from the same library. Mixed icon families look incoherent - different stroke widths, corner radii, visual weights.

**Exception:** Animated icons complement their static parent library. These pairings are allowed:
- Lucide + Lucide Animated
- Heroicons + Heroicons Animated

No other cross-library mixing.

### 5. Verbatim path data

Copy the exact SVG path data character-for-character from the library source. This rule is absolute:

- Do not redraw paths.
- Do not "simplify" or "optimize" paths.
- Do not approximate paths from memory.
- Do not compose icons from parts of other icons.
- If the path you are inserting does not match the library source byte-for-byte, it is wrong.

To source a path: find the icon in the library's GitHub repo or published package, copy the `<path d="...">` attribute value exactly.

### 6. Animated icon selection criteria

Use animated variants ONLY when:
- The icon represents a **state change** (loading -> complete, closed -> open, idle -> active)
- The icon responds to **user interaction** (hover reveal, click confirmation, toggle feedback)
- The icon **draws attention** to a new or changed element (notification badge, status update)

Do NOT animate:
- Static landmarks (nav items at rest, section headers, labels)
- Decorative icons (background illustrations, empty-state art)
- Icons that appear in bulk (table row actions, list item markers)

## Search Strategy (when you can't find the right icon)

1. Search the primary library by intent keyword
2. Try synonyms: "settings" -> "gear" -> "cog" -> "preferences" -> "sliders" -> "adjustments"
3. Try related concepts: "filter" -> "funnel" -> "sort" -> "refine"
4. If no match in primary library, check Tabler (largest set, 5,400 icons) or Phosphor (most weight variants, 7,000 icons) as fallback pools
5. If truly nothing exists across all libraries, tell the user explicitly. Never fabricate, approximate, or compose SVGs from parts.

## Library Selection Guide (when no project preference exists)

| Project type | Recommended library | Why |
|---|---|---|
| Marketing site / landing page | Heroicons | Clean, minimal, pairs well with Tailwind |
| Product UI / dashboard | Lucide | Broadest coverage for app UI patterns |
| Content-heavy / editorial | Phosphor | 6 weight variants match typography hierarchy |
| Component library / design system | Material Symbols | Variable font approach, most configurable |
| Quick prototype / hackathon | Tabler | Largest set, something for everything |
| Interactive / animated UI | Lucide Animated + Lucide | Best animated coverage with static fallback |
