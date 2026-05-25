---
name: fontshare-reference
description: Research typefaces via fontshare.com's curated catalog before recommending or implementing fonts. Use when picking a typeface for a new brand or product surface, building a type system, choosing pairings, or auditing an existing font choice. Triggers on font selection, type system work, "what font", "which font", "pick a font", "find a font", "font pairing", "type pairing", "typeface", "font for", brand-voice typography decisions, and any time a typography decision is being made for a project that has not yet committed to a font. Use this skill even when the user does not mention fontshare explicitly - fontshare's curated organization is the most useful first-pass catalog for open-source typefaces and a partial defense against Google-Fonts monoculture.
---

# Fontshare Reference

Use [fontshare.com](https://www.fontshare.com) as the research catalog before selecting typefaces. Fontshare is Indian Type Foundry's free-for-commercial catalog with sensible category + personality organization, variable-font support, and a curated quality bar that pushes back against the same-Google-Fonts-everywhere monoculture.

## The core idea: layered synthesis

Picking a font well requires three layers, and this skill is the first:

1. **Catalog layer** (this skill) - Browse fontshare with the brand's voice words in mind. Understand what families exist, how they are categorized, which families have the weights / variants / language coverage the project needs. This is the breadth pass - the part that surfaces candidates the project has not considered.

2. **Strategy layer** (sidecoach's `brand.md` "Font selection procedure" and `typography.md` "Anti-reflexes worth defending against") - Apply the reflex-reject list, reject any pick that lands in the editorial-typographic aesthetic lane without a brief reason, cross-check that the final font does not match the same training-data default the project's last design did.

3. **Project layer** (DESIGN.md, existing code, fallback chains) - Pair within the family before adding a second face. Document the pick in DESIGN.md with token references.

The key principle: never let a popular fontshare font become the new monoculture. Fontshare's own "Most popular" surface (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) is creeping toward training-data-default status the same way Inter and Fraunces did. Use fontshare for breadth; use sidecoach's reject discipline to avoid landing on the obvious fontshare hit.

## When to use this skill

- **Picking a font for a new brand** - Before suggesting any name, browse fontshare by category and personality tag.
- **Building a type system** - When establishing primary + secondary + mono, fontshare gives you one catalog with consistent quality across all three.
- **Pairing fonts** - Fontshare family pages list designer-recommended pairings drawn from the same catalog.
- **Auditing an existing pick** - When asked "is this font right?", check fontshare for under-represented alternatives in the same category.
- **Multilingual / Indic / Cyrillic work** - Indian Type Foundry families have stronger Devanagari and Latin-extended coverage than the typical Google Fonts default.

## Why fontshare specifically

- **Sensible organization**: Sans / Serif / Display / Monospace / Handwritten as top categories, with personality tags (Geometric, Humanist, Grotesque, Friendly, Refined, etc.) and feature filters (variable, weight count, language coverage) for deeper browsing.
- **Curated quality**: Designed by Indian Type Foundry or partners. No abandoned-Google-Fonts long tail to wade through.
- **Cohesive pairings**: Fonts in the catalog are designed to pair with one another. Same-designer families often share metrics and OpenType features.
- **Free for commercial use**: One license, one download, no upgrade nags.
- **Anti-monoculture stance**: Fontshare exists in part as an answer to the same-Google-Fonts-everywhere problem. Using its non-top-five fonts is a partial defense against the monoculture.

## Fontshare's organization (what to filter on)

### Categories
- **Sans** - the broadest category; further filter by personality (Geometric, Humanist, Grotesque, Neo-grotesque)
- **Serif** - filter by sub-style (Transitional, Modern, Slab, Display serif)
- **Display** - high-personality faces for headlines only; never for body
- **Monospace** - code, technical, type-as-voice
- **Handwritten** - rare for product UI; sometimes right for personality brand voice

### Personality tags (cross-reference against the brand-voice words from sidecoach step 1)
Friendly, Refined, Bold, Calm, Casual, Geometric, Humanist, Industrial, Mechanical, Editorial, Quirky, Modern, Classical, Warm, Cool.

### Feature filters
- **Variable** - prefer when 3+ weights are needed (one file beats three static weights)
- **Multilingual** - check language coverage if the project needs non-Latin
- **Weights** - filter by minimum weight count if a full range is needed

### Entry points
- `https://www.fontshare.com` - homepage shows curated picks and trending
- `https://www.fontshare.com/fonts` - all fonts, filterable by category, personality, weight, language
- Individual family page - shows weights, OpenType features, supported scripts, and the designer's recommended pairings

## Workflow

### Step 1: Read PRODUCT.md and write three brand-voice words

Same step 1 as sidecoach's `brand.md` font-selection procedure. Use physical-object words, not "modern" or "elegant." For example: "warm and mechanical and opinionated" or "calm and clinical and careful."

If PRODUCT.md does not exist, run `/sidecoach teach` first to seed it. Do not improvise typography without brand context.

### Step 2: List your reflex picks, then reject them

Per sidecoach's procedure: list the three fonts you would reach for by reflex. Reject any that appear on sidecoach's reflex-reject list:

> Fraunces, Newsreader, Lora, Crimson, Crimson Pro, Crimson Text, Playfair Display, Cormorant, Cormorant Garamond, Syne, IBM Plex Mono / Sans / Serif, Space Mono, Space Grotesk, Inter, DM Sans, DM Serif Display / Text, Outfit, Plus Jakarta Sans, Instrument Sans, Instrument Serif.

These are training-data defaults. Do not propose them as primaries on greenfield design choices. (Identity-preservation still wins if the brand has already committed to one of them.)

Also avoid the **editorial-typographic aesthetic lane** (display-serif italic + small mono labels + ruled separators + monochromatic restraint) unless the brief literally requires it.

### Step 3: Browse fontshare with the brand-voice words in mind

Navigate to `https://www.fontshare.com/fonts` and apply filters tied to Step 1's voice words:

- "Warm and mechanical" → start with Sans + Humanist + Mechanical-adjacent display options
- "Calm and clinical" → start with Sans + Neo-grotesque or Sans + Geometric (but reject anything that reads Inter-adjacent)
- "Bold and editorial" → start with Display or Serif + Bold weights
- "Friendly and casual" → Friendly + Humanist sans, or a personality display

Open 5-8 candidate family pages. For each, read weights, OpenType features, language coverage, and the designer's recommended pairings.

**Watch for the new fontshare monoculture**. Families that appear at the top of fontshare's homepage by mid-2026 (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) are trending toward training-data-default status. They are fine fonts, but if the reflex from Step 2 landed on one of them, look one filter deeper. Fontshare's catalog is wider than its homepage suggests.

### Step 4: Cross-check against sidecoach's anti-reflexes

From `typography.md`:

- A technical / utilitarian brief does NOT need a serif "for warmth."
- An editorial / premium brief does NOT need the same expressive serif everyone is using right now.
- A children's product does NOT need a rounded display font.
- A "modern" brief does NOT need a geometric sans. The most modern thing you can do is not use the font everyone else is using.

If the final pick lines up with the original reflex from Step 2, start over.

### Step 5: Verify weights, OpenType features, and language coverage

Before committing, confirm the candidate family supports:

- All weights the project needs (display weight + body weight + bold + italic if used)
- Tabular numbers if the project shows data (`font-variant-numeric: tabular-nums`)
- Diagonal fractions, small caps, ligatures if relevant
- Required scripts (Latin extended, Cyrillic, Devanagari, etc.)

If the family is missing a feature, either pick a different family or write an explicit fallback chain.

### Step 6: Pair within the family before adding a second face

Fontshare families often have enough weight contrast that ONE family + weight contrast is stronger than two competing typefaces. Per sidecoach's typography.md: "You often do not need a second font."

When pairing IS justified:

- Pair across a real contrast axis: Serif + Sans (structure), Geometric + Humanist (personality), Condensed + Wide (proportion).
- Never pair two similar-but-not-identical geometric sans-serifs - they create visual tension without clear hierarchy.
- Check the family page's "Pairs well with" section first; the designer's intent beats Claude's guesses.

### Step 7: Document the pick in DESIGN.md

```yaml
typography:
  primary:
    family: "Family Name"
    source: "fontshare"
    url: "https://www.fontshare.com/fonts/<family-slug>"
    weights: [400, 500, 700]
  secondary: ~ # only if pairing is justified
  mono: ~ # if the project needs code/data display
```

In DESIGN.md prose, record: which brand-voice words the pick serves, which reflex picks were rejected, why this family beat the obvious top-of-fontshare choices.

## Integration with the design stack

This skill is the catalog / breadth layer in the font-selection sub-stack:

1. **fontshare-reference** (this skill) - Browse the curated catalog. Find candidates the project has not considered.
2. **sidecoach** (`brand.md` font procedure + `typography.md` anti-reflexes) - Apply brand-voice cross-check and reject training-data defaults.
3. **make-interfaces-feel-better** - Apply tactical typography polish at implementation time: tabular nums on data, `text-wrap: balance` on headings, `font-optical-sizing: auto` for variable fonts, all-caps tracking, FOUT fallback metrics.

The catalog prevents narrow-search gaps ("settling on Inter because it's the first font Claude thinks of"). Sidecoach prevents brand-strategy gaps (off-register pick). Make-interfaces-feel-better prevents implementation polish gaps.

## Fallback - when fontshare does not have the right family

Fontshare is the *first* catalog, not the only one. If after a thorough browse no family fits:

- **Google Fonts** - much broader, but loaded with training-data defaults. Check AFTER fontshare, not before.
- **Velvetyne** (https://velvetyne.fr) - experimental, art-leaning, all OFL. Use for high-personality brands that want to look like nobody else.
- **Pangram Pangram** (https://pangrampangram.com) - paid catalog, free trial fonts usable for prototypes.
- **Future Fonts** (https://www.futurefonts.xyz) - works-in-progress and beta typefaces; for ambitious brand work willing to ship something pre-1.0.
- **Klim Type Foundry** (https://klim.co.nz) - paid, premium. The reference for editorial-grotesque quality.
- **ABC Dinamo** (https://abcdinamo.com) - paid, contemporary Swiss-influenced. Strong display work.

When falling through, document in the session memory why fontshare did not fit (which filters / categories were tried) so the next session does not repeat the search.

## Anti-pattern checklist

Before finalizing a pick, verify NONE of these are true:

- The pick is on sidecoach's reflex-reject list (Fraunces, Inter, Outfit, etc.)
- The pick is the top result on fontshare's homepage AND was the reflex from Step 2
- The pick lands in the editorial-typographic aesthetic lane without brief reason
- The pick is the same family used on the last brand surface this team shipped
- The pick is a geometric sans for a "modern" brief (the most common reflex)
- The pick pairs two similar-but-not-identical sans-serifs

If any are true, return to Step 3 and look further.
