# Installer bucket browser - design spec

Authored against commit `1ca3ef9f`.
Collaborator: Jonah Cohen.
Validated interactively against the clickable prototype at
`docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html` (this spec
documents the structure that prototype proved out).

## Goal

Replace the installer's current interactive experience - one flat list of ~40 components
with `active / inactive / not installed` badges and a flat picker - with a **siloed bucket
browser**: purpose-grouped buckets that show a rolled-up status, open into their members,
let you drill to individual hooks, toggle anything, apply changes in one pass, and update a
setup that has drifted behind the repo. One consistent experience for first-run and
returning users.

Non-interactive paths (`--only`, `--preset`, `--yes`, `--dry-run`, `--help`,
`--prune-skills*`) are unchanged. This spec is only about the interactive TUI.

## Approved decisions

1. **Navigation: nested screens.** A bucket list; opening a bucket enters its own screen;
   opening a folder/cluster/component enters a deeper screen; back moves up. Built on the
   existing `gum` + bash stack, with a plain-text numbered-menu fallback for no-`gum`
   terminals. (Rejected: a live expand/collapse tree - `gum` can't do it; a raw-terminal
   render loop is too fragile for a bash installer.)
2. **Scope: unified.** One browser for both first-run and returning users, driven by live
   per-item status. Replaces `run_tui_gum` / `run_tui_fallback` and `returning_flow`.
3. **Apply model: staged, then apply.** Toggling marks an item pending (`+install` /
   `-uninstall`); a persistent `Apply changes (N)` runs all pending installs in one
   `--only a,b,c --yes` pass plus the uninstalls, then refreshes. Quitting with unapplied
   changes warns. (Rejected: immediate per-toggle install.)
4. **Purpose-based buckets, not the `--help` wiring categories.** The first cut used
   Core/Channels/Tools/Apps/Clusters/Skills (how components are *wired*); that was wrong.
   Buckets group by what each thing *is/does* (below).
5. **Drill depth: all the way to individual hooks, with per-hook descriptions.** A group
   with real sub-components (Beats) shows its members plus a **"Hooks" folder** that
   aggregates the hooks it depends on. A single hook-owning component (Sidecoach, codex,
   ...) drills **straight** to its hook list - no redundant inner folder. Every hook carries
   a one-line description shown inline and in the detail bar on hover.
6. **Two-state update affordance.** `↻ Update available` when the repo's remote is ahead,
   `✓ Up to date` otherwise (see Update flow).

## Bucket taxonomy (validated)

Two sections at the root. `L` = leaf (toggles). `G` = group (drills). `HF` = a hook folder
(its children are hooks). Members are the live component set at the stamp commit.

**CORE COMPONENTS** (the featured tier - the base plus the flagship products):
- **Foundation** (G) - `brain`, `config`, `statusline`, `ampersand`, `nvm` (all L)
- **Beats** (G) - `memory` (L), `reflect` (L), **Hooks** (HF: memory-approve, memory-nudge,
  memory-compact, consolidate-nudge, beats-rebuild, beats-staleness-guard, reflect-nudge)
- **Sidecoach** (HF) - drills straight to its hooks (sidecoach-keyword, sidecoach-sessionstart)
- **Justify** (HF) - drills straight to its hooks (justify-source-guard, justify-watch-guard,
  justify-watch-standing-by)
- **Tilt-lab** (L) - no hooks
- **Lotus** (L) - no hooks

**MORE COMPONENTS**:
- **Design Tools** (G) - **Skills** (G: the 11 design-pipeline skills, all L), `figma` (HF: figma-fidelity-stop)
- **Guardrails** (G) - the 8 QA clusters (each HF: safety, verification, question-discipline,
  grounding, api-drift, planning-git, surface, model-routing) + `fable`, `codex`, `chrome`,
  `visualizer` (each HF)
- **Voice & chat** (G) - `discord` (L), `voice-input` (L), `voice-output` (HF: voice-gate)
- **Dev surface** (G) - `cmux` (HF), `task-list` (L), `clickup` (HF: block-clickup-writes)
- **Personal** (G, hidden unless `--personal`) - `ghostty` (L), `shaders` (L)

Bucket membership is defined ONCE as data, and `--help` is regenerated from the same source
so the two can't drift.

## The drill model

- **Multi-component group** (only Beats today): shows its member components as leaves plus a
  labeled **"Hooks" folder** that aggregates the hooks that group depends on. This separates
  "the components" from "the plumbing".
- **Single hook-owner** (Sidecoach, Justify, figma, codex, chrome, cmux, clickup, visualizer,
  fable, voice-output): drills straight to its hook list. No inner "Hooks" folder (that would
  add a redundant level - explicitly rejected as "too far left").
- **Cluster**: a hook folder already; drills to its member hooks.
- Every hook leaf carries a one-line description.

**Per-hook toggling - DECIDED (Jonah 2026-07-16): full per-hook control for every owner.**
Today the installer's per-hook selection (`HOOK_ON` / `HOOK_OFF`, wired through
`_AMPERSAND_HOOK_OFF`) exists ONLY for clusters; app-component install is all-or-nothing per
`--only <key>`. The build EXTENDS that selective-install mechanism to app-components, so an
individual app hook (justify-watch-standing-by, a codex guard, ...) can be toggled off while
the rest of its component stays installed - matching the prototype. Concretely: the app-hooks
install pass (`install_app_hooks`) must honor a per-hook off-list, and deactivate must reach
individual app hooks (not only whole components). This is the largest single piece of build
work and a first-class task in the plan.

## Status model

- `● active` - the item (and, for a group, all its leaves) is installed.
- `◐ partial` - some but not all leaves installed. Only groups/folders can be partial.
- `○ not installed` - nothing installed.

Per-item state: a leaf is active iff installed; a group/folder rolls up from its leaves
(all -> active, none -> not installed, else partial) with an `installed/total` leaf count.
Reuses `detect_component` / `cluster_detect`, refined to distinguish all-vs-some for partial.
Recomputed and redrawn after every stage/apply so it is always live.

## Screens, navigation, and wayfinding

Wayfinding is a first-class requirement (Jonah: "UX is key"):
- **Breadcrumb** every screen: `ampersand > Beats > Hooks`.
- **Lead line**: the current node's plain-language description + `N of M installed`.
- **Detail bar**: the highlighted row's description + what pressing enter/-> does (updates as
  you move). For a hook, its one-line description.
- **Contextual actions**: `Install all of <group>...` / `Remove all of <group>...` for
  component groups; `Enable all <name> hooks...` / `Disable all <name> hooks...` inside a hook
  folder (`Enable all hooks...` when the folder is literally named "Hooks"); `< Back to <parent>`.
- **Section labels**: `CORE COMPONENTS`, `MORE COMPONENTS`.
- Keys: up/down move, right/enter open-or-toggle, left/esc back, `a` apply, `q` quit.
- `>` marks a drillable component; `v` marks a folder; hook rows render in a distinct color.
- Plain-text numbered fallback covers no-`gum` terminals for every screen.

## Staged-apply mechanics

- Two pending sets `PENDING_INSTALL` / `PENDING_UNINSTALL` keyed by leaf. Toggling a leaf
  flips its pending action, or clears it if it returns to the on-disk state.
- Pending renders as a `+`/`-` marker; groups show `+a -b` roll-ups; a footer shows the total.
- `Install all... / Remove all...` (or `Enable/Disable all ... hooks`) stage every leaf under
  the current node.
- `Apply changes (N)`: one `install.sh --only <comma-list> --yes` pass for the installs
  (cluster-hook partial selections ride via `_AMPERSAND_HOOK_OFF`), `deactivate_component` /
  `rm_hook_if_ours` for the uninstalls, then refresh + clear pending.
- Quit with unapplied changes warns (apply / discard / cancel).

## Update flow (two-state)

The root shows one update-status row, driven by the real installer functions:

- **Detect** (on browser launch, and re-checkable on demand): `check_updates()` =
  `git fetch origin main` + `git log HEAD..origin/main`. Needs a git remote + network.
- **`↻ Update available`** when the remote is ahead: show the incoming commit summaries.
- **`✓ Up to date`** otherwise (matches the current installer's `ok "Up to date"`);
  selecting it re-checks.
- **Apply** (`↻` clicked): `apply_update()` = `git pull --ff-only`, THEN re-run install for
  the active components (see below), THEN refresh all statuses. Pull-only is not enough.
- **Why pull + re-run**: `hook_deploy_mode` defaults to `auto` -> SYMLINK on a real git
  checkout, COPY on a temp/snapshot. Symlinked hooks/skills go live the instant the repo is
  pulled; but copied/merged/built pieces (settings.json merge, CLAUDE.md, ghostty, and built
  components like justify's daemon via `justify/install.sh`) only update on a re-run. So the
  action must pull AND re-run install for the installed components.
- **Cross-machine reality** (the "I update Justify, my boss opens ampersand" case): only works
  if the change was pushed to the shared remote; the boss's fetch detects it, the pull applies
  it, symlinked justify hooks/skill go live, and the justify daemon rebuilds on the re-run.
- **Edge cases**: no remote or offline -> hide/grey the row (can't check, say so);
  non-fast-forward (local commits on the clone) -> surface "you have local changes, resolve
  first", never fail silently.

## What it replaces / preserves

- **Replaces** the two interactive entry flows (`run_tui_gum` / `run_tui_fallback` fresh and
  `returning_flow` manage) with one `component_browser`. The fresh-vs-returning split
  disappears (status is per-item, computed live either way). The update check moves from the
  top of `returning_flow` into the browser's update row.
- **Preserves and reuses**: `detect_component`, `cluster_detect`, `effective_state`, the
  `--only` comma-list install path, `install_app_hooks`, `deactivate_component` and the
  `deactivate_*` family, `rm_hook_if_ours`, the Stage-3b `_AMPERSAND_HOOK_OFF` drill-in,
  `check_updates` / `apply_update`, `state_*` persistence, and the `--personal` gate.
- The plain-text numbered fallback preserves current non-`gum` behavior.

## Data flow and units

- `bucket_members` / the tree definition - single source of bucket -> member mapping (also
  feeds `--help`).
- `item_state <path>` - active | partial | not-installed for one node.
- `bucket_state` / rollup - counts + status from leaves.
- `stage_toggle` / `stage_all <path> <install|uninstall>` - mutate the pending sets.
- `apply_pending` - the one-pass install + per-item uninstall + refresh.
- `render_*` per screen - each a pure renderer over (state, pending) -> rows; the browser
  loop owns navigation + mutation. Small enough to unit-test with a seeded state map.

## Testing

- `test-component-browser.sh` unit-tests the pure functions: tree membership completeness
  (every KEY lands in exactly one bucket; every hook maps to an owner), `item_state` /
  rollup against fixtures, and `stage_toggle` / `apply_pending` set math (toggle-back clears
  pending; apply builds the right comma-list; cluster-partial rides `_AMPERSAND_HOOK_OFF`).
- Update-flow unit tests with a fake git (stub `check_updates` / `apply_update`): detect
  ahead -> "Update available"; even -> "Up to date"; non-ff -> the warn path.
- The interactive gum path stays code-reviewed + hand-driven (needs a TTY), as the current
  TUI is.
- Regression: `test-settings-deploy-parity.sh` all pass; `bash -n install.sh` clean.

## Non-goals

- No live expand/collapse tree (decided).
- No change to the non-interactive flags.
- No new external dependency beyond `gum` (already required/optional with fallback).
- Not changing any component's actual install/deactivate logic - only how they are browsed,
  toggled, and re-synced.

## Open questions (resolve in the plan)

1. **Update re-run scope**: after `git pull`, re-run install for the currently-active
   components only (fast, targeted) vs a full `--preset`-style pass. Targeted is the intent.
2. **Update-row default in the real installer**: `check_updates` result decides it live -
   the prototype's default (Update available) is only a demo seed.

(Resolved: per-hook control for app-component hooks - full per-hook control, see the
"Per-hook toggling - DECIDED" note above.)
