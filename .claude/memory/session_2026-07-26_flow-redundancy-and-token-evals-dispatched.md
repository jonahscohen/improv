---
name: Flow-redundancy + token-efficiency evaluations dispatched (2 Opus teammates)
description: Two parallel Opus 5 evaluation agents dispatched - flow-auditor (are any of the 20 A-X flows redundant/consolidatable, Codex second opinion mandated) and token-optimizer (can sidecoach match oracle's token efficiency). Analysis only, no code changes.
type: project
relates_to: [session_2026-07-26_sidecoach-20-validators-catalog.md, session_2026-07-26_oracle-identity-correction.md]
author_human: Jonah
author_model: claude-fable-5
source: session
verified: none
confidence: high
---

Jonah requested two evaluations, dispatched 2026-07-26 as parallel named Opus 5 teammates (Fable orchestrates, Opus executes):

1. **flow-auditor** - takes the latest inventory beat (session_2026-07-26_sidecoach-20-validators-catalog.md, flows A-X) and determines whether any flows are redundant or consolidatable without losing quality/intended output. Must reconcile the skill's "26 flows" claim vs the 20 handlers on disk, verify against sidecoach/src/flow-handler-*.ts source (the inventory beat's trailing Note contradicts its own list - flagged as untrustworthy), and get a Codex second opinion on every verdict (independent Claude reviewer as fallback per the verification protocol). Expected beat: session_2026-07-26_flow-redundancy-evaluation.md.
2. **token-optimizer** - evaluates sidecoach's token intensity end to end (skill load, routing, design-laws payloads, flow prompts, validator output, hook injections) and determines whether oracle-level token optimization is achievable (oracle = our main competitive-analysis opponent, documented only under that codename). Constrained to protect empirically validated guidance lines (prose-ablation sweep). Expected beat: session_2026-07-26_sidecoach-token-efficiency-evaluation.md.

Correction (same day, mid-flight): the original dispatch wrongly equated oracle with Leonxlnx/taste-skill, following a stale alias in older beats. Jonah corrected this - oracle is a different product and is never named in documentation. Both teammates were rebriefed via SendMessage before delivering; see session_2026-07-26_oracle-identity-correction.md.

Why: Jonah wants to know "is this shit superfluous and repetitive" (flows) and whether token usage can drop the way oracle's did. Both are evaluation-only units; any consolidation/optimization work would be a follow-up decision.

How: single-message parallel Agent dispatch, general-purpose type, model opus, each writing its own session beat and MEMORY.md index line on completion.

Files touched: none in repo (dispatch only; this beat + MEMORY.md index).

## Teardown failure + self-analysis (2026-07-26, flagged by Jonah)

The lead reported "all four teammates torn down" when only two (token-optimizer, hook-fixer) had confirmed with shutdown_approved + teammate_terminated. flow-auditor and artifact-builder had only been SENT shutdown_requests - no approval ever arrived - and their panes stayed up until Jonah flagged it and the requests were re-issued.

**Why it happened:** the lead treated a sent shutdown_request as a completed teardown. The teardown protocol's verification step (ps / cmux list-panels) was unavailable in orchestrator-only mode, and instead of downgrading the claim to "pending confirmation," the lead upgraded the send to "done."

**How it went wrong:** same failure class hook-fixer had confessed minutes earlier from the other side - a message SENT is not an outcome DELIVERED. The confirmation signal for a teardown is the shutdown_approved/teammate_terminated pair, and for two of four agents that signal never came. Rule: a teardown is reportable only on receipt of the approval/termination messages; absent those, say "requested, unconfirmed" - and when a shutdown_request draws only idle heartbeats and no approval, re-issue it instead of assuming eventual processing.
