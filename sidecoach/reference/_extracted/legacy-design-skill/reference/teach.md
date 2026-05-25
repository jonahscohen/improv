# Impeccable teach.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Teach Flow

Gathers design context for a project and writes two complementary files at the project root:

- **PRODUCT.md** (strategic): root project file for register, target users, product purpose, brand personality, anti-references, strategic design principles. Answers "who/what/why".
- **DESIGN.md** (visual): root project file for visual theme, color palette, typography, components, layout. Follows the [Google Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/). Answers "how it looks".

Every other impeccable command reads these files before doing any work.

## Step 1: Load current state

Run the shared loader first so you know what already exists:

```bash
node .claude/skills/impeccable/scripts/load-context.mjs
```

The output tells you whether PRODUCT.md and/or DESIGN.md already exist. If `migrated: true`, legacy `.impeccable.md` was auto-renamed to `PRODUCT.md`. Mention this once to the user.

Decision tree:
- **Neither file exists (empty project or no context yet)**: do Steps 2-4 (write PRODUCT.md), then decide on DESIGN.md based on whether there's code to analyze.
- **PRODUCT.md exists, DESIGN.md missing**: skip to Step 5 and offer to run `/impeccable document` for DESIGN.md.
- **PRODUCT.md exists but has no `## Register` section (legacy)**: add it. Infer a hypothesis from the codebase (see Step 2), confirm with the user, write the field.
- **Both exist**: STOP and call the AskUserQuestion tool to clarify. Ask which file to refresh. Skip the one the user doesn't want changed.
- **Just DESIGN.md exists (unusual)**: do Steps 2-4 to produce PRODUCT.md.

Never silently overwrite an existing file. Always confirm first.

If teach was invoked as a setup blocker by another command, such as `/impeccable craft landing page`, pause that command here. Complete teach, re-run the loader, then resume the original command with the freshly loaded context. For craft, resume into shape next; teach creates project context, but it is not a substitute for the task-specific shape interview and confirmed design brief.

## Step 2: Explore the codebase

Before asking questions, thoroughly scan the project to discover what you can:

- **README and docs**: Project purpose, target audience, any stated goals
- **Package.json / config files**: Tech stack, dependencies, existing design libraries
- **Existing components**: Current design patterns, spacing, typography in use
- **Brand assets**: Logos, favicons, color values already defined
- **Design tokens / CSS variables**: Existing color palettes, font stacks, spacing scales
- **Any style guides or brand documentation**

Also form a **register hypothesis** from what you find:

- Brand signals: `/`, `/about`, `/pricing`, `/blog/*`, `/docs/*`, hero sections, big typography, scroll-driven sections, landing-page-shaped content.
- Product signals: `/app/*`, `/dashboard`, `/settings`, `/(auth)`, forms, data tables, side/top nav, app-shell components.

Register is a hypothesis at this point, not a decision; Step 3 confirms it.

Note what you've learned and what remains unclear. This exploration feeds both PRODUCT.md and DESIGN.md.

## Step 3: Ask strategic questions (for PRODUCT.md)

STOP and call the AskUserQuestion tool to clarify. Ask only about what you couldn't infer from the codebase.

### Interview mode, not confirmation mode

If the repo is empty or the user's brief is sparse, run a short interview before proposing PRODUCT.md. Do **not** turn a one-sentence request into a complete inferred PRODUCT.md and ask for blanket confirmation.

- Use the harness's structured question tool when one exists. Otherwise, ask directly in chat and stop.
- Ask **2-3 questions per round**, then wait for answers.
- Use inferred answers as hypotheses or options, not as finished facts.
- Complete at least one real user-answer round before drafting PRODUCT.md, unless every required answer is directly discoverable from repo docs.
- Round 1 should establish register, users/purpose, and desired outcome.
- Round 2 should establish brand personality or references, anti-references, and accessibility needs.

### Minimum viable interview

Ask enough to complete PRODUCT.md. At minimum, cover register confirmation, users and purpose, brand personality, anti-references, and accessibility needs unless each answer is directly discoverable from repo context. After at least one interview round, you may propose inferred answers, but the user must confirm them before you write PRODUCT.md. Never synthesize PRODUCT.md from the original task prompt alone.

### Register (ask first; it shapes everything below)

Every design task is either **brand** (marketing, landing, campaign, long-form content, portfolio: design IS the product) or **product** (app UI, admin, dashboards, tools: design SERVES the product).

If Step 2 produced a clear hypothesis, lead with it: *"From the codebase, this looks like a [brand / product] surface. Does that match your intent, or should we treat it differently?"*

If the signal is genuinely split (e.g. a product with a big marketing landing), STOP and call the AskUserQuestion tool to clarify. Ask which register describes the **primary** surface. The register can be overridden per task later, but PRODUCT.md carries one default.

### Users & Purpose
- Who uses this? What's their context when using it?
- What job are they trying to get done?
- For brand: what emotions should the interface evoke? (confidence, delight, calm, urgency)
- For product: what workflow are they in? What's the primary task on any given screen?

### Brand & Personality
- How would you describe the brand personality in 3 words?
- Reference sites or apps that capture the right feel? What specifically about them?
  - For brand, push for real-world references in the right lane (tech-minimal, editorial-magazine, consumer-warm, brutalist-grid, etc.), not generic "modern" adjectives.
  - For product, push for category best-tool references (Linear, Figma, Notion, Raycast, Stripe).
- What should this explicitly NOT look like? Any anti-references?

### Accessibility & Inclusion
- Specific accessibility requirements? (WCAG level, known user needs)
- Considerations for reduced motion, color blindness, or other accommodations?

Skip questions where the answer is already clear. **Do NOT ask about colors, fonts, radii, or visual styling here.** Those belong in DESIGN.md, not PRODUCT.md.

## Step 4: Write PRODUCT.md

Write PRODUCT.md only after the user has confirmed the strategic answers from Step 3. If an inferred answer is uncertain or unconfirmed, ask before writing.

Synthesize into a strategic document:

```markdown
# Product

## Register

product

## Users
[Who they are, their context, the job to be done]

## Product Purpose
[What this product does, why it exists, what success looks like]

## Brand Personality
[Voice, tone, 3-word personality, emotional goals]

## Anti-references
[What this should NOT look like. Specific bad-example sites or patterns to avoid.]

## Design Principles
[3-5 strategic principles derived from the conversation. Principles like "practice what you preach", "show, don't tell", "expert confidence". NOT visual rules like "use OKLCH" or "magenta accent".]

## Accessibility & Inclusion
[WCAG level, known user needs, considerations]
```

Register is either `brand` or `product` as a bare value. No prose, no commentary.

Write to `PROJECT_ROOT/PRODUCT.md`. If `.impeccable.md` existed, the loader already renamed it; merge into that content rather than starting from scratch.

## Step 5: Decide on DESIGN.md

Offer `/impeccable document` either way. Two paths:

- **Code exists** (CSS tokens, components, a running site): "I can generate a DESIGN.md that captures your visual system (colors, typography, components) so variants stay on-brand. Want to do that now?"
- **Pre-implementation** (empty project): "I can seed a starter DESIGN.md from five quick questions about color strategy, type direction, motion energy, and references. You can re-run once there's code, to capture the real tokens. Want to do that now?"

If the user agrees, delegate to `/impeccable document` (it auto-detects scan vs seed). Load its reference and follow that flow.

If the user prefers to skip, mention they can run `/impeccable document` any time later.

## Step 6: Confirm and wrap up

Summarize:
- Register captured (brand / product)
- What was written (PRODUCT.md, DESIGN.md, or both)
- The 3-5 strategic principles from PRODUCT.md that will guide future work
- If DESIGN.md is pending, remind the user how to generate it later

**Critical: re-run the loader to refresh session context.** After writing PRODUCT.md, run `node .claude/skills/impeccable/scripts/load-context.mjs` one final time and let its full JSON output land in conversation. This ensures subsequent commands in this session use the freshly-written PRODUCT.md, not a stale earlier version.

If teach was invoked as a blocker by another impeccable command (e.g. the user ran `/impeccable polish` with no PRODUCT.md), resume that original task now with the fresh context.

Optionally STOP and call the AskUserQuestion tool to clarify. Ask whether they'd like a brief summary of PRODUCT.md appended to CLAUDE.md for easier agent reference. If yes, append a short **Design Context** pointer section there.

## EXTENSION

### Codebase exploration: file priority order

1. `README.md` / `README.rst` at root - product purpose, target audience
2. `package.json` - tech stack, design library deps (tailwindcss, radix-ui, mui, chakra, etc.)
3. `PRODUCT.md` / `.impeccable.md` at root - prior context
4. `DESIGN.md` at root - prior visual context
5. `tailwind.config.{js,ts,mjs}` - color palette, font stack, spacing scale
6. `src/styles/`, `app/globals.css`, `public/css/` - CSS custom properties
7. `src/components/` or `app/components/` - existing component patterns
8. `public/favicon.ico`, `public/logo.*`, `assets/brand/` - brand assets
9. Routing convention (`/app/*` vs `/about` vs `/dashboard`) - register signal

### Register hypothesis decision matrix

| Signal | Brand | Product |
|---|---|---|
| Routes at `/`, `/about`, `/blog/*`, `/pricing` | ++ | - |
| Routes at `/app/*`, `/dashboard`, `/settings`, `/(auth)` | - | ++ |
| Hero sections with display type | ++ | - |
| Data tables, dense forms | - | ++ |
| Marketing copy in copy | ++ | - |
| User-input forms with validation | - | ++ |
| Scroll-driven motion | + | - |
| Keyboard shortcuts, command palettes | - | ++ |
| Single-purpose viewports (long-scroll story) | ++ | -- |

If signals are mixed (a product with a marketing landing), ask the user which surface is the project's primary register.

### PRODUCT.md anti-pattern: inferred-everything

Bad: Claude reads the prompt "build a fitness app" and writes a 200-line PRODUCT.md inferring users, purpose, personality, anti-references, principles, and accessibility from scratch, then asks for blanket "confirm?"

Good: Claude reads the prompt, finds README is sparse, asks 2 questions (who uses this; what differentiates it from MyFitnessPal), gets answers, writes a draft with the 2 user-supplied facts + 2 inferred placeholders marked `[INFERRED: ...]`, asks the user to confirm or correct the inferences.

The line: never synthesize content the user didn't supply or directly approve.

## WHAT'S MISSING

- **No way to scope teach to a sub-surface.** All teach writes are project-level; what if the project has 3 sub-brands (parent company + 2 product brands)? No PRODUCT.md-per-surface model.
- **No teach versioning.** What if the brand evolves? PRODUCT.md gets overwritten; no history kept of what changed and when.
- **No exit criteria.** When is teach "done"? Implicit "user confirms" but no checklist for what makes PRODUCT.md complete enough.
- **No PRODUCT.md template variations by register.** Same template for brand and product, but a brand PRODUCT.md probably wants more about emotional resonance, a product PRODUCT.md more about user workflows.
- **No interaction with version control.** Teach writes files but doesn't commit them; the user has to manage git themselves.
- **No PRODUCT.md schema validation.** Sections are described but no machine-readable schema; if a teammate manually edits and renames "Users" to "Audience", every other impeccable command breaks silently.
