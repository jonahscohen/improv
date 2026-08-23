---
name: Self-updating taste pipeline - end-to-end architecture (design only)
description: The full SOURCES -> MINER -> PROPOSER -> HUMAN-REVIEW GATE -> ENFORCER loop that turns expert + internal signal into enforced sidecoach taste rules, fail-closed so no untrusted content auto-enforces. Grounds every stage in an existing repo mechanism.
type: decision
relates_to: [session_2026-07-25_act-on-stage1-findings.md, session_2026-07-24_stage1a-1b-provider-defect-mining.md, session_2026-07-25_reference-update-service-wired.md, session_2026-07-23_borrow-list-reconciliation.md, session_2026-07-28_taste-precision.md, session_2026-08-17_justify-watcher-shutdown-guard.md, session_2026-07-18_fidelity-gate-level2-ledger-built.md, session_2026-08-23_sidecoach-qa-gate-finish-boundary.md, session_2026-08-23_cc-feature-tracker-design.md, reference_external_taste_sources.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - design only, no code written; every cited mechanism read at HEAD c199f9c5
confidence: medium
---

# Self-updating taste pipeline (design only, no code changed)

Collaborator: Jonah. READ-ONLY research + design task. HEAD c199f9c5. Authored as a teammate;
relayed to team-lead. Peer teammates own the MINER internals (miner-design), the ENFORCER map
(engine-map), and the external expert sources (expert-sources); THIS beat owns the end-to-end
architecture, the scheduled-job, and the human-review gate.

## Thesis (why this is a wiring job, not a greenfield build)

Every stage of this loop has already been run BY HAND in this repo, repeatedly, and the borrow debt
keeps recurring precisely because nothing stands the loop up permanently:
- SOURCES/MINER (internal): Stage 1a/1b/1c provider defect mining -> `eval/corpus/defect-distribution.json`
  (schema `sidecoach-defect-distribution/v1`) (session_2026-07-24_stage1a-1b-provider-defect-mining.md).
- SOURCES/MINER (external): oracle-v4 / three-tool / four-product gap analyses + the recurring
  "borrow list" (session_2026-07-23_borrow-list-reconciliation.md counts 6 design-competitive lists,
  11 across lineages, "prior four never drained").
- PROPOSER + validate: act-on-stage1-findings PROPOSED a default-typeface guidance line, did NOT apply
  it to shipped source, and VALIDATED a measured fire-rate delta first (session_2026-07-25_act-on-stage1-findings.md).
- ENFORCER: `product-rule-registry.ts` RAW_RULES -> `generate-validators.ts` (+ `--check` drift guard)
  -> `dist/` -> `bin/sidecoach-detect.js` -> `sidecoach-taste-gate.sh` (fail-closed PostToolUse).
- CURRENCY: reference-update-service / `bin/sidecoach-refs.js` already does version + content-hash
  drift detection with a `10 drift` exit code (session_2026-07-25_reference-update-service-wired.md).

The design formalizes these into ONE standing, scheduled, provenance-tracked, fail-closed pipeline.

## Pipeline (each stage: inputs -> outputs)

### 0. SOURCES (data, never authority)
- INTERNAL-A beats corpus: `.claude/memory/*.md` + `sidecoach/.claude/memory/`. Read via the reflect
  corpus-assembly step (MEMORY.md index -> referenced files -> JSON array w/ 80k-token budget).
- INTERNAL-B audit history: every `sidecoach-detect.js` scan already emits a result JSON
  ({verdict, findings[], severityCounts, lenses}); today it is consumed then dropped. NEW: append each
  scan's finding summary to an audit-history log so fire-rates accrue exactly like `defect-distribution.json`.
  This is the internal signal - our own pages, our own detectors, over time.
- EXTERNAL curated expert repos: handed in as DATA under a fenced dir (model: `sidecoach/reference/_extracted/external/<source>/`,
  which already holds e.g. taste-skill/named-vibe-variants.md). Each source carries a manifest:
  {source, repo_url, commit/ref, license, retrieved_utc}. NOTHING in here is executed or imported.
  Trust classification travels with it: external = `source: import`, `verified: none`, low `confidence`.

### 1. MINER (reflect-style parallel fan-out; owned in detail by miner-design)
- Input: the three source sets above, assembled into one corpus JSON.
- Execution model = reflect's fan-out verbatim: N lens agents spawned in ONE batch, each handed the full
  corpus JSON, each returning the identical `{lens, findings:[{title, evidence[], confidence, so_what}]}`
  contract with filename/commit-cited evidence; then ONE synthesis agent weaves + ranks (reflect SKILL.md).
- Lenses (mining-specific, swap reflect's 5): (a) Recurring-defect miner (internal audit-history fire-rates
  + beats that repeat a taste failure), (b) External-borrow miner (a candidate rule present in an expert
  source but absent from our registry), (c) Currency/drift miner (a source whose commit moved since last
  mine, or a rule whose held-out precision decayed), (d) Redundancy/conflict miner (a candidate that
  duplicates or contradicts an existing `canonicalRuleKey`).
- Output: NOT rules. A structured findings artifact (candidate signals w/ evidence + provenance), handed
  to the PROPOSER. The miner never writes to the registry.

### 2. PROPOSER (findings -> candidate rules in sidecoach's own schema, quarantined)
- Emits each candidate as a full `ProductRuleDefinition` (product-rule-types.ts) OR a taste-validator
  `TasteViolation`-shaped entry, whichever the finding class fits - the SAME schema the enforcer already
  validates, so a proposal is checkable the instant it exists.
- Every candidate carries FULL PROVENANCE beyond the existing sourceVocabulary/sourceSeverity fields:
  a `provenance` block = {source, repo/beat, commit/ref, retrieved_utc, minedBy(lens), rationale,
  evidence[], suggestedSeverity, measured?(precision/recall or fire-rate delta if the proposer ran an
  ablation)}. This is the "traceable to a source+date" requirement.
- Candidates land as DATA the enforcer NEVER imports:
  `sidecoach/data/proposed-rules/<ruleId>.json` (staging), one file per candidate, PLUS a queue index
  and a `proposal_taste-rules_YYYY-MM-DD.md` beat in `.claude/memory/` (the repo's existing "quarantined,
  not ratified" convention - proposal_beats_next_evolution.md carries no authority until a human acts).
- Pre-flight self-check (cheap, non-blocking): run the candidate through `validateRegistry`'s field-completeness
  + duplicate-key + severity-divergence checks IN ISOLATION (against a copy that unions RULES + this one
  candidate) so the queue only holds proposals that COULD pass the gate. A candidate that fails validation
  is filed with its errors, never silently dropped.

### 3. HUMAN-REVIEW GATE (the fail-closed safety layer - detailed below)
- A mined/external rule becomes LIVE enforcement ONLY after an explicit human sign-off expressed as an
  un-forgeable TTY-minted consent token. Nothing auto-promotes. Detailed in its own section.

### 4. ENFORCER (approved rules flow into the existing engine; owned in detail by engine-map)
- Promotion appends the approved candidate to `RAW_RULES` (product-rule-registry.ts) [or the taste-validator
  / reference-loader list for text/ban rules], then runs `npm run build` in sidecoach/, which runs
  `validateRegistry` (hard-fail on any invalid field/dup/undocumented-severity-divergence) then
  `generate-validators.ts` + `generate-validators.ts --check` (byte-diff drift guard) then `tsc`.
- The rebuilt `dist/` is what `bin/sidecoach-detect.js` loads; `sidecoach-taste-gate.sh` (PostToolUse,
  fail-closed) then enforces the new rule on the next `.html`/`.css` write in a DESIGN.md project.
- New rules promote OFF-BY-DEFAULT behind an opt-in flag with the un-gate criterion written into source,
  per the standing "an unmeasured rule does not ship" ruling (session_2026-07-28_taste-precision.md:
  default-typeface Ground A is gated behind `enableDefaultStackGround`; numbered-section-markers was
  REMOVED rather than shipped at coin-flip precision). A promoted rule ADVISES until its held-out precision
  is measured, then a second human sign-off flips it to blocking.

## Scheduled-job design (the MINER job)

MECHANISM: a launchd user-agent running a headless `claude -p` mine, modeled BYTE-FOR-BYTE on the existing
weekly reflect runner - `claude/hooks/beats-reflect-weekly.sh` + `claude/launchd/com.yesand.beats-reflect-weekly.plist`.
Reuse, do not reinvent:
- `claude -p "/sidecoach mine" --permission-mode bypassPermissions --add-dir "$REPO_ROOT"` (headless,
  unattended, no model pin - inherit newest default).
- THRESHOLD GATE: skip the run unless enough NEW signal accrued since the last mine, counted the same way
  reflect-nudge counts (`find ... -newer "$TIMESTAMP_FILE"`) - here: new beats OR new audit-history entries
  OR an external source whose commit moved. Shared timestamp `~/.claude/last-taste-mine-timestamp` so a
  quiet period is a cheap no-op (a mine is expensive: N agents + synthesis).
- WALL-CLOCK WATCHDOG: no `timeout(1)` on macOS - poll every POLL_SECS, TERM->grace->group-KILL at
  TIMEOUT_SECS (default 1800), child launched as a process-group leader (`perl setpgrp`) so claude's node
  + sub-agents are bounded not orphaned.
- FAIL-LOUD DISTINCT EXIT CODES (0/2/3/4/5/6) and success = a new proposal artifact newer than a start
  marker; a partial artifact before a hang/non-zero exit is treated as failure, timestamp left untouched
  so the next pass retries.

CADENCE: weekly (mirror the reflect plist: Sunday 09:00 local, `RunAtLoad false`, `ProcessType Background`).
Taste sources move slowly; the currency lens catches an external commit bump between runs. Tunable via the
plist `StartCalendarInterval` + `TASTE_MINE_THRESHOLD` env.

WHAT IT PRODUCES: staged `sidecoach/data/proposed-rules/*.json` + a `proposal_taste-rules_YYYY-MM-DD.md`
queue beat + a log line. It NEVER touches `RAW_RULES`, never runs `npm run build`, never enforces. Its
entire output is reviewable proposals.

WHY LAUNCHD (the OS scheduler), weighed against ALL THREE Claude Code internal schedulers (authoritative
map from the CLI bundle, claude-agent-sdk@0.2.110):
- `/schedule` -> the `RemoteTrigger` tool -> claude.ai CCR API (`/v1/code/triggers`), runs in a CLOUD remote
  environment on a true cron, independent of any local session. BUT it teleports the repo off-machine (git
  bundle or the Claude GitHub App) and CANNOT see the local beats corpus, the local audit-history log, or the
  local external-source checkout - the miner's three inputs. Wrong primitive for a mine that must read local
  state and write proposals into the local working tree for in-place review.
- `CronCreate`/`CronList`/`CronDelete` (flag `tengu_kairos_cron`) - LOCAL, 5-field cron, but "jobs only fire
  while the REPL is idle"; durable jobs persist to `.claude/scheduled_tasks.json` yet only resume on next CLI
  launch and auto-EXPIRE after 7 days. Needs a permanently-open session; unfit for unattended weekly.
- `/loop` + `ScheduleWakeup` - LOCAL in-session loop, delay clamped [60,3600]s, whole loop ages out at 7 days.
  An attended self-paced loop, not an unattended job.
CHOICE = launchd (a macOS OS-level user-agent, OUTSIDE Claude Code's own cron), which is the repo's OWN
precedent for its one corpus-fan-out job (beats-reflect-weekly). It alone fires headless `claude -p` on a real
calendar cron with NO live REPL required AND full local repo/corpus/working-tree access - the union the other
three each miss. The one trade-off: launchd only fires while the Mac is awake (it catches up a missed
StartCalendarInterval on wake), so a powered-off machine defers the mine; acceptable for a weekly, drift-tolerant
job. If a truly machine-independent cadence is ever required, the cloud `RemoteTrigger` is the only option, but
it would force the whole corpus + audit-history + external sources into the remote environment and file
proposals as a PR instead of local staging - a larger redesign, not this one.

## HUMAN-REVIEW GATE (fail-closed; the non-negotiable safety layer)

Design goal: a mined or external candidate rule can influence what the enforcer BLOCKS only after an explicit
human decision that an agent CANNOT forge. This mirrors the repo's proven "nothing auto-promotes without a
TTY-minted consent token" spine (justify-watcher-shutdown-guard, justify-watch consent guards, the
frontier-confirm token, sidecoach-qa-gate finish-boundary), applied to rule promotion.

WHERE PROPOSALS LIVE: `sidecoach/data/proposed-rules/*.json` (staging, one candidate per file) is DATA that
NO source file imports - `product-rule-registry.ts` imports nothing from there, so a proposal is inert by
construction, not by policy. A `proposal_taste-rules_YYYY-MM-DD.md` beat is the human-facing queue.

HOW A HUMAN REVIEWS: a review surface renders each candidate's rule body + full provenance + evidence +
(if measured) its precision/fire-rate delta, and its `validateRegistry` pre-flight result. On a rich surface
this is a review artifact/dashboard; on a text surface it is the executive-report contract (deliverable
blocks). Review is a deliberate read of source+date+evidence, exactly the "trust becomes a filter" model
(proposal_beats_next_evolution.md): "verified decisions authored by a named human" vs "speculative note from
an unverified model."

HOW A HUMAN APPROVES (the un-forgeable token): a TTY-gated CLI (`[ -t 0 ]`, typed confirmation) - model it on
the justify-watcher shutdown helper - mints a SINGLE-USE, short-lived (~120s) consent token naming the exact
`ruleId(s)` approved, e.g. `~/.claude/.taste-rule-promote-consent`. The helper has check/consume only, NO mint
subcommand an agent could call. `bash-guard.sh` + `content-guard.sh` DENY every agent write/move/copy to the
token path (the same fence the frontier-confirm token uses: "you MUST NEVER author this file"). In a same-uid
world the boundary is the HARNESS: every agent tool call passes a PreToolUse hook; the user's TTY does not.

HOW APPROVAL PROMOTES A RULE (and nothing else does): a promotion step, gated on consuming the token for the
named ruleId, (1) moves the candidate from `data/proposed-rules/` into `RAW_RULES` [or the taste/ban list],
(2) runs `npm run build` - which HARD-FAILS if the candidate is malformed (`validateRegistry`) or drifts
(`--check`), so a bad approval cannot ship a broken registry, (3) appends a promotion entry to an append-only,
HMAC hash-chained PROMOTION LEDGER (model: the figma fidelity ledger, session_2026-07-18) recording
{ruleId, source, commit, retrieved_utc, approvedBy=human, approved_utc, token_mac, prev_mac, mac} - so every
LIVE rule is traceable to a source+date+human sign-off and the record detects its own tampering. A promoted
rule ships advisory-only until a second measured sign-off flips it to blocking.

WHY NOTHING AUTO-PROMOTES (three independent layers, each fail-closed):
1. STRUCTURAL: the registry imports nothing from the staging dir, so an unpromoted proposal is physically
   unreachable by the enforcer - not "allowed but discouraged," unreachable.
2. HARNESS: agent writes to `RAW_RULES` are not blocked (that would break normal dev), but the PROMOTION
   PATH consumes a token an agent is hook-blocked from minting; a promotion without a valid consumed token
   fails, and the ledger has no matching entry, so an un-blessed live rule is DETECTABLE as ledger-inconsistent.
3. BUILD: `validateRegistry` + `--check` mean even a hand-forced bad entry cannot compile to `dist/`, and the
   taste-gate fails CLOSED (unbuilt/erroring engine => "page UNVERIFIED", never a false clean).
An audit hook (SessionStart or the mine job itself) can verify: every LIVE rule whose provenance is external/
mined has a matching promotion-ledger entry; any that does not is flagged as an un-blessed rule to remove.

## Currency (detecting when a source drifted / updated)
- The currency lens diffs each external source manifest's `commit/ref` against the last-mined commit
  (reuse `bin/sidecoach-refs.js` `check()`: version + content-hash, reason `version` vs `content`,
  `10 drift` exit code). A moved commit re-opens that source for mining.
- Internal currency: a live rule whose held-out precision decays (re-measured on a fresh slice) is
  re-proposed for review - never auto-demoted. The held-out set is spent after one look
  (session_2026-07-28_taste-precision.md) so re-measurement always uses fresh evidence.

## Files that WOULD be touched to build this (none touched now)
- NEW: `claude/hooks/taste-mine-weekly.sh` + `claude/launchd/com.yesand.taste-mine-weekly.plist`
  (clones of the reflect runner + plist).
- NEW: `sidecoach/data/proposed-rules/` (staging dir, git-tracked, imported by nothing).
- NEW: a `/sidecoach mine` flow (miner fan-out) + a `promote` helper CLI (TTY-gated, token-minting).
- NEW: an append-only promotion ledger + a `bash-guard.sh`/`content-guard.sh` fence on the consent-token path.
- REUSE unchanged: reflect fan-out, product-rule-registry + generate-validators --check, sidecoach-detect +
  taste-gate, sidecoach-refs currency, the fidelity-ledger pattern, the QA-gate finish-boundary spine.

Why (rationale): the loop already runs by hand and the borrow debt proves it does not persist; a standing
scheduled miner + a fail-closed human gate makes it durable WITHOUT letting untrusted external content reach
enforcement. How (approach): reuse every existing mechanism; the only genuinely new safety primitive is a
consent-token-gated promotion path + a tamper-evident promotion ledger, both cloned from proven repo patterns.
