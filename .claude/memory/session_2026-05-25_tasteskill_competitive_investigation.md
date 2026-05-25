---
name: Taste-skill repo competitive investigation
description: Deep read of Leonxlnx/taste-skill to find what it does that sidecoach doesn't
type: reference
relates_to: [session_2026-05-24_sprint4_closed.md, session_2026-05-22_task2_phase2_block3.md]
---

# Taste-skill repo competitive investigation (Jonah, 2026-05-25)

Cloned https://github.com/Leonxlnx/taste-skill to /tmp/taste-skill. 12 skills total, one
master "taste-skill" plus variants (gpt-taste, soft-skill, minimalist-skill, redesign-skill,
brutalist-skill, stitch-skill, output-skill) and three image-gen skills.

## Activation model

Each skill is a single SKILL.md with YAML frontmatter, installed via `npx skills add`
(vercel-labs/agent-skills CLI). No flows, no validators, no orchestrator. The agent loads
the SKILL.md verbatim as instructions and follows them inline during generation. There is
no post-hoc validation step - the rules are constraints on the WRITER, not checks on the
output.

## Philosophy

Taste-skill operationalizes "taste" as **bias correction**. The framing across all SKILL.md
files: LLMs have statistical defaults toward AI-cliche patterns (Inter font, centered hero,
purple/blue glow, 3-card row, John Doe, "Elevate/Seamless/Unleash"). The skill enumerates
those defaults as FORBIDDEN and prescribes specific replacements. It's rule-based but the
rules are **linguistic and aesthetic** ("NO purple button glows", "NO startup slop names
like Acme/Nexus/SmartFlow"), not numeric.

Three top-of-file "dials" tune behavior: DESIGN_VARIANCE (1-10), MOTION_INTENSITY (1-10),
VISUAL_DENSITY (1-10). gpt-taste adds a "Python RNG" pre-flight where the model simulates
`random.choice()` seeded by prompt char count to FORCE variation between generations.

## Specific things sidecoach doesn't have

### 1. Named-pattern forbidden lists (linguistic, not measurable)
- "THE LILA BAN: The 'AI Purple/Blue' aesthetic is strictly BANNED. No purple button glows,
  no neon gradients."
- "NO Startup Slop Names: 'Acme', 'Nexus', 'SmartFlow'. Invent premium, contextual brand names."
- "NO Filler Words: 'Elevate', 'Seamless', 'Unleash', 'Next-Gen', 'Delve', 'Tapestry', or
  'In the world of...'"
- "NO Generic Names: 'John Doe', 'Sarah Chan', 'Jack Su' are banned."
- "NO Fake Numbers: Avoid 99.99%, 50%, basic phone numbers. Use organic, messy data (47.2%,
  +1 (312) 847-1928)"
- "Exclamation marks in success messages. Remove them. Be confident, not loud."
- "'Oops!' error messages. Be direct: 'Connection failed. Please try again.'"
- Meta-label ban: "BANNED FOREVER are labels like 'SECTION 01', 'SECTION 04', 'QUESTION 05'"
- "NO 3-Column Card Layouts: The generic 3 equal cards horizontally feature row is BANNED.
  Use a 2-column Zig-Zag, asymmetric grid, or horizontal scrolling approach instead."

Sidecoach's flowD category-reflex detector catches "request a demo", "screenshot carousel
of fake dashboards" but does NOT enumerate this many specific linguistic/naming/numeric
patterns at the source-text level.

### 2. Pre-generation randomization protocol
gpt-taste mandates a `<design_plan>` block BEFORE writing code:
"You MUST simulate a Python script execution in your <design_plan> before writing any UI
code. Use a deterministic seed (e.g., character count of the user prompt modulo math) to
simulate random.choice() and strictly select: 1 Hero Architecture, 1 Typography Stack, 3
Unique Component Architectures, 2 Advanced GSAP Paradigms. You are forbidden from
defaulting to the same UI twice."

Sidecoach validates AFTER generation. Taste-skill prevents AI-template-y output by forcing
explicit variation choice BEFORE generation. The Python RNG is theater (the model isn't
running Python) but the discipline forces the model to commit to one path from N
alternatives.

### 3. Mandatory pre-flight checklist embedded in skill
Both taste-skill (Section 10) and gpt-taste (Section 8) ship with a pre-output verification
matrix the model must run against its own code BEFORE returning:
- "Hero Math Verification: Explicitly state the max-w class you are applying to the H1 to
  GUARANTEE it will flow horizontally in 2-3 lines."
- "Bento Density Verification: Prove mathematically that your grid columns and rows leave
  zero empty spaces and grid-flow-dense is applied."
- "Label Sweep & Button Check: Confirm no cheap meta-labels exist, and button text
  contrast is perfect."

Sidecoach's 159 rules are checked by a validator. Taste-skill puts the checklist INTO the
writer's loop - the model self-audits before output, which catches voice/content/hero
issues a post-hoc CSS-token validator can't see.

### 4. "Strategic Omissions" - what AI typically forgets
redesign-skill enumerates things AI never adds without prompting:
- "No legal links" (privacy, terms in footer)
- "No 'back' navigation. Dead ends in user flows."
- "No custom 404 page"
- "No form validation"
- "No 'skip to content' link"
- "No cookie consent"

This is a category sidecoach's accessibility/responsive flows touch but doesn't enumerate
as "things AI forgets when generating greenfield." It's framed as omission detection, not
rule compliance.

### 5. The "Jane Doe" content layer
Taste-skill has an entire "Content & Data" anti-pattern category for content authenticity:
generic names, fake round numbers, startup-slop brand names, AI filler vocabulary,
exclamation-mark enthusiasm, "Oops!" friendliness, Title Case On Every Header. This is
specifically the category where sidecoach missed "fictional install URLs" and "Memory in
layers. Not a feature, a discipline." rhetorical templates. Taste-skill doesn't catch
those exact patterns either, but its FRAMING is closer - it asks "is this content real or
template-y?" not "does this CSS comply with token X?"

### 6. Variant skills cover stylistic register explicitly
soft-skill, minimalist-skill, brutalist-skill are separate SKILL.md files the user composes.
A project picks register by skill choice. Sidecoach loads register from PRODUCT.md but
doesn't have specialized validators per register - a brutalist project and a minimalist
project use the same 159 rules.

## Where sidecoach is stronger

- 159 measurable rules across 10 domains; taste-skill has rules but they're scattered
  across SKILL.md prose, no machine-readable validation
- Per-flow memory tracking, orchestration, composite flows; taste-skill has zero workflow
- Tokens, PRODUCT.md/DESIGN.md as separate spec files; taste-skill is a single prompt blob
- Reference systems (component.gallery, fontshare); taste-skill recommends fonts inline

## Verdict

Worth borrowing the LINGUISTIC anti-pattern lists and the pre-flight self-audit checklist
mechanism. Not worth replacing sidecoach's architecture - taste-skill is a fancy system
prompt, sidecoach is a pipeline.

## Files touched
- /tmp/taste-skill/ (cloned for read)
- this memory
