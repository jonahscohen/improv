---
name: design-team
description: Orchestrate multi-agent design sprints with specialized roles, creative director review, and persistent team state. Use when the user wants a design sprint, collaborative design session, multi-section layout, landing page build, campaign creation, or any task that benefits from multiple specialized perspectives working in parallel. Triggers on "design team", "design sprint", "creative director", "multi-agent design", "collaborative design", "team design", "design review", "CD review", and when a task is complex enough to warrant research + build + review phases (e.g., full landing pages, multi-page sites, campaign assets, design system creation).
---

# Design Team

Orchestrate multi-agent design sprints with specialized roles, a creative director review gate, and persistent team state.

## Execution Model

Hybrid: parallel subagents for research and build phases, main-thread creative director for review. This gives you real parallelism where it matters (multiple designers building simultaneously) while keeping the review in the main thread where it has full context.

## Four-Phase Workflow

### Phase 1: Research (parallel, text-only)

Dispatch research-role subagents in parallel using Claude Code's Agent tool. Each subagent receives:
- Its role persona (from the Roles section below)
- The user's brief/request
- PRODUCT.md content (inlined, not as a file path)
- DESIGN.md content (inlined, if it exists)

Each subagent returns a brief (max 500 words) to the main thread. Research agents do NOT write files. They produce text output only.

**Typical research dispatch:**
- Researcher: competitor analysis, reference gathering, market context
- Copywriter: headlines, body copy, CTAs, microcopy options
- Brand Strategist: alignment check against PRODUCT.md, tone guidance
- Content Strategist: information hierarchy, messaging framework

Only dispatch roles relevant to the task. A simple component doesn't need 7 researchers.

### Phase 2: Build (parallel, file writes)

Dispatch builder-role subagents in parallel. Each builder receives:
- Its role persona
- All research briefs from Phase 1
- PRODUCT.md + DESIGN.md content
- Specific assignment (which section/page/component to build)
- File paths to write to (non-overlapping - builders MUST NOT write to the same files)

Builders work in isolation. They do not see each other's output during the build phase.

**Typical build dispatch:**
- Design Engineer A: hero section + navigation
- Design Engineer B: features section + pricing
- Social Media Designer: OG images + social cards

Scale the number of builders to the task. One builder for a single component. Three or more for a full page.

### Phase 3: Review (main thread, sequential)

The creative director review runs in the main session (NOT as a subagent). This is critical - the CD needs full context of what was built and access to the project's QA pipeline.

The CD reviews each builder's output sequentially:

1. Read the built files
2. Run the existing QA pipeline:
   - `/sidecoach audit` (a11y, performance, theming, responsive, anti-patterns)
   - `/sidecoach critique` (AI-slop detection, Nielsen heuristics, cognitive load)
   - `/sidecoach polish` (alignment pass against design system)
   - `make-interfaces-feel-better` 14-point checklist
   - `DESIGN.md` lint (if present)
3. Check cross-section consistency (typography, spacing, color palette, component patterns)
4. Produce a review document with per-section verdicts:
   - **Approve**: no changes needed
   - **Revise**: specific notes on what to fix (exact file, line, issue, fix)
   - **Reject**: fundamental problems requiring a rebuild (rare)

### Phase 4: Revise (targeted, one round)

For sections marked "Revise": dispatch builder subagents with their review notes. Each builder receives:
- Their original assignment context
- The CD's specific revision notes
- The current state of their files

**One round only.** If the CD still has issues after revision, the CD fixes directly in the main thread rather than ping-ponging. This prevents infinite revision loops.

For sections marked "Reject": the CD rebuilds in the main thread with full context from research briefs and the failed attempt.

## Roles

### Research Phase (text-only, no file writes)

| Role | What they produce |
|---|---|
| Researcher | Competitor analysis, reference examples, market context, data points |
| Copywriter | Headlines (3-5 options), body copy, CTAs, microcopy, error messages |
| UX Designer | User flow descriptions, information architecture, wireframe descriptions (text, not images) |
| Brand Strategist | Brand alignment assessment, tone guidance, positioning relative to PRODUCT.md |
| Content Strategist | Content hierarchy, messaging framework, what to say where and why |
| SEO Specialist | Target keywords, meta descriptions, structured data recommendations, heading hierarchy |
| Marketing Strategist | Campaign framing, audience targeting, conversion funnel position, A/B test suggestions |

### Build Phase (file writes, parallel)

| Role | What they build |
|---|---|
| Design Engineer | Component implementations, responsive layouts, interactive elements |
| Graphic Designer | Visual compositions, illustrations, decorative elements |
| Social Media Designer | Platform-specific social content (uses social-media skill specs) |
| Editorial Designer | Long-form layouts, article templates, reading-optimized designs |
| Motion Designer | Animation specifications, transition timing, interaction choreography |
| Print Designer | Print-specific layouts, CMYK considerations, bleed areas |

### Review/Revise Phase

| Role | What they do |
|---|---|
| Creative Director | Reviews all output, runs QA pipeline, enforces cross-section consistency |
| Accessibility Specialist | Assists CD with WCAG audit, keyboard navigation review, screen reader testing |
| UX Writer | Assists builders during revision with copy polish |

## Personality System

Each agent gets a 3-axis profile that subtly shapes their system prompt:

| Axis | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Boldness | Conservative | Measured | Balanced | Confident | Dramatic |
| Playfulness | Serious | Professional | Warm | Lively | Whimsical |
| Precision | Loose | Flexible | Thorough | Meticulous | Exacting |

Default profiles by role type:
- **Researchers**: Boldness 2, Playfulness 2, Precision 4 (careful, thorough, understated)
- **Builders**: Boldness 3, Playfulness 3, Precision 3 (balanced, adaptable)
- **Creative Director**: Boldness 4, Playfulness 2, Precision 5 (high standards, serious, opinionated)

These are defaults. Override them in team.json for specific agents.

### Conviction Scores

Determines how agents respond to CD feedback during Phase 4:

- **High** (builder default): Pushes back on CD feedback with design rationale. "I chose X because Y. If we change it, we lose Z."
- **Moderate**: Weighs feedback, accepts most changes but flags concerns. "I see the issue. I'd suggest A instead of B because..."
- **Low** (default for assistant roles): Accepts feedback and implements. "Got it, fixing now."

## Team State

Persists to `~/.claude/design-teams/` (per-machine, not checked into project repos).

### team.json
```json
{
  "agents": [
    {
      "id": "eng-1",
      "role": "Design Engineer",
      "personality": { "boldness": 3, "playfulness": 3, "precision": 3 },
      "conviction": "high"
    }
  ],
  "created": "2026-05-03T00:00:00Z",
  "lastSprint": "2026-05-03T00:00:00Z"
}
```

### memory.json
```json
{
  "entries": [
    {
      "agentId": "eng-1",
      "type": "preference",
      "content": "Prefers CSS Grid over Flexbox for page layouts",
      "salience": 0.8,
      "created": "2026-05-03T00:00:00Z"
    }
  ]
}
```

Salience decays at 0.02/day. Entries below 0.1 salience are pruned. Memory is injected into agent system prompts at the start of each sprint.

### history.json

Array of past sprint summaries (what was built, who built what, CD verdict, files touched). Used for continuity across sessions.

## When to Use This Skill

**Use it for:**
- Full landing pages or multi-section pages
- Campaign asset creation (hero + social + email)
- Design system creation or major extension
- Multi-page site builds
- Any task where parallel specialized work + review improves quality

**Do NOT use it for:**
- Single component builds (just use Sidecoach + component-gallery-reference)
- Bug fixes or minor tweaks
- Non-UI work
- Tasks where the overhead of team orchestration exceeds the benefit

## Subagent Dispatch Template

When dispatching a subagent, use this structure:

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
