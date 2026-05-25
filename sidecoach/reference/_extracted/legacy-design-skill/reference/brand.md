# Impeccable brand.md (extracted)

Note: long dashes in source replaced with regular hyphens per repo policy. Semantic content preserved.

## VERBATIM LIFT

# Brand register

When design IS the product: brand sites, landing pages, marketing surfaces, campaign pages, portfolios, long-form content, about pages. The deliverable is the design itself; a visitor's impression is the thing being made.

The register spans every genre. A tech brand (Stripe, Linear, Vercel). A luxury brand (a hotel, a fashion house). A consumer product (a restaurant, a travel site, a CPG packaging page). A creative studio, an agency portfolio, a band's album page. They all share the stance (*communicate, not transact*) and diverge wildly in aesthetic. Don't collapse them into a single look.

## The brand slop test

If someone could look at this and say "AI made that" without hesitation, it's failed. The bar is distinctiveness; a visitor should ask "how was this made?", not "which AI made this?"

Brand isn't a neutral register. AI-generated landing pages have flooded the internet, and average is no longer findable. Restraint without intent now reads as mediocre, not refined. Brand surfaces need a POV, a specific audience, a willingness to risk strangeness. Go big or go home.

**The second slop test: aesthetic lane.** Before committing to moves, name the reference. A Klim-style specimen page is one lane; Stripe-minimal is another; Liquid-Death-acid-maximalism is another. Don't drift into editorial-magazine aesthetics on a brief that isn't editorial. A hiking brand with Cormorant italic drop caps has the wrong register within the register.

Then the inverse test: in one sentence, describe what you're about to build the way a competitor would describe theirs. If that sentence fits the modal landing page in the category, restart.

## Typography

### Font selection procedure

Every project. Never skip.

1. Read the brief. Write three concrete brand-voice words. Not "modern" or "elegant," but "warm and mechanical and opinionated" or "calm and clinical and careful." Physical-object words.
2. List the three fonts you'd reach for by reflex. If any appear in the reflex-reject list below, reject them; they are training-data defaults and they create monoculture.
3. Browse a real catalog (Google Fonts, Pangram Pangram, Future Fonts, Adobe Fonts, ABC Dinamo, Klim, Velvetyne) with the three words in mind. Find the font for the brand as a *physical object*: a museum caption, a 1970s terminal manual, a fabric label, a cheap-newsprint children's book, a concert poster, a receipt from a mid-century diner. Reject the first thing that "looks designy."
4. Cross-check. "Elegant" is not necessarily serif. "Technical" is not necessarily sans. "Warm" is not Fraunces. If the final pick lines up with the original reflex, start over.

### Reflex-reject list

Training-data defaults. Ban list. Look further:

Fraunces · Newsreader · Lora · Crimson · Crimson Pro · Crimson Text · Playfair Display · Cormorant · Cormorant Garamond · Syne · IBM Plex Mono · IBM Plex Sans · IBM Plex Serif · Space Mono · Space Grotesk · Inter · DM Sans · DM Serif Display · DM Serif Text · Outfit · Plus Jakarta Sans · Instrument Sans · Instrument Serif

### Reflex-reject aesthetic lanes

Parallel to the font list. Currently saturated aesthetic families that have flooded brand surfaces. If a brief lands in one of these lanes without a register reason that *requires* it (a literal magazine, a literal terminal, a literal industrial signage system), it's the second-order training reflex: the trap one tier deeper than picking a Fraunces font. Look further.

- **Editorial-typographic.** Display serif (often italic) + small mono labels + ruled separators + monochromatic restraint. Klim-influenced, magazine-cover affectation. By 2026, every Stripe-adjacent and Notion-adjacent brand has landed here. The fingerprint: three rule-separated columns, an italic Fraunces / Recoleta / Newsreader headline, lowercase track-spaced metadata, no imagery.

(More entries land here on the same cadence the font list updates. Brutalist-utility and acid-maximalism may join when they saturate. Removing entries when they fall back below saturation is also fine.)

The reflex-reject lists apply to **new design choices**. When the existing brand has already committed to a font or a lane as part of its identity, identity-preservation wins; variants on an existing surface don't second-guess what's already shipping. The reflex-reject lists are for greenfield decisions and for departure-mode variants in [live.md](live.md).

### Pairing and voice

Distinctive + refined is the goal. The specific shape depends on the brand:

- **Editorial / long-form / luxury**: display serif + sans body (a magazine shape).
- **Tech / dev tools / fintech**: one committed sans, usually; custom-tight tracking, strong weight contrast inside a single family.
- **Consumer / food / travel**: warmer pairings, often a humanist sans plus a script or display serif.
- **Creative studios / agencies**: rule-breaking welcome. Mono-only, or display-only, or custom-drawn type as voice.

Two families minimum is the rule *only* when the voice needs it. A single well-chosen family with committed weight/size contrast is stronger than a timid display+body pair.

Vary across projects. If the last brief was a serif-display landing page, this one isn't.

### Scale

Modular scale, fluid `clamp()` for headings, ratio of at least 1.25 between steps. Flat scales (1.1x apart) read as uncommitted.

Light text on dark backgrounds: add 0.05 to 0.1 to line-height. Light type reads as lighter weight and needs more breathing room.

## Color

Brand surfaces have permission for Committed, Full palette, and Drenched strategies. Use them. A single saturated color spread across a hero is not excess; it's voice. A beige-and-muted-slate landing page ignores the register.

- Name a real reference before picking a strategy. "Klim Type Foundry #ff4500 orange drench", "Stripe purple-on-white restraint", "Liquid Death acid-green full palette", "Mailchimp yellow full palette", "Conde Nast Traveler muted navy restraint", "Vercel pure black monochrome". Unnamed ambition becomes beige.
- Palette IS voice. A calm brand and a restless brand should not share palette mechanics.
- When the strategy is Committed or Drenched, color carries the brand. Don't hedge with neutrals around the edges. Commit.
- Don't converge across projects. If the last brand surface was restrained-on-cream, this one is not.
- When a cultural-symbol palette is the obvious pull, reach past it. Let the cultural reading come from typography, imagery, and copy, not the palette.

## Layout

- Asymmetric compositions are one option. Break the grid intentionally for emphasis.
- Fluid spacing with `clamp()` that breathes on larger viewports. Vary for rhythm: generous separations, tight groupings.
- Alternative: a strict, visible grid as the voice (brutalist / Swiss / tech-spec aesthetics). Either asymmetric or rigorously-gridded can be "designed"; the failure mode is splitting the difference into a generic centered stack.
- Don't default to centering everything. Left-aligned with asymmetric layouts feels more designed; a strict grid reads as confident structure. A centered-stack hero with icon-title-subtitle cards reads as template.
- When cards ARE the right affordance, use `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` for breakpoint-free responsiveness.

## Imagery

Brand surfaces lean on imagery. A restaurant, hotel, magazine, or product landing page without any imagery reads as incomplete, not as restrained. A solid-color rectangle where a hero image should go is worse than a representative stock photo.

**When the brief implies imagery (restaurants, hotels, magazines, photography, hobbyist communities, food, travel, fashion, product), you must ship imagery.** Zero images is a bug, not a design choice. "Restraint" is not an excuse. If the approved comp or brief is image-led, ship real project assets, generated raster assets, or a credible canvas/SVG/WebGL scene. Do not replace photographic, architectural, product, or place imagery with generic CSS panels, decorative diagrams, cards, bullets, or copy.

- **For greenfield work without local assets, use stock imagery.** Unsplash is the default. The URL shape is `https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1600&q=80`. **Verify the URLs before referencing them.** If you have an image-search MCP, web-fetch tool, or browser access, use it to find real photo IDs and confirm they resolve. Guessed IDs (even ones that look real) often 404 and ship as broken-image placeholders. Without a verification path, pick fewer photos you're confident exist over more that you guessed; never substitute colored `<div>` placeholders.
- **Search for the brand's physical object**, not the generic category: "handmade pasta on a scratched wooden table" beats "Italian food"; "cypress trees above a limestone hotel facade at dusk" beats "luxury hotel".
- **One decisive photo beats five mediocre ones.** Hero imagery should commit to a mood; padding with more stock doesn't rescue an indecisive one.
- **Alt text is part of the voice.** "Coastal fettuccine, hand-cut, served on the terrace" beats "pasta dish".

"Imagery" here is broader than stock photography: product screenshots, custom data visualizations, generated SVG, and canvas/WebGL scenes are all imagery. Text-only pages where typography alone carries the entire visual weight are the failure mode.

## Motion

- One well-orchestrated page-load with staggered reveals beats scattered micro-interactions, when the brand invites it. Tech-minimal brands often skip entrance motion entirely; the restraint is the voice.
- For collapsing/expanding sections, transition `grid-template-rows` rather than `height`.

## Brand bans (on top of the shared absolute bans)

- Monospace as lazy shorthand for "technical / developer." If the brand isn't technical, mono reads as costume.
- Large rounded-corner icons above every heading. Screams template.
- Single-family pages that picked the family by reflex, not voice. (A single family chosen deliberately is fine.)
- All-caps body copy. Reserve caps for short labels and headings.
- Timid palettes and average layouts. Safe = invisible.
- Zero imagery on a brief that implies imagery (restaurant, hotel, food, travel, fashion, photography, hobbyist). Colored blocks where a hero photo belongs.
- Defaulting to editorial-magazine aesthetics (display serif + italic + drop caps + broadsheet grid) on briefs that aren't magazine-shaped. Editorial is ONE aesthetic lane, not the default brand aesthetic.
- Repeated tiny uppercase tracked labels above every section heading. A single strong kicker can be voice; repeating it as section grammar is AI scaffolding unless it's a deliberate, named brand system.

## Brand permissions

Brand can afford things product can't. Take them.

- Ambitious first-load motion. Reveals, scroll-triggered transitions, typographic choreography.
- Single-purpose viewports. One dominant idea per fold, long scroll, deliberate pacing.
- Typographic risk. Enormous display type, unexpected italic cuts, mixed cases, hand-drawn headlines, a single oversize word as a hero.
- Unexpected color strategies. Palette IS voice; a calm brand and a restless brand should not share palette mechanics.
- Art direction per section. Different sections can have different visual worlds if the narrative demands it. Consistency of voice beats consistency of treatment.

## EXTENSION

### The reflex-reject font list, structured

Each banned font + the family it belongs to + why it's banned:

| Font | Family | Why banned (2026) |
|---|---|---|
| Fraunces | Variable serif (curated by Google) | Default "thoughtful editorial" pick across every Notion-adjacent / Stripe-adjacent landing page |
| Newsreader | Serif | The "Fraunces alternative" that became its own monoculture |
| Lora | Variable serif | Default warm-but-not-too-warm editorial pick |
| Crimson / Crimson Pro / Crimson Text | Old-style serif | Same as Lora; bookish without specificity |
| Playfair Display | High-contrast didone | "Luxury brand" reflex |
| Cormorant / Cormorant Garamond | Display Garamond | Default "elevated wedding-invitation" pick |
| Syne | Variable display sans | The "creative agency" reflex (2022-2024) |
| IBM Plex Mono / Sans / Serif | Plex family | Default "technical / serious" reflex; IBM monoculture |
| Space Mono / Space Grotesk | Geometric | Default "tech / startup" reflex |
| Inter | Variable sans (default UI face) | Default "modern SaaS" pick; in product UI it's legitimate, in brand it's invisible |
| DM Sans / DM Serif Display / DM Serif Text | DM family | Default "design tool / Notion-adjacent" pick |
| Outfit | Geometric sans | Default "rounded modern" pick |
| Plus Jakarta Sans | Humanist sans | Default "approachable tech" pick |
| Instrument Sans / Instrument Serif | New monoculture (post-2024) | Currently flooding "elevated startup" pages |

These bans apply to greenfield decisions. An existing brand already shipped with Inter doesn't get rebranded mid-iteration; the live mode's identity-lock supersedes the ban list.

### Aesthetic-lane catalog (live tracking)

Saturated (avoid in greenfield unless brief literally requires):

- **Editorial-typographic** (described in detail above)

Watch list (likely to saturate by 2026/2027):

- **Brutalist-utility.** Heavy grids, oversized helvetica-clones, exposed labels and grid lines, fluorescent-on-black accents. Already dominant on agency portfolios; near-saturation in YC startup landing pages.
- **Acid-maximalism.** Liquid Death / Brat-album palette (acid green, eye-blast magenta, neon yellow on black), grainy textures, distorted type. Already over-indexed in CPG and consumer-tech branding.
- **Soft-Y2K nostalgia.** Pastel gradients, blob shapes, Helvetica-rounded, frosted glass with sparkle motifs. Saturated in consumer apps for Gen-Z products.

Not-yet-saturated (still safe lanes as of 2026):

- Genuinely-Swiss (real DIN, real Helvetica, real grid discipline) - the discipline keeps it rare because most teams cheat the grid.
- Newspaper / broadsheet (real ITC Cheltenham, real ATF type, no italic flourish) - too unfashionable to attract reflex use.
- Industrial-signage (real Akzidenz, real DIN Engschrift, no nostalgia layer) - too austere for SaaS appetite.

The lanes update on the same cadence as the font list. When a watch-list item saturates, promote it to the banned list.

### Imagery: prescribed Unsplash patterns

Search-term recipes for image-led briefs:

| Brief | Bad search | Good search |
|---|---|---|
| Italian restaurant | "italian food" | "handmade pasta scratched wooden table flour dusted" |
| Luxury hotel | "luxury hotel" | "cypress trees limestone hotel facade dusk mediterranean" |
| Travel magazine | "travel" | "lone traveler ridgeline backlit golden hour southwest" |
| CPG packaging | "product photography" | "matte ceramic bottle slate countertop natural light single shadow" |
| Coffee brand | "coffee" | "ceramic cup espresso crema close macro morning light" |

Pattern: subject + material + light condition + composition cue. Generic category words alone produce stock-photo slop.

### Brand bans expanded with detection

- **Monospace lazy use:** ANY mono font on a non-developer-tool brand. Mono is legitimate for: code editors, dev-tool marketing, terminal-themed brands, intentional retro-tech aesthetics. Mono is costume on: restaurants, hotels, fashion, consumer products, agencies, B2B SaaS that isn't dev-facing.
- **Large rounded-corner icons above every heading:** detect when a layout has 3+ sections each with a centered icon (24-64px), rounded corners (8-16px radius), single tint, sitting above a heading + paragraph. This is the Linear/Stripe icon-card template.
- **All-caps body copy:** `text-transform: uppercase` on body text (paragraphs longer than 1 line). Allowed: short labels, section eyebrows, single-word emphasis.
- **Repeated tiny uppercase tracked labels:** detect when 3+ consecutive sections start with the same shape: `<span class="eyebrow">` containing 1-3 uppercase words with letter-spacing. One eyebrow per page is voice; eyebrows on every section is AI scaffolding.

## WHAT'S MISSING

- **No reflex-reject list update mechanism.** When is the list refreshed? Who decides Inter is suddenly "saturated"? No process documented.
- **No imagery licensing guidance.** Unsplash is named but the license terms aren't reviewed. What about Pexels? Pixabay? Generated images and their licensing? Missing.
- **No color OKLCH palette templates for brand registers.** The shared design laws say "use OKLCH" and brand.md says "palette IS voice" but there's no worked example of building a brand palette from voice words in OKLCH space.
- **No reflex-reject layout primitives.** Banned fonts and aesthetic lanes are catalogued, but specific layout templates (hero-with-laptop-screenshot, three-column-feature-card, big-quote-with-photo, etc.) aren't enumerated.
- **No real-world brand exemplars.** "Klim-style", "Stripe-minimal", "Liquid-Death-acid-maximalism" are referenced but not linked, screenshotted, or analyzed for their distinguishing moves.
- **No "how to escape your own first reflex" worked example.** The procedure says "if your first pick is on the list, reject and start over" but doesn't show a worked example of the second-pass thinking that finds something genuinely different.
- **Cultural-symbol palette guidance is vague.** "Reach past it" is the entire prescription. Specific case studies (a Mexican-coded brand, a Japanese-coded brand, a Brazilian-coded brand and what they did instead of red/white/green, red/sun-disc, or yellow/green respectively) would be far more useful.
