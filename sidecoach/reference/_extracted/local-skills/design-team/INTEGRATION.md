# design-team - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/design-team/SKILL.md`

## What this skill provides

A **multi-agent sprint orchestrator** with specialized roles, creative-director review gate, and persistent team state. Uses Claude Code's Agent tool to dispatch role-played subagents in parallel for research and build phases, then runs the creative director review in the main thread.

## Execution model: 4-phase workflow

### Phase 1: Research (parallel, text-only)
Dispatch research-role subagents in parallel. Each receives:
- Its role persona
- The user's brief
- PRODUCT.md content (inlined)
- DESIGN.md content (inlined, if exists)

Each subagent returns a brief (max 500 words). Research agents do NOT write files - text only.

**Typical research dispatch:**
- Researcher: competitor analysis, reference gathering, market context
- Copywriter: headlines, body copy, CTAs, microcopy
- Brand Strategist: alignment check against PRODUCT.md
- Content Strategist: information hierarchy, messaging framework

### Phase 2: Build (parallel, file writes)
Dispatch builder-role subagents in parallel. Each receives:
- Its role persona
- All research briefs from Phase 1
- PRODUCT.md + DESIGN.md content
- Specific assignment (which section/page/component)
- Non-overlapping file paths (builders MUST NOT write to the same files)

Builders work in isolation - they do not see each other's output during the build.

**Typical build dispatch:**
- Design Engineer A: hero section + navigation
- Design Engineer B: features section + pricing
- Social Media Designer: OG images + social cards

### Phase 3: Review (main thread, sequential)
Creative director runs in MAIN session (NOT subagent) - needs full context + QA pipeline access.

1. Read built files
2. Run QA pipeline:
   - `/oracle audit` (a11y, performance, theming, responsive, anti-patterns)
   - `/oracle critique` (AI-slop, Nielsen heuristics, cognitive load)
   - `/oracle polish` (alignment pass against design system)
   - `make-interfaces-feel-better` 14-point checklist
   - DESIGN.md lint (if present)
3. Check cross-section consistency (typography, spacing, color palette, components)
4. Per-section verdict:
   - **Approve**: no changes needed
   - **Revise**: specific notes (exact file, line, issue, fix)
   - **Reject**: fundamental problems requiring rebuild (rare)

### Phase 4: Revise (targeted, ONE round)
For "Revise" sections: dispatch builder subagents with CD's notes. ONE ROUND ONLY. If CD still has issues, CD fixes directly in main thread (prevents infinite revision loops).

For "Reject" sections: CD rebuilds in main thread with full context.

## Roles catalog

### Research Phase (text-only)
| Role | What they produce |
|---|---|
| Researcher | Competitor analysis, reference examples, market context |
| Copywriter | Headlines (3-5 options), body copy, CTAs, microcopy, error messages |
| UX Designer | User flow descriptions, IA, wireframe descriptions (text) |
| Brand Strategist | Brand alignment assessment, tone guidance, positioning |
| Content Strategist | Content hierarchy, messaging framework |
| SEO Specialist | Keywords, meta descriptions, structured data, heading hierarchy |
| Marketing Strategist | Campaign framing, audience targeting, conversion funnel |

### Build Phase (file writes, parallel)
| Role | What they build |
|---|---|
| Design Engineer | Component implementations, responsive layouts, interactive elements |
| Graphic Designer | Visual compositions, illustrations, decorative elements |
| Social Media Designer | Platform-specific social content (uses social-media skill specs) |
| Editorial Designer | Long-form layouts, article templates, reading-optimized designs |
| Motion Designer | Animation specifications, transition timing, interaction choreography |
| Print Designer | Print-specific layouts, CMYK, bleed areas |

### Review/Revise Phase
| Role | What they do |
|---|---|
| Creative Director | Reviews all output, runs QA pipeline, enforces cross-section consistency |
| Accessibility Specialist | Assists CD with WCAG audit, keyboard nav, SR testing |
| UX Writer | Assists builders during revision with copy polish |

## Personality system (3-axis profile)

| Axis | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Boldness | Conservative | Measured | Balanced | Confident | Dramatic |
| Playfulness | Serious | Professional | Warm | Lively | Whimsical |
| Precision | Loose | Flexible | Thorough | Meticulous | Exacting |

**Default profiles by role type:**
- Researchers: Boldness 2, Playfulness 2, Precision 4
- Builders: Boldness 3, Playfulness 3, Precision 3
- Creative Director: Boldness 4, Playfulness 2, Precision 5

### Conviction scores (affects CD-feedback response)
- **High** (builder default): Pushes back on CD with design rationale
- **Moderate**: Weighs feedback, accepts most, flags concerns
- **Low** (assistant default): Accepts feedback and implements

## Team state (persistent)

Persists to `~/.claude/design-teams/` (per-machine, NOT checked into repos).

### Files
- `team.json` - agent roster with role, personality, conviction
- `memory.json` - per-agent preference/learning entries with salience scores (decay 0.02/day, prune below 0.1)
- `history.json` - past sprint summaries

## When to use

**Use for:**
- Full landing pages or multi-section pages
- Campaign asset creation (hero + social + email)
- Design system creation or major extension
- Multi-page site builds
- Tasks where parallel specialized work + review improves quality

**Do NOT use for:**
- Single component builds (use oracle/sidecoach + component-gallery-reference)
- Bug fixes or minor tweaks
- Non-UI work
- Tasks where team orchestration overhead exceeds benefit

## Subagent dispatch template (verbatim)

```
Agent({
  description: "[Role]: [specific assignment]",
  prompt: `You are a [Role] on a design team.

Personality: Boldness [N]/5, Playfulness [N]/5, Precision [N]/5
Conviction: [high/moderate/low]

## Your Assignment
[Specific task description]

## Brand Context (from PRODUCT.md)
[Inlined PRODUCT.md content]

## Design Tokens (from DESIGN.md)
[Inlined DESIGN.md content, if exists]

## Research Briefs (Phase 2 only)
[Inlined briefs from Phase 1]

## Constraints
- Write to these files only: [specific paths]
- Do not modify files outside your assignment
- Use design tokens from DESIGN.md, not hardcoded values
- [Role-specific constraints]

## Output Format
[What to produce and how to format it]`
})
```

## How sidecoach should query / integrate this skill

### Trigger conditions

design-team should kick in when sidecoach detects:
- Full landing page or multi-section build
- Campaign asset creation (hero + social + email)
- Design system creation
- Multi-page site build
- User explicitly says: "design team", "design sprint", "creative director", "multi-agent design", "collaborative design", "team design", "design review", "CD review"

### Which sidecoach flows / verbs map to design-team

| Sidecoach verb | Should trigger design-team? | Why |
|---|---|---|
| `/sidecoach craft <large-feature>` | YES if multi-section | Parallel builders + CD review beats single-thread |
| `/sidecoach craft <single-component>` | NO | Single component = single thread, no parallelism benefit |
| `/sidecoach shape <feature>` | NO | Shape is the strategy phase; design-team is for execution |
| `/sidecoach polish <target>` | NO | Polish is tactical; doesn't need a team |
| `/sidecoach audit <target>` | PARTIAL - the CD review pattern is the audit | Sidecoach Flow N already does this; design-team's CD role overlaps |
| `/sidecoach critique <target>` | YES | The CD role IS the critique role |
| Landing page request | YES | Canonical use case |
| Multi-page site | YES | Canonical use case |

### Sidecoach orchestrator hook for design-team

When the user invokes a craft verb on a sufficiently large surface (heuristic: >3 distinct sections OR >5 distinct components OR user uses the word "landing page" / "site" / "campaign"), sidecoach should:

1. Detect the scope
2. Surface via AskUserQuestion: "This looks like a multi-section build. Should I run it as a design-team sprint (parallel agents + CD review) or as a single-thread craft?"
   - Design-team sprint (Recommended for landing pages / multi-page)
   - Single-thread craft (Recommended for tight integration / single dev preview)
3. If design-team selected, dispatch using the skill's 4-phase pattern

### Query shape / integration spec

```typescript
{
  source: 'design-team',
  sprintScope: 'landing-page' | 'multi-page' | 'campaign' | 'design-system',
  sections: [
    { name: 'hero', assignedRole: 'Design Engineer A', files: ['hero.tsx'] },
    { name: 'features', assignedRole: 'Design Engineer B', files: ['features.tsx'] },
    { name: 'social', assignedRole: 'Social Media Designer', files: ['og-image.tsx'] },
  ],
  researchRoles: ['Researcher', 'Copywriter', 'Brand Strategist'],
  buildRoles: ['Design Engineer A', 'Design Engineer B', 'Social Media Designer'],
  cdReview: {
    role: 'Creative Director',
    runInMainThread: true,        // CRITICAL - CD must have full context
    qaPipeline: [
      'sidecoach-flow-N-audit',
      'sidecoach-flow-N-critique',
      'sidecoach-flow-N-polish',
      'make-interfaces-feel-better-checklist',
      'design-md-lint',
    ],
  },
  revisionRounds: 1,              // ONE round max, then CD fixes directly
}
```

### Cross-section consistency rules (CD enforces, sidecoach should validate)

The CD must verify across builder outputs:
- Typography: same font families, weights, scale tokens across sections
- Spacing: same spacing scale (4px / 8px grid) honored across sections
- Color palette: no off-token colors injected by any builder
- Component patterns: same button shape, same card shadow recipe, same border radius
- Motion timing: same easing curves, same duration scale

Sidecoach Flow N can extend the existing 159-rule validator framework with **cross-section consistency rules** that fire only after a multi-agent sprint.

### Persistent team state - sidecoach should respect

`~/.claude/design-teams/` is per-machine. Sidecoach should NOT replicate or override this state - the design-team skill owns it. Sidecoach can READ team.json and memory.json to surface "this team has worked on X before" context.

## What's well-stocked

- Detailed role catalog (16 roles across 3 phases)
- Personality + conviction system for non-stochastic agent behavior
- Persistent team state (team.json, memory.json, history.json)
- Clear "use for / don't use for" boundaries
- Subagent dispatch template (lifted verbatim above)
- CD-in-main-thread architectural insight (subagents lose context for review)

## What's missing

- No example team.json with realistic agent roster
- No mechanism to enforce "non-overlapping file paths" - relies on prompt-engineering the builders
- No revision-loop counter or escalation policy beyond "ONE round only"
- No integration callbacks to other skills (CD runs oracle via prompt, not as a programmatic call)
- No telemetry on which roles produced the most CD-revisions historically (could inform personality/conviction defaults)

## What sidecoach is currently missing

1. **No `/sidecoach team <feature>` verb.** A landing page request currently runs as single-thread craft; should detect scope and offer the team dispatch pattern.
2. **No cross-section consistency rules in Flow N.** The 159-rule validator framework doesn't have rules that fire across multiple builder outputs (typography drift, spacing scale drift, color palette drift).
3. **No CD-role implementation in sidecoach.** The CD pattern (main-thread review + sequential per-section verdict) is not encoded as a sidecoach flow.
4. **No team-state read in sidecoach orchestrator.** Sidecoach does not currently read `~/.claude/design-teams/*.json` for prior context.

## Recommended sidecoach integration

Add to sidecoach as a new high-level orchestration mode:

```typescript
// In sidecoach-orchestrator.ts
if (scope === 'multi-section' || scope === 'landing-page' || scope === 'campaign') {
  const teamSprint = await runDesignTeamSprint({
    research: ['Researcher', 'Copywriter', 'Brand Strategist'],
    build: assignBuildersToSections(sections),
    cdReview: {
      runInMainThread: true,
      qaFlows: ['flow-N-audit', 'flow-N-critique', 'flow-N-polish'],
      crossSectionRules: crossSectionConsistencyRules,
    },
    revisionRounds: 1,
  });
  return teamSprint;
}
```

This is the spec for the next wiring step.
