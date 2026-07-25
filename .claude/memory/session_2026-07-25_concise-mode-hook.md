---
name: concise-mode-hook-default-on
description: Concise-response mode for Claude Code - default-ON hook pair (adapted from ayghri/i-have-adhd), toggle with "concise on/off"
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

** ACTIVE ** Concise-response mode shipped for Jonah's own Claude Code, from the request "https://github.com/ayghri/i-have-adhd - i want this for myself... i need the option to keep things concise. opt in by default." Adapts the repo's 10 ADHD-friendly formatting rules (MIT) into a default-ON, runtime-toggleable harness feature.

**Mechanism (mirrors the voice on/off system):**
- `concise-mandate.sh` (SessionStart + PostCompact) injects the 10 rules (inlined in the script via a quoted heredoc - see packaging below for why not a data file) UNLESS the disable marker is present. Emits `hookSpecificOutput.additionalContext` with `hookEventName` (NOT top-level additionalContext - see Codex fold below); the event name is passed as $1 by each registration so the same script is correct on both events. Because it fires on SessionStart, a compaction (SessionStart source=compact) re-injects the rules independently of whether PostCompact is a live event. `--emit-body` prints just the raw ruleset (used by the toggle to single-source the text).
- `concise-toggle.sh` (UserPromptSubmit) matches the WHOLE message (like voice-toggle, so it never fires mid-prose): `concise on`|`be concise` -> ON, `concise off`|`verbose` -> OFF, `concise toggle` -> flip, `concise status` -> report. On "on" it re-injects the full ruleset (sourced from `concise-mandate.sh --emit-body`) so turning it on mid-session actually lands the rules in context.
- State = presence of `~/.claude/.concise-disabled`. Short user-facing `systemMessage` + full-ruleset `additionalContext` emitted via python3 json.dumps with values passed through env vars (no manual escaping).

**Key decisions:**
- **Hook, not the linked plugin.** Why: the repo installs as `/i-have-adhd`, a per-invocation slash command - it cannot be "default-on". A hook can. The plugin path was rejected because "opt in by default" requires always-on-by-default with an opt-out, which the plugin does not provide.
- **DISABLE marker (absent = ON), inverted from voice's ENABLE flag (absent = OFF).** Why: makes default-on automatic on ANY machine that has the hook, with no per-machine `touch` install step - which is the literal reading of "opt in by default". Voice uses absent=off because voice is opt-in; concise is opt-out.
- **SessionStart/PostCompact injection, not per-turn.** Why: the ruleset lands once and persists in context; re-injecting ~300 tokens every UserPromptSubmit turn would be wasteful. Matches where voice-mandate sits.
- **Carve-out baked into the rules text:** concise mode governs prose length, NOT process - it explicitly does not suspend the AskUserQuestion mandate, verification-before-done, beats discipline, or safety confirmations. Prevents the brevity rule from being read as license to skip standing mandates.

**Verified (all green):** settings.json still valid JSON with all 3 registrations on the right events; default-ON emits all 10 rules + ayghri attribution as valid JSON; disable marker -> clean no-op (empty); every toggle command returns valid JSON and tracks the marker correctly; prose containing the word "concise" produces NO output (exact full-message match, zero false positives). Live settings backed up to `~/.claude/settings.json.bak.20260725_055000` before editing.

**Codex cross-model review (0.142.5, deterministic wrapper, exit 0, 85s) - 2 real defects folded:**
- **[High, FOLDED] SessionStart JSON shape was WRONG.** First cut copied voice-mandate.sh's top-level `additionalContext`, which is the outlier shape and NOT reliably honored - default-on would have silently failed to inject. VERIFIED against ground truth: the three SessionStart hooks that demonstrably injected this session (task-loop-mandate.sh, justify-queue-mandate.sh, claude-surface.sh) all use `hookSpecificOutput.additionalContext` + `hookEventName`. Fixed to that shape, event name passed as $1 (mirrors task-loop-mandate) so SessionStart vs PostCompact each report correctly.
- **[Medium, FOLDED] Unchecked touch/rm in the toggle** could misreport state on a write failure. Added `enable_concise`/`disable_concise` guards that verify the marker operation and emit an honest "could not enable/disable" instead of a false "now ON/OFF". Proven with a chmod-000 dir simulation.
- **[High, KEPT with reason] PostCompact may not be a documented event.** Kept for parity with voice-mandate (the user maintains a PostCompact array); the SessionStart-source=compact path now covers compaction survival regardless, so nothing relies on PostCompact being live.
- **[Medium, REJECTED with reason] "extra aliases" (concise mode on/off, be verbose, concise?).** Flagged only against a constraint stated in my own review prompt, not the user's; they are safe whole-message exact matches (Codex's own Low finding confirms no false-positive risk). Kept as intended conveniences.
- Codex Low findings CONFIRMED the core design: no command-injection (prompt is JSON-parsed then shell-`case`-matched, never evaluated), no JSON-escaping hazard (all text through json.dumps), whole-message matching sound (prose never fires).

**Re-verified after fold (all green):** settings valid JSON with event args wired; SessionStart emits hookSpecificOutput (no top-level additionalContext) + hookEventName=SessionStart + 10 rules; PostCompact tracks its event name; no-arg defaults to SessionStart; disabled=no-op; every toggle command valid JSON + UserPromptSubmit event + correct marker tracking; write-guard reports honestly on simulated failure; prose with command words ignored; `bash -n` clean on both scripts.

**Non-UI verification note:** the Stop/PostToolUse visual gate armed ("take a screenshot"), but this is shell-hook + JSON-config work with no rendered surface - proof is the runnable behavioral matrix above (JSON shape, exit codes, marker state), not a screenshot. Legitimate no-UI override.

**PACKAGING (forced by the hook-registry-stop.sh gate, which blocked the Stop): a hook in claude/hooks/ that is not packaged cannot install elsewhere or show in the component browser.** Traced the whole system before wiring:
- The managed rule (hook-registry-guard.sh `_is_managed`): a hook is managed iff `name in pinned_hooks` OR (`name in hook_owner` AND install.sh names `name.sh`). `_is_excluded` exempts genuinely non-toggleable core hooks (node-path-default "breaks every node CLI if off", detect-session-model, etc.).
- **Chose: join the `grounding` cluster** (owner=grounding). Why: concise-mandate/concise-toggle are always-on behavioral-mandate hooks of the SAME shape as task-loop-mandate/justify-queue-mandate, which already live in grounding (that cluster is effectively "always-on behavioral discipline," not literally source-grounding). Rejected the node-path-default core-EXCLUSION path because concise is deliberately user-toggleable, so excluding it as "not toggleable" would be dishonest. Rejected a NEW cluster/component (honest but many install.sh touch points = higher structural risk); the pinned-ownerless path is repo-only (wired in improv/.claude/settings.json via $CLAUDE_PROJECT_DIR) and concise is global. Broadened the grounding tag/desc honestly (4->6 hooks, "response conciseness" named).
- **Inlined the rules into the scripts and DROPPED concise-rules.txt/concise-off.txt.** Why: clusters deploy `.sh` files only (cluster_hooks list); a sibling `.txt` would NOT deploy on other machines, so concise would install INERT (mandate `[ -f "$RULES" ]` false -> no-op). Inlining (quoted heredoc, single-sourced via `--emit-body`) makes the feature fully self-contained in the two `.sh` files.
- Wired 3 files: install.sh (grounding `cluster_hooks` line + "4 grounding hooks"->"6" display string), browser-tree.json (hook_owner + hook_desc for both + grounding node hooks list/tag/desc), cluster-wirings.json (concise-mandate.sh SessionStart+PostCompact, concise-toggle.sh UserPromptSubmit). cluster-wirings command strings match the live ~/.claude/settings.json EXACTLY so install dedupes cleanly.
- **Verified:** `hook-registry-guard.sh --audit` exit 0 (was flagging both hooks, now clean); `test-component-browser.sh` 139/0; `test-hook-registry.sh` 52/0; both scripts `bash -n` clean; stale `.unmanaged-hook`/`.acked` flags cleared.

**Codex round 2 (post-refactor, exit 0, 24s) - 1 Medium folded:** the ON-path fallback silently degraded - if `concise-mandate.sh` is missing/off-listed on its own (the per-hook off-list CAN drop the mandate while keeping the toggle), the user saw "now ON" with a stub body and no real rules, stderr swallowed. Folded to `emit_on()`: on happy path injects the real ruleset; on failure emits an HONEST warning in systemMessage + a "ruleset could not be loaded" additionalContext that does NOT claim brevity is active. Proven: happy=10 rules/no warning, degraded=warning present + 0 rules claimed, recovery after restore=clean. (Codex Low was the same finding; heredoc quoting, env-var passing, and OFF/status all confirmed clean.)

**Takes effect next session** (Claude Code loads hooks at startup); this session self-applied concise style by hand.

**Files touched:**
- `claude/hooks/concise-mandate.sh` (new) - SessionStart/PostCompact injector; holds the inlined ruleset + `--emit-body`
- `claude/hooks/concise-toggle.sh` (new) - UserPromptSubmit toggle; single-sources the ON body from the mandate, honest degraded fallback
- `claude/hooks/browser-tree.json` - hook_owner + hook_desc for both; grounding node (4->6 hooks, broadened desc)
- `claude/hooks/cluster-wirings.json` - concise-mandate.sh (SessionStart+PostCompact) + concise-toggle.sh (UserPromptSubmit)
- `install.sh` - grounding `cluster_hooks` line + count display string
- `~/.claude/settings.json` (live) - 3 registrations (backup `.bak.20260725_055000`); mirrors what the grounding cluster install produces
- concise-rules.txt / concise-off.txt were created then REMOVED (rules inlined for cluster-deployability)
- all four symlinked into `~/.claude/` (matching the repo's per-file symlink convention)
- `~/.claude/settings.json` (live, hand-maintained, NOT the stale repo copy) - 3 hook registrations added
