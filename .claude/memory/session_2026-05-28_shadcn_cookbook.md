---
name: shadcn/ui opt-in cookbook reference for sidecoach
description: Wrote concise OPT-IN shadcn/ui cookbook extracted from giuseppe-trisciuoglio/developer-kit, excluding scraped install dumps
type: reference
---

Wrote `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/external/shadcn-ui/COOKBOOK.md` (Jonah).

What: A library-agnostic OPT-IN shadcn/ui reference for sidecoach. Header gate says the doc applies ONLY when a project ships `components.json` or has Tailwind + Radix + cva detected; otherwise ignore.

Source: shadcn-ui skill in `giuseppe-trisciuoglio/developer-kit` at `plugins/developer-kit-typescript/skills/shadcn-ui/`. Fetched via `gh api ... contents` (base64): SKILL.md, references/customization.md, setup-and-configuration.md, forms-and-validation.md, ui-components.md, charts-components.md, nextjs-integration.md, chart.md.

Excluded (deliberately): `references/official-ui-reference.md` and `references/ui-reference.md` - the two large machine-scraped official-doc dumps (install-command bloat, low signal).

Sections written: 1) cn() = clsx + tailwind-merge; 2) cva variant systems + VariantProps; 3) Radix asChild/Slot composition; 4) React-Hook-Form + Zod resolver wiring (incl. controlled-widget rules + server-side z.parse route handler); 5) CSS-variable theming (HSL channel triples consumed via hsl(var(--token)) in tailwind theme.extend, noting oklch chart tokens coexist); 6) next-themes dark mode (class toggle + suppressHydrationWarning); 7) components.json registry + npx shadcn add + registry-security note; 8) ChartContainer/Recharts theming with config -> var(--color-key), oklch chart tokens, accessibilityLayer.

Convention: Matched frontmatter shape of vercel-web-interface-guidelines/forms-guidelines.md (source / source_files / captured / license / attribution / type). Added applies_when field for the opt-in gate.

License: MIT, Copyright (c) 2025 Giuseppe Trisciuoglio (verified via repo LICENSE). Attributed in frontmatter + footer.

Why no fabricated APIs: all snippets lifted/adapted verbatim from the source skill; ChartTooltip import added to the chart snippet to match its usage (was used but omitted from one import line upstream).

Files touched:
- sidecoach/reference/_extracted/external/shadcn-ui/COOKBOOK.md (new)
