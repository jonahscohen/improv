#!/bin/bash
# SessionStart / PostCompact hook: inject the concise-response ruleset unless disabled.
#
# Default state is ON (opt-in by default). The gate is a DISABLE marker, inverted from
# the voice system's ENABLE flag, so concise mode is active on any machine that has this
# hook with no per-machine install step:
#   - ~/.claude/.concise-disabled ABSENT  -> concise ON  -> inject the ruleset
#   - ~/.claude/.concise-disabled PRESENT -> concise OFF -> no-op
#
# The event name is passed as $1 by the registration ("SessionStart" or "PostCompact") so
# the emitted hookSpecificOutput.hookEventName matches the event it ran under - the same
# hookSpecificOutput shape the proven-working mandate hooks use (task-loop-mandate.sh,
# claude-surface.sh). A top-level "additionalContext" is NOT reliably honored and would
# make default-on silently fail to inject. Because this fires on SessionStart too, a
# compaction (SessionStart with source=compact) re-injects the rules independently of
# whether PostCompact is honored.
#
# The ruleset text lives HERE, in one place. `concise-mandate.sh --emit-body` prints just
# the raw rules (no hook JSON); concise-toggle.sh calls that on "concise on" so the text
# is never duplicated. Self-contained on purpose: the grounding cluster deploys .sh files
# only, so keeping the rules inline (not in a sibling .txt) is what lets this install and
# work on any machine.
#
# Toggle at runtime with "concise on" / "concise off" (handled by concise-toggle.sh).
# Ruleset adapted from the i-have-adhd skill by ayghri (MIT, github.com/ayghri/i-have-adhd).

concise_rules_body() {
  cat <<'RULES'
CONCISE MODE IS ON (opt-in default for this user). Shape every response for a reader who wants signal over padding. Rules, adapted from the i-have-adhd skill by ayghri (MIT, github.com/ayghri/i-have-adhd):

1. Lead with the action or the answer. The thing to do, or the direct answer, goes in the first sentence - before any context.
2. Number multi-step work. One bounded task per step; no step hides two actions behind "and then".
3. End with one concrete next action doable in under two minutes.
4. Finish the current thread before raising tangents. Do not fan out into side issues mid-answer.
5. Make completed work visible in plain terms ("Login now works with magic links"), not buried in narration.
6. State errors matter-of-factly: cause, then fix. No softening filler.
7. Cap lists at five items. Longer than five, split into priority tiers.
8. No preamble, no recap, no pleasantries. Start with the answer, stop when done.
9. When scoping work, give a specific estimate ("about 15 minutes if tests cover this"), not a vague one.
10. Prefer short. If a sentence can go, cut it.

Override ONLY when: the user asks you to explain or go deep, a destructive or irreversible action needs its confirmation, you are genuinely blocked on real ambiguity, or brevity would delete the answer itself. Concise mode governs prose length, not process - it never suspends standing mandates (AskUserQuestion for questions, verification before reporting done, beats discipline, safety confirmations).

Toggle: the user can say "concise off" or "verbose" to disable, "concise on" to re-enable, "concise status" to check.
RULES
}

case "${1:-}" in
  --emit-body) concise_rules_body; exit 0 ;;
esac

EVENT="${1:-SessionStart}"
MARKER="$HOME/.claude/.concise-disabled"

if [ ! -f "$MARKER" ]; then
  EVENT="$EVENT" BODY="$(concise_rules_body)" python3 -c '
import json, os
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": os.environ.get("EVENT", "SessionStart"),
    "additionalContext": os.environ.get("BODY", "")}}))
'
fi
# marker present -> no output (no-op)
