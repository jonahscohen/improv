# Hook taxonomy + install.sh restructure (design)

**Stamp:** `f3677189`. Supersedes the narrow v1 plan (docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md) - cmux/fable/sidecoach are now just the first instances of the general principle below.

**Jonah's principle (2026-07-15):** every hook is either (a) **dependent on an application** (cmux, justify, sidecoach, voice, discord, codex, chrome, ...) and should attach to that application's install.sh component, or (b) a **standalone upgrade** that makes Claude better regardless of any app. The end user chooses which apps to install (their hooks ride along, each described) and which standalone upgrades fit them. Nothing app-specific should sit in a base that non-users of that app receive (that is the exact bug the cmux leak was).

**Classification rule (how the judgment was made):** a hook is app-DEPENDENT only if it is meaningless / never fires without that app. A hook that merely *references* app tool-names inside a general policy (e.g. bash-guard listing forbidden `cmux` commands) is STANDALONE. Token-grep evidence over-attributes; each row below is the judgment call, not the grep.

---

## A. App-dependent hooks (attach to the app's component)

| App component | Hooks | Notes |
|---|---|---|
| **cmux** | agent-teams-guard, cmux-close-guard, cmux-teammate-shim-heal, node-shim-heal, resume-guard, resume-toggle, team-reaper, teammate-relay-stop | + the `~/.claude/cmux` tmux-shim dir. teammate-relay-stop is a cmux-teams concept (judgment call: it also mentions codex, but "teammate" = cmux teams). |
| **sidecoach** | sidecoach-keyword, sidecoach-postresponse, sidecoach-postuserp, sidecoach-preamble, sidecoach-sessionstart, sidecoach-taste-gate, sidecoach_lanes.py | already a component; hooks already wired by it (but ALSO leaked into base - fix). |
| **voice-output** | voice-gate, voice-mandate, voice-toggle | already a component. |
| **justify** | justify-source-guard, justify-watch-guard, justify-watch-standing-by | justify is an app (not currently an install.sh component - may need one, or these are personal). |
| **codex** | codex-failure-watcher, codex-rescue-guard, codex-review.py | depends on the codex CLI. |
| **chrome (claude-in-chrome)** | chrome-tabgroup-track, chrome-tabgroup-clear, chrome-tabgroup-stop | browser tab-group hygiene; only fire on chrome MCP tools. |
| **clickup** | block-clickup-writes | depends on the clickup MCP. |
| **figma/lotus** | figma-fidelity-stop | figma design-fidelity gate (judgment: figma over justify). |
| **reflect** | reflect-nudge | already a component. |
| **memory** | memory-approve, memory-nudge, memory-compact, compact-memory.py, consolidate-nudge, verify-consolidation.py, beats-rebuild, beats-staleness-guard, beats-reflect-weekly | already a component; the beats/consolidation subsystem. |
| **fable** | fable-orchestrator-guard | new opt-in component (from the v1 plan). |
| **visualizer (mcp__visualize)** | visualizer-guard | only fires on show_widget. |

## B. Standalone upgrades (selectable on their own - make Claude better regardless of app)

| Cluster | Hooks | Purpose |
|---|---|---|
| **safety** | bash-guard, content-guard, content-guard-stop, destructive-ops-guard, destructive-confirm-detect | block forbidden commands/content/destructive ops. |
| **verification** | verify-before-done, verify-before-done-stop, verify-clear, verify-manual, screenshot-open-mandate, screenshot-open-clear, second-fix-gate, validation-guard | the "verify before you claim done" discipline. Some key off chrome/cmux tools but the discipline is app-agnostic (judgment: verify-clear + validation-guard live here, not under chrome, because they ARE the verification upgrade - they just happen to trigger on those tools). |
| **question-discipline** | multiple-choice-detect-stop, multiple-choice-enforce, multiple-choice-inject-prompt, question-enforcement | force questions through AskUserQuestion. |
| **grounding** | grounding-gate, grounding-guard | grounding/anti-hallucination. |
| **api-drift** | api-drift-detector, api-drift-stop, api-drift-ack | catch breaking API/tool-contract drift. |
| **planning + git-hygiene** | plan-consistency-lint, push-ahead-check | plan-doc lint + unpushed-work surfacing. |
| **surface/presentation** | claude-surface, surface-visual-gate | detect the Claude Code surface + enforce visual presentation on rich surfaces (judgment: standalone, not visualizer-tied - claude-surface just detects; surface-visual-gate enforces the norm). |
| **model-routing** | model-router-guard | governs which model does what (cost/routing). |

## C. Shared library (not selectable; a dependency, installed with its consumers)

| Hook | Depended on by |
|---|---|
| **detect-session-model.sh** | fable-orchestrator-guard (fable) AND model-router-guard (model-routing). Must be present whenever either is. |

---

## Open judgment calls (flagged for Jonah - these are HIS domain)

1. **verify-clear / validation-guard** -> I put them in the standalone **verification** cluster (they key off chrome tools but embody the verification discipline). Alt: attach to **chrome**.
2. **surface-visual-gate / claude-surface** -> standalone **surface/presentation**. Alt: attach to **visualizer**.
3. **teammate-relay-stop** -> **cmux** (teams). Alt: **codex** (mentions codex handoff).
4. **model-router-guard** -> its own standalone **model-routing** cluster. Alt: fold into **fable** (they share detect-session-model).
5. **figma-fidelity-stop** -> **figma/lotus**. Alt: **justify**.
6. **justify hooks** -> justify is an app but NOT currently an install.sh component. Either add a `justify` component or treat these as personal/hidden.

---

## Proposed install.sh model (the two open PRODUCT decisions marked)

**Mechanism (settled - matches existing patterns):** every hook is wired into settings.json by its OWNER (app component or standalone cluster), added-on-pick and removed-on-deactivate, exactly as sidecoach/voice already do. NOTHING app- or cluster-specific stays in a base `claude/settings.json` that the merge gives everyone. A committed test asserts "every hook referenced in a component's wiring is deployed by that component" so base/deploy drift (this whole bug) cannot regress.

**PRODUCT DECISION 1 - granularity of the standalone upgrades (B).** Two viable shapes:
- **Themed clusters** (8 selectable bundles: safety, verification, question-discipline, grounding, api-drift, planning+git, surface, model-routing), each ALSO `--only`-able - mirrors the existing `skills` bundle + individual design-skill keys pattern. Fewer, meaningful choices.
- **Individual hooks** (~30 standalone toggles) - maximum choice, but a long TUI.

**PRODUCT DECISION 2 - is there a forced base, or is everything opt-in?** Jonah said the user should "choose which ones fit best," implying even standalone upgrades are choosable. But the **safety** cluster (bash-guard/content-guard/destructive-ops) is the kind most users want on by default. Options: (a) nothing forced - every cluster opt-in (default-on in the TUI, unpickable-free); (b) safety is the only always-installed base, everything else opt-in.

Both decisions shape the execution plan; neither is mine to pick. Everything else (the classification, the wiring mechanism, the anti-drift test) is settled and ready to plan against once these two are answered.

---

## What executes once the structure is confirmed (preview, not yet planned in detail)

1. Move every app-dependent hook's wiring from base `claude/settings.json` into its component (cmux first - it is the active exit-127 bug; then voice/reflect/sidecoach/memory dedupe).
2. Create the missing app components (fable; possibly justify/codex/chrome/clickup/figma if they are not to be personal).
3. Regroup the standalone clusters per DECISION 1, each with a description, `--only`-able.
4. Fix the Category-3 fresh-install danglers (claude-surface, visualizer-guard, surface-visual-gate, plan-consistency-lint, push-ahead-check, teammate-relay-stop, codex-*) by giving each a real owner (per this taxonomy) instead of the current "wired in base, deployed by nothing."
5. Wire up sidecoach-mcp (Jonah's separate ruling) as part of the sidecoach component pass.
6. Add the anti-drift test. Full self-review + Codex gate on the execution plan before touching install.sh.

---

## Decisions resolved (Jonah, 2026-07-15)

1. **Granularity: BOTH levels.** Themed cluster bundles you can check off to install the whole cluster, AND an expandable view of the full hook list so the user can edit at the individual-hook level. In install.sh terms: each cluster is a key (installs all its hooks) AND every hook is its own `--only`-able key sharing the same source (the `skills` bundle + individual design-skill keys pattern, applied to all 8 clusters). The TUI shows clusters with an expand-to-hooks affordance.
2. **Nothing forced - everything opt-in.** No base hook set. Even the safety cluster is choosable (default-checked in the TUI for sanity, but removable). Base `claude/settings.json` wires NO hooks; every hook is wired by its chosen owner. The current `config` bundle dissolves: its non-hook parts (permissions, enabledPlugins, statusLine, marketplaces) stay a small "core" merge; all hook wiring moves to components/clusters.
3. **The five apps become public selectable components:** justify, codex, chrome, clickup, figma.

## Staging (execution strategy - land active bugs first, aligned to the final model)

- **Stage 1 (active bugs + first instances):** cmux full fix (all 8 hooks + shim dir move out of base into the cmux component), fable component, sidecoach-mcp wire-up, fix the Category-3 fresh-install danglers, and add the anti-drift test. Folds all 9 Codex findings from the v1 review. Every hook moved here lands in its FINAL taxonomy home, so no rework in later stages. Detailed plan: docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md (revised).
- **Stage 2 (dissolve config):** split the config merge into "core" (permissions/plugins/statusline) + the 8 standalone clusters (each a key + per-hook keys), strip all cluster hooks out of base settings.json, wire them from their clusters. Nothing-forced becomes real here.
- **Stage 3 (remaining app components):** justify/codex/chrome/clickup/figma/reflect/memory/visualizer hook-wiring moves out of base into their components; each with descriptions.

Each stage: plan -> self-review -> Codex -> execute -> verify (sandbox `--only` matrix + the anti-drift test).
