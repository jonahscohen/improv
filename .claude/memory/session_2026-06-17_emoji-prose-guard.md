---
name: Emoji guard hardened - prose Stop hook + broadened ranges
description: Closed two gaps that let emojis reach the terminal - content-guard only scanned file writes and its emoji codepoint ranges missed Dingbats/Misc-Technical/Misc-Symbols; added content-guard-stop.sh (prose Stop guard) and broadened ranges; 20/20 tests
type: project
relates_to: [reference_browser_validation_tool_precedence.md]
---

## Trigger (recorded 2026-06-17 by Jonah Cohen)
During an NSSGA session I printed status lines with U+2705 (white check) and U+23F3 (hourglass) emojis to the terminal. Jonah caught it - CLAUDE.md bans emojis ("we're professionals"). He directed: check the hook that should prevent this and harden it. (Sidecoach "harden" keyword fired on the UserPromptSubmit hook, but this is infrastructure/hook work, NOT a sidecoach design concern - ignored that routing.)

## Self-analysis - why the emojis got through (TWO real gaps)
1. **Coverage gap (structural):** content-guard.sh is a PreToolUse hook on Write|Edit|MultiEdit only. It scans FILE content. Conversational prose to the terminal is not a tool call, so no PreToolUse gate ever sees it. The enforcement layer had no hook positioned on assistant output.
2. **Detection gap:** content-guard.sh's emoji check only covered cp >= 0x1F300 (plus a couple subranges already inside that). U+2705 (Dingbats 0x2700-0x27BF) and U+23F3 (Misc Technical 0x2300-0x23FF) and U+26A0 (Misc Symbols 0x2600-0x26FF) are all BELOW 0x1F300 - so even a file write containing them would NOT have been caught. Verified empirically before the fix.

## Self-analysis - process failure during the fix
Writing content-guard-stop.sh, I tried 3x to put the emdash/endash detection as literal glyphs (or "intended" escapes but emitted glyphs); content-guard correctly blocked my own Write each time. Root cause: I mentally substituted the dash glyph when composing. Fix: detect emdash/endash by CODEPOINT (0x2014/0x2013) like the emoji check - no glyph, no \\u escape to fat-finger. Lesson: when writing guard code that must reference forbidden chars, use integer codepoints exclusively.

## The hardening (Claude Code has no PreResponse event, so prose enforcement is post-hoc)
- **Broadened content-guard.sh emoji ranges** to a `_emoji()` helper covering: 0x1F000-0x1FAFF, 0x2600-0x27BF (misc symbols + dingbats), 0x2B00-0x2BFF, 0x231A-0x231B, 0x23E0-0x23FF, 0x2194-0x21AA, and singles 0xFE0F/0x20E3/0x2049/0x203C/0x2139. Deliberately leaves legit typography (U+2122 TM, U+2022 bullet, U+2026 ellipsis), basic arrows U+2190-2193, and Mac keys (cmd U+2318, opt U+2325, shift U+21E7) UNblocked.
- **New `content-guard-stop.sh`** (Stop hook, modeled on multiple-choice-detect-stop.sh): reads transcript_path, extracts last assistant text, detects emoji + emdash/endash by codepoint. On hit: logs to ~/.claude/.content-guard-blocks.log, writes ~/.claude/.content-guard-violation, and emits `{"decision":"block","reason":...}` so Claude must re-send the message cleaned in the same turn. Honors stop_hook_active to avoid a loop. Scope = emoji + dash ONLY (not attribution/legacy-model, which have legit prose-discussion contexts).
- **Registered** content-guard-stop.sh in the Stop array of BOTH ~/.claude/settings.json (live; note it is a real file, NOT symlinked to repo, and the two had already diverged) AND claude/settings.json (repo). Symlinked hook + test into ~/.claude/hooks.
- **Test:** claude/hooks/test-content-guard.sh (all forbidden chars generated via chr(0xXXXX) so the test file stays pure ASCII). 20/20 pass: blocks U+2705/U+23F3/U+26A0/U+1F916/U+1F680/U+2B50/emdash in writes AND prose; allows TM/arrow/cmd/bullet/clean; loop-guard honored; both settings.json valid + registered.

## Honest limitation
Stop-hook detection is post-hoc: the bad text is already on screen once before the block forces a clean re-send. True prevention is impossible without a PreResponse event Claude Code does not expose. This is detect-and-force-immediate-correction, the strongest available. Behavioral discipline (no emojis, ever) remains the first line.

## Files touched
- claude/hooks/content-guard.sh (broadened emoji ranges)
- claude/hooks/content-guard-stop.sh (NEW - prose Stop guard)
- claude/hooks/test-content-guard.sh (NEW - 20 tests)
- claude/settings.json (repo) + ~/.claude/settings.json (live) - Stop registration
- ~/.claude/hooks/ symlinks for the two new files
