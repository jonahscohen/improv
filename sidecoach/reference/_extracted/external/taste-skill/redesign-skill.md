---
source: https://github.com/Leonxlnx/taste-skill/blob/main/skills/redesign-skill/SKILL.md
captured: 2026-05-25
type: external-taste-skill (variant - for upgrading existing projects)
---

# taste-skill / redesign-skill (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### How This Works

When applied to an existing project, follow this sequence:

1. **Scan** - Read the codebase. Identify framework, styling method, current design patterns.
2. **Diagnose** - Run through audit. List every generic pattern, weak point, missing state.
3. **Fix** - Apply targeted upgrades working with existing stack. Do not rewrite from scratch. Improve what's there.

### Design Audit - Typography

- **Browser default fonts or Inter everywhere.** Replace with font with character: `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`. Editorial: pair serif header with sans-serif body.
- **Headlines lack presence.** Increase size for display text, tighten letter-spacing, reduce line-height.
- **Body text too wide.** Limit paragraph width to roughly 65 characters. Increase line-height.
- **Only Regular (400) and Bold (700) weights used.** Introduce Medium (500) and SemiBold (600).
- **Numbers in proportional font.** Use monospace or enable `font-variant-numeric: tabular-nums`.
- **Missing letter-spacing adjustments.** Negative tracking for large headers, positive for small caps/labels.
- **All-caps subheaders everywhere.** Try lowercase italics, sentence case, or small-caps instead.
- **Orphaned words.** Fix with `text-wrap: balance` or `text-wrap: pretty`.

### Design Audit - Color and Surfaces

- **Pure `#000000` background.** Replace with off-black (`#0a0a0a`, `#121212`, or dark navy).
- **Oversaturated accent colors.** Keep saturation below 80%.
- **More than one accent color.** Pick one. Remove the rest.
- **Mixing warm and cool grays.** Stick to one gray family.
- **Purple/blue "AI gradient" aesthetic.** Most common AI design fingerprint. Replace with neutral bases and single considered accent.
- **Generic `box-shadow`.** Tint shadows to match background hue. Use colored shadows.
- **Flat design with zero texture.** Add subtle noise, grain, or micro-patterns.
- **Perfectly even gradients.** Break uniformity with radial gradients, noise overlays, mesh gradients.
- **Inconsistent lighting direction.** Audit all shadows for single consistent light source.
- **Random dark sections in a light mode page (or vice versa).** Either commit to full dark mode or keep consistent background tone.
- **Empty, flat sections with no visual depth.** Add high-quality background imagery (blurred, overlaid, masked), subtle patterns, ambient gradients. Use `https://picsum.photos/seed/{name}/1920/1080`.

### Design Audit - Layout

- **Everything centered and symmetrical.** Break symmetry with offset margins, mixed aspect ratios.
- **Three equal card columns as feature row.** Most generic AI layout. Replace with 2-column zig-zag, asymmetric grid, horizontal scroll, masonry.
- **Using `height: 100vh` for full-screen sections.** Replace with `min-height: 100dvh` (iOS Safari viewport bug).
- **Complex flexbox percentage math.** Replace with CSS Grid.
- **No max-width container.** Add container (1200-1440px) with auto margins.
- **Cards of equal height forced by flexbox.** Allow variable heights or use masonry.
- **Uniform border-radius on everything.** Vary the radius: tighter on inner, softer on containers.
- **No overlap or depth.** Use negative margins to create layering.
- **Symmetrical vertical padding.** Adjust optically - bottom padding often slightly larger.
- **Dashboard always has a left sidebar.** Try top navigation, floating command menu, collapsible panel.
- **Missing whitespace.** Double the spacing.
- **Buttons not bottom-aligned in card groups.** Pin buttons to bottom of each card.
- **Feature lists starting at different vertical positions.** Use consistent spacing above the list.
- **Inconsistent vertical rhythm in side-by-side elements.** Align shared elements across all items.
- **Mathematical alignment that looks optically wrong.** Icons next to text, play buttons in circles need 1-2px optical adjustments.

### Design Audit - Interactivity and States

- **No hover states on buttons.** Add background shift, slight scale, translate on hover.
- **No active/pressed feedback.** Add `scale(0.98)` or `translateY(1px)` on press.
- **Instant transitions with zero duration.** Add 200-300ms.
- **Missing focus ring.** Accessibility requirement.
- **No loading states.** Replace generic circular spinners with skeleton loaders.
- **No empty states.** Design composed "getting started" view.
- **No error states.** Add inline error messages. Do NOT use `window.alert()`.
- **Dead links.** Buttons that link to `#`.
- **No indication of current page in navigation.**
- **Scroll jumping.** Add `scroll-behavior: smooth`.
- **Animations using `top`, `left`, `width`, `height`.** Switch to `transform` and `opacity`.

### Design Audit - Content (EXTENDED slop word list)

- **Generic names like "John Doe" or "Jane Smith".** Use diverse, realistic-sounding names.
- **Fake round numbers like `99.99%`, `50%`, `$100.00`.** Use organic data: `47.2%`, `$99.00`, `+1 (312) 847-1928`.
- **Placeholder company names like "Acme Corp", "Nexus", "SmartFlow".** Invent contextual, believable brand names.
- **AI copywriting cliches.** Never use **"Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve", "Tapestry", or "In the world of..."**. Write plain, specific language.
- **Exclamation marks in success messages.** Remove them. Be confident, not loud.
- **"Oops!" error messages.** Be direct: "Connection failed. Please try again."
- **Passive voice.** Use active voice.
- **All blog post dates identical.** Randomize dates.
- **Same avatar image for multiple users.** Use unique assets.
- **Lorem Ipsum.** Never use placeholder latin text.
- **Title Case On Every Header.** Use sentence case instead.

### Design Audit - Component Patterns

- **Generic card look (border + shadow + white background).** Remove the border, or use only background color, or use only spacing.
- **Always one filled button + one ghost button.** Add text links or tertiary styles.
- **Pill-shaped "New" and "Beta" badges.** Try square badges, flags, or plain text labels.
- **Accordion FAQ sections.** Use side-by-side list, searchable help, or inline progressive disclosure.
- **3-card carousel testimonials with dots.** Replace with masonry wall, embedded social posts, or single rotating quote.
- **Pricing table with 3 towers.** Highlight recommended tier with color and emphasis, not just extra height.
- **Modals for everything.** Use inline editing, slide-over panels, or expandable sections.
- **Avatar circles exclusively.** Try squircles or rounded squares.
- **Light/dark toggle always a sun/moon switch.** Use dropdown, system preference detection.
- **Footer link farm with 4 columns.** Simplify.

### Design Audit - Iconography

- **Lucide or Feather icons exclusively.** "Default" AI icon choice. Use Phosphor, Heroicons, or custom set.
- **Rocketship for "Launch", shield for "Security".** Replace cliche metaphors (bolt, fingerprint, spark, vault).
- **Inconsistent stroke widths across icons.** Audit all icons and standardize.
- **Missing favicon.**
- **Stock "diverse team" photos.** Use real team photos, candid shots, or consistent illustration style.

### Design Audit - Code Quality

- **Div soup.** Use semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`.
- **Inline styles mixed with CSS classes.**
- **Hardcoded pixel widths.** Use relative units.
- **Missing alt text on images.**
- **Arbitrary z-index values like `9999`.** Establish clean z-index scale in theme.
- **Commented-out dead code.**
- **Import hallucinations.** Check every import exists in `package.json`.
- **Missing meta tags.** Add `<title>`, `description`, `og:image`.

### Strategic Omissions (What AI Typically Forgets)

- **No legal links.** Add privacy policy and terms of service in footer.
- **No "back" navigation.** Dead ends in user flows.
- **No custom 404 page.**
- **No form validation.**
- **No "skip to content" link.** Essential for keyboard users.
- **No cookie consent.** If required by jurisdiction.

### Upgrade Techniques - Named Categories

**Typography Upgrades:**
- Variable font animation
- Outlined-to-fill transitions
- Text mask reveals

**Layout Upgrades:**
- Broken grid / asymmetry
- Whitespace maximization
- Parallax card stacks
- Split-screen scroll

**Motion Upgrades:**
- Smooth scroll with inertia
- Staggered entry
- Spring physics
- Scroll-driven reveals

**Surface Upgrades:**
- True glassmorphism (1px inner border + subtle inner shadow)
- Spotlight borders
- Grain and noise overlays
- Colored, tinted shadows

### Fix Priority (apply in this order)

1. **Font swap** - biggest instant improvement, lowest risk
2. **Color palette cleanup** - remove clashing or oversaturated colors
3. **Hover and active states** - makes interface feel alive
4. **Layout and spacing** - proper grid, max-width, consistent padding
5. **Replace generic components** - swap cliche patterns for modern alternatives
6. **Add loading, empty, and error states** - makes it feel finished
7. **Polish typography scale and spacing** - the premium final touch

### Rules

- Work with existing tech stack. Do not migrate frameworks.
- Do not break existing functionality. Test after every change.
- Before importing any new library, check dependency file first.
- If Tailwind, check version (v3 vs v4) before modifying config.
- Small, targeted improvements over big rewrites.

---

## SECTION 2: EXTENSION

### "Strategic Omissions" - a checklist sidecoach doesn't have

The 6-item omissions list (legal links / back nav / 404 / form validation / skip-to-content / cookie consent) is the most underrated section of this skill. These are the things that mark a build as "shipped product" vs "demo". Sidecoach has no equivalent "what is AI typically forgetting" gate.

Extended list of strategic omissions to layer onto sidecoach:
- Loading state on FORM SUBMIT (not just initial load)
- Disabled state on submit button after click (prevent double-submit)
- Keyboard shortcut hints on hoverable elements (`Cmd+K` hint on search bar)
- Browser tab title that reflects current page (not just app name)
- Favicon AND favicon-dark for dark-mode tab bars
- Open Graph image for social shares
- Print stylesheet (or `@media print { ... }`) for forms users need to save
- A 503/maintenance page (not just 404)
- Empty search results state (different from initial empty state)
- Offline-state notification banner

### The 7-step Fix Priority - WHY this order

The order is engineered to maximize visual impact per risk unit:

1. **Font swap** is one CSS variable change. Visual impact is enormous (the page feels like a different product). Risk is near-zero.
2. **Color cleanup** is class-name edits. Visual impact is high. Risk is low if you're removing colors, not adding.
3. **Hover/active states** add to existing buttons - additive, doesn't change layout.
4. **Layout and spacing** is structural - higher risk because containers shift.
5. **Replace generic components** can break interaction patterns - moderate risk.
6. **Add loading/empty/error states** is new code paths - moderate risk if testing is thin.
7. **Typography scale polish** is last because earlier steps may have changed your sense of what "right" looks like.

Sidecoach has no codified upgrade-order priority. This 7-step priority is portable wisdom.

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

The redesign-skill is the AUDIT/UPGRADE flow that Oracle's `/audit` doesn't have at this level of specificity:

1. **The 6-category audit checklist** (Typography, Color/Surfaces, Layout, Interactivity, Content, Components, Iconography, Code Quality). Sidecoach's `/audit` runs 5-dimension technical scan (a11y, performance, theming, responsive, anti-patterns). This redesign-skill audit is DESIGN-aesthetic-focused, not technical-quality-focused. Complementary, not duplicative.

2. **The 7-step Fix Priority order** - a sequenced playbook for upgrading an existing codebase.

3. **The "Strategic Omissions" list** - what AI typically forgets.

4. **Specific named anti-patterns within each category** ("Buttons not bottom-aligned in card groups", "Mathematical alignment that looks optically wrong"). These are POLISH-level diagnostic items, not just principles.

5. **The "work with existing stack, don't rewrite" discipline.** Sidecoach flows assume greenfield. This skill is explicit about retrofit.
