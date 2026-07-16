---
name: beats-rebuild + beats-staleness-guard stay PROJECT-scoped in Stage 3b (not globalized)
description: Stage-3b plan text said fold beats-rebuild/staleness into the memory component's GLOBAL install_app_hooks line. Jonah ruled KEEP PROJECT-SCOPED - they are improv-repo-specific and already correctly wired in the repo's checked-in .claude/settings.json. Only chrome/figma/justify-watch-standing-by become global app-component hooks.
type: decision
relates_to: [session_2026-07-15_stage3b-plan.md, session_2026-07-02_beats-stage4-5-hooks-implemented.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: code-read (both hooks resolve REPO_ROOT from their own location; wired via $CLAUDE_PROJECT_DIR in repo .claude/settings.json; absent from ~/.claude/hooks)
confidence: high
---

During Stage-3b execution (fresh context), the "7 unmanaged hooks" split into two architectures, not one:

- **Global (hand-added to LIVE ~/.claude/settings.json, deployed as symlinks in ~/.claude/hooks):** chrome-tabgroup-track/clear/stop, figma-fidelity-stop, justify-watch-standing-by. These correctly become GLOBAL app-component hooks via the proven install_app_hooks + app-wirings.json pattern (chrome + figma new components; justify-watch-standing-by joins the existing justify component beside its sibling justify-watch-guard).
- **Project-scoped (wired in the REPO's checked-in .claude/settings.json via `$CLAUDE_PROJECT_DIR/claude/hooks/...`, ABSENT from ~/.claude/hooks):** beats-rebuild.sh, beats-staleness-guard.sh.

Choice made: **beats-rebuild + beats-staleness-guard STAY project-scoped. Do NOT add them to the memory component's global install_app_hooks line or app-wirings.json.** The memory-component install.sh block gets only a documentation comment noting they are intentionally project-scoped (owned by the repo's version-controlled .claude/settings.json, a legitimate ownership surface distinct from the global installer). The unmanaged-hook audit resolves to 0 by counting repo-project-settings wiring as ownership.

**Alternatives considered:**
- Globalize per the plan text (add to memory install_app_hooks + app-wirings.json, wire `~/.claude/hooks/beats-rebuild.sh` into GLOBAL settings): rejected. Both hooks resolve `REPO_ROOT="$HOOK_DIR/../.."` and default corpus/build to `$REPO_ROOT/.claude/memory` + `$REPO_ROOT/beats/beats.py` - they only ever rebuild improv's OWN beats index. Global wiring fires them on every Write/Edit in every project and double-fires inside improv alongside the existing project wiring. An improv-only tool does not belong in every project's global hook set.
- Leave as-is with no install.sh acknowledgement: rejected. The audit would keep re-flagging them as "unmanaged" every future session. The comment makes their project-scoped ownership explicit and auditable.

**Why this one:** project-scoping is the hooks' correct design (they are improv-repo tooling), and the repo's checked-in .claude/settings.json already deploys them portably to anyone who opens the repo - install.sh has nothing to add except a note. The plan text's "globalize" instruction was authored the same session its own memory-subsystem-wiring analysis was mid-correction, so it did not account for the project-scope. Jonah confirmed keep-project-scoped 2026-07-15.

**Revisit when:** beats-rebuild/staleness are ever generalized to operate on an arbitrary project's `.claude/memory` (portable corpus root, not improv-hardcoded) - at that point a global memory-component wiring would make sense for teammates who want the same freshness guarantee on their own beats corpus.
