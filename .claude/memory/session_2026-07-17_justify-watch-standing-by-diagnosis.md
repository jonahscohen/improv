---
name: justify-watch-standing-by hook - why it failed to suppress heartbeat replies
description: Root-caused the orphaned/mis-mechanism justify-watch-standing-by hook and redesigned it to actually suppress lead replies to idle heartbeats
type: project
relates_to: [session_2026-07-17_task-loop-justify-queue-mandates.md, session_2026-07-15_stage3b-plan.md, session_2026-07-15_stage3b-execution.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Dispatched by the team lead: in a real session the assistant replied ~8x "standing by"
to consecutive justify-watch idle_notification heartbeats; the justify-watch-standing-by.sh
hook was supposed to prevent that and did not.

TWO root causes found:

1. ORPHAN IN LIVE SETTINGS. The hook is NOT in the live ~/.claude/settings.json (0 occurrences).
   It exists in claude/hooks/app-wirings.json (bound to the Stop event, gated on the `justify`
   app component) and in install.sh's `install_app_hooks justify-source-guard.sh
   justify-watch-guard.sh justify-watch-standing-by.sh` line. But the other two justify hooks
   ARE in live settings and this one is not. History: a `claude/settings.json.pre-standingby-unregister.bak`
   (Jul-12) shows it was deliberately UNREGISTERED on 2026-07-12; Stage-3b (2026-07-15) authored
   the wiring into the templates ("justify absorbs justify-watch-standing-by (my Stage-3 miss)")
   but the `justify` component was never re-installed on this machine, so live settings never got
   it back. Net: the hook never runs -> it cannot do anything.

2. MECHANISM MISMATCH (the deeper bug). Even when registered, the hook was a **Stop** hook that
   emitted a display-only `systemMessage` ("Teammate justify-watch standing by."). That was only
   ever a COSMETIC correction of the harness's false "finished" verb - it was NEVER designed to
   suppress the lead's reply. A Stop hook structurally cannot prevent a reply: Stop fires AFTER the
   assistant already replied, and a Stop `{"decision":"block"}` CONTINUES the turn (feeds reason
   back), the opposite of suppression. So registering it as-is would add a cosmetic line but never
   stop the 8 replies.

FIX (self-contained to justify-watch-standing-by.sh + its test):
- Made the hook DUAL-EVENT, branching on hook_event_name.
- NEW UserPromptSubmit branch: when the INCOMING prompt (or newest transcript user msg) carries a
  real justify-watch idle_notification heartbeat (same envelope + from==teammate_id + exact-name +
  not failed/interrupted guards as the Stop branch), emit {"decision":"block","reason":...} to
  suppress the turn entirely - the lead never composes a reply, never burns a turn. This is the only
  event that can pre-empt the reply.
- KEPT the Stop branch verbatim (the cosmetic "standing by" correction) so nothing tested is lost
  and it stays backward-compatible. Existing 45 tests still pass unmodified (they send no
  hook_event_name -> fall through to the Stop branch).

Why: matches the lead's explicit goal ("instructs the assistant to NOT reply", "should NOT burn a
turn"). block > additionalContext because block does not burn a turn at all.

UNVERIFIED ASSUMPTION (flagged to lead): that an incoming teammate idle_notification actually
triggers the lead's UserPromptSubmit hook. The heartbeat surfaces as a type:user transcript message
and the assistant demonstrably starts a turn from it, so UPS is the strong candidate - but teammate
messages may be injected out-of-band without firing UPS. If UPS does NOT fire for teammate messages,
NO hook can suppress the reply (Stop is too late) and the answer is a behavioral/context fix instead.
The block is harmless if inert (no-op). Confirm live: park justify-watch, watch for a "standing by"
reply; if suppressed, UPS fires.

CODEX CROSS-MODEL REVIEW (codex-review.py, real gpt verdict, 110s, exit 0) - folded:
- HIGH: the UPS transcript fallback blocked a real prompt that merely FOLLOWED an older park.
  FIX: removed the transcript scan entirely; the hook now acts ONLY on the submitted `prompt`
  (the authoritative current-submit source on UserPromptSubmit). Structurally impossible to block
  off history now. Regression test added.
- MEDIUM: a human pasting a full envelope in prose got their prompt eaten. FIX: added a prose guard -
  the envelope must be essentially the whole delivery (residual outside the envelope must be empty
  or a short single-line preamble with no '?'), erring strict because a suppression false-positive
  ERASES user input while a false-negative is just the status quo. Regression test added.
- LOW: double-quote-only teammate_id regex - accepted (matches the proven Stop parser + real format).
- Added an explicit hook_event_name:"Stop" test to lock the legacy path against regression.
Re-verified whole unit: 77/77 tests green, syntax clean, 4 live scenarios confirmed by eye
(HIGH pass-through, MEDIUM pass-through, real heartbeat blocks, bare envelope blocks).

EXACT WIRING THE LEAD MUST APPLY (I was constrained from editing app-wirings.json/settings.json/
install.sh). In claude/hooks/app-wirings.json, add a UserPromptSubmit entry to the
"justify-watch-standing-by.sh" array (KEEP the existing Stop entry as the legacy-cosmetic fallback):

  "justify-watch-standing-by.sh": [
    { "event": "UserPromptSubmit", "matcher": null,
      "hook": { "type": "command", "command": "~/.claude/hooks/justify-watch-standing-by.sh", "timeout": 10 } },
    { "event": "Stop", "matcher": null,
      "hook": { "type": "command", "command": "~/.claude/hooks/justify-watch-standing-by.sh", "timeout": 10 } }
  ],

Then ACTIVATE (this also fixes the orphan - even the Stop binding was never in live settings):
`bash install.sh --only justify` -> runs `picked justify && install_app_hooks ...
justify-watch-standing-by.sh` (install.sh:4906), which reads app-wirings.json and merges BOTH
bindings into live ~/.claude/settings.json. (Or hand-merge the two command objects into the
matcher-less groups of hooks.UserPromptSubmit + hooks.Stop, as was done for the grounding hooks.)
For PURE suppression with zero cosmetic line, wire ONLY UserPromptSubmit.

Files touched: claude/hooks/justify-watch-standing-by.sh, claude/hooks/test-justify-watch-standing-by.sh
