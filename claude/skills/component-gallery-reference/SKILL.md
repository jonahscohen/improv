---
name: component-gallery-reference
description: Research industry-validated UI component patterns from component.gallery before building, extracting, or re-implementing components. Use when creating any standard UI component (button, modal, accordion, tabs, toast, card, navigation, form elements, etc.), when naming components, when checking accessibility patterns, or when the user wants to see how major design systems handle something. Triggers on building components, component naming debates, accessibility patterns for UI elements, "how do other design systems do X", design system audits, component extraction, and re-implementation of existing components. Use this skill even when the user doesn't mention component.gallery explicitly - if they're building a UI component that exists in the catalog, research it first.
---

# Component Gallery Reference

Use component.gallery as a research layer before building UI components. The site catalogs 60 component types across 95 real-world design systems (Shopify Polaris, IBM Carbon, GitHub Primer, Adobe Spectrum, Google Material, etc.) with 2,672 total examples.

## The core idea: layered synthesis

Building a component well requires three layers, and this skill is the first:

1. **Function layer** (this skill) - Browse component.gallery to learn the industry-validated interaction patterns, semantic markup, accessibility requirements, and behavioral expectations for the component type. This is the skeleton - the part that makes the component actually work correctly.

2. **Identity layer** (project's design system) - Read the project's DESIGN.md, PRODUCT.md, existing tokens, and component library. Apply the project's fonts, colors, spacing, border radii, and visual language to the functional skeleton. The component should look like it belongs in this project, not like it was ripped from Polaris or Carbon.

3. **Gap-filling layer** (Claude's judgment, informed by gallery research) - The project's design system will almost never cover every state and interaction the component needs. Hover states, focus rings, disabled appearances, loading states, animation timing, keyboard shortcuts - if the project doesn't specify these, derive them from the gallery's best practices and the project's existing visual patterns. Fill the gaps, don't leave them empty.

The key principle: never sacrifice function for identity. If the project's design system doesn't define a hover state for the notification component, don't ship it without one. Use the gallery research to understand what the hover state should do functionally, then style it using the project's existing tokens and patterns so it looks native.

## When to use this skill

- **Building a new component** - Before writing code, check the gallery. Even if you think you know how to build a modal, the gallery will remind you about focus trapping, scroll locking, the escape key handler, and the backdrop click behavior that you might otherwise forget.
- **Naming a component** - The gallery shows what 95 design systems call the same thing. Use the name distribution data to align with industry consensus.
- **Accessibility patterns** - Each component page aggregates a11y guidance from dozens of systems. Better than any single source.
- **Extracting components from existing UI** - When pulling components out of a monolith into a design system, check the gallery to see if the component maps to a known pattern.
- **Settling debates** - "Should this be a modal or a drawer?" The gallery has both, with usage guidelines from real systems.
- **Filling design system gaps** - When the project defines a component visually but leaves out interactive states, use the gallery to understand what states are expected and how they should behave.

## The 60 component types

If the user is building something that maps to one of these, this skill applies:

Accordion, Alert, Avatar, Badge, Breadcrumbs, Button, Button group, Card, Carousel, Checkbox, Color picker, Combobox, Date input, Datepicker, Drawer, Dropdown menu, Empty state, Fieldset, File, File upload, Footer, Form, Header, Heading, Hero, Icon, Image, Label, Link, List, Modal, Navigation, Pagination, Popover, Progress bar, Progress indicator, Quote, Radio button, Rating, Rich text editor, Search input, Segmented control, Select, Separator, Skeleton, Skip link, Slider, Spinner, Stack, Stepper, Table, Tabs, Text input, Textarea, Toast, Toggle, Tooltip, Tree view, Video, Visually hidden

## Workflow

### Step 1: Identify the component type

Map the user's request to one of the 60 component types. Some mappings aren't obvious:

| User says | Component type | URL slug |
|-----------|---------------|----------|
| "dialog" or "popup" | Modal | `/components/modal/` |
| "notification" or "banner" or "callout" | Alert | `/components/alert/` |
| "tag" or "chip" or "label" (non-form) | Badge | `/components/badge/` |
| "autocomplete" or "autosuggest" | Combobox | `/components/combobox/` |
| "snackbar" | Toast | `/components/toast/` |
| "loading" or "loader" | Spinner | `/components/spinner/` |
| "flyout" or "sheet" or "tray" | Drawer | `/components/drawer/` |
| "switch" or "lightswitch" | Toggle | `/components/toggle/` |
| "toggletip" | Tooltip | `/components/tooltip/` |
| "tile" | Card | `/components/card/` |
| "toolbar" | Button group | `/components/button-group/` |
| "nav" or "menu" | Navigation | `/components/navigation/` |
| "collapse" or "disclosure" or "expandable" | Accordion | `/components/accordion/` |
| "range input" | Slider | `/components/slider/` |
| "skeleton loader" | Skeleton | `/components/skeleton/` |
| "divider" or "horizontal rule" | Separator | `/components/separator/` |
| "nudger" or "quantity" or "counter" | Stepper | `/components/stepper/` |
| "jumbotron" | Hero | `/components/hero/` |
| "calendar" or "datetime picker" | Datepicker | `/components/datepicker/` |
| "progress tracker" or "steps" or "timeline" | Progress indicator | `/components/progress-indicator/` |
| "content slider" | Carousel | `/components/carousel/` |
| "dropdown" (form input) | Select | `/components/select/` |
| "dropdown" (action menu) | Dropdown menu | `/components/dropdown-menu/` |
| "toggle button group" | Segmented control | `/components/segmented-control/` |

If the component doesn't map to any of the 60 types, skip this skill.

### Step 2: Detect the project's tech stack

Before browsing the gallery, identify the project's tech stack so you can filter results to relevant implementations. Check `package.json`, framework config files, and existing component files to determine which of these gallery filter categories apply:

| Project signal | Gallery tech filter |
|---|---|
| `react`, `next`, `remix`, `gatsby` in deps | React |
| `vue`, `nuxt` in deps | Vue |
| `@angular/core` in deps | Angular |
| `svelte`, `sveltekit` in deps | Svelte |
| `.scss` files or `sass` in deps | Sass |
| `tailwindcss` in deps or `tailwind.config` | Tailwind CSS |
| CSS Modules (`.module.css` files) | CSS Modules |
| `styled-components`, `@emotion`, CSS-in-JS | CSS-in-JS |
| Web Components / custom elements | Web Components |
| Plain `.css` files, no framework | CSS |
| `.njk` / Nunjucks templates | Nunjucks |
| jQuery in deps | jQuery |
| Vanilla JS, no framework | Vanilla JS |
| `.hbs` / Handlebars templates | Handlebars |
| `.twig` templates | Twig |
| Stimulus in deps | Stimulus |
| WordPress theme/plugin structure | WordPress (not a gallery filter - use HTML/CSS/jQuery as proxies) |
| Drupal theme structure | Drupal (use Twig/CSS as proxies) |
| HubSpot modules/templates | HubSpot (use HTML/CSS/Vanilla JS as proxies) |
| React Native or native mobile | Mobile |

A project often matches multiple filters (e.g., React + Tailwind CSS + CSS Modules). Note all that apply - you'll use them to prioritize which gallery examples are most relevant.

### Step 3: Browse the component page (filtered)

Navigate to `https://component.gallery/components/<slug>/` and read the page content.

**Filtering the examples**: The gallery page has Tech and Features filter dropdowns. When reading the examples list, prioritize implementations that match the project's tech stack from Step 2. If a project uses React + Tailwind, focus on examples tagged with those technologies - their implementation patterns will be directly applicable.

**Forbidden sources**: Skip any design system example tagged with "Unmaintained" or "Accessibility issues" in the Features filter. These are explicitly excluded from research:
- **Unmaintained** systems have stale patterns that may not reflect current best practices, have known unfixed bugs, and will not receive updates. Drawing from them risks importing dead patterns.
- **Accessibility issues** systems have documented a11y problems. Using their patterns as reference defeats the purpose of the gallery research step, which is to get accessibility right.

When reading the examples list on a component page, each example card shows its tech tags and feature tags. If you see "Unmaintained" or "Accessibility issues" on an example card, do not use that implementation as a reference for markup, ARIA patterns, interaction behavior, or any other aspect of your component.

Extract from the remaining (non-forbidden, tech-relevant) examples:

1. **Semantic markup** - What HTML element should this be? The editorial content explains why (e.g., why `<button>` not `<div>`, why `<dialog>` not a custom modal).

2. **Name consensus** - What do most design systems call this? Use the most common name unless the project already has an established convention.

3. **Interaction patterns** - What states does this component need? Hover, focus, active, disabled, loading, error, empty. What keyboard shortcuts are expected? What happens on Escape, Enter, Tab, arrow keys? The gallery's cross-system view reveals which interactions are considered table stakes vs. nice-to-have.

4. **Accessibility patterns** - ARIA attributes, keyboard interactions, focus management, screen reader announcements. Focus on examples tagged with the "Accessibility" feature - these are the ones that document a11y properly.

5. **Usage guidelines** - When to use and when NOT to use this component. These are distilled from real user research across dozens of teams.

6. **Related components** - Important distinctions the gallery surfaces (e.g., Modal vs Drawer vs Popover are three different components with different use cases).

### Step 4: Inventory the project's design system

Before writing code, check what the project already provides for this component:

1. Read DESIGN.md (if it exists) for tokens: colors, typography, spacing, border radii, shadows, component-specific definitions.
2. Read PRODUCT.md (if it exists) for brand register, personality, anti-references.
3. Check for existing components in the codebase that are similar or adjacent - they establish the visual language and interaction conventions the new component should match.
4. Identify what the project's design system covers and what it doesn't for this component type.

### Step 5: Synthesize a component brief

Before writing code, produce a brief that maps gallery research onto the project's system:

```
Component: [name - gallery consensus or project convention if established]
Gallery research: [N] examples studied from component.gallery
Tech stack filter: [e.g., React, CSS Modules, Tailwind CSS]
Excluded: [N] examples skipped (Unmaintained or Accessibility issues)
Semantic element: [HTML element and key attributes]

Covered by project design system:
- [e.g., Typography: using project's --font-body and --text-sm tokens]
- [e.g., Colors: using project's --color-primary and --color-surface tokens]
- [e.g., Border radius: using project's --radius-md token]

Gaps to fill (from gallery best practices, styled with project tokens):
- [e.g., Hover state: not in DESIGN.md. Deriving from gallery patterns - subtle background shift using project's --color-surface-hover or a 4% opacity adjustment on --color-primary]
- [e.g., Focus ring: not specified. Using 2px offset ring in project's --color-focus or --color-primary]
- [e.g., Dismiss animation: not specified. Exit via opacity+translateY per gallery consensus, 150ms ease-out]
- [e.g., Keyboard: Escape to dismiss, not in project spec but universal across gallery examples]

Key a11y: [ARIA roles, keyboard interactions, focus trap if applicable]
Avoid: [anti-patterns noted in the gallery]
```

The brief makes the layering explicit: here's what the project gives us, here's what we're borrowing from industry patterns, and here's how we're styling the borrowed parts to look native.

### Step 6: Build the component

Implement with all three layers active:

- **Structure and behavior** from the gallery research (semantic markup, keyboard handling, ARIA, state management, dismiss logic)
- **Visual identity** from the project's tokens (fonts, colors, spacing, radii, shadows)
- **Gap fills** derived from gallery patterns but expressed in the project's visual language (hover states in the project's color palette, focus rings using the project's focus token, animations matching the project's motion conventions)

When filling a gap, prefer deriving from the project's existing patterns over importing a foreign aesthetic. If the project uses `scale(0.98)` for press states on buttons, use a similar scale for press states on the new component. If the project uses `box-shadow` for elevation rather than borders, follow that convention for the new component's elevation. The gallery tells you what states to implement; the project's existing components tell you how to style them.

## Checking the design systems list

When auditing, comparing, or researching design systems:

Navigate to `https://component.gallery/design-systems/` and filter by:
- **Tech stack** - React (50), Sass (22), Web Components (20), Vue (9), Angular (6), Tailwind (4)
- **Features** - Code examples (79), Open source (69), Usage guidelines (55), Accessibility (27), Tone of voice (20)
- **Platform** - GitHub (70), Figma (23), Storybook (23)

Useful for finding open-source systems to reference in the client's tech stack, identifying systems with strong accessibility documentation, or competitive analysis when a client's industry peers are in the list.

## Integration with other skills

This skill is the research and gap-analysis layer. The workflow across all three skills:

1. **component-gallery-reference** (this skill) - Research the component type. Understand function, interaction, accessibility, naming. Identify what the project's design system covers and what gaps exist.
2. **sidecoach** - Apply brand strategy. Ensure the component fits the product's register and personality.
3. **make-interfaces-feel-better** - Apply tactical polish. Concentric radii, optical alignment, animation timing, hit areas.

The gallery prevents functional gaps (missing keyboard handling, wrong semantics, inaccessible markup). Sidecoach prevents strategic gaps (off-brand, wrong register). Make-interfaces-feel-better prevents polish gaps (janky animations, misaligned icons, wrong cursor). All three layers together produce components that work correctly, look native to the project, and feel polished.
