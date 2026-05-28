---
name: OMC research synthesis (2026-05-28)
description: Four-teammate research sweep across ohmyclaudecode.com, .dev, GitHub repo, and cmux integration docs. Surfaces ideas worth absorbing into sidecoach; one queued as T-0007 (Codex/Gemini CLI orchestration).
type: project
relates_to: [session_2026-05-25_sidecoach_omc_gap_analysis.md, session_2026-05-27_hook-sweep-team.md, session_2026-05-27_agent-teams-guard-hook.md]
---

Collaborator: Jonah

## What this is

Cross-source research synthesis. Four parallel cmux teammates (r1-omc-com, r2-omc-dev, r3-omc-github, r4-cmux-omc-doc) scanned the four OMC surfaces. Builds on the 2026-05-25 gap analysis but goes deeper on the architecture and cmux integration story.

## Findings consolidated

**What OMC is** (cross-source agreement):
- 35,093-star Korean-led TypeScript Claude Code plugin, MIT, daily release cadence, active Discord (~1.4k). Solo lead (Yeachan Heo / "Bellman") with 10+ collaborators (Ambassadors + Doc Specialists).
- 19 specialized subagents + 39 skills + 4-6 execution modes (autopilot, ralph, ultrawork, team N:X, deep-interview, planning).
- Two surfaces with full parity: terminal CLI (`omc ...`) and in-session slash commands.
- Three install paths: plugin marketplace, npm global (`oh-my-claude-sisyphus`), local checkout. `/omc-setup` is the single onboarding command.
- Built on `@anthropic-ai/claude-agent-sdk` + `@modelcontextprotocol/sdk`. Vitest with 168 test files. Filesystem-first persistence (per-team task files, worktrees, inboxes, audit-log, heartbeat files). `better-sqlite3` is minor (13 hits, mostly build scripts).
- cmux integration uses the SAME tmux-shim pattern as cmux claude-teams: `~/.cmuxterm/omc-bin/tmux` shim, `tmux-compat-store.json` persistence. Sets `TMUX`, `TMUX_PANE`, `CMUX_SOCKET_PATH`, plus `NODE_OPTIONS` for Claude Code compatibility.

**Worth absorbing into sidecoach:**
1. **Modes as positioning.** autopilot/ralph/ultrawork are sticky, self-explaining "shapes of work" names. Sidecoach has 22 verbs + 36 flows but no equivalent top-level mental model.
2. **CLI surface parity.** Script-friendly access to flows. Sidecoach is slash-only.
3. **Multi-CLI orchestration.** Real Codex/Gemini panes alongside Claude is OMC's most distinctive capability. Queued as T-0007 with a caveat: full accommodation only (no half-measures - prompt adapters, output parsers, capability maps per CLI).
4. **Phase-gated retry loop with hard stop conditions.** Autopilot caps QA at 5 cycles, halts after 3 identical errors. Sidecoach polish flows could borrow.
5. **Smart model-tier routing.** Concrete 30-50% token-cost pitch via Haiku/Sonnet/Opus per task. Already on the 2026-05-25 gap-analysis list, never queued.
6. **Vitest + benchmark harness.** 168 test files plus `benchmarks/run-all.ts` with save-baseline/compare. Maps to the eval-harness gap from 2026-05-25 (sidecoach has 78 sprint-regression tests that verify correctness, no benchmarks that measure quality drift over time).
7. **Magic Keywords / single-page verb cheatsheet.** OMC's .dev site has a single-glance table mapping all execution modes to trigger words. Sidecoach's 22 verbs are buried in SKILL.md.

**Where sidecoach is genuinely differentiated (don't lose this):**
- Design domain depth: 159-rule validator framework, taste validator, DESIGN.md/PRODUCT.md grounding, polish standard. OMC has zero design intelligence.
- Beats discipline more codified than OMC's session state.
- 36 design flows vs OMC's 39 general skills.

**Risks if sidecoach goes deeper on OMC patterns:**
- OMC solo-lead bus factor (Bellman authors most releases).
- Daily hotfix cadence visible (4.14.2 -> 4.14.4 in 2 days, Windows hook regressions). High maintenance burden.
- Heavy native dep (better-sqlite3) with prebuild warnings.

## Actions taken

- **T-0007 filed** earlier in turn (Codex + Gemini CLI orchestration; scope-heavy with explicit "fully accommodate" sub-requirements a-h).
- **Follow-up arch-detective dispatch** confirmed OMC's magic-keyword mechanism is a deterministic UserPromptSubmit shell hook (`src/hooks/keyword-detector/index.ts`, ~930 lines, 2286-line Vitest suite). NOT skill auto-triggers. Sanitization order: strip code fences, inline backticks, URLs, XML, transcript headers BEFORE matching. Context-aware suppression (informational framings blocked). Per-keyword regex with word boundary and brand-collision exclusions (e.g. `ralph` excludes `ralph lauren`). Execution-gate redirects keywords to plan-mode if prompt lacks file paths/symbols. `team` keyword permanently disabled to prevent worker recursion.
- **Exec summary delivered, Jonah committed to 1-6 + CLI surface parity.** Filed as T-0008 through T-0014:
  - T-0008 [P1]: UserPromptSubmit keyword interception hook (port of OMC's keyword-detector).
  - T-0009 [P1]: Phase-gated retry loop with hard stop conditions (cap at 5, halt at 3 identical errors).
  - T-0010 [P2]: Single-page verb cheatsheet (bundle with T-0008).
  - T-0011 [P2]: Modes-as-positioning naming pass (depends on T-0008).
  - T-0012 [P2]: Per-flow model-tier routing (already on 2026-05-25 gap analysis).
  - T-0013 [P3]: Vitest benchmark harness (depends on T-0012 for cost interpretation).
  - T-0014 [P3]: Terminal CLI binary `sidecoach` mirroring slash-command surface.

## Recommended execution order

T-0008 -> T-0010 (bundled) -> T-0009 -> T-0011 -> T-0012 -> T-0013 -> T-0014 -> T-0007 (last, scope-heavy).

## Files touched

- TASKS.md (added `## sidecoach` section with T-0007)
