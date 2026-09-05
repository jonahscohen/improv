---
name: icon-source
description: Find, select, and source icons, logos, and illustrations by CONTEXT using the priority cascade. Invoke this skill when the task involves "icon", "icon for", "find an icon", "which icon", "animated icon", "icon library", "svg icon", "logo", "brand logo", "company logo", "AI logo", "illustration", plus library names (Lucide, Heroicons, Tabler, Bootstrap Icons, Phosphor, Material Symbols, Hugeicons, reicon, Lobehub, Lucide Animated, Heroicons Animated, Hugeicons Animated). Use whenever the agent needs any icon, logo, or illustration during a build - it routes each need to the correct source by context and enforces verbatim sourcing.
---

# Icon Source

The authoritative routing for every icon, logo, and illustration in a build. There is ONE
decision tree. Follow it top to bottom, stop at the first source that has what you need, and
source it verbatim. This cascade routes by CONTEXT (what the graphic is and where it sits),
which is why a single project now legitimately mixes several sources. Do not improvise a
library choice; run the cascade.

## The absolute rule (never violated by any branch)

NEVER draw, compose, approximate, redraw, "optimize", "clean up", or fabricate icon/logo SVG
path data. Every graphic is sourced VERBATIM from one of the approved sources below - copy the
exact `<svg>` / `d="..."` character-for-character. If the path you insert does not match the
source byte-for-byte, you are breaking this rule. If nothing in the cascade has the concept,
say so explicitly - never invent one. This is enforced hard at write time (see Enforcement).

Every sourced graphic carries a provenance marker so the verbatim claim is auditable:
`data-icon-source="<source>"` on the root plus the library's own class where it has one
(e.g. `class="lucide lucide-menu"`). `<source>` is one of: `figma`, `lucide-animated`,
`heroicons-animated`, `hugeicons-animated`, `reicon`, `lobehub`, `lucide`, `heroicons`,
`hugeicons`, `tabler`, `bootstrap-icons`, `phosphor`, `material-symbols`.

## The Cascade (decision tree)

First classify the graphic, then follow that lane. A graphic is INTERACTIVE if it lives on
something the user clicks, hovers, toggles, or focuses (a button, link, toggle, control, menu
item, tab). Otherwise it is NON-INTERACTIVE. Logos and illustrations have their own lanes
regardless of interactivity.

### Lane A - INTERACTIVE element icons

1. **Figma reference for this build?** Extract the icon FROM the Figma file - `get_design_context`
   on the node, export/download the vector asset, and use that exact vector. Same design-source
   discipline as RULES.md Verification item 3 (measured values, reuse the canonical component)
   and item 12 (comb the whole surface). The Figma file wins over any library. STOP here.
2. **No Figma reference:** use an ANIMATED library, in this strict preference order. Take the
   first that carries the concept:
   1. Lucide Animated
   2. Heroicons Animated
   3. Hugeicons Animated
3. **No animated icon exists for the concept** (checked across all three tier-2 libraries):
   use **reicon**.
4. **reicon lacks it:** static fallback tier (see Lane D). One library per project WITHIN this
   tier.

### Lane B - NON-INTERACTIVE element icons

Animation is NOT a priority for at-rest chrome (section markers, labels, list markers,
landmarks).

5. **reicon first**, then the static fallback tier (Lane D). Do not reach for an animated
   library for a non-interactive icon.

### Lane C - ILLUSTRATIONS (in place of stock photography)

6. Spot art, empty-state art, hero art, editorial illustration: the primary route is
   **image generation via `/sidecoach` (sidecoach-image)** - generate the illustration and
   verify the produced pixels. reicon spot icons can SUPPLEMENT decoratively, but reicon is a
   UI-icon set, not an illustration library, so do not treat it as one. Offer imagegen as the
   option when a page wants illustration rather than a placeholder or stock photo.

### Lane D - COMPANY / BRAND / AI LOGOS (Anthropic, OpenAI, Gemini, GitHub, ...)

7. **Lobehub first** (`@lobehub/icons`) - it is the AI/LLM/company brand-logo set. reicon's
   small brands bundle is a limited fallback only. This lane applies whether the logo is
   interactive or not.

### Static fallback tier (used by Lane A step 4 and Lane B step 5)

Preference order, first with the concept wins: **Lucide -> Heroicons -> Hugeicons -> Phosphor
-> Material Symbols** (Tabler and Bootstrap Icons are also approved for edge-case coverage).
The **one-library-per-project rule survives only inside this tier**: once the first static
fallback icon is placed from a library, every later STATIC fallback icon in that project comes
from the same library, for visual coherence (matching stroke width, corner radius, weight).
An animated icon may pair with its static parent (Lucide Animated with Lucide, etc.).

> This context cascade SUPERSEDES the old blanket "one library per project" rule. A project
> now legitimately mixes Figma-extracted, animated, reicon, and Lobehub graphics by context.
> Consistency is enforced only within the static-fallback tier, where it still matters.

## Exact verbatim sourcing per source

### Figma extract (Lane A step 1)
Pull the node with `get_design_context`; export or download the icon's vector; use that exact
SVG. Do not substitute a library glyph that merely looks similar. Mark `data-icon-source="figma"`.

### Lucide Animated (tier-2 #1) - `pqoqubbw/icons`, site lucide-animated.com, MIT
React + Framer Motion, ~467 components, distributed as copy-paste components through a shadcn
registry (no lock-in). Add one:
```bash
npx shadcn@latest add "https://lucide-animated.com/r/<icon-name>.json"
```
This drops the component source into your project; import and render it. You may also copy the
component source verbatim from the site/repo. Note the repo README adds a no-resell/no-redistribute
clause on top of the MIT license - fine for use in a build, do not repackage the set.

### Heroicons Animated (tier-2 #2) - `heroicons-animated/heroicons-animated`, site heroicons-animated.com, MIT
React + `motion`. Two supported paths:
```bash
# shadcn (copy-paste source, no package)
npx shadcn@latest add @heroicons-animated/<icon-name>
# or the npm package
npm add @heroicons-animated/react motion
```
```tsx
import { BeakerIcon } from "@heroicons-animated/react";
<BeakerIcon className="size-6" />
```

### Hugeicons Animated (tier-2 #3) - `enesgules/hugeicons-animated`, site hugeicons-animated.com
> WARNING - UNLICENSED third-party project (no license file in the repo). It is kept as the #3 animated option per the icon mandate, but confirm the license before using it in anything redistributable or client-shipped, and prefer Lucide Animated or Heroicons Animated (both properly licensed) whenever either has the icon.

Hand-animated Hugeicons built with `motion`, distributed as copy-paste source via the shadcn CLI:
```bash
npx shadcn@latest add @hugeicons-animated/<icon-name>   # e.g. notification-03
```
```tsx
import { Notification03Icon } from '@/components/ui/notification-03';
```
Geometry is the matching icon from `@hugeicons/core-free-icons`. LICENSE: the repo declares no
explicit license file - confirm the license before shipping it in anything redistributable;
for a normal build it is fine.

### reicon (Lane A step 3, Lane B step 5) - `dqev/reicon`, site reicon.dev, MIT
2,700+ UI icons, weights Outline (default) and Filled, plus a separate duotone set. Single
source of truth is `data/icon-data.json` (categories -> icons -> `weights.Outline.code` /
`weights.Filled.code`, each a full `<svg>` using `currentColor`, 24x24 viewBox). Ways to source:
- **Raw SVG (vanilla HTML / static site):** copy the exact SVG from the icon page
  `https://reicon.dev/icon/<name>`, from the downloadable ZIP, or from `data/icon-data.json`.
  It uses `currentColor`, so colorize via CSS `color`.
- **Web component (CDN):** `<re-icon name="<name>"></re-icon>` via the `reicon.js` bundle.
- **npm (per framework):** `reicon-react` (`import { Home } from 'reicon-react'`, or the
  smallest-bundle form `import Home from 'reicon-react/icons/Home'`), plus `reicon-vue`,
  `reicon-svelte`, `reicon` (vanilla), `reicon-react-native`, `reicon-flutter`.
  Props: `size`, `color`, `weight="Filled"`.
- **MCP server:** `reicon-mcp` (`npx reicon-mcp`) lets an agent search the set and return exact
  SVG markup.
- reicon icon names are kebab-case; component names are PascalCase (`arrow-up-right` ->
  `ArrowUpRight`). Mark `data-icon-source="reicon"`.
- reicon is a UI-icon set. It has a small `reicon-brands.js` brand/social bundle but NO
  comprehensive company/AI-logo set and NO illustration set. Do not route logos or
  illustrations to reicon as the primary source (see Lanes C and D).

### Lobehub (Lane D) - `lobehub/lobe-icons`, site icons.lobehub.com, MIT
900+ AI/LLM/company brand logos (Anthropic, Claude, OpenAI, Gemini, Mistral, Cohere, Google,
GitHub, Copilot, Cursor, and many more), color + monochrome, dark/light variants.
- **React:** `npm i @lobehub/icons`, then `import { OpenAI, Anthropic, Claude, Gemini } from '@lobehub/icons'`.
- **Static SVG (any stack):** package `@lobehub/icons-static-svg`, or CDN
  `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<slug>.svg`
  (e.g. `openai.svg`, `claude-color.svg`, `anthropic.svg`). Verbatim source lives at
  `packages/static-svg/icons/<slug>.svg` on the `master` branch.
- Also `@lobehub/icons-static-png`, `-static-webp`, `-static-avatar` (dark/light), and
  `@lobehub/icons-rn` for React Native. Mark `data-icon-source="lobehub"`.

### Static fallback libraries (Lane D tier)
Copy the exact `<path d="...">` / `<svg>` from the source, byte-for-byte. IMPORTANT: raw
repo SVGs (`icons/<name>.svg` in the Lucide/Heroicons/Tabler repos) ship with NO `class` and
no marker. If you copy one and add `aria-hidden="true"` (correct for a decorative icon), you
MUST also add `data-icon-source="<lib>"` yourself, or the B2 gate will treat a marker-less,
primitive-built, square, aria-hidden icon as fabrication and block the write. Website
"Copy SVG" output that already includes the library class passes as-is.
| Library | Repo | Notes |
|---|---|---|
| Lucide | lucide-icons/lucide | broadest general UI coverage, `icons/<name>.svg` |
| Heroicons | tailwindlabs/heroicons | clean UI chrome, pairs with Tailwind |
| Hugeicons | hugeicons/hugeicons | 5,400+ free, `@hugeicons/react` + `@hugeicons/core-free-icons`, 10 styles |
| Phosphor | phosphor-icons/core | 6 weights, illustration-adjacent |
| Material Symbols | google/material-design-icons | variable font, 3 fills / 7 grades |
| Tabler | tabler/tabler-icons | largest set, edge-case coverage |
| Bootstrap Icons | twbs/icons | familiar web conventions |

## Search by intent, not by shape

Search for the concept in context, not a literal description of the drawing.

| Bad search | Good search | Why |
|---|---|---|
| "house" | "home" | it means "go home", not "building" |
| "circle with X" | "close" / "dismiss" | the action, not the shape |
| "arrow pointing right" | "next" / "forward" / "chevron-right" | the purpose in context |
| "person silhouette" | "user" / "account" / "profile" | the domain concept |

If a lane's source lacks the concept, exhaust its synonyms first (settings -> gear -> cog ->
preferences -> sliders), then fall to the next lane. Only after every lane is exhausted do you
tell the user the concept has no verbatim source. Never fabricate to fill the gap.

## Enforcement (what is mechanical vs behavioral - be honest)

`claude/hooks/icon-cascade-guard.sh` (PreToolUse on Write/Edit/MultiEdit) is the fail-HARD gate.
It blocks a write, it does not warn. It is deliberately narrow, because a "can't-fail" gate
that blocks legitimate work is itself a failure. It fires only on buildable app source
(`.html/.htm/.jsx/.tsx/.vue/.svelte/.astro`) and never on captured corpora, generated eval
fixtures, backups, vendored trees, tests, or docs. Two checks BLOCK:

- **B1 - off-cascade icon library.** An import from an icon library OUTSIDE the approved
  cascade (react-icons, Font Awesome, Feather, Iconify, Ionicons, Ant/MUI icons, remix/box
  icons, etc.) is denied. Use a cascade source instead. Matched only at real import/require
  positions (comments and mid-code strings are stripped first), so a migration note or a
  code sample that merely mentions a blocked name does not deny the write. Residual limit: a
  full off-cascade import line inside a MULTILINE template-literal code sample is
  indistinguishable from a real import and will still deny; keep such samples in a `.md` or a
  data file.
- **B2 - fabricated / hand-drawn icon.** An inline `<svg>` that is unmistakably an icon
  (root `aria-hidden="true"`, `currentColor`, square viewBox <= 48, no text/image/defs/gradient)
  built from >= 2 primitive elements (`line`/`rect`/`circle`/`polyline`/`polygon`/`ellipse`)
  or one compound path with >= 2 subpaths, and carrying NO provenance marker, is denied. A
  verbatim icon that keeps its library class / `data-icon-source` marker passes.

These are BEHAVIORAL only - no hook can soundly enforce them, so they are on you:

- The cascade PRIORITY itself (Figma before animated before reicon before static). A hook
  cannot know whether a Figma reference exists for the build, whether an animated icon exists
  for a given concept, or whether the Figma file contains the icon.
- Static-icon-on-an-interactive-element when a Figma reference exists. A hook cannot reliably
  decide interactivity + concept-animation-availability + Figma-ref state together, so forcing
  it would over-block. You enforce it by running the cascade.
- Logo routing to Lobehub and illustration routing to imagegen.

## Quick reference

| Context | Source order |
|---|---|
| Interactive icon, Figma build | Figma extract |
| Interactive icon, no Figma | Lucide Animated -> Heroicons Animated -> Hugeicons Animated -> reicon -> static tier |
| Non-interactive icon | reicon -> static tier |
| Illustration (vs stock photo) | imagegen (sidecoach-image); reicon spot icons supplement |
| Company / brand / AI logo | Lobehub -> reicon brands (limited) |
| Static tier order | Lucide -> Heroicons -> Hugeicons -> Phosphor -> Material Symbols (Tabler / Bootstrap for edge cases), one library per project within the tier |
