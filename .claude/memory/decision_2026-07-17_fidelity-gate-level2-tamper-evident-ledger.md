---
name: Level 2 fidelity-gate design - tamper-evident signed arm ledger (the mechanism that actually makes opt-out impossible)
description: Jonah chose "Both" after the Codex review showed command-text guards can't fully prevent opt-out. Level 1 (guard-harden teammate) folds the guard bypasses. Level 2 (this) is the architectural piece: the Stop gate stops trusting the mutable .figma-fidelity.pending as the source of truth for what is armed, and instead verifies a tamper-evident signed ledger. Deleting/editing an arm to skip coverage becomes DETECTABLE (HMAC breaks) and BLOCKING, so tampering is self-defeating - the only way past is genuine coverage. Sequenced AFTER Level 1 (shared subsystem).
type: decision
relates_to: [session_2026-07-17_gate-hardening-codex-findings.md, session_2026-07-18_fidelity-gate-no-optout.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
confidence: high
---

## Threat model (important - scopes the design)
The "attacker" is Claude itself taking a LAZY shortcut (deleting a .pending line to skip
pixel validation), NOT a determined adversary exfiltrating secrets. So the bar to clear
is: make the lazy opt-out shortcut STRUCTURALLY UNAVAILABLE and any residual tampering
SELF-DEFEATING (detected + blocked). It does not need to defeat a deliberate multi-step
forgery, which the behavioral rules already forbid.

## Choice made
The Stop gate derives "what is armed" from a tamper-evident SIGNED LEDGER, not from the
mutable .figma-fidelity.pending file.

**Alternatives considered:**
- OS-level immutability (chflags schg / chattr +a): rejected - schg needs root the hooks
  lack; uchg the agent (= same user) can clear; platform-fragile.
- Gate re-derives arms purely from git/design-pull history: rejected - the pull log is
  itself a mutable file (same tamper point), and git history is rewritable.
- Hide the marker outside the repo: rejected alone - the agent's Bash reaches ~/.claude
  too; location-hiding is not protection.

**Why the ledger:** signing makes tampering DETECTABLE regardless of where the file
lives, which is the property that actually holds under same-privilege. Combined with
Level 1 guards (which block the common write vectors), the lazy path is blocked AND any
slip-through is caught.

## Mechanism
1. Secret: ~/.claude/.fidelity-secret (0600, generated once idempotently, NOT in any
   repo). Added to the Level-1 guard read-block list (defense in depth). Only the arm
   hook + Stop gate read it.
2. Arm hook (figma-fidelity-arm.sh): in ADDITION to writing .figma-fidelity.pending
   (kept, still Level-1-guarded), append to a ledger a line:
   `arm|<node_id>|<iso_ts>|<hmac_sha256("arm|node|ts", secret)>`.
3. Stop gate (figma-fidelity-stop.sh): read the ledger; VERIFY every line's HMAC. Any
   missing/altered/forged line = tamper -> BLOCK ("ledger integrity failed"). For each
   `arm` node with no later signed `resolve` AND no covering check in
   .figma-fidelity.json -> BLOCK. When a node is covered, the GATE (which holds the
   secret) appends a signed `resolve|<node>|<ts>|<hmac>` - the agent cannot forge this.
4. Net: agent cannot delete an arm (HMAC chain breaks -> block), cannot forge a resolve
   (no secret), cannot skip coverage (gate still requires the manifest check). Genuine
   coverage is the only exit.

## Verification plan (falsify both ways before done)
- arm a node, do NOT cover, DELETE its ledger line -> gate BLOCKS (tamper detected).
- arm + add covering check -> gate PASSES (+ writes signed resolve).
- forge a resolve line with a wrong/absent hmac -> gate BLOCKS.
- normal flow (arm -> cover -> pass) works; unrelated repos with no ledger are unaffected.
- Codex re-review of the arm-hook + stop-gate diff.

## Sequencing
Build AFTER Level 1 lands + verifies (guard-harden teammate) - they share the marker
subsystem and Level 2 relies on the Level-1 read-block for the secret. Not parallel.

## Files (when built)
- claude/hooks/figma-fidelity-arm.sh (append signed ledger line)
- claude/hooks/figma-fidelity-stop.sh (verify ledger, block on tamper, sign resolves)
- claude/hooks/bash-guard.sh + content-guard.sh (read-block the secret) - coordinate w/ L1
- a new test (test-figma-ledger.sh) + this decision beat

## BUILT 2026-07-18 (design STRENGTHENED past this sketch - see session_2026-07-18_fidelity-gate-level2-ledger-built.md)
The line-42 per-line-HMAC format above is NECESSARY BUT NOT SUFFICIENT: two Codex rounds
proved it. Detects middle-edit/delete/insert + forgery, but NOT tail truncation (deleting the
LAST line leaves a valid chain prefix). The build added: (1) a SIGNED HEAD ANCHOR
`.figma-fidelity.ledger.head` = `count|tip|HMAC(count|tip)` so truncation mismatches the anchor;
(2) a CONSISTENCY GUARD so the arm hook cannot be used as a signing oracle to re-anchor the head
to a truncated ledger (refuse to sign from a base that does not match the current head). Secret
read-block landed in bash-guard.sh only (content-guard.sh not needed - it gates file writes, not
reads). 40-case falsification suite + 3 Codex rounds green. Decision itself still holds; only the
mechanism got harder.
