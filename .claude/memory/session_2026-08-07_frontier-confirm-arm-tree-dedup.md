---
name: frontier-confirm-arm de-registered as a tree app-hook (fixes installer<->tree drift)
description: The red test-component-browser assertion "installer and tree agree on every app hook" was caused by frontier-confirm-arm being routed to owner fable in the tree while install.sh deploys it via a compound `{ picked fable || picked model-routing; } && install_app_hooks` line the single-owner invariant parser cannot read. Fixed by treating arm as a shared frontier DEPENDENCY (not a fable-owned app hook): removed it from all three tree surfaces. 147/0 now.
type: decision
relates_to: [session_2026-08-07_model-router-guard-red-note.md, session_2026-08-05_frontier-orchestrator-guard.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (test-component-browser 146/1 -> 147/0)
confidence: high
---

Collaborator: Jonah. Unit 1 of the four field-report remedies. The failing self-check was pre-existing drift, flagged in [[session_2026-08-07_model-router-guard-red-note]] and left unfixed.

## The bug
`test-component-browser.sh` assertion "installer and tree agree on every app hook (both directions)" was RED with:
`fable: tree routes frontier-confirm-arm to fable but install_app_hooks never deploys it`.

Root cause (not a flaky test): the invariant parser reads only canonical `^picked (\S+)\s+&& install_app_hooks (.+)$` lines as the installer's truth. arm is deployed by a COMPOUND line that intentionally dodges that form:
`{ picked fable || picked model-routing; } && install_app_hooks frontier-confirm-arm.sh`
so `truth` had NO arm entry, while the tree's hook_owner routed arm to fable. One-sided mismatch -> RED.

## Why arm is shaped this way
arm (the "type confirm to lift the frontier gate" hook) is genuinely SHARED between two surfaces: the fable app-component (frontier-orchestrator-guard) and the model-routing CLUSTER (model-router-guard). install.sh proves the sharing:
- deploy: the compound OR line (fable OR model-routing).
- deactivate_fable: removes arm only CONDITIONALLY via `_drop_arm` (kept if model-router-guard is still linked).
- detect_component fable: sentinel is frontier-orchestrator-guard, NOT arm (arm can exist for model-routing while fable is off).
The single-owner app-hook invariant cannot model a hook shared between an app component and a cluster. The compound line was the mechanism to keep arm OUT of the parsed truth (so it never trips the deactivate/detect invariants) - but that also removed the legitimate fable ownership the TREE still declared.

## Decision: arm is a DEPENDENCY, not a tree app-hook
Chosen (Jonah, "make it an invisible dependency"): remove arm from all three tree surfaces so it is no longer a standalone toggle, matching how the OTHER shared frontier deps (detect-session-model.sh, frontier-confirm.sh) are already NOT tree app-hooks. arm still deploys as a dependency via the unchanged compound line; its "confirm" behavior is unchanged and still described on the frontier-orchestrator-guard card.

**Alternatives considered:**
- Keep arm as a visible fable switch + make install.sh deploy it canonically under fable AND model-routing + update deactivate/detect: rejected - fights the single-owner invariant, breaks the sharing semantics (deactivating fable would strip arm even when model-routing needs it), more moving parts.
- Teach the invariant test to parse the compound form + dual ownership: rejected - the test's own guard warns against reshaping it, and the tree's single-owner model still cannot represent dual ownership cleanly.

**Why this one:** consistent with the existing treatment of shared frontier deps; smallest change (tree only, no install.sh change); removes a misleading toggle (arm is a dependency, not independently controllable).

**Revisit when:** the tree/hook_owner schema grows real multi-owner support, or arm stops being shared (e.g. model-routing gains its own arm), at which point arm could become a first-class single-owner app hook again.

## Change + verification
- claude/hooks/browser-tree.json: removed frontier-confirm-arm from (1) the fable hooks node, (2) hook_desc, (3) hook_owner. No install.sh change (compound deploy line kept - arm still ships as a dep).
- claude/hooks/hook-registry-guard.sh: added a `frontier-confirm-arm) return 0 ;;` exemption WITH a stated reason, and updated the now-stale comment that had claimed arm "IS registered in browser-tree.json - it is not exempt here." REQUIRED SECOND STEP: unlike the sibling shared deps (detect-session-model, frontier-confirm) which are non-event libraries, arm IS event-wired (UserPromptSubmit). Removing it from the tree made hook-registry-stop.sh flag it as an unpackaged event hook. The exemption is the forced completion of "invisible dependency" - the guard's design otherwise demands every event hook carry a toggle. arm is the first genuinely event-wired exemption; the section header was softened from "NOT EVENT HOOKS" to "NOT INDIVIDUALLY TOGGLEABLE" to stay honest.
- WHY the exemption is forced (not optional): arm cannot enter the parsed installer `truth` (the detect + deactivate single-owner invariants forbid a conditionally-deployed shared hook there), so it cannot be tree-routed to fable (installer<->tree), so it must be registry-exempt. The three invariants are mutually consistent ONLY when arm is outside the single-owner system entirely.
- Verified: browser-tree.json valid JSON; hook-registry-guard.sh `--check frontier-confirm-arm` exit 0 (managed); guard `bash -n` clean; `test-component-browser.sh` 146/1 -> 147/0; audit now lists only the 3 in-flight teammate hooks as unmanaged (expected, wiring pending their reports).

## Note on the "smallest change" framing
Presented to Jonah as the "cleanest, smallest change." Accurate on direction, understated on scope: it required the guard exemption above because arm is event-wired. The alternative (keep arm a visible toggle) is NOT cleanly viable while arm is dual-deployed - canonical fable deploy breaks the detect invariant, and fable-only deploy would regress the model-routing confirm capability. So the chosen path is the correct one; it just costs one extra edit.

## Files
- claude/hooks/browser-tree.json
- claude/hooks/hook-registry-guard.sh
- this beat + MEMORY.md pointer
