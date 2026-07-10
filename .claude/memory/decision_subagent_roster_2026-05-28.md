---
name: Subagent roster - close OMC 19-agent gap?
description: Research outcome for T-0024. Recommendation NO close, with three watch-list candidates deferred.
type: decision
relates_to: [session_2026-05-28_omc-research-synthesis.md, session_2026-05-25_sidecoach_omc_gap_analysis.md]
---

Choice made: do NOT add named specialist agent definitions to close the 19-agent gap with OMC. Keep the current pattern of "spawn a general-purpose teammate with a detailed prompt" as the default lane for specialist work, and watch three candidates (critic, tracer, debugger) for future repeat-use signal before reconsidering.

## Inventory

### OMC roster (19 agents at https://github.com/Yeachan-Heo/oh-my-claudecode/tree/main/agents)

| # | OMC name | model | tools | what it does (one line) |
|---|---|---|---|---|
| 1 | analyst | opus | read-only | pre-planning requirements analysis - finds gaps, guardrails, edge cases before plan exists |
| 2 | architect | opus | read-only | strategic architecture + debugging advisor, file:line evidence, trade-off honest |
| 3 | code-reviewer | opus | read-only | severity-rated review (CRITICAL/HIGH/MEDIUM/LOW) with confidence ratings, spec compliance first |
| 4 | code-simplifier | opus | full | refactor for clarity preserving exact behavior, project-convention bound |
| 5 | critic | opus | read-only | final quality gate - gap analysis ("what's missing"), multi-perspective lenses, 10x cost-of-false-approval framing |
| 6 | debugger | sonnet | full | root-cause analysis, regression isolation, build/compile error resolution, minimal-fix discipline |
| 7 | designer | sonnet | full | UI/UX implementation with intentional aesthetic direction, framework-idiomatic components |
| 8 | document-specialist | sonnet | read-only | external docs lookup - local repo, curated backends, official docs, with source URLs |
| 9 | executor | sonnet | full | focused implementer - smallest viable diff, no scope expansion, verify before report |
| 10 | explore | haiku | read-only | codebase search - absolute paths, ALL matches, relationships explained |
| 11 | git-master | sonnet | full | atomic commits, style-matched messages, safe rebasing with --force-with-lease |
| 12 | planner | opus | full | strategic planning with interview workflow, 3-6 step plans saved to .omc/plans/ |
| 13 | qa-tester | sonnet | full | interactive CLI testing in tmux, clean teardown, PASS/FAIL evidence per assertion |
| 14 | scientist | sonnet | read-only | data analysis in Python, [FINDING] backed by stats, hypothesis-driven structure |
| 15 | security-reviewer | opus | read-only | OWASP Top 10, secrets, severity x exploitability x blast radius |
| 16 | test-engineer | sonnet | full | test strategy + TDD - 70/20/10 pyramid, one behavior per test, flaky-test diagnosis |
| 17 | tracer | sonnet | full | evidence-driven causal tracing - competing hypotheses, evidence for/against, ranks by strength |
| 18 | verifier | sonnet | full | evidence-based completion checks - fresh test output, lsp clean, VERIFIED/PARTIAL/MISSING per criterion |
| 19 | writer | haiku | full | technical docs - all code examples verified to run, scannable structure |

### Our roster

Harness-provided `subagent_type` values (12):
- general-purpose - catch-all, all tools
- Explore - read-only codebase search, no edit/write
- Plan - read-only implementation planning, no edit/write
- code-architect (feature-dev) - feature architecture blueprints from existing patterns
- code-explorer (feature-dev) - deep feature analysis tracing execution paths
- code-reviewer (feature-dev) - bug/security/quality review with confidence filtering
- agent-sdk-verifier-py / agent-sdk-verifier-ts - verify Agent SDK apps
- claude-code-guide - questions about Claude Code CLI, Agent SDK, Anthropic API
- claude - catch-all (general-purpose alias)
- statusline-setup - status line configuration
- conversation-analyzer (hookify) - find hook candidates in transcripts

Custom agents on disk: NONE. `~/.claude/agents/` does not exist, no repo-scoped `.claude/agents/<name>.md` files anywhere in dotfiles/sidecoach/endow/reference.

Skill layer carrying specialist behavior:
- `/sidecoach` (26 flows, 5 modes) - design orchestration
- `/social-media`, `/visual-effects`, `/icon-source`, `/design-team`, `/tactical-polish`, `/motion-reference`, `/fontshare-reference`, `/design-references`, `/component-gallery-reference` - design peer skills
- `/verify`, `/security-review`, `/code-review`, `/simplify` - QA layer
- `superpowers:systematic-debugging`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:writing-plans`, `superpowers:brainstorming` - process discipline
- `/reflect`, `/init`, `/run`, `/loop`, `/schedule` - meta and utility
- `/discord:*`, `/figma:*`, `/claude-api`, `/feature-dev`, `/agent-sdk-dev:new-sdk-app` - venue-specific

Process discipline carried in `~/.claude/CLAUDE.md`:
- Verification Protocol (visual + interactive + side-by-side + completeness)
- Debugging Protocol (delta-first, no source-diving without trace)
- Self-Analysis Protocol (after any failure)
- Gut Check
- Beats Discipline (mandatory per-task writes)
- Question-Asking Protocol (AskUserQuestion for 3+ options)

## Mapping table (OMC -> ours)

| OMC | Our analog | Gap rating |
|---|---|---|
| analyst | Plan (loose), Question-Asking Protocol, `superpowers:brainstorming` | minor |
| architect | code-architect, code-explorer | minor |
| code-reviewer | code-reviewer (feature-dev), `/code-review` skill, `code-review:code-review` skill | none |
| code-simplifier | `/simplify` skill, `/code-review --fix` | none |
| critic | none direct - CLAUDE.md verification protocol catches some; `superpowers:requesting-code-review` partial | **material** |
| debugger | CLAUDE.md Debugging Protocol, `superpowers:systematic-debugging` skill | minor |
| designer | sidecoach 26 flows + 4 design peer skills (much larger coverage) | none (we're ahead) |
| document-specialist | claude-code-guide (for SDK/CLI/API), WebFetch + WebSearch on general-purpose | minor |
| executor | main thread or general-purpose teammate | none |
| explore | Explore (direct match) | none |
| git-master | main thread handles commits with CLAUDE.md git protocol; no specialist | minor |
| planner | Plan + EnterPlanMode + `superpowers:writing-plans` + `feature-dev:code-architect` | minor |
| qa-tester | none - we use cmux + browser tools manually | minor (we don't run CLI services via tmux as a pattern) |
| scientist | none | none (we don't do data analysis) |
| security-reviewer | `/security-review` skill | minor (we have it as a skill not an agent) |
| test-engineer | `superpowers:test-driven-development` skill | minor |
| tracer | none direct - CLAUDE.md Debugging Protocol partial | **material** |
| verifier | `/verify` + `superpowers:verification-before-completion` + verify-before-done.sh hook (T-0017) | minor (we may be stronger - hook-enforced) |
| writer | none - the assistant writes docs inline | none (we don't generate docs as a separate concern) |

Material gaps: 2 (critic, tracer). All other OMC roles either already exist in our layer or are not work we actually do.

## 5 most impactful gap candidates (the only ones that would justify adding a file)

If we ever do add specialists, these are the highest-leverage candidates, ranked:

1. **critic** - distinct from code-reviewer in that it forces gap analysis ("what's not there") and multi-perspective lenses. Would integrate cleanly with sidecoach's audit/critique cycle (T-0009 retry-control). Watch-list signal: 3+ sessions where a general-purpose review missed something a structured critic prompt would have caught.
2. **tracer** - evidence-driven causal tracing with competing hypotheses. CLAUDE.md Debugging Protocol mandates the discipline but a tracer agent would enforce the structure (observation, hypotheses, evidence for/against, next probe). Watch-list signal: 3+ failed-debug cycles where source-diving consumed more than 30 minutes.
3. **debugger** - similar enforcement value, narrower (root cause + minimal fix). Probably absorbed by tracer if we ever build it.
4. **document-specialist** - would beat WebSearch+general-purpose for repeated external docs lookups. Watch-list signal: we start hitting the same external docs (e.g., Lenis, GSAP, Framer Motion APIs) multiple times per session.
5. **git-master** - atomic commits + style-match. Probably not worth a file; the main thread already does this well with CLAUDE.md's commit protocol.

Filenames if built (deferred):
- `~/.claude/agents/critic.md` - description: "Gap-analysis reviewer for plans, designs, and code. Lists what's missing alongside what's wrong. Multi-perspective lenses (executor, stakeholder, skeptic). Read-only." Tools: Read, Grep, Glob, WebFetch.
- `~/.claude/agents/tracer.md` - description: "Evidence-driven causal tracing for regressions. Enumerates competing hypotheses with evidence for/against, ranks by strength, recommends the next probe." Tools: Read, Grep, Glob, Bash.
- `~/.claude/agents/debugger.md` - description: "Root-cause + minimal-fix for failures. Reproduces the bug, traces to root, applies smallest viable change." Tools: Read, Edit, Grep, Glob, Bash.

## Alternatives considered

- **Option A: Add all 19 specialist files for symmetry.** Rejected because it would create 19 prompt definitions that drift from each other and from CLAUDE.md, multiply maintenance, and add no benefit beyond what a detailed teammate prompt already provides. OMC's audience needs them because OMC is a published kit; ours is a personal workstation.
- **Option B: Add 5-7 high-value specialists (critic, tracer, debugger, document-specialist, git-master, scientist, qa-tester).** Rejected for now because the empirical usage data does not support it. Looking back through 2026-05 beats, the general-purpose teammates closed the work cleanly (hook-sweep team 2026-05-27, omc-research team 2026-05-28, arch-detective team 2026-05-28 for T-0008). No instance where a named specialist would have demonstrably saved a turn that a detailed prompt did not.
- **Option C: Add 0 specialists, document the call, watch three candidates for repeat-use signal.** CHOSEN.

## Why this one

Three reasons:

1. **The detailed-prompt pattern already amortizes well.** Sidecoach teammate prompts (see session_2026-05-27_hook-sweep-team.md and session_2026-05-28_omc-research-synthesis.md) routinely carry 50-200 lines of context. Adding a 5-line frontmatter file does not measurably reduce that overhead, because the context is in the spawn prompt, not in the agent definition.
2. **Most of OMC's 19 are process discipline, not capability.** analyst/critic/verifier/tracer are framings (review like a final gate, trace evidence not opinion, etc.). Our equivalent layer is CLAUDE.md protocols + hook enforcement (verify-before-done.sh, validation-guard.sh, second-fix-gate.sh, multiple-choice-enforce.sh). Hooks catch the discipline failures at mechanical layer; OMC catches them at prompt layer. Both work; ours is already shipped.
3. **OMC's designer is a single sonnet agent. Ours is 26 sidecoach flows + 4 peer skills + DESIGN.md spec + Polish Standard validators + Extended Domain validators + taste validator + bench harness.** On the design lane specifically, we are dramatically ahead, not behind. Counting "19 vs 12 subagents" understates that asymmetry.

The 19-vs-12 number framing is misleading. The right framing is: "they distribute discipline across 19 agent definitions; we distribute it across 12 subagents + ~60 skills + 6 hooks + CLAUDE.md + sidecoach's 26 flows." Adding agent definitions to match their count would not close a real gap, it would duplicate enforcement that already exists.

## Revisit when

- We see 3+ sessions where a general-purpose review missed something that critic's gap-analysis framing would have caught. Then add `critic.md`.
- We see 3+ debug sessions burning >30 minutes on source-diving without naming a competing hypothesis. Then add `tracer.md`.
- We add a new venue (e.g., a recurring data-analysis lane) that needs a scientist-class agent. Then add the specific agent.
- OMC ships a feature that depends on the agent-definition layer specifically (not their hook layer or skill layer). Then re-audit.
- We discover that detailed prompts are costing meaningful prompt tokens compared to a tight agent definition. Run the math; if true, convert 3-5 highest-frequency lanes to agent files.

The trigger is repeat-use signal, not symmetry with OMC. Symmetry with a published kit is not a goal of a personal workstation.

## Files touched

- `TASKS.md` - T-0024 filed and marked done
- `.claude/memory/MEMORY.md` - index updated
- `.claude/memory/decision_subagent_roster_2026-05-28.md` - this file
