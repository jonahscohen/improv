---
name: cmux feature-tracker - scheduled autonomous researcher (design only)
description: A launchd-scheduled researcher that diffs the LOCAL cmux binary's version + capabilities JSON (and the upstream CHANGELOG) since last-seen, comprehends each new capability, maps it onto OUR cmux touch-points (adopt + retire-workaround), and files human-gated PROPOSALS. Never auto-edits the harness; release notes are untrusted data. Third instance of the shared learning-researcher spine (taste loop + CC tracker).
type: decision
relates_to: [session_2026-08-23_cc-feature-tracker-design.md, session_2026-08-23_self-updating-taste-pipeline-design.md, reference_cmux_dependency.md, decision_cmux_hardening_proposal.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: none - design only, no code written; every cited source/mechanism read or fetched read-only at HEAD c199f9c5 (cmux 0.64.22 (102) [ddd4a01bc] live)
confidence: medium
---

# cmux feature-tracker (design only, no code changed)

Collaborator: Jonah. READ-ONLY investigation + design task, HEAD c199f9c5. Authored as a teammate,
relayed to team-lead. This is the THIRD instance of the general "learning researcher" framework, designed
in parallel with the self-updating TASTE loop (session_2026-08-23_self-updating-taste-pipeline-design.md)
and the Claude Code feature-tracker (session_2026-08-23_cc-feature-tracker-design.md). It plugs into the
SAME spine those two established (FETCH -> DIFF since last-seen -> COMPREHEND to data -> PROPOSE into a
quarantined queue -> human GATE -> launchd SCHEDULE); only the source adapter, the taxonomy, and the
opportunity-map differ. Everything below is a wiring plan over existing repo mechanisms.

## Thesis

cmux is the terminal/teams/browser harness this session runs inside, and it ships FAST (15 versions
0.64.8 -> 0.64.22 in ~2.5 months) and auto-updates out-of-band. Two problems follow that nobody watches
today: (1) so much of our cmux code is WORKAROUNDS for cmux quirks - the PATH shim for the bare-name
`cmux` fallback, the node shim, the team-config heal (4x recur), the close-guard's three fragile
output-schema parsers - and when cmux fixes a quirk upstream we keep carrying the dead workaround; (2) new
cmux capabilities (native Simulator panes, browser design-mode/react-grab, structured read-state) go
unadopted because nobody maps them onto our surfaces. The tracker stands that watch up permanently,
fail-closed: RESEARCH + PROPOSE autonomously, every harness change human-gated. It is the ACTIONABLE
extension of the existing WARN-only version-drift check (decision_cmux_hardening_proposal.md option b):
that check says "you are on an old version"; this says "here is WHAT changed and what we could do."

## 1. SOURCE - where cmux features are published + fetchable (confirmed live, read-only)

cmux has a signal the CC/taste trackers DON'T: **local-binary introspection.** The installed binary emits
its own machine-readable feature surface, so the tracker can diff what THIS install actually supports, not
just what upstream shipped. Two tiers:

**TIER A - LOCAL ground truth (what this install supports NOW; the trigger of record):**
- `cmux version` -> `cmux 0.64.22 (102) [ddd4a01bc]` = semver + build number + git short hash. The
  authoritative "what is installed right now." Diffable string. (Same form documented in
  reference_cmux_dependency.md; the pin lives at `claude/cmux/cmux.version`, currently 0.64.20.)
- `cmux capabilities` -> JSON: `capabilities[]` (34 versioned tokens, e.g. `browser.stream.v1`,
  `terminal.render_grid.verified_replay.v1`, `terminal.artifact.list.v1`, `workspace.read_state.v1`,
  `workspace.groups.v1`), `methods[]` (~250 RPC names, e.g. `browser.design_mode.set`,
  `browser.react_grab.toggle`, `workspace.remote.*`), plus `protocol` (`cmux-socket`), `version` (protocol
  version = 2), `access_mode` (`cmuxOnly`), `socket_path`. This is the MOST PRECISE signal: a set-diff of
  two capabilities snapshots yields the exact capability tokens/methods added or removed on this binary.
- `cmux docs [settings|shortcuts|api|browser|agents|dock|sidebars]` -> per-topic doc URLs + raw resources
  + "next commands." Used to resolve a new capability token to its documentation.
- All local commands are read-only against the live app; confirmed working live (ran them this session).

**TIER B - UPSTREAM narrative (what changed + WHY; the semantic layer):**
- **PRIMARY: GitHub raw CHANGELOG.md** `https://raw.githubusercontent.com/manaflow-ai/cmux/main/CHANGELOG.md`
  Keep-a-Changelog format: `## [0.64.22] - 2026-08-03` version headers, `### Added/Changed/Fixed/Removed`
  subsections, inline PR links `[#9436](...)`, `@handle` contributor tags. WebFetch works (public, no auth).
  Parse by version header + category. Confirmed live; tip = 0.64.22 (2026-08-03).
- **MIRROR: cmux.com/docs/changelog** - same content, feature-highlight narrative form (bold feature name
  + description, e.g. "Native Simulator Panes...", "Native AppKit Sidebar..."). Fetch as cross-check.
- **GitHub Releases** `https://github.com/manaflow-ai/cmux/releases` + atom feed `.../releases.atom` (feed
  = cheapest remote poll). NOTE: `gh` is NOT installed on this machine - use WebFetch, not the gh CLI.
- Repo `https://github.com/manaflow-ai/cmux` (open source, Ghostty-based). Mintlify mirror exists as a
  redundant fallback.

**CADENCE (measured from CHANGELOG version dates):** bursty, not steady. 0.64.8 (2026-05-21) -> 0.64.22
(2026-08-03) = 15 versions, ~1 per 5 days on average but clustered - some same-day (0.64.8/0.64.9),
some ~2-week gaps (0.64.17 2026-06-23 -> 0.64.18 2026-07-14). Local install (0.64.22) is currently AT the
changelog tip with no newer release in the ~20 days since. IMPLICATION: a fixed calendar cadence wastes
most runs or misses bursts. The right trigger is a cheap frequent poll that diffs current-vs-last-seen and
gates the expensive run on an actual delta - identical to the reflect beat-count gate, pointed at a
version/capabilities diff. Two distinct questions the dual signal answers: "what does my installed cmux now
do that it didn't" (Tier A local diff, actionable NOW) and "what has cmux shipped that I don't have yet"
(Tier B changelog ahead of local version, actionable after an update).

## 2. COMPREHEND - capability delta -> what each ENABLES (transform-to-data only)

Input assembled by the shell wrapper: (a) the capabilities set-diff (last-seen JSON vs current), (b) the
CHANGELOG sections newer than last-seen version, verbatim, (c) a curated **harness inventory** (below).
The comprehend step is a single-pass headless `claude -p` analysis (a changelog is linear; the taste
MINER's N-lens fan-out is overkill). It emits, per new capability, a typed record
`{version, date, raw_text, capability_token/method, surface_area, enables, confidence}` where
`surface_area` is one of the cmux areas our harness touches: **panes / teams-agent-spawning / browser /
hooks-integration / surface-detection / keybindings-shortcuts / settings / remote-vm**. `enables` is the
one-line "what a harness author could now DO that they couldn't." An ambiguous entry can be grounded via
`cmux docs <topic>`. Output is a `cmux-capability-inventory_<from>-<to>.json` artifact - it never edits
anything.

## 3. OPPORTUNITY-MAP - map a cmux capability onto OUR touch-points (the cmux-specific analysis)

Like the CC tracker, this needs an **inventory of our own surfaces** to map against. For cmux that
inventory is derivable from reference_cmux_dependency.md (the ~10 consumers) + the CLAUDE.md cmux sections.
Seed touch-points:
- **cmux-close-guard.sh's THREE output-schema parsers** - `list-panels` regex, `top --format tsv` strict
  7-column, `tree --all` indentation. The single most drift-fragile coupling in the harness
  (decision_cmux_hardening_proposal.md). Watch `terminal.artifact.list.v1` / `workspace.read_state.v1` and
  any structured/JSON output mode - a stable machine-readable pane/tree read would let us REPLACE all three
  regex parsers, the biggest fragility win available.
- **Teammate spawn shape** (pass `name`, omit `run_in_background`) + `agent-teams-guard.sh` - if cmux
  stabilizes pane-vs-in-process selection, the guidance + guard simplify.
- **The PATH shim** (`claude/cmux/cmux`, the `CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux` bare-name fallback) and the
  **node shim** - both exist ONLY to work around cmux quirks; an upstream fix retires them outright.
- **Team-config heal** (`reference_cmux_team_init_orphan_bug.md`, 4x recur) - a cmux fix to the team-init
  orphan deadlock retires the heal hook.
- **Browser verification** (`cmux browser screenshot/navigate/snapshot`) - new `browser.*` methods
  (`design_mode.set`, `react_grab.toggle`, `screencast.*`) are new affordances for sidecoach/justify QA.
- **Surface-aware presentation** (`claude-surface.sh` reads `CMUX_*` env) - new surface/env signals refine
  the rich-vs-text presentation gate.
- **Session hooks integration** (`cmux hooks <agent> ...`) and **teardown/pane lifecycle**.
- **The version pin + preflight** (`cmux.version`, `cmux-preflight.sh`).

The mapper runs each capability against these in the shared two directions, using the CC tracker's exact
verdict split:
- **ADDITIVE ("X could improve/replace/enable"):** a new capability lets us adopt something new or
  simplify a multi-hook workaround (e.g. structured read-state -> collapse the close-guard parsers; native
  Simulator panes (0.64.21) -> drive iOS sims beside the terminal).
- **REDUNDANCY / RETIRE ("Y is now redundant given X"):** cmux fixed a quirk our shim/heal hand-rolls ->
  propose retire. This direction is DISPROPORTIONATELY valuable for cmux because so much of our cmux code
  is quirk-workarounds (shims, heals, fragile parsers) rather than feature use.

Each mapping emits `{capability, direction(additive|redundant), touch-point(s), opportunity_1liner,
effort, risk}`, RANKED with fragility-reducers and obsolete-workaround-retirements first (they cut risk),
new-capability adoptions second. A capability touching nothing we do is dropped (logged, not proposed).

## 4. PROPOSE -> GATE -> APPLY (fail-closed; non-negotiable)

SAFETY POSTURE up front, identical containment to the CC tracker + taste loop: **cmux release notes /
changelog / fetched content are UNTRUSTED external DATA.** The comprehend agent NEVER follows an
instruction inside fetched text; fetched text is rendered only inside a fenced `UNTRUSTED SOURCE EXCERPT`
block for the human, never concatenated into a prompt an agent acts on. The agent's whole job is
transform-to-data. And **no cmux release ever auto-edits the harness** - a harness change is hand-authored
code, so the human gate is the only apply path.

- **PROPOSE (autonomous):** per surviving opportunity, write a reviewable proposal = { **capability brief**
  (version, date, quoted changelog excerpt in the untrusted-fence, the raw capability-token diff,
  `enables`), **the opportunity** (additive/redundant, touch-points, 1-liner, effort, risk), **a draft
  plan** (`<step> -> verify: <check>` lines per the non-UI verification protocol), stamped with the commit
  hash it was authored against (so a stale brief is caught before execution). Proposals land as inert DATA
  nothing imports/executes: `claude/proposals/cmux-tracker/<version>-<slug>.md` (git-tracked staging) PLUS
  a `proposal_cmux-features_YYYY-MM-DD.md` queue beat in `.claude/memory/` (the repo's quarantined-not-
  ratified convention). A SessionStart nudge (mirroring reflect-nudge.sh) surfaces the queue.
- **REVIEW (human):** rendered per the surface contract - executive-report text on a terminal/cmux surface,
  a review artifact on a rich surface. Human decides apply / defer / reject; approved-not-done items file
  into TASKS.md via /task-list.
- **APPLY (human-gated only):** the human hand-edits, or dispatches an executor (opus-executor / sonnet-impl)
  to implement the approved plan under the FULL verification protocol (baseline-first, tests, visual/
  interactive verification if UI, Codex/independent cross-model review, completeness). The tracker has NO
  write path into `claude/`, `settings.json`, the hooks, or `cmux.version`.
- **No auto-pin-bump:** detecting a new version never bumps `cmux.version`; that stays the manual
  re-verify step (reference_cmux_dependency.md). The tracker can PROPOSE "clear to bump pin to 0.64.NN,
  here is the consumer re-verify checklist," but a human runs it.

Three fail-closed layers (same shape as the siblings): STRUCTURAL (proposals dir sourced by nothing -> a
proposal is physically inert), HARNESS (headless run has no approved write path to harness files;
availability gated by `cmux-preflight.sh --warn` so no-cmux is a clean skip), HUMAN (the apply is code
through the verification + cross-model review gate).

## 5. SCHEDULE - autonomous periodic run (reuse the reflect runner)

MECHANISM: a launchd user-agent running a headless `claude -p`, cloned from
`claude/hooks/beats-reflect-weekly.sh` + `claude/launchd/com.yesand.beats-reflect-weekly.plist`. Reuse, do
not reinvent:
- `claude -p "/cmux-track" --permission-mode bypassPermissions --add-dir "$REPO_ROOT"` (headless,
  unattended, no model pin - inherit newest; the reflect runner's exact invocation).
- **TRIGGER = version/capabilities diff (the "new-version-detected" gate), NOT a beat-count.** Cheap
  pre-check: run `cmux-preflight.sh --warn` (cmux absent/old -> clean logged skip, exit 0), then
  `cmux version` + `cmux capabilities`; compare against stored `~/.claude/cmux-tracker/last-seen.version`
  + `last-seen.capabilities.json`. Unchanged -> log skip, exit 0 (a featureless day is two local CLI calls
  + a string/set compare, near-free). Also cross-check the CHANGELOG for versions AHEAD of local. Only on a
  real delta does it run the comprehend+map+propose pass.
- **CURSOR advanced only on complete success** (a new proposal/inventory artifact newer than a start
  marker) - a partial write before a hang/non-zero exit leaves the cursor untouched so the next pass
  retries. The reflect runner's exact success contract.
- **WALL-CLOCK WATCHDOG + FAIL-LOUD EXIT CODES carried over verbatim:** perl-setpgrp process-group launch,
  poll every POLL_SECS, TERM -> grace -> group-KILL at TIMEOUT_SECS (bounds claude's node + sub-agents, not
  orphaned); distinct exit codes 0/2/3/4/5/6; minimal-env PATH export + robust repo-root resolution +
  log-trim + DRY_RUN, all lifted from the reflect runner.
- CADENCE: **daily** at an off-peak local hour (`StartCalendarInterval` Hour/Minute only, `RunAtLoad false`,
  `ProcessType Background`). The version gate makes a featureless day free. A lightweight SessionStart diff
  (mirroring reflect-nudge) also catches a change if launchd missed a day (laptop asleep). Tunable via the
  plist + `CMUX_TRACKER_*` env.
- **WHY launchd (local), NOT a cloud `schedule`/CronCreate routine:** the authoritative trigger signal
  (`cmux version` / `cmux capabilities`) requires running the LOCAL cmux binary against the live install -
  a cloud agent can't see it - AND the tracker must read the local tree to build the opportunity-map and
  write proposals into the tree for in-place review. This is the SHARPEST reason of the three trackers to
  stay local. A cloud changelog-watcher could be an optional secondary "upstream shipped something" signal,
  but the local job is the one that knows what THIS harness can actually do. (`/loop` + ScheduleWakeup is
  the attended in-session path, not an unattended daily job.)

## 6. COMMON FRAMEWORK - generic spine vs cmux-specific

The three researchers (cmux-tracker, CC-tracker, taste-loop) share ONE spine; only the ends differ. Spine
vocabulary is already fixed by the CC-tracker + taste beats - this instance conforms to it.

**GENERIC (shared; factor into a common learning-researcher harness):**
- **FETCH** a pinned source, everything fetched treated as untrusted data (prompt-injection fence).
- **DIFF since last-seen** a stored cursor - the `sidecoach-refs.js`-style currency primitive; only a moved
  cursor opens a run.
- **COMPREHEND** the delta into a typed inventory artifact (transform-to-data, never execute).
- **PROPOSE** into a quarantined staging dir + a `proposal_*` queue beat, imported/sourced by nothing.
- **GATE** human review before anything lands; the apply is a normal verified session (executor + Codex/
  independent cross-model review), never the tracker.
- **SCHEDULE** via the launchd reflect-runner clone: cheap pre-check gate, wall-clock watchdog, fail-loud
  distinct exit codes, cursor advanced only on complete success.
- Three fail-closed layers: STRUCTURAL (inert dir), HARNESS (no write path), HUMAN (verification gate).
- The two-direction opportunity verdict (ADDITIVE / REDUNDANT) shared with the CC tracker.

**cmux-SPECIFIC (the adapters that plug into the spine):**
- The **source adapter** - and the ONE genuinely distinct element vs CC/taste: **local-binary
  introspection.** `cmux version` + `cmux capabilities` JSON diff is a signal read from the INSTALLED
  binary, not a remote fetch. The cursor is therefore a version string + a capabilities set snapshot (vs
  CC's npm version, taste's source-corpus git commit). The CHANGELOG/releases/docs are the semantic layer
  on top. `cmux-preflight.sh --warn` is the availability guard.
- The **capability taxonomy** the comprehend step classifies into (panes / teams-agent-spawning / browser /
  hooks-integration / surface-detection / keybindings / settings / remote-vm) - cmux's surfaces specifically.
- The **opportunity-map** against our cmux touch-points, weighted toward the REDUNDANCY direction because
  most of our cmux code is quirk-workarounds (shims, heals, fragile parsers) a cmux fix retires - the CC
  tracker's concise-cluster example has many cmux analogs (the PATH shim, node shim, team-config heal,
  close-guard parsers).
- Cross-reference the version PIN + preflight (propose the bump + re-verify checklist; never auto-bump).

## Files that WOULD be touched to build this (none touched now)
- NEW: `claude/hooks/cmux-tracker-daily.sh` + `claude/launchd/com.yesand.cmux-tracker-daily.plist`
  (clones of the reflect runner + plist; version/capabilities-diff gate instead of beat-count gate).
- NEW: a `/cmux-track` flow (fetch/introspect -> comprehend -> opportunity-map -> propose).
- NEW: `claude/proposals/cmux-tracker/` (staging dir, git-tracked, imported by nothing).
- NEW: `~/.claude/cmux-tracker/last-seen.version` + `last-seen.capabilities.json` cursor + a run log under
  `~/.claude/logs/`.
- REUSE unchanged: the reflect launchd runner/watchdog/fail-loud contract, `cmux-preflight.sh --warn` (the
  availability guard), the untrusted-external-data containment, the proposal-queue-beat quarantine
  convention, the executor-dispatch + verification/Codex-review gate for the apply step, and the shared
  learning-researcher spine (if factored) from the CC/taste designs.

Why (rationale): cmux evolves fast and auto-updates out-of-band; our harness both misses new capabilities
and hoards workaround code cmux has made redundant, and today only a WARN-only version check watches it. A
standing daily local-introspection+changelog researcher surfaces both as reviewable proposals WITHOUT ever
letting untrusted release notes touch the harness. How (approach): clone the proven reflect launchd runner,
point a version+capabilities-diff cursor at the LOCAL cmux binary (semantic layer from the GitHub
CHANGELOG), comprehend the delta to typed data, map it onto our cmux touch-points two ways (weighted to
retire dead workarounds), and file human-gated proposals - reusing every existing repo mechanism; the only
cmux-specific parts are the local-introspection source adapter, the capability taxonomy, and the
opportunity-map.
