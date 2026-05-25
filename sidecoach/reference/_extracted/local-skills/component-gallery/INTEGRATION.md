# component-gallery-reference - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/component-gallery-reference/SKILL.md`

## What this skill provides

A research layer over [component.gallery](https://component.gallery) - a catalog of 60 component types, 95 real-world design systems (Shopify Polaris, IBM Carbon, GitHub Primer, Adobe Spectrum, Google Material, etc.), and 2,672 total examples.

The skill is a **workflow**, not a data file. It tells the agent to:
1. Identify the component type
2. Detect the project's tech stack
3. Browse the gallery page (filtered by tech)
4. Skip "Unmaintained" and "Accessibility issues" tagged examples
5. Extract semantic markup, naming consensus, interaction patterns, ARIA
6. Inventory the project's design system (DESIGN.md, PRODUCT.md, existing components)
7. Synthesize a component brief that separates "function from gallery" + "identity from project" + "gap-fills from gallery patterns styled in project tokens"

The core idea is **layered synthesis**: never sacrifice function for identity. The gallery gives the skeleton; the project's design tokens give the visual identity; gaps get filled with gallery patterns styled in project tokens.

## The 60 component types (the full taxonomy)

These are the component slugs sidecoach can query directly. URL pattern: `https://component.gallery/components/<slug>/`.

| Slug | Aliases sidecoach should map | Notes |
|---|---|---|
| `accordion` | collapse, disclosure, expandable | |
| `alert` | notification, banner, callout | NOT toast - alerts are inline |
| `avatar` | profile picture, user image | |
| `badge` | tag, chip, pill, label (non-form) | |
| `breadcrumbs` | path, trail | |
| `button` | btn, action, cta | |
| `button-group` | toolbar, action group | |
| `card` | tile, panel | |
| `carousel` | slider, content slider, slideshow | NOT range input |
| `checkbox` | tickbox | |
| `color-picker` | swatch picker, palette | |
| `combobox` | autocomplete, autosuggest, typeahead | |
| `date-input` | date field | NOT calendar |
| `datepicker` | calendar, date selector, datetime picker | |
| `drawer` | flyout, sheet, tray, side panel | NOT navigation - drawers are dismissable |
| `dropdown-menu` | action menu, kebab menu, overflow menu | NOT select - actions not values |
| `empty-state` | zero state, blank slate | |
| `fieldset` | form group, field group | |
| `file` | file display, attachment | |
| `file-upload` | uploader, drop zone | |
| `footer` | site footer | |
| `form` | form layout | |
| `header` | site header, top bar | |
| `heading` | title, h1-h6 | |
| `hero` | jumbotron, masthead, splash | |
| `icon` | glyph, symbol | (icon-source skill is the deeper one) |
| `image` | picture, photo | |
| `label` | input label, form label | |
| `link` | anchor, hyperlink | |
| `list` | listview, feed | |
| `modal` | dialog, popup, lightbox | |
| `navigation` | nav, menu, navbar | **MOBILE NAV LIVES HERE** - filter by Mobile feature tag |
| `pagination` | page nav, page selector | |
| `popover` | floating panel, hovercard | NOT tooltip - popovers are interactive |
| `progress-bar` | loader, progress meter | |
| `progress-indicator` | progress tracker, steps, timeline, stepper for processes | |
| `quote` | blockquote, pull quote | |
| `radio-button` | radio, option | |
| `rating` | stars, score | |
| `rich-text-editor` | wysiwyg, content editor | |
| `search-input` | search box, search bar | |
| `segmented-control` | toggle button group, tab-style switch | |
| `select` | dropdown (form input), picker | NOT dropdown-menu |
| `separator` | divider, horizontal rule, hr | |
| `skeleton` | skeleton loader, shimmer placeholder | |
| `skip-link` | skip to content | a11y essential |
| `slider` | range input | NOT carousel |
| `spinner` | loading, loader, busy indicator | |
| `stack` | layout primitive | |
| `stepper` | counter, quantity, nudger | NOT progress-indicator |
| `table` | data table, grid | |
| `tabs` | tab bar | |
| `text-input` | input field, textbox | |
| `textarea` | multi-line input | |
| `toast` | snackbar | NOT alert - toasts auto-dismiss |
| `toggle` | switch, lightswitch | |
| `tooltip` | hint, label-on-hover, toggletip | |
| `tree-view` | tree, hierarchy | |
| `video` | video player | |
| `visually-hidden` | sr-only | a11y |

## Mobile navigation (called out specifically)

`navigation` is the slug. Filter the gallery page by **Mobile** in the Features filter to see mobile-specific implementations. Patterns sidecoach should expect to surface include:
- Bottom tab bars (iOS/Android native conventions)
- Hamburger + slide-out drawer
- Hamburger + full-screen overlay
- Sticky top bar with collapsing menu
- Compound nav: bottom tabs + top utility bar
- "More" overflow when tab count exceeds 4-5

The gallery cross-system view distinguishes:
- `navigation` (top-level site/app nav, persistent)
- `drawer` (slide-out panel, dismissable - some mobile navs use drawer pattern)
- `tabs` (within-page section switcher, NOT site nav)
- `breadcrumbs` (hierarchical location)

A "mobile nav" query should consult `navigation` first with Mobile filter, then `drawer` if the implementation uses a slide-out pattern.

## How sidecoach should query this skill

### Trigger phase

Sidecoach should consult component-gallery-reference whenever a flow handler is generating, naming, or QA'ing a UI component. Trigger words sidecoach should match:

| Trigger word in user task | Map to slug |
|---|---|
| "button", "btn", "cta", "action button" | `button` |
| "modal", "dialog", "popup", "lightbox" | `modal` |
| "card", "tile", "panel" | `card` |
| "nav", "navbar", "menu", "navigation" | `navigation` |
| "mobile nav", "mobile menu", "hamburger" | `navigation` (Mobile filter) + `drawer` |
| "table", "data table", "grid" | `table` |
| "form", "input", "field" | `form` + `text-input` + relevant input type |
| "dropdown" (form) | `select` |
| "dropdown" (actions) | `dropdown-menu` |
| "toast", "snackbar", "notification (transient)" | `toast` |
| "alert", "banner", "callout" (inline) | `alert` |
| "tooltip", "hint", "toggletip" | `tooltip` |
| "popover", "floating panel" | `popover` |
| "drawer", "sheet", "tray", "flyout" | `drawer` |
| "tabs", "tab bar" | `tabs` |
| "accordion", "collapse", "disclosure" | `accordion` |
| "switch", "toggle", "lightswitch" | `toggle` |
| "stepper" (count nudger) | `stepper` |
| "stepper" (progress) | `progress-indicator` |
| "skeleton", "shimmer", "loading placeholder" | `skeleton` |
| "spinner", "loader", "busy" | `spinner` |
| "badge", "chip", "tag", "pill" | `badge` |
| "empty state", "zero state", "blank slate" | `empty-state` |
| "search", "search bar" | `search-input` |
| "datepicker", "calendar" | `datepicker` |
| "carousel", "slideshow" | `carousel` |
| "hero", "masthead", "jumbotron" | `hero` |

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to extract |
|---|---|---|
| **Flow B (component-research)** | ALWAYS on entry | Component slug, gallery URL, name consensus, semantic element |
| **Flow G (component-implementation)** | Before writing code | Interaction states list (hover, focus, active, disabled, loading, error, empty), keyboard shortcuts, ARIA attributes |
| **Flow I (accessibility)** | During WCAG audit | A11y patterns from gallery's "Accessibility" feature-filtered examples |
| **Flow N (audit/critique/polish triad)** | During audit pass | Cross-check against gallery's name consensus + interaction states; flag missing states |
| **Flow tactical-polish** | When tightening states | Gallery's "states this component should have" checklist |

### Query shape (what sidecoach's flow handler should produce)

When a flow handler needs to query this skill, it should generate a context payload like:

```typescript
{
  source: 'component-gallery-reference',
  componentType: 'navigation',          // mapped slug
  galleryUrl: 'https://component.gallery/components/navigation/',
  techStack: ['React', 'Tailwind CSS'], // detected from package.json
  filters: {
    excluded: ['Unmaintained', 'Accessibility issues'],
    featureRequired: ['Mobile'],         // optional, only when mobile-specific
  },
  extractFields: [
    'semantic-markup',
    'name-consensus',
    'interaction-states',
    'aria-patterns',
    'keyboard-shortcuts',
    'related-components',
    'usage-guidelines',
  ],
  expectedOutput: 'ComponentBrief',     // structured brief per the skill's Step 5
}
```

### Forbidden sources

Sidecoach MUST filter out examples tagged "Unmaintained" or "Accessibility issues" from the gallery. These are explicitly excluded - their patterns are stale or known-broken and using them defeats the purpose of the research layer.

## What sidecoach is currently missing

1. **No automatic gallery lookup in Flow B (component-research)** - the flow handler at `flow-handler-component-research.ts` does not currently fetch gallery URLs or surface name-consensus data. It produces a research summary but does not anchor it in the gallery's cross-system view.
2. **No mobile-nav filter logic** - the navigation slug is queried generically, missing the Mobile feature filter when the task is mobile-specific.
3. **No tech-stack detection step** before query - sidecoach does not currently inspect `package.json` to filter gallery examples by relevant framework.
4. **No "excluded sources" enforcement** - Unmaintained and Accessibility-issues examples are not actively filtered out in any flow.

## Gaps in the skill itself

- The skill ships as a workflow only; no embedded data file lists the 95 design systems or example URLs. Each consultation requires a live web fetch. Sidecoach should cache common slug responses to avoid round-tripping.
- No structured machine-readable schema for what the skill returns - sidecoach has to parse the gallery's HTML or produce a synthesized brief from the agent's reading. Worth building a small extractor utility.
