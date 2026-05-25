---
source: https://github.com/bergside/typeui/blob/main/skills/fundamentals/typography-principles.md
author: typeui.sh
captured: 2026-05-25
type: external-taste-skill
license: MIT
note: em-dashes in source replaced with hyphens or commas (project rule)
---

# TypeUI - Typography Principles (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### How agents must use this document

1. Treat each pillar as a lens. Before generating or reviewing typography, scan all six pillars and identify which apply. Most surfaces touch at least four (foundations, hierarchy, readability, accessibility).
2. Foundations first. Decide typeface(s), family count (1-2, NEVER 3+), and weights BEFORE writing any styles.
3. Build the scale once. Pick a modular ratio (`1.125`, `1.2`, `1.25`, `1.333`, `1.414`, `1.5`, `1.618`) and derive every size from the body base. Never set sizes "by eye."
4. Validate readability before aesthetics. Test at 16px, 14px, and zoomed-in 200%.
5. Bake accessibility in from the first line of CSS.
6. Design for the smallest screen first.
7. Justify every deviation.
8. Font choice is yours; the rules are universal.

### PILLAR 1: Type System Foundations

#### Vocabulary (must use precisely)

| Term | Definition |
|---|---|
| **Typeface** (font family) | The named design that defines the shared visual style. Composed of multiple fonts. |
| **Font** | A specific weight/style instance within a typeface. |
| **Weight** | Stroke thickness expressed numerically (100-900) or by name (Thin, Regular, Medium, Bold, Black). |
| **Style** | Upright (Roman) vs. Italic vs. Oblique. |
| **x-height** | Height of the lowercase `x`. High x-height = better at small UI sizes; low x-height = often suits long-form display. |
| **Cap height** | Height of uppercase letters from the baseline. |
| **Ascender / Descender** | Strokes that rise above x-height (`h`, `b`) or descend below baseline (`g`, `p`). |
| **Counter** | The enclosed/open negative space inside a letter (`o`, `d`). Open counters improve legibility at small sizes. |
| **Tracking (letter-spacing)** | Uniform spacing across a run. Tighten for headlines, loosen for ALL CAPS labels. |
| **Kerning** | Adjustment between specific letter PAIRS. Mostly handled by the font. |
| **Leading (line-height)** | Vertical space between baselines. |
| **Measure (line length)** | Number of characters per line. Single biggest readability lever after font size. |

#### Choosing typefaces

- Default to system fonts for performance and platform familiarity.
- Sans-serif for body on screen (high x-height + open counters outperform serifs at body sizes).
- Serif for editorial display.
- Monospace for code and tabular numerals (also: `font-variant-numeric: tabular-nums` for data tables in any typeface).
- Avoid script/decorative for anything beyond a single logotype or hero word. They collapse below ~24px.

#### Selection process (in this order)

1. Scope the deliverable (web app, marketing site, native app, email, print). Audience? Competitors?
2. State the tone in one sentence (e.g. "professional and approachable", "playful and energetic", "authoritative and editorial").
3. Shortlist 3-5 candidates fitting tone AND category constraints. For most UI work: high-x-height humanist sans-serifs.
4. Test each with real, representative content at actual shipping sizes. Lorem ipsum hides legibility problems.
5. Test each with brand colors on both light and dark backgrounds.
6. **Test the ambiguous-character set:** `Il1 O0 rn/m a/o cl/d`. Winner differentiates these clearly at body size with no squinting.
7. Confirm glyph coverage for every script you ship.
8. Ship variable-font version if it exists; 2-4 static weights only if it doesn't.

#### Pairing rules

- One family is always safe. Regular/Medium/Semibold/Bold covers 95%.
- If you pair, pair ACROSS classification. One sans + one serif. Two visually similar sans-serifs create dissonance, not contrast.
- Match x-heights when pairing for body + headline.
- NEVER exceed three families on a single product (typically: brand display, UI sans, code mono).
- Test the pair on a real layout.

#### Weight discipline

- Ship 2-4 weights per family. Typical ramp: Regular (400), Medium (500), Semibold (600), Bold (700).
- Body copy lives at 400 or 500. Reserve 600+ for headings, emphasis, key labels.
- Avoid Thin (100) and Light (200/300) below 18px (strokes thin out, contrast drops below WCAG).
- Avoid Black (900) at any UI size below 24px (counters fill in).
- Prefer variable fonts when available.

#### Loading and performance

- Subset fonts to glyphs you use (Latin-1, Latin Extended).
- Use `font-display: swap` so text renders immediately. FOUT beats invisible text.
- Preload critical face (headline + body Regular) with `<link rel="preload" as="font" crossorigin>`.
- Match fallback metrics with `size-adjust`, `ascent-override`, `descent-override` on `@font-face` to eliminate CLS.

#### Agent rules - foundations

- DO default to a system font stack unless brief requires custom face.
- DO keep family count to 1, push to 2 only with justification, never reach 3+.
- DO declare 2-4 weights per family and stick to them.
- DO subset, preload, and use `font-display: swap`.
- DO use variable fonts when available.
- DO NOT introduce a new typeface mid-project to "spice up" a section.
- DO NOT ship Thin/Light weights below 18px or Black below 24px.
- DO NOT rely on Comic Sans, Papyrus, or any decorative face for system text.

### PILLAR 2: Hierarchy & Scale

#### The modular scale - ratio enumeration

Pick ONE ratio. Derive every size from a single base.

| Ratio | Use case |
|---|---|
| **1.125** (Major Second) | Dense data UIs, dashboards, admin panels - subtle steps preserve density. |
| **1.2** (Minor Third) | General product UI; the safe default. |
| **1.25** (Major Third) | Marketing sites with moderate hierarchy contrast. |
| **1.333** (Perfect Fourth) | Bold marketing/landing pages. |
| **1.414** (Augmented Fourth, sqrt(2)) | Print-influenced editorial. |
| **1.5** (Perfect Fifth) | High-contrast hero typography. |
| **1.618** (Golden Ratio) | Editorial / brand-led pages where headline must dominate. |

**Example with base 16px and ratio 1.25:**

| Step | Size | Use |
|---|---|---|
| -2 | 10.24px -> round to 11-12px | Captions, micro-labels (use sparingly) |
| -1 | 12.8px -> 13px | Small text, helper text |
| 0  | 16px | **Body** |
| +1 | 20px | Lead paragraph, large body |
| +2 | 25px | h4 |
| +3 | 31.25px | h3 |
| +4 | 39.06px | h2 |
| +5 | 48.83px | h1 |

#### Hierarchy beyond size

| Lever | When to use |
|---|---|
| **Weight** | Cheapest signal - Bold headings vs. Regular body. |
| **Color** | Primary heading dark; secondary copy mid-tone; tertiary muted. Reinforce, never replace, size. |
| **Letter-spacing / Case** | Tight tracking for large headings (`-0.02em`); positive tracking for ALL CAPS section labels (`0.08-0.15em`). |
| **Family** | Serif headline + sans body provides hierarchy through contrast. |
| **Position** | Centered hero vs. left-aligned body signals different roles. |

#### The four-level rule

- Limit any single surface to 3-4 hierarchy levels. Beyond that the hierarchy collapses.
- One element dominates per surface.
- Squint test. Reduce to ~25% size or blur. Primary element should still be the first thing the eye finds.

#### Heading semantics

- One `<h1>` per page.
- NEVER skip levels (`<h2>` -> `<h4>`).
- `<h1>`-`<h6>` should match the visual hierarchy.

#### Heading size != heading level (anti-inflation rule)

Common failure: agents conflate semantic level (`<h1>`-`<h6>`) with visual size. Result: footer column titles set as `<h2>` at 32px, card titles at 28px competing with page hero, FAQ questions rendered as display headlines.

**The principle:** semantic level is set by the DOCUMENT OUTLINE; visual size is set by the ROLE of the heading on its surface. The two are independent decisions.

#### Visual size by role (CRITICAL TABLE)

| Role | Typical level | Typical size (web) | Why this size |
|---|---|---|---|
| **Page hero / first impression** | `<h1>` | Largest in the scale (clamp ~36-72px) | One dominant element per page. |
| **Major section opener** | `<h2>` | Second-largest (clamp ~28-44px) | Anchors a section so users can scan the page outline. |
| **Sub-section opener** | `<h3>` | Third-largest (~22-32px) | Used only when an `<h2>` section has clearly distinct sub-topics. |
| **Card / tile title** | `<h3>` or `<h4>` | **16-20px** (often body size or one step above) | A card is one of many siblings - title competes inside the card, not with the page. |
| **Modal / dialog title** | `<h2>` (within the dialog) | 18-24px | Anchors the dialog; never larger than the page hero behind it. |
| **Accordion / FAQ question** | `<h3>` | **16-18px** | Repeats many times - must stay scannable, not shouty. |
| **Footer column title** | `<h3>` or `<h4>` | **14-16px**, often uppercase with `letter-spacing: 0.06em+` | Functions as a list label, not a banner. |
| **Sidebar / nav group label** | `<h3>` or `<h4>` | **14-16px**, uppercase with tracking | A navigation cue, not a content opener. |
| **List-group label inline in body** | `<h4>` or `<h5>` | Body size or one step below | Quietly groups related items. |

#### The two questions before sizing any heading

1. What is its level in the document outline? -> Determines the HTML tag.
2. What is its visual role on the surface? -> Determines the CSS class and `font-size`.

#### Specific rules

- Display-scale sizes (>= 30px) belong only to the page hero `<h1>` and the opening heading of a major page section (`<h2>`).
- Card/tile titles never exceed ~20px unless the card IS the hero.
- Card/tile titles and footer column titles must use `<h4>` or lower, NEVER `<h2>` or `<h3>`.
- Footer column titles, sidebar group labels, nav group labels must be small (typically 13-16px, frequently uppercase with letter-spacing).
- FAQ/accordion questions stay close to body size (16-18px).
- Modal/dialog titles 18-24px.
- Stat/metric numerals are NOT headings. A "99.99%" uptime is a display NUMBER, not an `<h2>`. Use a `<p>` with display-scale size.
- Define heading roles as named CSS classes (`.heading-display`, `.heading-section`, `.heading-sub`, `.heading-card`, `.heading-label`).

#### Quick decision tree

```
Is this heading the FIRST IMPRESSION of the page?
- YES -> <h1>, display-scale (36-72px clamp), unique on the page.
- NO  -> Is it the OPENER of a major page section?
        - YES -> <h2>, large (28-44px clamp), one per major section.
        - NO  -> Is it a SUB-section of an <h2> (NOT inside a repeating component)?
                - YES -> <h3>, medium (~22-32px).
                - NO  -> Is it INSIDE a repeating component (card, pricing tier, footer column, sidebar, FAQ)?
                        - YES -> <h4> or <h5>, small (14-20px), uppercase + tracking for labels. NEVER <h2> or <h3>.
                        - NO  -> Probably not a heading. Use <p> with the right class.
```

### PILLAR 3: Readability & Legibility

#### The distinction

- **Legibility** = can the user RECOGNIZE individual characters? (typeface design, x-height, counter shape, weight)
- **Readability** = can the user COMFORTABLY READ extended passages? (size, line-height, line length, contrast, language clarity)

#### Readability triad: size / line-height / measure

##### Size

| Context | Recommended | Floor |
|---|---|---|
| **Web body** | 16-18px (1rem-1.125rem) | 14px (legitimate microcopy only) |
| **Mobile native body** | iOS 17pt, Android 16sp | Don't go below |
| **Form labels & UI controls** | 14-16px | 12px never on interactive labels |
| **Headlines (h1)** | 32-72px depending on hero treatment | - |
| **Captions, footnotes** | 12-13px | 11px is absolute floor |

##### Line-height (CRITICAL TABLE)

| Context | Recommended |
|---|---|
| **Body copy** | 1.4-1.6 (sweet spot is 1.5-1.6 for long-form) |
| **Headings** | 1.05-1.25 (tighter as size increases) |
| **UI labels and buttons** | 1.0-1.2 |
| **Multi-line captions** | 1.4 |

Larger type wants TIGHTER leading; smaller type wants LOOSER leading.

##### Measure (line length)

- Desktop body: 45-75 characters per line (CSS: `max-width: 65ch`).
- Mobile body: 30-45 characters acceptable.
- Lines longer than 90 characters: eye must "find" next line. Reading speed drops sharply.
- Lines shorter than ~30 characters: too many breaks per paragraph, disrupts rhythm.

#### Spacing micro-rules

- Tracking on body: leave alone. Font designer set it correctly.
- Tracking on display headlines: tighten slightly (`-0.01em` to `-0.03em`).
- Tracking on ALL CAPS labels: open it (`0.05em` to `0.15em`).
- Paragraph spacing: prefer space BETWEEN paragraphs (margin-bottom ~ 1em) over indented first lines on screen.
- No double spaces after a period. Ever.

#### What hurts readability

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| ALL CAPS body paragraphs | Strips ascender/descender shape cues; ~13% scannability drop. | Reserve caps for short labels (<=2 words). |
| Justified text without hyphenation | Creates "rivers" of white space. | Left-align for screen, or enable `hyphens: auto`. |
| Italic body paragraphs | Slower to read for most users. | Use italic for emphasis, titles of works, foreign terms. |
| Centered multi-line paragraphs | Each line starts at a different position. | Center only headlines and 1-2 line callouts. |
| Pure black on pure white at full brightness | High contrast can cause eye strain. | Use near-black (#1A1A1A) on near-white (#FAFAFA). |
| Decorative scripts at small size | Counters fill in, strokes blur. | Scripts only >=24px and only for logos/hero. |
| Underlining non-link text | Trains users that anything underlined is a link. | Use bold or color for emphasis; reserve underline for links. |
| Thin/Light weight on thin background contrast | Drops below 4.5:1. | Use Regular weight or darker color. |

#### Long-form vs. UI text

- Long-form (articles, docs): 18-20px body, 1.6 line-height, 65ch measure, generous paragraph spacing.
- UI (forms, lists, dashboards): 14-16px body, 1.4 line-height, density-driven measure.
- Tables of numbers: enable `font-variant-numeric: tabular-nums`. Right-align numeric columns; left-align text columns.

#### Letter case (5 styles)

| Case | Pattern | Use for | Avoid for |
|---|---|---|---|
| **Sentence case** | First word capitalized, rest lowercase | Body paragraphs, button labels, form labels - almost everything. The default. | - |
| **Title Case** | All Major Words Capitalized (Articles, Short Prepositions, Conjunctions Stay Lowercase) | Editorial headlines, page titles, navigation items, section headings in formal contexts. | Body text. Mid-sentence labels. |
| **ALL CAPS** | EVERY LETTER UPPERCASE | Short emphasis labels (<=2 words), category tags, eyebrow labels, wordmarks. | Body text (~13% scannability drop). Long button labels. Conversational/chat UI (reads as yelling). |
| **Small caps** | Capital letterforms drawn at x-height | Distinguishing acronyms, abbreviations, running heads from body. | Body text in any typeface that lacks proper small-cap glyphs (faux small caps look bad). |
| **all lowercase** | Every letter lowercase | Stylistic wordmarks, intentionally informal brand voice. | Anything users read for information. |

#### Case rules

- Default to sentence case for buttons, links, form labels, microcopy.
- Always increase tracking on ALL CAPS by `0.05em` to `0.15em`.
- Avoid ALL CAPS in conversational interfaces (reads as yelling).
- Use real small-cap glyphs only (`font-variant-caps: small-caps` works only when font ships small caps).
- NEVER set entire paragraph in ALL CAPS even for emphasis.
- Avoid Title Case in conversational UI.

#### Widows / orphans / "danglies"

- **Widow**: single word or very short line stranded at end of paragraph/headline.
- **Orphan**: first line of paragraph stranded alone at bottom of column/page.
- Some teams prefer "danglies" to avoid the loaded language.

**Fix on the web:**
- `text-wrap: balance` on HEADINGS and short paragraphs.
- `text-wrap: pretty` on LONGER paragraphs (where supported).
- Non-breaking space (`&nbsp;`) before last word of headline.
- Adjust container width by a few characters.

#### The rag

- Good rag: gently uneven, no dramatic jumps.
- Bad rag: lines vary wildly, zigzag visual noise.
- Adjust container width or `letter-spacing` slightly.
- Hyphenation (`hyphens: auto`) tames the rag.

#### Line length under pressure

- Body line length under ~30 chars loses rhythm; over ~75 loses eye between line returns.
- Wide column: INCREASE line-height (1.7-1.8) to compensate.
- Narrow column: REDUCE line-height slightly (toward 1.4).

#### Justification (4 options)

- **Left-aligned** - default for body on screen.
- **Right-aligned** - tabular numerics or text paired with strong vertical anchor on right.
- **Centered** - only for <=2-line callouts, headlines, quotes.
- **Fully justified** - only with `hyphens: auto` enabled.

### PILLAR 4: Accessibility

#### WCAG 2.2 contrast minimums

| Text type | Minimum contrast |
|---|---|
| **Body text** (< 18pt regular, < 14pt bold) | **4.5 : 1** against background |
| **Large text** (>= 18pt regular / 24px, or >= 14pt bold / 18.5px bold) | **3 : 1** |
| **UI components & graphical objects** (focus rings, icons) | **3 : 1** |
| **AAA target body** | 7 : 1 (aspirational; required for some regulated contexts) |

- Test contrast on actual background, including images and gradients.
- Text over images: scrim/overlay or text-shadow to guarantee contrast at worst-case pixel.
- Disabled text exempt from contrast rules but must still be perceivable as disabled.

#### Resizing and Dynamic Type

- Users must be able to resize text up to 200% (WCAG 1.4.4).
- Use `rem`/`em` units for font-size.
- Native: use platform's dynamic/scaled text system.
- Web: support `prefers-reduced-motion` for animated copy.

#### Cognitive and visual accessibility

- Accessibility-tuned typefaces measurably improve comprehension.
- Open counters and clear letter differentiation (`I` vs `l` vs `1`, `O` vs `0`, `rn` vs `m`) reduce reading errors.
- Avoid decorative italics for body (many dyslexic users find them harder).
- Provide maximum line length cap even on wide screens.

#### Color & dark mode

- Test contrast in BOTH light and dark themes.
- Don't rely on color alone (pair with icon, text label, weight change).
- Pure white on pure black can cause "halation" (text appears to vibrate). Prefer near-white on near-black.

#### Localization & RTL

- Test with longest expected translation. German ~30% longer than English.
- RTL: use logical CSS properties (`margin-inline-start` over `margin-left`, `text-align: start` over `text-align: left`).
- Diacritics require slightly more line-height (1.5+ leading for accented Latin and CJK).
- CJK and Arabic require different font stacks.

### PILLAR 5: Responsive & Cross-Platform Typography

#### Fluid typography with clamp()

```css
/* min 36px, fluid 5vw, max 72px */
h1 { font-size: clamp(2.25rem, 5vw, 4.5rem); }
h2 { font-size: clamp(1.875rem, 4vw, 2.75rem); }
h3 { font-size: clamp(1.375rem, 3vw, 1.75rem); }
p  { font-size: clamp(1rem, 0.95vw + 0.85rem, 1.125rem); }
```

- Min value = smallest acceptable size (mobile floor, never below accessibility floor).
- Preferred value = viewport-relative expression.
- Max value = cap so text doesn't grow grotesquely on ultra-wide.

#### Breakpoint-based scale (when clamp isn't enough)

```css
:root { --type-ratio: 1.25; }
@media (min-width: 1024px) { :root { --type-ratio: 1.5; } }
```

#### Platform conventions

| Platform category | Typical body size | Notes |
|---|---|---|
| **Phone / tablet** | 16-17pt | Use platform's dynamic/scaled text system. |
| **Desktop** | 13-16pt | Smaller due to greater viewing distance and higher input precision. |
| **Watch / small wearable** | 16pt | Compact widths. |
| **TV / large screen** | 29pt+ | Much larger because TVs viewed from across the room. |
| **Spatial / AR-VR** | Varies | Sized for perceived distance. |
| **Web** | 16px body | `clamp()` for fluid scaling. |

Key insight: text size is about the user's DISTANCE from the screen, not just pixels.

#### Container queries for component-level type

```css
.card { container-type: inline-size; }
.card h3 { font-size: 1.25rem; }
@container (min-width: 480px) {
  .card h3 { font-size: 1.5rem; }
}
```

### PILLAR 6: Brand & Emotional Tone

#### Type carries voice (by classification)

- **Trust** - old-style and transitional serifs signal heritage; neo-grotesque sans-serifs signal precision.
- **Energy** - geometric display faces with wide, bold letterforms.
- **Approachability** - humanist sans-serifs with open counters and rounded terminals.
- **Playfulness** - rounded sans-serifs and soft geometric faces with circular shapes.
- **Authority / editorial** - high-contrast (Didone) serifs for fashion; transitional serifs for news and publishing.
- **Tech / utility** - any monospaced family.

#### Brand pairing patterns (CRITICAL TABLE)

| Pattern | Pairing | Tone |
|---|---|---|
| **Editorial** | Display serif headline + sans body | Magazine, news, long-form blog. |
| **Modern minimal** | Single humanist sans, weight-driven hierarchy | Product UI, SaaS, B2B. |
| **Heritage / luxury** | Old-style serif everywhere | Watch brands, hotels, fashion. |
| **Tech / dev** | Geometric sans + monospace | Developer tools, infra. |
| **Friendly consumer** | Rounded sans + handwritten accent | Wellness, kids, lifestyle. |

#### Don't fight your audience

- B2B users want efficiency. Clean sans, conservative scale, dense layouts.
- Long-form readers want comfort. Serif or high-x-height sans, generous leading, ~65ch measure.
- Discovery-driven users (e-commerce, media) want hierarchy and personality.

#### Animated copy

- Use sparingly.
- Respect `prefers-reduced-motion`. Static end-state.
- Don't animate body copy.
- Type-on transitions should not exceed ~600ms.

### Conflict Resolution Priority

1. **Accessibility** - non-negotiable.
2. **Readability** - if users can't read it, the message fails.
3. **Hierarchy / scannability** - users must find what they need.
4. **Performance** - large web-font payloads hurt LCP.
5. **Brand expression** - important, but never at the cost of the four above.
6. **Aesthetic preference** - last; "I like how it looks" is not a reason to ship.

---

## SECTION 2: EXTENSION (added specificity, examples, WHY)

### Modular ratio - which to pick by product type (concrete examples)

The seven ratios are abstract until you ground them in real products. Concrete mapping:

- **1.125 (Major Second)**: Linear, Notion sidebar, Stripe Dashboard, Figma. Anywhere density is sacred and step-up between sizes must be near-invisible. Use when 12, 13, 14, 16, 18, 20px all coexist on one screen without competing.
- **1.2 (Minor Third)**: Vercel dashboard, Shopify admin, GitHub repo view. "Safe default for general product UI" means: when you don't know, pick this. Body 16, h4 19, h3 23, h2 28, h1 33 - hierarchy that's perceptible but never shouty.
- **1.25 (Major Third)**: Most marketing sites with moderate hierarchy. Apple's product pages historically. Body 16, h1 ~49. Hero is 3x body - feels substantial but not theatrical.
- **1.333 (Perfect Fourth)**: Stripe.com homepage, Linear.app landing. Bold marketing. Body 16, h1 ~64. Hero dominates without overwhelming. Use when you want "confident, modern startup".
- **1.414 (Augmented Fourth, sqrt(2))**: A4 paper ratio. Print-influenced editorial - long-form magazine layouts, design publications. Rare in pure software.
- **1.5 (Perfect Fifth)**: Modern editorial sites (The New York Times feature pages). Body 16, h1 ~81. "High-contrast hero" - the headline becomes the page.
- **1.618 (Golden Ratio)**: Awwwards-style editorial portfolios. Body 16, h1 ~111. Use only when the headline IS the experience.

### Card title sizing - the most common failure

The single most common typography mistake LLMs make: rendering card titles at `<h2>` 32px because "it's the title of the card." The TypeUI rule says cards titles cap at 20px and use `<h4>`. Concrete examples:

- Stripe pricing cards: tier name "Standard" at ~18px, NOT 28px.
- Linear feature cards: card title at 17px Medium, body at 15px Regular.
- Notion gallery card: title at 14px Bold, NOT 24px.
- The exception is the "single featured card" pattern (Webflow homepage hero card) where the card IS the page hero.

### Line-height by font size - the inverse relationship

TypeUI gives the headline table (body 1.4-1.6, headings 1.05-1.25, UI labels 1.0-1.2). The mechanism:

- At small sizes, vertical eye motion between lines is proportionally large compared to character height. Loose leading (1.5) prevents the eye from doubling back.
- At large sizes (>32px), the character itself fills more vertical space. Loose leading (1.5) would create vertical canyons. Tight leading (1.05-1.1) keeps the headline as a single visual block.
- The transition is gradual: 16px wants 1.5, 24px wants 1.35, 32px wants 1.2, 48px wants 1.1, 72px wants 1.05.

Hand-computed formula approximation: `line-height = 1.6 - (font-size-px / 100)`. Diverges below 12px and above 80px but useful as a sanity check in the 14-64px range.

### clamp() formulas - the math behind them

TypeUI gives `clamp(2.25rem, 5vw, 4.5rem)` for h1 without explaining the middle term. The mechanics:

- `2.25rem` = 36px mobile floor.
- `5vw` = 5% of viewport width. At 1440px viewport that's 72px. At 320px that's 16px (below the min - clamp kicks min in).
- `4.5rem` = 72px desktop ceiling.

The crossover: when does `5vw` exceed the minimum? `36px / 0.05 = 720px viewport`. So below 720px, text is locked at 36px; above 720px it scales linearly with viewport; above 1440px it locks at 72px.

For better mobile/desktop balance, use a two-term preferred value: `clamp(2.25rem, 0.875rem + 5vw, 4.5rem)` - this adds a fixed offset so the curve "starts higher" at small viewports without locking. Body text version: `clamp(1rem, 0.95vw + 0.85rem, 1.125rem)`.

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

**make-interfaces-feel-better has tabular-nums and balanced text wrap as 2 of its 14 rules.** TypeUI's typography-principles.md is 638 lines of complete typography theory.

**Specific gap-fills TypeUI provides:**

1. **The enumerated modular ratio list (7 named ratios with use cases).** Sidecoach typography handler references "modular scale" abstractly. TypeUI names them and gives each a product-category use case.

2. **The line-height-by-size-tier table.** Sidecoach has no codified line-height ramp. TypeUI provides body 1.4-1.6, headings 1.05-1.25, UI labels 1.0-1.2, multi-line captions 1.4.

3. **The heading-size-by-role table (10 roles).** This is the SOURCE of the "card title sizing" anti-inflation rule. Make-interfaces-feel-better doesn't have this; Impeccable's `/typeset` command doesn't have it; this is the missing structural layer.

4. **The 5-letter-case vocabulary with use-for/avoid-for.** "Avoid Title Case" is a common piece of taste advice; TypeUI makes it concrete by enumerating Sentence/Title/ALL CAPS/small caps/all lowercase and the role of each.

5. **The ambiguous-character set test (`Il1 O0 rn/m a/o cl/d`).** A specific, copyable typeface evaluation gate that fontshare-reference doesn't include.

6. **The widows/orphans/danglies vocabulary and the `text-wrap: balance` vs `text-wrap: pretty` distinction.** Make-interfaces-feel-better mentions `text-wrap: balance` for headings; TypeUI adds `pretty` for long paragraphs and the `&nbsp;` fallback.

7. **Heading-tag vs heading-size as INDEPENDENT decisions.** The conceptual breakthrough: `<h2>` doesn't mean "32px", it means "second level in document outline". The size depends on role on the surface. Footer column titles are `<h4>` 14px even though they're "the title of the section".

8. **Pillar 4 Accessibility - the WCAG 2.2 contrast ratios in a single table** (4.5:1 body, 3:1 large/UI, 7:1 AAA). Sidecoach a11y handler has this somewhere; TypeUI puts it in a clean, copyable matrix.

9. **The fluid typography clamp formula syntax** with the three components labeled (min/preferred/max).

10. **The font-pairing 5-pattern table** (Editorial, Modern minimal, Heritage/luxury, Tech/dev, Friendly consumer). Fontshare-reference covers individual typeface vibes; TypeUI codifies the COMBINATION patterns by use case.

11. **The Conflict Resolution Priority hierarchy** (Accessibility > Readability > Hierarchy > Performance > Brand > Aesthetic). Resolves debates that would otherwise be vibes-based.

12. **The "no double space after period. Ever." micro-rule** and other minute typography hygiene that polish reviews routinely miss.
