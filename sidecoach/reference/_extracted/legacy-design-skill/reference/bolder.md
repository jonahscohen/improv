# Impeccable bolder.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

When asked for "bolder," AI defaults to the same tired tricks: cyan/purple gradients, glassmorphism, neon accents on dark backgrounds, gradient text on metrics. These are the opposite of bold. Reject them first, then increase visual impact and personality through stronger hierarchy, committed scale, and decisive type.

---

## Register

Brand: "bolder" means distinctive. Extreme scale, unexpected color, typographic risk, committed POV.

Product: "bolder" rarely means theatrics; those undermine trust. It means stronger hierarchy, clearer weight contrast, one sharper accent, more committed density. The amplification is in clarity, not drama.

---

## Assess Current State

Analyze what makes the design feel too safe or boring:

1. **Identify weakness sources**:
   - **Generic choices**: System fonts, basic colors, standard layouts
   - **Timid scale**: Everything is medium-sized with no drama
   - **Low contrast**: Everything has similar visual weight
   - **Static**: No motion, no energy, no life
   - **Predictable**: Standard patterns with no surprises
   - **Flat hierarchy**: Nothing stands out or commands attention

2. **Understand the context**:
   - What's the brand personality? (How far can we push?)
   - What's the purpose? (Marketing can be bolder than financial dashboards)
   - Who's the audience? (What will resonate?)
   - What are the constraints? (Brand guidelines, accessibility, performance)

If any of these are unclear from the codebase, STOP and call the AskUserQuestion tool to clarify.

**CRITICAL**: "Bolder" doesn't mean chaotic or garish. It means distinctive, memorable, and confident. Think intentional drama, not random chaos.

**WARNING - AI SLOP TRAP**: Review ALL the DON'T guidelines from the parent impeccable skill (already loaded in this context) before proceeding. Bold means distinctive, not "more effects."

## Plan Amplification

Create a strategy to increase impact while maintaining coherence:

- **Focal point**: What should be the hero moment? (Pick ONE, make it amazing)
- **Personality direction**: Maximalist chaos? Elegant drama? Playful energy? Dark moody? Choose a lane.
- **Risk budget**: How experimental can we be? Push boundaries within constraints.
- **Hierarchy amplification**: Make big things BIGGER, small things smaller (increase contrast)

**IMPORTANT**: Bold design must still be usable. Impact without function is just decoration.

## Amplify the Design

Systematically increase impact across these dimensions:

### Typography Amplification
- **Replace generic fonts**: Swap system fonts for distinctive choices (see the parent skill's typography guidelines and [typography.md](typography.md) for inspiration)
- **Extreme scale**: Create dramatic size jumps (3x-5x differences, not 1.5x)
- **Weight contrast**: Pair 900 weights with 200 weights, not 600 with 400
- **Unexpected choices**: Variable fonts, display fonts for headlines, condensed/extended widths, monospace as intentional accent (not as lazy "dev tool" default)

### Color Intensification
- **Increase saturation**: Shift to more vibrant, energetic colors (but not neon)
- **Bold palette**: Introduce unexpected color combinations. Avoid the purple-blue gradient AI slop
- **Dominant color strategy**: Let one bold color own 60% of the design
- **Sharp accents**: High-contrast accent colors that pop
- **Tinted neutrals**: Replace pure grays with tinted grays that harmonize with your palette
- **Rich gradients**: Intentional multi-stop gradients (not generic purple-to-blue)

### Spatial Drama
- **Extreme scale jumps**: Make important elements 3-5x larger than surroundings
- **Break the grid**: Let hero elements escape containers and cross boundaries
- **Asymmetric layouts**: Replace centered, balanced layouts with tension-filled asymmetry
- **Generous space**: Use white space dramatically (100-200px gaps, not 20-40px)
- **Overlap**: Layer elements intentionally for depth

### Visual Effects
- **Dramatic shadows**: Large, soft shadows for elevation (but not generic drop shadows on rounded rectangles)
- **Background treatments**: Mesh patterns, noise textures, geometric patterns, intentional gradients (not purple-to-blue)
- **Texture & depth**: Grain, halftone, duotone, layered elements. NOT glassmorphism (it's overused AI slop)
- **Borders & frames**: Thick borders, decorative frames, custom shapes (not rounded rectangles with colored border on one side)
- **Custom elements**: Illustrative elements, custom icons, decorative details that reinforce brand

### Motion & Animation
- **Entrance choreography**: Staggered, dramatic page load animations with 50-100ms delays
- **Scroll effects**: Parallax, reveal animations, scroll-triggered sequences
- **Micro-interactions**: Satisfying hover effects, click feedback, state changes
- **Transitions**: Smooth, noticeable transitions using ease-out-quart/quint/expo (not bounce or elastic, which cheapen the effect)

### Composition Boldness
- **Hero moments**: Create clear focal points with dramatic treatment
- **Diagonal flows**: Escape horizontal/vertical rigidity with diagonal arrangements
- **Full-bleed elements**: Use full viewport width/height for impact
- **Unexpected proportions**: Golden ratio? Throw it out. Try 70/30, 80/20 splits

**NEVER**:
- Add effects randomly without purpose (chaos != bold)
- Sacrifice readability for aesthetics (body text must be readable)
- Make everything bold (then nothing is bold; you need contrast)
- Ignore accessibility (bold design must still meet WCAG standards)
- Overwhelm with motion (animation fatigue is real)
- Copy trendy aesthetics blindly (bold means distinctive, not derivative)

## Verify Quality

Ensure amplification maintains usability and coherence:

- **NOT AI slop**: Does this look like every other AI-generated "bold" design? If yes, start over.
- **Still functional**: Can users accomplish tasks without distraction?
- **Coherent**: Does everything feel intentional and unified?
- **Memorable**: Will users remember this experience?
- **Performant**: Do all these effects run smoothly?
- **Accessible**: Does it still meet accessibility standards?

**The test**: If you showed this to someone and said "AI made this bolder," would they believe you immediately? If yes, you've failed. Bold means distinctive, not "more AI effects."

When the result feels right, hand off to `/impeccable polish` for the final pass.

## EXTENSION

### The "AI bolder" slop checklist (reject these moves)

If your "bolder" instinct lands here, you've defaulted to the AI training-data mode. Restart:

- Purple-to-blue gradient on the hero
- Glassmorphic card with backdrop-blur on a gradient background
- Cyan or magenta neon accent on a near-black background
- Gradient text on the headline ("Build the future of X")
- Pulsing glow on the CTA button
- Floating geometric shapes (circles, triangles) in the background
- Spotlight or radial gradient illuminating the center of a dark hero
- "Cyber" font (Orbitron, Audiowide, Major Mono Display)
- Letter-spacing > 0.2em on a heading
- Particle effect on hover

If three or more of these appear in your "bolder" attempt, the bolder is not bolder, it's slop. Restart with a real reference (Klim, Liquid Death, a museum publication, a fashion lookbook).

### Register-specific "bolder" interpretations

**Brand "bolder":**
- 5x scale on the hero headline (clamp(4rem, 12vw, 12rem))
- A single saturated color filling 60%+ of the surface
- One unexpected typographic move (an italic display serif used as logo, an oversized number anchoring the page, hand-drawn type for one moment)
- Real photography or generative art for the hero, not stock geometry

**Product "bolder":**
- Stronger weight contrast in hierarchy (h1 weight 800, body 400)
- One sharper accent color reserved for primary actions only (not 5 accents)
- Tighter density on data-dense surfaces
- More confident copy (active voice, specific verbs)
- NOT: aggressive motion, decorative gradients, or anything that competes with the task

### Scale-jump worked examples

| Element | Timid | Bolder |
|---|---|---|
| Hero headline | 2.5rem | clamp(3rem, 8vw, 6rem) |
| Section heading | 1.5rem | 2.5rem |
| Body | 1rem | 1rem (don't grow body; grow contrast) |
| CTA button | 0.875rem padding 0.5rem 1rem | 1rem padding 1rem 2rem |
| Logo / brand mark | 1.25rem | 2rem |

The principle: amplify the gap between sizes, not every size.

## WHAT'S MISSING

- **No "is this brand or product?" gate at the top.** The register section discusses both but the rest of the doc applies to both interchangeably; some sections (Spatial Drama, Motion & Animation) heavily lean brand.
- **No "if it's already bold, don't bolder again" check.** If a design is already maximalist, "bolder" risks tipping into chaos.
- **No risk-budget rubric.** "How experimental can we be?" is asked but no rubric for the answer (consumer vs. enterprise vs. luxury vs. mass-market).
- **No before/after format.** Like make-interfaces-feel-better's table format, bolder could use a side-by-side change log.
- **No measurable success criterion.** "Distinctive, memorable, confident" but no test (would a user describe this in 3 words without mentioning AI?).
