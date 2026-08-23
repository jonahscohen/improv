---
name: Claude Code feature-tracker - scheduled autonomous researcher (design only)
description: A launchd-scheduled researcher that fetches the Claude Code CHANGELOG/npm/docs, diffs since last-seen version, comprehends each new feature, maps it onto THIS harness (additive + redundancy), and files human-gated PROPOSALS. Never auto-edits the harness; release notes are untrusted data. Shares the generic fetch/diff/comprehend/propose/gate/schedule spine with the taste loop and cmux tracker.
type: decision
relates_to: [session_2026-08-23_self-updating-taste-pipeline-design.md, reference_external_taste_sources.md, session_2026-07-25_reference-update-service-wired.md, session_2026-08-08_hook-deploy-currency-check.md, session_2026-07-26_concise-mode-feature-committed.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - design only, no code written; every cited mechanism/source read or fetched read-only at HEAD c199f9c5
confidence: medium
---

# Claude Code feature-tracker (design only, no code changed)

Collaborator: Jonah. READ-ONLY investigation + design task, HEAD c199f9c5. Authored as a teammate,
relayed to team-lead. This is ONE instance of a general "learning researcher" framework designed in
parallel with the self-updating TASTE loop (session_2026-08-23_self-updating-taste-pipeline-design.md)
and a cmux-tracker; the three share a spine, split out at the end of this beat. Everything below is a
wiring plan over existing repo mechanisms, not a greenfield build.

## Thesis

Claude Code ships features multiple times a week. Our harness (200+ hooks, 17 skills, 3 agents, an
installer, MCP wiring) is a large hand-built accretion, much of it working AROUND gaps CC later closes
natively (the concise-mode hook cluster vs the now-native "Concise" output style is the canonical
example - see the worked case below). Today nobody watches CC releases against our surfaces, so we both
miss new mechanisms we could mechanize a mandate with, AND keep carrying custom code CC has made
redundant. The tracker stands that watch up permanently, fail-closed: it RESEARCHES and PROPOSES
autonomously, but every harness change stays human-gated.

## 1. SOURCE - where CC features are published and fetchable (confirmed live, read-only)

Three layered fetchable sources, primary -> corroborating:

- **PRIMARY (richest, human-readable): GitHub raw CHANGELOG.md**
  `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
  Confirmed live at latest `2.1.241`. Structure: `## <version>` headers, each followed by a bullet list
  of feature/fix lines. This is the canonical prose source the tracker parses for feature semantics.
- **MACHINE-READABLE version+timestamp signal: npm registry**
  - `https://registry.npmjs.org/@anthropic-ai/claude-code/latest` -> `{version, dist.tarball, homepage}`
    (confirmed `2.1.241`). Cheapest "what's the newest version" poll.
  - Full doc `https://registry.npmjs.org/@anthropic-ai/claude-code` -> `versions{}` + `time{}` map with a
    publish timestamp per version. This is the ideal trigger signal for "diff since last-seen version":
    compare `dist-tags.latest` (or the newest `time` key) against a stored last-seen version.
- **CORROBORATING mirror: the docs-site changelog**
  `https://code.claude.com/docs/en/changelog` (explicitly "generated from the CHANGELOG.md on GitHub")
  and the platform release notes `https://platform.claude.com/docs/en/release-notes/overview` (API/model
  side). Mirrors of the GitHub source; fetch as a fallback/cross-check, not the primary.
- **COMPREHENSION AUTHORITY (consulted, not fetched): the built-in `claude-code-guide` agent.**
  It exists in the agent roster (tools: Bash/Read/WebFetch/WebSearch) and is Anthropic's own authority on
  CC features/hooks/slash-commands/MCP/settings. The tracker CONSULTS it to interpret an ambiguous
  changelog line ("what does feature X actually enable?") - it is a comprehension aid, never the diff
  source. It is a built-in agent, not a repo file, so nothing to install.

**Cadence (measured from the fetch):** very fast. `2.1.237 -> 2.1.241` are consecutive, near-daily patch
releases, most tagged "Bug fixes and reliability improvements," with periodic real feature drops
interleaved (Workflows research preview; keybinding-flavor setting; native **Concise** output style;
plugin-marketplace header helpers; Python API migration tools; cloud-session plugin syncing;
self-hosted runner options). IMPLICATION: the tracker must **diff + FILTER to feature-bearing entries**,
never fire a run per patch. A version bump is the trigger; a feature-bearing changelog delta is what
warrants a proposal.

## 2. COMPREHEND - release -> extracted features -> what each ENABLES

Input: the changelog hunk for every version between `last-seen` and `latest` (concatenated bullets),
plus the npm `time`/version deltas. The comprehension step is a headless `claude -p` analysis pass
(single-pass is enough; the taste MINER's N-lens fan-out is overkill for a linear changelog) that
transforms the delta into a structured, typed **feature inventory** - transform-to-DATA only, it never
edits anything:

For each new bullet, emit `{version, date, raw_text, feature_class, capability, enables, confidence}`
where `feature_class` is one of the CC extension surfaces our harness actually uses:
- **hook event / hook field** (a new PreToolUse/Stop/SessionStart/... event or matcher capability)
- **tool / tool contract** (a new built-in tool, or a changed tool signature - overlaps api-drift, see below)
- **settings.json key / permission feature** (new config knob, permission-rule behavior, env var)
- **slash command / output style / skill feature** (e.g. native Concise output style)
- **agent / subagent / SDK feature** (agent-definition fields, model routing, background agents)
- **MCP capability** (new MCP wiring/transport/capability)
- **plugin / marketplace / installer feature**
- **noise** (pure bug fix with no harness-extension surface -> dropped, keeps volume sane)

`enables` is the one-line "what a harness author could now DO with this that they couldn't before" -
this is the semantic bridge into the opportunity-map. Ambiguous lines are escalated to the
`claude-code-guide` agent for a grounded reading before classification. Output is a
`cc-feature-inventory_<version-range>.json` artifact, nothing more.

## 3. OPPORTUNITY-MAP - map a CC feature onto OUR harness (the genuinely CC-specific analysis)

This is the one component with no analog in the taste loop: it needs an **inventory of our own harness
surfaces** to map candidate features against. That inventory (built once, refreshed cheaply per run):
- `claude/hooks/*` (200+ scripts) + their wiring in `cluster-wirings.json` / `app-wirings.json` ->
  live `~/.claude/settings.json` (the wiring model hook-deploy-currency.sh already walks).
- `claude/skills/*` (17), `claude/agents/*` (3), `claude/settings.json` (permissions, env, mcpServers),
  `claude/launchd/*`, the installer + installer-gui, statusline.

The mapper runs each inventoried feature against these surfaces in TWO directions:
- **ADDITIVE ("feature X could improve/replace Y", or enables something new):** a new hook event or
  matcher capability lets us MECHANIZE a mandate currently enforced only in prose, or SIMPLIFY a
  multi-hook workaround. The repo's own escalation ladder already thinks this way ("a twice-failed
  mandate that becomes mechanizable at a real boundary gets a hook, not more prose" - the
  sidecoach-qa-gate finish-boundary rung). A new CC boundary is exactly the trigger to revisit those.
- **REDUNDANCY / RETIRE ("Y is now redundant given X"):** CC ships natively what a custom hook/skill
  hand-rolls. Surfacing these is how the harness stays small instead of only growing. WORKED EXAMPLE
  (real, in-repo): 2.1.237 shipped a native **Concise output style**; this repo carries an entire
  concise-mode hook cluster (`concise-mandate.sh` + `concise-detect-stop.sh` + `concise-toggle.sh`,
  ported from a third-party MIT repo, session_2026-07-26_concise-mode-feature-committed.md). The tracker
  would file: "native Concise output style (2.1.237) may subsume the concise-mode cluster - evaluate
  retire/migrate." That is precisely the "redundant given X" proposal a human should see and nobody
  currently generates.

Each mapping emits a candidate `{feature, direction(additive|redundant), harness_surface(s) touched,
opportunity_1liner, effort_estimate, risk}`. A feature that touches nothing we do is dropped (logged, not
proposed). Overlap note: a **tool-contract CHANGE** (renamed/removed parameter) is ALSO caught reactively
today by `api-drift-detector.sh` (PostToolUse). The tracker is the PROACTIVE complement - it reads the
same drift from the changelog before a live tool call ever hits it - and a redundancy/api-drift finding
should cross-reference that log rather than duplicate its accommodation flow.

## 4. PROPOSE -> GATE -> APPLY (the fail-closed safety layer - non-negotiable)

SAFETY POSTURE up front: **release notes are UNTRUSTED external DATA.** Identical containment to the
taste loop's external-source rule (reference_external_taste_sources.md pts 5+7): the comprehension agent
NEVER follows an instruction found inside changelog/docs text; fetched text is rendered only inside a
fenced `UNTRUSTED SOURCE EXCERPT` block for the human reviewer and is never concatenated into a prompt an
agent acts on. The agent's whole job is transform-to-data. And **no CC release ever auto-edits the
harness** - there is no auto-enforcer here at all (unlike the taste loop, whose approved rules flow into
the sidecoach registry; a harness change is hand-authored code, so the human gate is the ONLY apply path).

- **PROPOSE (autonomous):** for each surviving opportunity the researcher writes a reviewable proposal =
  { **feature brief** (version, date, quoted changelog excerpt in the untrusted-fence, `enables`),
    **the opportunity** (additive/redundant, harness surfaces, 1-liner, effort, risk),
    **a draft plan** (`<step> -> verify: <check>` lines per the repo's non-UI verification protocol),
    optionally **a draft diff** (illustrative only, never applied) }.
  Proposals land as DATA nothing imports/executes: `claude/proposals/cc-tracker/<version>-<slug>.md`
  (staging, git-tracked, inert by construction) PLUS a `proposal_cc-features_YYYY-MM-DD.md` queue beat in
  `.claude/memory/` (the repo's existing "quarantined, not ratified" convention). A draft diff is stored
  as a `.patch` text file, never applied by the tracker.
- **REVIEW (human):** the queue renders each proposal per the surface contract (executive-report text on
  a terminal surface; a review artifact/dashboard on a rich surface). The human reads brief + opportunity
  + plan + optional diff and decides: apply / defer / reject.
- **APPLY (human-gated only):** approval is expressed the proven repo way - the human hand-edits the
  harness, OR dispatches an executor (opus-executor / sonnet-impl) to implement the approved plan, which
  then runs the full verification + Codex-review gate before it lands. The tracker itself has NO write
  path into `claude/hooks/`, `claude/skills/`, `settings.json`, `cluster-wirings.json`, or the installer.
- **OPTIONAL hardening (mirror the taste loop if desired):** if we ever want the tracker to stage a diff
  a human can one-click-apply, gate that apply behind the taste loop's TTY-minted single-use consent token
  + `bash-guard`/`content-guard` fence + append-only hash-chained ledger. For v1, "human hand-applies or
  dispatches an executor" is simpler and strictly safer (no apply automation to secure), so start there.

Three independent fail-closed layers (same shape as the taste loop): (1) STRUCTURAL - the proposals dir
is imported/sourced by nothing, so a proposal is physically inert, not merely discouraged; (2) HARNESS -
the tracker runs headless with no approved write path to harness files, and agent writes to the consent
token (if the optional apply path is built) are hook-blocked; (3) HUMAN - a harness change is code that
goes through the normal verification + cross-model review gate before merge.

## 5. SCHEDULE - autonomous periodic run (reuse the reflect runner byte-for-byte)

MECHANISM: a launchd user-agent running a headless `claude -p`, cloned from
`claude/hooks/beats-reflect-weekly.sh` + `claude/launchd/com.yesand.beats-reflect-weekly.plist`. Reuse,
do not reinvent:
- `claude -p "/cc-track" --permission-mode bypassPermissions --add-dir "$REPO_ROOT"` (headless,
  unattended, no model pin - inherit newest default; the reflect runner's exact invocation shape).
- **TRIGGER = version diff (the "new release detected" gate), NOT a beat-count.** Unlike reflect/taste
  (which gate on `find -newer TIMESTAMP` counts), the CC-tracker's cheap pre-check is a version compare:
  fetch npm `dist-tags.latest`, read stored `~/.claude/.cc-tracker-last-seen-version`; if equal -> log
  skip, exit 0 (a quiet week is a near-free HTTP GET). This mirrors `bin/sidecoach-refs.js` currency
  (version + content-hash drift, `10 drift` exit code) - the same "diff-since-last-seen" primitive the
  taste loop's currency lens uses, pointed at a version string instead of a git commit.
- Only on a real bump does it run the comprehend+map+propose pass over the `last-seen..latest` changelog
  range, then write `last-seen-version` = latest ONLY on a complete successful run (partial output before
  a hang/non-zero exit leaves it untouched so the next pass retries - the reflect runner's exact
  success-contract).
- **WALL-CLOCK WATCHDOG + FAIL-LOUD EXIT CODES** carried over verbatim: poll every POLL_SECS,
  TERM -> grace -> group-KILL at TIMEOUT_SECS (perl setpgrp so claude's node + sub-agents are bounded not
  orphaned); distinct exit codes 0/2/3/4/5/6; success = a new proposal/inventory artifact newer than a
  start marker.
- CADENCE: the tracker can afford to poll more often than the weekly taste mine because its pre-check is
  a single cheap HTTP GET that no-ops when the version is unchanged. Recommend **daily** (mirror the plist
  but `StartCalendarInterval` daily at an off-peak local hour, `RunAtLoad false`, `ProcessType Background`);
  the version gate makes a featureless day free. Tunable via the plist + a `CC_TRACKER_*` env.
- WHY launchd (local), not a cloud `schedule`/CronCreate routine: identical reasoning to the taste loop -
  the tracker must READ the local harness tree to build the opportunity-map and WRITE proposal files into
  the working tree for in-place human review. A cloud routine executes off-machine without that tree. The
  repo already chose launchd for its one scheduled fan-out job (reflect); this is the same shape.
  (`/loop` + ScheduleWakeup is the attended in-session path, not an unattended daily job.)

## 6. COMMON FRAMEWORK - generic spine vs CC-specific

The three researchers (CC-tracker, taste-loop, cmux-tracker) share ONE spine; only the ends differ.

**GENERIC (shared, factor into a common learning-researcher harness):**
- **FETCH** a pinned source, treating everything fetched as untrusted data (prompt-injection fence).
- **DIFF since last-seen** a stored cursor (version string here / git commit for taste + cmux) - the
  `sidecoach-refs.js`-style currency primitive; only a moved cursor opens a run.
- **COMPREHEND** the delta into a typed findings/inventory artifact (transform-to-data, never execute).
- **PROPOSE** into a quarantined staging dir + a `proposal_*` queue beat; imported/sourced by nothing.
- **GATE** human review before anything lands; optional TTY-consent-token + hash-chained ledger for an
  automated apply path.
- **SCHEDULE** via the launchd reflect-runner clone: cheap pre-check gate, wall-clock watchdog, fail-loud
  distinct exit codes, cursor advanced only on complete success.

**CC-SPECIFIC (the adapters that plug into the spine):**
- The **source adapter**: npm registry + GitHub raw CHANGELOG.md + docs mirror + the `claude-code-guide`
  consult (taste loop's adapter is expert skill-repos; cmux's is the cmux release surface).
- The **feature taxonomy** the comprehend step classifies into (hook event / tool / settings / slash
  command / agent / MCP / plugin) - CC's extension surfaces specifically.
- The **opportunity-map** against our harness inventory, in both additive and redundancy directions -
  the component with no taste-loop analog, because "how does a CC feature change what OUR harness should
  do" is a question only this instance asks.

## Files that WOULD be touched to build this (none touched now)
- NEW: `claude/hooks/cc-tracker-daily.sh` + `claude/launchd/com.yesand.cc-tracker-daily.plist`
  (clones of the reflect runner + plist; version-diff gate instead of beat-count gate).
- NEW: a `/cc-track` flow (fetch -> comprehend -> opportunity-map -> propose).
- NEW: `claude/proposals/cc-tracker/` (staging dir, git-tracked, imported by nothing).
- NEW: `~/.claude/.cc-tracker-last-seen-version` cursor + a run log under `~/.claude/logs/`.
- REUSE unchanged: the reflect launchd runner/watchdog/fail-loud contract, the sidecoach-refs currency
  primitive, the untrusted-external-data containment from reference_external_taste_sources.md, the
  api-drift log (cross-reference for tool-contract changes), hook-deploy-currency's wiring-table walk
  (to build the harness inventory), the proposal-queue-beat quarantine convention, the executor-dispatch
  + verification/Codex-review gate for the apply step.

Why (rationale): CC evolves faster than any hand-watch can track, and our harness both misses new
mechanisms and hoards code CC has made redundant; a standing daily version-diff researcher surfaces both
as reviewable proposals WITHOUT ever letting untrusted release notes touch the harness. How (approach):
clone the proven reflect launchd runner, point a version-diff cursor at npm/CHANGELOG, comprehend the
delta to typed data, map it onto our harness inventory two ways, and file human-gated proposals - reusing
every existing repo mechanism; the only CC-specific parts are the source adapter, the feature taxonomy,
and the opportunity-map.
