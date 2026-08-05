---
name: Frontier orchestrator guard (fable -> frontier, both surfaces, confirm override)
description: Expanded fable-orchestrator-guard to all .5 frontier models + agent-routing gate + user "confirm" override; renamed frontier-orchestrator-guard
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

**Goal (Jonah, 2026-08-05):** expand `fable-orchestrator-guard.sh` to also gate Opus 5 + Sonnet 5, rename it `frontier-orchestrator-guard.sh`. Preferred models = Opus 4.8 / Sonnet 4.6 / Haiku 4.5; frontier (gated) = Opus 5 / Sonnet 5 / Fable 5. Override: a single user-typed "confirm" lifts the gate for one action. Chosen scope: **BOTH surfaces** (session production AND agent routing), **two-hook split kept**.

**Stamped @83523ddd.** Baseline: existing test-fable-orchestrator-guard.sh 25/0.

**Design decisions (surfaced + approved):**
- Two hooks, not one: frontier-orchestrator-guard = session-production surface; model-router-guard = agent-routing surface. Shared confirm token.
- Confirm token is armed ONLY by the USER typing "confirm" (UserPromptSubmit hook), NEVER by the model - a frontier session's own Bash is what the gate blocks, so self-arming would be a bypass. One-shot, ~120s TTL, model-scoped or blanket.
- Non-frontier session routing an agent to another model stays HARD-blocked (unchanged, no confirm) - only frontier TARGETS are confirm-liftable. Documented so Jonah can loosen/tighten.
- Agent `model` param is a family alias (opus/sonnet/haiku/fable) with no version, so only `fable` and `*-5` ids are unambiguously frontier; bare opus/sonnet/haiku = preferred.

**Functional core DONE + green:**
- NEW `frontier-confirm.sh` (sourced lib): `frontier_check_confirm <want>` - one-shot consume, TTL, `*`/substring match, malformed/expired cleanup.
- NEW `frontier-confirm-arm.sh` (UserPromptSubmit): arms token only when whole prompt is exactly "confirm" or "confirm <one-token>" (a sentence containing "confirm" does NOT arm).
- RENAMED `fable-orchestrator-guard.sh` -> `frontier-orchestrator-guard.sh`: session match `*fable-5*|*opus-5*|*sonnet-5*`; beats carve-out preserved (runs BEFORE confirm so a beat never spends a token); confirm check; new reason text (delegate to preferred / reply confirm).
- MODIFIED `model-router-guard.sh` Agent branch: frontier session -> any preferred producer allowed; frontier target (`fable`/`opus-5`/`sonnet-5`) blocked unless confirmed; non-frontier session routing blocked (unchanged); CLI hacks (fable-router/claude --model/ANTHROPIC_MODEL) always blocked, confirm does NOT lift them.
- Tests: test-frontier-orchestrator-guard.sh (renamed) **27/0**; NEW test-model-router-guard.sh **20/0** (none existed before); NEW test-frontier-confirm.sh **15/0**.

**WIRING DONE + verified:**
- Mechanical rename `fable-orchestrator-guard` -> `frontier-orchestrator-guard` across install.sh (10), app-wirings.json (2), browser-tree.json (3), hook-registry-guard.sh (1), test-settings-wire-parity.sh (2). Component/cluster KEY stays "fable" (bounded risk; human-facing titles/descs updated to frontier).
- frontier-confirm.sh registered as a shared lib: hook-registry-guard exemption case + parity UNWIRED_BY_DESIGN_JSON + REACHER_KIND_JSON ("exec") + deployed via make_symlink in the fable block AND the model-router cluster (self-sufficient under --only fable AND --only model-routing).
- frontier-confirm-arm.sh wired as a UserPromptSubmit hook: app-wirings.json entry + `install_app_hooks frontier-orchestrator-guard.sh frontier-confirm-arm.sh` + browser-tree hooks list/desc/cluster-map + deactivate_fable now removes it + its UserPromptSubmit wiring (leaves the shared libs).
- DESCS/FILES/status/summary prose updated to frontier.

**Verification:** test-frontier-orchestrator-guard 27/0, test-model-router-guard 20/0, test-frontier-confirm 15/0, test-settings-wire-parity 22/0, test-hook-registry 94/0. `bash -n install.sh` OK; `install.sh --manifest` exit 0, valid JSON, frontier entries present. app-wirings.json + browser-tree.json valid JSON. Only residual "fable-orchestrator" strings are the historical beat-filename ref (correct). plan-consistency-lint refs are test FIXTURES (out of scope). Beats/docs history untouched.

**GAP for Codex/Jonah:** a NON-frontier session could in principle write ~/.claude/.frontier-confirm via Bash and self-lift a frontier route (the arm hook is the sanctioned writer, but the file is not access-controlled). On a frontier session the model's Bash is blocked so it cannot. Flagged in the Codex review prompt.

**Codex review (real Codex, 207s):** 5 findings. Findings 2-5 FOLDED + verified; finding 1 (Critical) escalated to Jonah as a threat-model decision.
2. (High) raceable one-shot consume -> FIXED: `frontier_check_confirm` now claims the token via an atomic `mv` (rename(2)); parallel callers - only one wins, rest fail. Restore-on-live-mismatch for scoped tokens. (Also fixed a `set -u` crash: non-numeric ts pinned to 0 before the age arithmetic.)
3. (Med) scoped-confirm substring over-broad ("confirm op" unlocking opus-5) -> FIXED: arm hook accepts a scoped `<model>` only if it matches a frontier family/id whitelist, else falls back to blanket "*".
4. (Med) `--only model-routing` could never confirm (arm hook only wired under `picked fable`) -> FIXED: arm hook wired when `picked fable || picked model-routing`; deactivate_fable ref-guards its removal (leaves it if model-router still installed). Residual (Low): arm hook can linger inert after a model-routing-only uninstall.
5. (Low/Med) legacy `fable-orchestrator-guard.sh` not cleaned on upgrade -> FIXED: fable install block strips the stale symlink + old PreToolUse entry; deactivate_fable removes both old+new names.
Codex confirmed the model-matching is correct (bare opus/sonnet/haiku stay preferred, opus-4-8 never matches frontier, claude-opus-5-1 still gates) and the beats carve-out still precedes confirm consumption.

Re-verified after folding: test-frontier-orchestrator-guard 27/0, test-model-router-guard 20/0, test-frontier-confirm 17/0, wire-parity all-pass, hook-registry 94/0, install.sh -n OK, --manifest valid JSON.

**FINDING 1 (CRITICAL) - FOLDED, Jonah chose Option A (best-effort block + rule):**
- bash-guard.sh: denies any Bash command naming `.frontier-confirm` (grep -qF; the leading-dot token, never the frontier-confirm.sh scripts) - mirrors the existing `.fidelity-secret` off-limits block.
- content-guard.sh: denies Write/Edit/MultiEdit whose resolved file_path == the token, or basename == `.frontier-confirm` (path-equality like the .figma-fidelity.pending block; NO-APOSTROPHE python constraint honored).
- claude/CLAUDE.md: new "Frontier Model Confirm Token (NEVER write it yourself)" section - only the user's typed confirm arms it; the .sh scripts remain editable.
- NEW test-frontier-token-block.sh (7/0): token writes blocked on both guards, .sh script refs/edits allowed. (Runs by filename since a live bash-guard blocks any command naming the token - which is itself proof the block fires.)
- Honest residual (accepted): a same-user token is not airtight against a deliberately-obfuscated write; same cooperative-model threat model as every guard here (proportionate, per the .fidelity-secret precedent).

**FINAL verification (all green):** test-frontier-orchestrator-guard 27/0, test-model-router-guard 20/0, test-frontier-confirm 17/0, test-frontier-token-block 7/0, test-content-guard 47/0, test-bash-guard-commit pass, wire-parity all-pass, hook-registry 94/0, `bash -n install.sh` OK, `install.sh --manifest` valid JSON.

**Files (final):** NEW claude/hooks/{frontier-confirm.sh, frontier-confirm-arm.sh, test-model-router-guard.sh, test-frontier-confirm.sh, test-frontier-token-block.sh}. RENAMED {fable->frontier}-orchestrator-guard.sh + its test. MODIFIED claude/hooks/{model-router-guard.sh, bash-guard.sh, content-guard.sh, hook-registry-guard.sh, app-wirings.json, browser-tree.json, test-settings-wire-parity.sh}, install.sh, claude/CLAUDE.md.

**Files so far:** NEW claude/hooks/{frontier-confirm.sh, frontier-confirm-arm.sh, test-model-router-guard.sh, test-frontier-confirm.sh}. RENAMED claude/hooks/{fable->frontier}-orchestrator-guard.sh + test. MODIFIED claude/hooks/model-router-guard.sh.
