# fontshare-reference - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/fontshare-reference/SKILL.md`

## What this skill provides

A research layer over [fontshare.com](https://www.fontshare.com) - Indian Type Foundry's free-for-commercial typeface catalog. The skill is opinionated: fontshare is the *first* catalog (not the only one) because it has sensible category + personality organization, variable-font support, and a curated quality bar that pushes back against the same-Google-Fonts-everywhere monoculture.

## Fontshare's organization

### Categories (top-level filter)
- **Sans** - broadest; further filter by Geometric / Humanist / Grotesque / Neo-grotesque
- **Serif** - filter by Transitional / Modern / Slab / Display serif
- **Display** - high-personality, headlines only, never body
- **Monospace** - code, technical, type-as-voice
- **Handwritten** - rare for product UI

### Personality tags (cross-reference against brand-voice words)
Friendly, Refined, Bold, Calm, Casual, Geometric, Humanist, Industrial, Mechanical, Editorial, Quirky, Modern, Classical, Warm, Cool

### Feature filters
- **Variable** - prefer when 3+ weights are needed
- **Multilingual** - check language coverage if non-Latin
- **Weights** - minimum weight count filter

### Entry points
- `https://www.fontshare.com` - homepage curated picks + trending
- `https://www.fontshare.com/fonts` - all fonts, filterable
- `https://www.fontshare.com/fonts/<family-slug>` - individual family

## The reflex-reject list (CRITICAL)

The skill maintains an explicit list of typefaces that are training-data defaults and should NOT be proposed as primaries on greenfield design choices:

**Reject these:**
- Fraunces, Newsreader, Lora, Crimson, Crimson Pro, Crimson Text
- Playfair Display, Cormorant, Cormorant Garamond
- Syne
- IBM Plex Mono / Sans / Serif
- Space Mono, Space Grotesk
- Inter, DM Sans, DM Serif Display / Text
- Outfit, Plus Jakarta Sans
- Instrument Sans, Instrument Serif

**Also avoid the "editorial-typographic aesthetic lane"**: display-serif italic + small mono labels + ruled separators + monochromatic restraint, UNLESS the brief literally requires it.

**Emerging fontshare monoculture (also reject as primary):**
- General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display

(Identity-preservation still wins if the brand has already committed to one of these.)

## Anti-reflex rules (from impeccable's typography.md)

| Brief type | Common reflex | Why wrong |
|---|---|---|
| Technical / utilitarian | Add a serif "for warmth" | Not the warmth move |
| Editorial / premium | Pick the expressive serif everyone uses | That's the lane |
| Children's product | Rounded display font | Often saccharine |
| "Modern" brief | Geometric sans | "The most modern thing is not using the font everyone else is using" |

## The 7-step workflow

1. **Read PRODUCT.md and write three brand-voice words.** Use physical-object words ("warm and mechanical and opinionated"), not abstract words ("modern", "elegant").
2. **List reflex picks, then reject them.** If any are on the reject list, drop them.
3. **Browse fontshare with brand-voice words in mind.** Apply category + personality filters. Open 5-8 candidate family pages.
4. **Cross-check against anti-reflex rules.** If the final pick lines up with the original reflex, start over.
5. **Verify weights, OpenType features, language coverage.** Confirm the family supports all weights, tabular nums if needed, required scripts.
6. **Pair within the family before adding a second face.** Often one family + weight contrast beats two competing typefaces.
7. **Document the pick in DESIGN.md** with token references and the rejected reflex picks captured as rationale.

## Fallback catalogs (when fontshare doesn't fit)

- **Google Fonts** - broader but training-data-default heavy. AFTER fontshare, not before.
- **Velvetyne** (https://velvetyne.fr) - experimental, art-leaning, OFL.
- **Pangram Pangram** (https://pangrampangram.com) - paid catalog with free trials.
- **Future Fonts** (https://www.futurefonts.xyz) - works-in-progress.
- **Klim Type Foundry** (https://klim.co.nz) - paid, premium editorial-grotesque reference.
- **ABC Dinamo** (https://abcdinamo.com) - paid, Swiss-influenced display.

## How sidecoach should query this skill

### Trigger conditions

Sidecoach should consult fontshare-reference whenever:
- A new project's typography is being established
- A brand-voice change requires re-evaluating type
- A type pairing is being added
- An audit flags the current font as a reflex pick
- The user explicitly asks "what font", "which font", "find a font", "pick a font"

DO NOT trigger when:
- DESIGN.md already locks typography and the task isn't about type
- The user is changing only weight/size, not family
- The project has a brand-mandated font

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to extract |
|---|---|---|
| **Flow C (font-research)** | ALWAYS on entry when type is in scope | Reject-list cross-check, 5-8 candidates, recommended pairings |
| **Flow A (brand-verify)** | When the brand has no locked typeface | Surface fontshare candidates that match the three brand-voice words |
| **Flow F (design-tokens)** | When generating typography tokens | Pull weights, OpenType features, family-slug for fallback chain |
| **Flow N (audit triad)** | During critique | Flag if current font is on the reject list; suggest alternatives |

### Query shape

```typescript
{
  source: 'fontshare-reference',
  catalog: 'https://www.fontshare.com/fonts',
  brandVoiceWords: ['warm', 'mechanical', 'opinionated'],   // from PRODUCT.md
  rejectList: [
    'Fraunces', 'Newsreader', 'Lora', 'Crimson', 'Crimson Pro', 'Crimson Text',
    'Playfair Display', 'Cormorant', 'Cormorant Garamond', 'Syne',
    'IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Serif',
    'Space Mono', 'Space Grotesk',
    'Inter', 'DM Sans', 'DM Serif Display', 'DM Serif Text',
    'Outfit', 'Plus Jakarta Sans',
    'Instrument Sans', 'Instrument Serif',
    // Emerging fontshare monoculture:
    'General Sans', 'Cabinet Grotesk', 'Switzer', 'Satoshi', 'Clash Display',
  ],
  filters: {
    category: 'Sans',                  // or Serif, Display, Monospace, Handwritten
    personality: ['Humanist', 'Mechanical'],   // mapped from voice words
    variable: true,                    // when 3+ weights needed
    multilingual: false,               // true if non-Latin scripts needed
    minWeights: 4,
  },
  requireFeatures: ['tabular-nums', 'multiple-weights'],
  expectedOutput: 'TypefaceCandidate[]',
}
```

### Voice-word → personality mapping (heuristics)

| Voice words | Suggested filters |
|---|---|
| "warm + mechanical" | Sans + Humanist + Mechanical-adjacent display |
| "calm + clinical" | Sans + Neo-grotesque or Geometric (NOT Inter-adjacent) |
| "bold + editorial" | Display or Serif + Bold weights |
| "friendly + casual" | Friendly + Humanist sans, or personality display |
| "premium + sharp" | Display Serif + tight weights, but check editorial-lane warning |
| "industrial + technical" | Mechanical, Grotesque, Monospace (for type-as-voice) |
| "playful + quirky" | Quirky + Display, or Handwritten if brand permits |
| "classical + refined" | Serif + Transitional or Modern |

### Output structure (what to deliver back to the flow handler)

```typescript
interface TypefaceCandidate {
  family: string;
  fontshareUrl: string;
  category: 'Sans' | 'Serif' | 'Display' | 'Monospace' | 'Handwritten';
  personalityTags: string[];
  weights: number[];
  variable: boolean;
  openTypeFeatures: string[];
  languageCoverage: string[];
  recommendedPairings: string[];     // from fontshare family page
  rationale: string;                   // why this matches the voice words
  rejectReason?: string;               // if on reject list, why not
}
```

## What sidecoach is currently missing

1. **Flow C (font-research) does not enforce the reject list.** The current handler returns candidates without cross-checking against the 25-name reflex-reject list. A `validate-against-reject-list.ts` utility is needed.
2. **No anti-reflex cross-check.** The "technical brief != serif for warmth" rule needs an explicit guard in the flow handler.
3. **No fontshare monoculture detection.** The emerging defaults (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) are not flagged.
4. **No language-coverage validation** for non-Latin projects.
5. **No fallback catalog routing** when fontshare doesn't fit - the handler should suggest Velvetyne / Pangram Pangram / etc. when appropriate.

## Gaps in the skill itself

- The reject list is hardcoded in prose; no structured data file. Worth extracting to `fontshare-reject-list.json` for programmatic enforcement across both sidecoach and the skill.
- No data on which families are CURRENTLY top of fontshare (the "emerging monoculture" list will drift over time and needs periodic refresh).
- No mapping from voice words to category/personality filters in the skill itself - the heuristic in this doc fills that gap.
