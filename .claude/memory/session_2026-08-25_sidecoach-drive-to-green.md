---
name: Sidecoach audit drive-to-green campaign
description: Jonah directed that EVERY non-green item in the sidecoach readiness audit be fixed to green - fan out parallel builders, work autonomously, loop until each is re-graded green by the audit author; be honest about human-gated/harness-bounded residuals
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none (campaign in flight)
relates_to: [session_2026-08-25_consolidation-contradiction-model.md, session_2026-08-25_taste-sources-pioneers-baseline.md]
---

CONTEXT: sc-audit-super (opus-executor teammate) supervised a Codex fine-tooth audit of sidecoach's promises vs delivery and published a verification-grade ARTIFACT (Sidecoach Readiness Audit, https://claude.ai/code/artifact/7dae74e0-9daf-4666-9b29-3d4a1c7af034). Verdict: capable working QA/verification toolkit whose promise is louder than its mechanism - what MEASURES/VERIFIES is real; what is self-running / self-learning mostly is not yet.

DIRECTIVE (Jonah, 2026-08-25): "I want every point that isn't graded with a green addressed and solved to bring it into green. Fan out agents to make it happen, work autonomously. Loop until you have achieved my goal."

ORCHESTRATION MODEL:
- sc-audit-super OWNS the scorecard: produces the authoritative backlog (every partial/gap row + unmitigated risk) with GREEN DEFINITION, FIX, FILES, VERIFY, and CLOSEABILITY (CODE | PARTIAL-HARNESS | HUMAN-GATED), leverage-ranked with file-overlap noted. It later RE-GRADES each fix - a builder "done" is not green until re-audited against code.
- Fan out one opus-executor builder per CODE item (grouped to avoid file conflicts). Each builds + self-verifies (runnable) + I run an independent Codex pass + fold, looping until sc-audit-super grades it green.
- HONESTY GUARDRAIL: PARTIAL-HARNESS items (e.g. a hook cannot call the Skill tool -> the NL self-starting gap) get the MAX autonomous close + an honestly-stated residual. HUMAN-GATED items (enforcement consent-token signing; daemon install) get pre-staged as far as possible + a clear one-line ask to Jonah. NEVER paint those green falsely.

KNOWN TOP GAPS (from the audit summary, HEAD d1c9be59; full backlog pending sc-audit-super):
1. Learning loop inert end-to-end - ENFORCED_RULES=[]/ENFORCED_RULE_IDS=[], guidance tier empty (0 promoted), miner launchd plist not installed in ~/Library/LaunchAgents, latest candidates netNew 0. (Enforcement promotion is HUMAN-GATED by design; guidance-tier first-promotion + daemon install are the closeable/pre-stageable parts.)
2. Natural-language SELF-STARTING gap - hook only injects additionalContext; intent-detector returns a RECOMMENDATION, not an invocation; skill cannot wake itself from a raw prompt. (PARTIAL-HARNESS: a hook cannot call the Skill tool.)
3. Consolidation/contradiction map UNWIRED - `sidecoach consolidate` -> "Unknown command"; no router/orchestrator branch; doctor flags it UNREACHED/UNVERIFIED. (CODE - fully closeable.)
4. Portability - live auto-fire hooks are in ~/.claude/settings.json; committed claude/settings.json wires only craft-floor, so a fresh install is weaker. (CODE - wire the auto-fire hooks into the committed settings.)
5. Doctor exits 1 with 24 graph findings (dead-weight tools + the consolidate engine unreached/unverified). (Mostly CODE.)

PARALLEL THREAD (separate): consolidate-build is folding Codex round-3 on the map ENGINE's correctness (structured-field override must be type-independent; trim polarity; genuine-direction requires no raw hard fields). That is engine correctness; item 3 above is the WIRING. Keep distinct.

STATUS: backlog requested from sc-audit-super; fan-out pending its reply. Not committed.

FILES TOUCHED: .claude/memory/session_2026-08-25_sidecoach-drive-to-green.md (new), MEMORY.md (index).
