---
name: stage5-team-dispatched
description: Stage 5 team dispatched - two builder teammates (buzzword=marketing-buzzword detector PRIMARY, sidestripe=side-stripe recall investigation CONDITIONAL) running as real cmux panes; lead holds Codex review + frozen-90 milestone + Stage 6. Eval pipeline confirmed functional in this env.
type: project
relates_to: [session_2026-06-25_stage5-6-kickoff-grounding.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Autonomous manager mode (teams flag=1, session-bef88f21, config.json present = no orphan-bug).

## DISPATCHED (both confirmed real panes: surface:26, surface:27; ps shows 3 claude.exe)
- **Task #1 buzzword** (PRIMARY): build a Sidecoach-own marketing-buzzword subjective detector. Reimplement-and-own (no oracle wordlist), dev-develop (16 pos/5 neg), MUST add >=10 synthetic clean-prose negatives for the precision gate, precision-first (cluster/density not single word), home = rendered subjective scanner (auto-flows to eval via sidecoach-scan.mjs source='subjective-rendered') + register a live registry rule + golden. Rationale: oracle hits this at respectable P0.4, so closing it ADDS recall while HOLDING our banked precision win.
- **Task #2 sidestripe** (CONDITIONAL, investigate-first): does a RENDERED side-stripe detector improve recall WITHOUT precision loss on the 19 dev negatives? Build only if yes; else document side-stripe as a noisy class (both tools ~P0.11) where our lower recall is the disciplined choice. Reasoning math: matching oracle's R0.556 at its P0.11 adds ~24 FP -> tanks our subjective precision 0.426->0.333 = a BAD trade we refuse.
- **Task #3 Stage 6** (lead-held, blockedBy 1+2): ONE frozen-90 milestone of the batch + full converged-engine scorecard re-collect (detection-preserving proof) + Codex final gate + honest framing.

## VERIFICATION SPLIT (produce-and-verify)
Teammates BUILD + self-test (build green, npm test green, dev measurement) on DEV ONLY. Lead runs the Codex adversarial review on each unit + independent re-measurement + the lead-held frozen-90 milestone. Teammates do NOT run Codex (avoids the codex-rescue-teammate-no-relay issue; keeps producer != certifier with the lead as the different actor).

## ENV NOTES
- Eval pipeline CONFIRMED working: `node eval/sidecoach-scan.mjs <html> objective` rendered via Playwright + emitted findings. Full scorecard collect+score will run (slow; .scorecard-cache caches oracle findings - valid across Stage 5 since oracle is unchanged; only sidecoach entries re-collect after detector changes).
- macOS has NO `timeout`/`gtimeout` - use node-internal timeouts (the scan + runDetached already do); for wedge-prone Codex use the plugin runtime's own timeout.
- Baseline GREEN: build OK, npm test OK (57+ ": OK" suites), HEAD 44f37d68.

## Files touched
- (dispatch beat; tasks #1-3 in the harness task list)
</content>
