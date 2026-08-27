---
name: sidecoach README updated to document the taste layer
description: The sidecoach/README.md was v3-flow-only and missing the entire taste layer; added a detect/learn/enforce section + updated What-it-does, Status, and Files to match the shipped drive-to-green state
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: headings intact, code fences balanced
relates_to: [session_2026-08-25_sidecoach-drive-to-green.md, session_2026-08-26_schedule-cmd-and-arm-hook-gap.md]
---

Jonah: "update the readme" (right after committing + pushing the drive-to-green work). Target = sidecoach/README.md (the system doc the recent work affects), not the improv root README.

The README was at "Sidecoach v3" and documented only the flow orchestrator (36 flows, 21 verbs, daemon, intent detection) - it was missing the ENTIRE taste layer built across Phase 3 + drive-to-green. Added:
- NEW section "The taste layer: detect, learn, enforce" before How-It-Works: the 63-rule detection engine (rendered + static, fails closed as `unverified`) + sidecoach-taste-gate auto-fire; the three-stage QA gate (audit->critique->polish) with orchestrate-edit + qa-gate-stop finish boundary + the `.sidecoach-off` per-project opt-out; the human-gated self-learning loop (mine -> signed promote -> signed enforce + precision gate, off-by-default behind ~/.claude/.taste-blocking-enabled, HMAC-ledgered, agent can never mint a token); the CLIs (mine/promote/enforce, sidecoach-schedule); the consolidation + contradiction map (direction-pair/hard-vs-hard/standard-calibration/cross-type, provenance-gated direction exemption) + sidecoach-doctor.
- "What Sidecoach Does": +items 8-10 (Measured Detection, Human-Gated Enforcement, Rule Reconciliation).
- "Status": replaced the sprint-8 line set with the current shipped state (taste layer live; loop proven end-to-end - 13 net-new + motion.no-scale-zero-enter enforced off-by-default at P=1.0; consolidation map + sidecoach-schedule shipped).
- "Files": added the taste-layer tools (detect, mine, promote/enforce, consolidate, doctor, product-rule-registry, sidecoach-schedule).

Verified: heading structure intact, code fences balanced. Committed + pushed to origin/main.

FILES: sidecoach/README.md.
