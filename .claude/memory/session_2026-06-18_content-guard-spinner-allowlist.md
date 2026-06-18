---
name: content-guard spinner-glyph allowlist
description: content-guard no longer blocks terminal/CLI spinner frames (braille + dingbat asterisks) as emoji
type: project
relates_to: [session_2026-06-17_emoji-prose-guard.md]
---

Collaborator: Jonah

Jonah's irritation #4: content-guard blocked terminal spinner glyphs as emoji, breaking
edits to files that carry CLI spinner frames (e.g. marketing-site/demo.js uses the dingbat
asterisk cycle, install-demo.js uses the braille cycle).

Root cause: the emoji range 0x2600..0x27BF (misc symbols + dingbats) catches the dingbat
asterisk/star spinner frames used by CLI progress spinners - U+2722 (four-teardrop asterisk),
U+2733 (eight-spoked asterisk), U+2736 (six-pointed star), U+273B/U+273D (teardrop asterisks).
Those are typographic ornaments, not emoji. (Braille U+2800..U+28FF was already not blocked.)

Fix: added a `_spinner_ok(cp)` carve-out checked BEFORE the emoji ranges in both guards:
- braille 0x2800..0x28FF
- dingbat asterisk/star spinner frames 0x2722..0x2727 and 0x2731..0x2743
Sparkles U+2728 sits between the two star sub-ranges and is deliberately NOT whitelisted, so
the most common decorative-emoji-in-that-block stays blocked.

Why two sub-ranges instead of one: keeps U+2728 (real emoji) blocked while allowing the
asterisk family on both sides of it.

Verified:
- demo.js asterisk spinner (U+2722,2733,2736,273B,273D) -> allowed `{}`
- braille spinner (install-demo.js) -> allowed `{}`
- sparkles U+2728 -> still deny; white-check U+2705 -> still deny
- `bash claude/hooks/test-content-guard.sh` -> 20 passed, 0 failed

Both hooks edited (kept in sync per their own KEEP-IN-SYNC note). Edits use hex codepoints only
(no literal glyphs) so the live on-disk guard did not block its own update.

Files: claude/hooks/content-guard.sh, claude/hooks/content-guard-stop.sh
