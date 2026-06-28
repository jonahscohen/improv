---
name: Visual-presentation enforcement - three layers (moved past the once-per-session nudge)
description: Jonah pushed for stronger-than-a-nudge enforcement of "present data visually on rich surfaces". Built 3 layers - SessionStart full directive, UserPromptSubmit per-turn reminder (rich only), and a Stop-time gate that BLOCKS a substantial data table dumped as markdown text on a rich surface. All verified. Honest: still not a hard guarantee, but much more reliable.
type: project
relates_to: [session_2026-06-27_presentation-by-surface.md, reference_claude_code_surface_detection.md]
---

Collaborator: Jonah. 2026-06-27. "Move the needle" - after I admitted the SessionStart-only nudge was not a guarantee (same soft-nudge class as the sidecoach invocation gap).

## THE THREE LAYERS (all on the surface signal: CLAUDE_CODE_ENTRYPOINT + CMUX_*)
1. SessionStart (claude-surface.sh, default mode) - the FULL directive once: rich surface ->
   prefer the visualizer/artifact for data; text surface -> use the panel. (Built earlier.)
2. UserPromptSubmit (claude-surface.sh turn) - a SHORT reminder EVERY prompt, RICH surfaces
   ONLY (silent on text), so the directive never fades over a long conversation. This is the
   main reliability jump over once-per-session.
3. Stop gate (surface-visual-gate.sh) - the teeth. On a RICH surface, if the last assistant
   message presents a SUBSTANTIAL markdown data table (>= 8 pipe-rows, fenced code excluded),
   it BLOCKS once ({"decision":"block"}) and asks for a VISUAL artifact instead. stop_hook_active
   loop guard => exactly ONE reconsideration, never a loop; satisfiable (re-render as a visual
   or restructure clears the table signal). Text/mobile/sdk surfaces are EXEMPT (tables are right there).

## WIRING (both repo AND live, since ~/.claude/settings.json is a copy not a symlink)
- claude/hooks/claude-surface.sh: now mode-aware (session|turn). Stray </content> artifact from
  the Write tool removed (it was after exit 0 - harmless at runtime, failed bash -n).
- claude/hooks/surface-visual-gate.sh: NEW Stop hook. Same </content> artifact removed. Code-fence
  detection uses chr(96)*3 (a literal triple-backtick inside $() broke bash's parser).
- settings.json (repo + live): SessionStart claude-surface.sh; UserPromptSubmit claude-surface.sh
  turn; Stop surface-visual-gate.sh. Both symlinked live; both settings valid JSON.

## VERIFIED (logic; can't render an artifact from this terminal)
- RICH (web): L1 full directive, L2 per-turn reminder, L3 big-table -> BLOCK. All fire.
- TEXT (cmux): L1 panel directive, L2 silent, L3 exempt. All quiet.
- Gate cases: rich+big->block; rich+small->pass; cmux+big->exempt; mobile+big->exempt;
  stop_hook_active->pass (loop guard). bash -n clean on both hooks.

## HONEST CEILING (told Jonah)
Still NOT a hard guarantee - the final step (the model actually rendering a visual) is the model's
choice; no prompt/hook forces it to 100%. And the Stop gate only catches the most obvious miss (a
big TABLE); it can't reliably detect "this prose should have been a chart" without false-firing. What
this BUYS: salient every turn + a hard stop on the clearest failure = "happens almost always, and
gets caught when it doesn't" on rich surfaces. Takes effect NEXT session (SessionStart/per-turn).

## CODEX REVIEW (folded)
No P0. P1 = packaging only (claude-surface.sh is a NEW untracked file, so it was not in the
git-diff handed to Codex; the hook IS live/symlinked - but MUST be `git add`ed at commit time;
reminder, not a code bug). Two P2s folded in surface-visual-gate.sh: (1) fence exclusion now
handles BOTH ``` and ~~~ (regex built with chr(96) to keep no literal backtick in the script);
(2) row-count now takes the MAX CONTIGUOUS table block requiring a separator row, not the sum of
all pipe lines - so two small tables no longer falsely add to a block, and leading pipes are
optional. Re-verified: big->BLOCK, two-small->pass, tilde-fenced->pass, no-leading-pipes->BLOCK,
cmux->exempt. bash -n clean. Codex independently re-confirmed surface classification + loop guard.

## COMMIT NOTE
claude/hooks/claude-surface.sh + claude/hooks/surface-visual-gate.sh are NEW untracked files -
include both in the commit (Codex P1).

## Files touched
- claude/hooks/claude-surface.sh (mode-aware), claude/hooks/surface-visual-gate.sh (new),
  claude/settings.json + ~/.claude/settings.json (UserPromptSubmit + Stop wiring).
</content>
