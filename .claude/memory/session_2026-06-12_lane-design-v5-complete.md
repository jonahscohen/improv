---
name: lane intent detection design v5 - complete
description: v5 = Option A convergence contract (Jonah's edit) + remaining v4-review P0/P1/P2 resolutions folded in; spec implementation-ready pending final review
type: decision
relates_to: [session_2026-06-12_lane-design-v4-execution-truthfulness.md, reference_convergence_validator_capability_inventory.md]
supersedes: session_2026-06-12_lane-design-v4-execution-truthfulness.md
superseded_by: session_2026-06-12_lane-design-v6-release-floor.md
---

Spec v5 finalized (2026-06-12). Two parts:

**Part 1 (Jonah's edit, applied before this session picked the file back
up):** convergence Option A as decision 7 - product validators gate, advisory
flows coach. New flow-validation-capabilities.ts registry (none | advisory |
product_validator), typed ProductValidationResult, lane_converge capability
table (polish = sole product_validator today; audit/critique advisory),
measured/unverified scope in the persisted convergence state, mandatory
boundary-naming summary, self-widening gate (a promoted lane member joins the
gate automatically). The capability inventory beat
(reference_convergence_validator_capability_inventory.md) documents why the
staged widening path is short: ~3.5/6 of the upgrade table already exists in
the package.

**Part 2 (this session): remaining v4-review findings folded in:**
- P0 three-gate preflight: executability = historical edges +
  contextRequirements + canExecute preconditions; machine-readable
  precondition declarations (never static interpretation of canExecute) with
  per-condition unmet-handling (synthesize_from_project_state |
  convert_to_step_guidance | waive_with_fallback | reject_at_preflight);
  acceptance matrix for UI-source/no-PRODUCT.md/no-DESIGN.md/no-tokens/
  no-history per lane; --check fails on undeclared handling.
- P1 edge-specific waivers ({dependentFlowId, prerequisiteFlowId, reason});
  --check rejects unused/duplicate/broad/stale waivers.
- P1 resume transition: only valid action on an interrupted checkpoint;
  atomic interrupted -> in_progress with revision increment; other actions
  rejected.
- P1 real CAS: updateCheckpoint(checkpointId, expectedRevision, mutator)
  under a per-checkpoint O_EXCL lock file with stale-lock takeover;
  temp+rename alone was racy (read-check-write).
- P1 NUDGE parity: shared classifier returns deterministic NUDGE_ELIGIBLE;
  hook alone maps to NUDGE | SILENT via cooldown; MCP loads
  sidecoach-intent.json but never touches cooldown state.
- P1 clause segmentation: exact length-preserving algorithm (sentence
  terminators + comma-conjunction boundaries + shared abbreviation list),
  per-occurrence negation/binding rules, per-lane aggregation
  (IN_SCOPE if any in-scope occurrence survives; OUT_OF_SCOPE only if all
  occurrences negative-bound; else SCOPE_UNKNOWN).
- P2 realpath report containment (symlink-safe, regular files only) +
  checkpoint retention policy (terminal 30 days; lane list defaults to
  active+interrupted, --all includes terminal).
- Acceptance additions for all of the above incl. cross-process race test
  and Python/TS segmentation parity.

Why: the v4 reviewer's verdict was "architecturally approved, implementation
blocked on validator capability and executable preflight" - part 1 resolved
the validator capability blocker, part 2 the preflight blocker and the P1
state/parity details.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v5 completion edits)
