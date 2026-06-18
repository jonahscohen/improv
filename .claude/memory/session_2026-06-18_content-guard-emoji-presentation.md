---
name: content-guard switched to emoji-presentation model
description: guard now blocks only true emoji (presentation/planes/VS16), allowing all terminal typography symbols
type: project
supersedes: session_2026-06-18_content-guard-spinner-allowlist.md
relates_to: [session_2026-06-17_emoji-prose-guard.md, session_2026-06-18_two-session-role-split.md]
---

Collaborator: Jonah

Jonah's directive: "Symbols, ASCII, are all acceptable in terminal. PROPER EMOJIS are forbidden."
The guard had been banning whole Unicode blocks (0x2600-0x27BF dingbats, 0x2B00-0x2BFF,
0x2194-0x21AA, 0x231A-0x231B, 0x23E0-0x23FF), which over-blocked legitimate terminal typography -
check (U+2713), ballot-x (U+2717), stars, arrows, box-drawing, the dingbat-asterisk spinner - and
was about to block the new Sidecoach panel glyphs (diamonds U+25C6/25C7, bar U+25B0, marks).

Fix: replaced the block-range approach in BOTH content-guard.sh and content-guard-stop.sh with an
EMOJI-PRESENTATION model. A char is flagged only when it is genuinely a color pictograph:
- supplementary emoji planes U+1F000-U+1FAFF;
- a Variation-Selector-16 (U+FE0F) or combining keycap (U+20E3) anywhere (forces/defines emoji
  presentation - e.g. warning+VS16, keycaps);
- a BMP code point in the Unicode Emoji_Presentation=Yes set (curated ranges: 231A-231B, 23E9-23EC,
  23F0, 23F3, 25FD-25FE, 2614-2615, 2648-2653, 267F, 2693, 26A1, 26AA-26AB, 26BD-26BE, 26C4-26C5,
  26CE, 26D4, 26EA, 26F2-26F3, 26F5, 26FA, 26FD, 2705, 270A-270B, 2728, 274C, 274E, 2753-2755,
  2757, 2795-2797, 27B0, 27BF, 2B1B-2B1C, 2B50, 2B55).
Everything else (default text-presentation symbols) passes. The prior spinner-allowlist carve-out
is now subsumed (dropped). Emdash/endash, attribution, and legacy-model rules unchanged.

Note the consequence (intended): bare U+26A0 (warning sign, text) now PASSES; only U+26A0+VS16
(the emoji) is blocked. Same pattern for other text-default symbols that become emoji only with VS16.

Verified: `bash claude/hooks/test-content-guard.sh` -> 35 passed, 0 failed (added cases: check/ballot-x/
diamonds/bar/chevron/six-point-star/box-drawing/bare-warning ALLOWED; sparkles/cross-mark/party/
warning+VS16/keycap BLOCKED).

This is Step 0 of the "make Sidecoach real" plan (~/.claude/plans/swirling-napping-stonebraker.md):
it unblocks the panel's terminal glyphs.

Files: claude/hooks/content-guard.sh, claude/hooks/content-guard-stop.sh, claude/hooks/test-content-guard.sh
