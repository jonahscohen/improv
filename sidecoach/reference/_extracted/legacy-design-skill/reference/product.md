# Impeccable product.md (extracted)

Note: long dashes in source replaced with regular hyphens per repo policy. Semantic content preserved.

## VERBATIM LIFT

# Product register

When design SERVES the product: app UIs, admin dashboards, settings panels, data tables, tools, authenticated surfaces, anything where the user is in a task.

## The product slop test

Not "would someone say AI made this." Familiarity is often a feature here. The test is: would a user fluent in the category's best tools (Linear, Figma, Notion, Raycast, Stripe come to mind) sit down and trust this interface, or pause at every subtly-off component?

Product UI's failure mode isn't flatness, it's strangeness without purpose: over-decorated buttons, mismatched form controls, gratuitous motion, display fonts where labels should be, invented affordances for standard tasks. The bar is earned familiarity. The tool should disappear into the task.

## Typography

- **System fonts are legitimate.** `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` gives you native feel on every platform. Inter is the common cross-platform default for a reason.
- **One family is often right.** Product UIs don't need display/body pairing. A well-tuned sans carries headings, buttons, labels, body, data.
- **Fixed rem scale, not fluid.** Clamp-sized headings don't serve product UI. Users view at consistent DPI, and a fluid h1 that shrinks in a sidebar looks worse, not better.
- **Tighter scale ratio.** 1.125 to 1.2 between steps is typical. More type elements here than on brand surfaces; exaggerated contrast creates noise.
- **Line length still applies for prose** (65 to 75ch). Data and compact UI can run denser; tables at 120ch+ are fine.

## Color

Product defaults to Restrained. A single surface can earn Committed (a dashboard where one category color carries a report, an onboarding flow with a drenched welcome screen), but Restrained is the floor.

- State-rich semantic vocabulary: hover, focus, active, disabled, selected, loading, error, warning, success, info. Standardize these.
- Accent color used for primary actions, current selection, and state indicators only, not decoration.
- A second neutral layer for sidebars, toolbars, and panels (slightly cooler or warmer than the content surface).

## Layout

- Predictable grids. Consistency IS an affordance; users navigate faster when the structure is expected.
- Familiar patterns are features. Standard navigation (top bar, side nav), breadcrumbs, tabs, and form layouts have established user expectations. Don't reinvent for flavor.
- Responsive behavior is structural (collapse sidebar, responsive table, breakpoint-driven columns), not fluid typography.

## Components

Every interactive component has: default, hover, focus, active, disabled, loading, error. Don't ship with half of these.

- Skeleton states for loading, not spinners in the middle of content.
- Empty states that teach the interface, not "nothing here."
- Consistent affordances across the surface. Same button shape. Same form-control vocabulary. Same icon style.

## Motion

- 150 to 250 ms on most transitions. Users are in flow; don't make them wait for choreography.
- Motion conveys state, not decoration. State change, feedback, loading, reveal: nothing else.
- No orchestrated page-load sequences. Product loads into a task; users don't want to watch it load.

## Product bans (on top of the shared absolute bans)

- Decorative motion that doesn't convey state.
- Inconsistent component vocabulary across screens. If the "save" button looks different in two places, one is wrong.
- Display fonts in UI labels, buttons, data.
- Reinventing standard affordances for flavor (custom scrollbars, weird form controls, non-standard modals).
- Heavy color or full-saturation accents on inactive states.

## Product permissions

Product can afford things brand surfaces can't.

- System fonts and familiar sans defaults (Inter, SF Pro, system-ui stacks).
- Standard navigation patterns: top bar + side nav, breadcrumbs, tabs, command palettes.
- Density. Tables with many rows, panels with many labels, dense information when users need it.
- Consistency over surprise. The same visual vocabulary screen to screen is a virtue; delight is saved for moments, not pages.

## EXTENSION

### The 8 mandatory interaction states (enumerated)

Every interactive component MUST implement and visually distinguish:

1. **Default** - base styling, at rest
2. **Hover** - pointer-only (`@media (hover: hover)`); never required for function
3. **Focus** - keyboard focus, via `:focus-visible`; visible ring (3:1 contrast minimum, 2-3px outline, 2px offset)
4. **Active** - the moment of click/tap; brief feedback (scale 0.96 + slight darkening)
5. **Disabled** - reduced opacity (0.4 to 0.5), no pointer cursor, `aria-disabled="true"` or `disabled` attribute
6. **Loading** - skeleton or inline spinner; preserve layout to prevent shift
7. **Error** - visible error state (border color, icon, message); `aria-invalid="true"` with `aria-describedby` linking to message
8. **Success** - confirmation state (color shift, checkmark, transient message)

For toggleable/selectable elements, add:
- **Selected / Checked / Active-route** - persistent state indicator (border, fill, weight shift); different from hover, different from focus

### Component vocabulary canonical list

If the product has these, standardize them once and reuse:

| Component | Variants required |
|---|---|
| Button | primary, secondary, ghost/tertiary, destructive, icon-only |
| Input | text, password, number, search, textarea, with-prefix/suffix |
| Select / Dropdown | native, searchable combobox, multi-select |
| Toggle | checkbox, radio, switch (each a distinct affordance, not interchangeable) |
| Modal / Dialog | confirmation (small, blocking), form (medium), full-screen sheet |
| Tooltip | static, with delay (300-500ms before show, instant hide) |
| Toast / Notification | info, success, warning, error; with optional action (undo) |
| Card | flat, elevated; never nested |
| Table | with sortable columns, with row selection, with sticky headers, with empty state |
| Form | inline edit, separate form, wizard / multi-step |
| Navigation | top bar, side nav (collapsible), breadcrumbs, tabs, command palette |

### Density tokens for product UI

A product UI should support at least 2 density levels via a token like `--density: 1` (default) and `--density: 0.85` (compact). Drive all paddings, gaps, and line-heights through `calc(var(--density) * <base>)`. Users dealing with information-dense workflows often want compact mode; default-density is friendlier for casual or first-time use.

### Display fonts in product UI: the exception list

The product ban on display fonts has narrow exceptions:

- **First-run welcome screens** (one-time, intentional moment of brand voice)
- **Empty-state hero illustrations** that already use display type as art (not as UI)
- **Onboarding milestones** that celebrate completion (one moment, not every screen)

NOT exceptions: settings page headings, dashboard titles, modal titles, button labels, navigation labels, data table headers. All those use the body sans family.

## WHAT'S MISSING

- **No explicit accessibility section.** Product UIs need keyboard nav, screen reader support, focus management; the ban list mentions it indirectly but doesn't enumerate.
- **No data table prescriptions.** Tables are mentioned but no rules about: striped vs hairlined rows, sortable column UX, sticky headers, row hover, batch-select patterns, empty state inside tables.
- **No command palette prescriptions.** Mentioned in permissions but no implementation guidance (keyboard activation, fuzzy search behavior, action prioritization).
- **No form-design pillar.** Inputs are mentioned in the 8 states but form-level concerns (validation timing, error summary at top, field grouping, save-on-blur vs explicit submit) are absent.
- **No multi-window / multi-tab guidance.** Product apps often run in multiple windows (Figma, VS Code); how should that affect design decisions? Not addressed.
- **No notification / alert hierarchy.** Toasts vs banners vs modals vs inline messages: when is each appropriate? Implicit but never enumerated.
- **No empty-state taxonomy for product.** "Empty states that teach the interface" but no enumeration of empty-state subtypes (first-use, user-cleared, no-results-from-filter, error, permission-denied).
- **No keyboard-shortcut catalog.** Stripe, Linear, Figma, Notion all have shortcut systems; product.md doesn't prescribe a starting vocabulary (Cmd+K for command palette, Cmd+/ for search, etc.).
