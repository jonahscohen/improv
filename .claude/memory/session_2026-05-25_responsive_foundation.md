---
name: Responsive foundation reference written (2026-05-25)
description: Canonical sidecoach responsive reference synthesizing Bencium, oracle, component-gallery, make-interfaces-feel-better, and public web research
type: project
relates_to: [all_tasks_complete.md, session_2026-05-23_sidecoach_100_complete.md, sidecoach_consolidation_gameplan.md]
---

# Responsive foundation reference

Built by Jonah on 2026-05-25. Single dense reference file at `sidecoach/reference/responsive-foundation.md` that becomes the canonical responsive section of sidecoach's chain prompt for every craft / shape / adapt / polish flow.

## What was captured

Sourced verbatim and synthesized from:

1. **Bencium's `RESPONSIVE-DESIGN.md`** (https://github.com/bencium/bencium-marketplace/blob/main/bencium-impact-designer/skills/bencium-impact-designer/RESPONSIVE-DESIGN.md): the 5-band breakpoint table (XS 0-479, SM 480-767, MD 768-1023, LG 1024-1439, XL 1440+) reproduced as-is plus extensions (test widths 375/390/414/768/1024/1280/1440, Tailwind name mapping, content-driven breakpoint allowance, clamp() guidance).
2. **oracle `adapt.md` and `responsive-design.md`** (cached): mobile/tablet/desktop adaptation strategies, layout-vs-interaction-vs-content split, pointer/hover media queries, safe-area env() pattern, responsive images with srcset.
3. **component-gallery-reference SKILL.md** (`~/.claude/skills/component-gallery-reference/SKILL.md`): the 60 component types map; pulled Navigation, Drawer, Tabs, Segmented control, Modal, Combobox into the mobile-nav decision tree.
4. **make-interfaces-feel-better SKILL.md** (`~/.agents/skills/make-interfaces-feel-better/SKILL.md`, principle 16): the 40x40 hit-area minimum - sidecoach overrides to 44x44 for WCAG 2.5.5 / iOS HIG / Bencium consistency; documented the override and the pseudo-element extension pattern.

Web research filled gaps Bencium and oracle did not cover:

- **2026 mobile-nav patterns** (uxpin, phone-simulator, designstudiouiux): bottom-tab-bar vs hamburger 40% task-completion gap, hybrid bottom-nav + hamburger NN/g recommendation.
- **WCAG 2.5.5 vs 2.5.8** (w3.org, css-tricks, adrian roselli): 44x44 AAA enhanced vs 24x24 AA minimum, target-size-is-not-visual-size principle.
- **iOS Safari 100vh address-bar gotcha** (bram.us, WebKit bug 261185): svh / lvh / dvh viewport units, the legacy `-webkit-fill-available` fallback.
- **iOS HIG segmented control vs tab bar** (developer.apple.com): segmented = related-views-within-screen, tab bar = primary navigation between sections.
- **Container queries vs media queries 2026** (logrocket, joshwcomeau, freecodecamp): page-level + OS preferences = media; component intrinsic = container; use both.
- **Command palette mobile invocation** (mobbin, uxpatterns.dev, maggieappleton): keyboard-first surface needs visible trigger on touch since no `Cmd+K` equivalent.

## Structure delivered

The reference file follows the requested structure exactly: The Premise, The Breakpoint Table (with sidecoach extensions), Pattern Transitions Per Breakpoint (12-row matrix), three source-to-target code examples (nav, tables, filters), six Mobile Navigation Patterns DEEP with decision tree (hamburger, bottom nav, drawer, segmented control, tab bar, command palette, FAB), Hit Area Rules (44x44 override + pseudo-element + pointer split), Fluid Type (clamp formulas + ratio-swap + body-text rules), 15 Named Anti-Patterns, Touch vs Mouse Detection (with safe-area), Container Queries Note, Degrade Plan Template, Mandatory Verification Steps tied to Flow J, "What This Covers Better Than Each Source" delta section, Sources.

## Gaps noted during research

- **Component.gallery does not have a dedicated Command Palette type.** Documented that finding in the reference file - the closest catalog entries are Combobox + Modal. Pointed sidecoach at Linear / Raycast / Superhuman as study examples.
- **WCAG 2.5.5 pseudo-element extension** is not explicitly documented on w3.org. Pulled the pattern from make-interfaces-feel-better's principle 16 and codified the extension recipe.
- **No public catalog of "responsive degrade plan" templates** exists - the template at the bottom of the file is sidecoach-original, synthesized from the verification steps in CLAUDE.md and the per-pattern transitions documented above.
- **make-interfaces-feel-better says 40x40, WCAG 2.5.5 says 44x44.** Resolved the contradiction by overriding to 44 explicitly with rationale documented in the Hit Area Rules section.

## Files touched

- Created `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/responsive-foundation.md` (~22KB, single dense reference).
- Created this memory file.

## Next step

Wire the reference into the sidecoach flow handlers (craft / shape / adapt / polish, plus Flow G implementation and Flow J tactical polish) so the degrade-plan template fires during component emission and the mandatory verification steps gate Flow J completion.
