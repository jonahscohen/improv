---
name: MEMORY.md auto-compactor fixed (title-heavy line-cap bug)
description: compact-memory.py left MEMORY.md 4.4x over budget because cap_line only trimmed post-link `rest`, never the giant text inside the [title] brackets; fixed cap_line to cap the whole rendered line while preserving the ](file) pointer + pin marker. 109KB -> ~19.7KB by capping alone.
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests / codex-review
confidence: high
relates_to: [session_2026-06-05_memory-index-auto-compaction.md, session_2026-07-02_beats-parallel-run-hardening.md]
---

The beats index `MEMORY.md` had grown to ~108KB (4.4x over the compactor's 23KB
BUDGET). At that size the harness silently truncates the index at load (~24.4KB
limit), so ~75% of pointers were being dropped and recall was degrading. The
`memory-compact` hook / `compact-memory.py` was supposed to prevent exactly this.

## Root cause (one logic bug; the hook was wired and firing all along)

The hook is NOT unwired. `app-wirings.json` (the hook-deployment manifest) declares
memory-compact on SessionStart + PostToolUse(Write|Edit|MultiEdit), and the live
`~/.claude/settings.json` carries both registrations. `~/.claude/hooks/compact-memory.py`
is a symlink to this repo, so it fires on every MEMORY.md write. It was firing the
whole time - it just did NOTHING because of the cap_line bug below (a silent no-op).
Proven end-to-end: editing MEMORY.md in THIS session triggered the wired PostToolUse
hook, which ran the FIXED compactor and auto-compacted the index 110KB -> ~19.9KB.
(The repo's tracked `claude/settings.json` does not list memory-compact, but that
file is not the hook-deployment source - app-wirings.json is - so it is not a gap.)

**BUG 1 (the 108KB cause): `cap_line` was a no-op on the live corpus.** Every
index entry had drifted to a one-liner style where the ENTIRE 1000-4000 char hook
sits INSIDE the `[title]` brackets and the post-link `rest` group is empty:
`- [** ACTIVE ** <huge text>](session_x.md)`. The old `cap_line` built
`prefix = "- [" + full_title + "](" + file + ")"` and then only trimmed `rest`.
For a title-heavy entry `prefix` alone already exceeded MAX_LINE, so `avail` went
negative and the function returned the line UNCAPPED. Proven: a 1403-char entry
went in and came back 1403 chars (MAX_LINE=200). So line-capping - the primary
defense that is supposed to "lose nothing real" - did literally nothing, and 96
entries stayed at ~1125 bytes each.

**SECONDARY (masked by BUG 1): every entry is pinned, so archiving can't help.**
95 of 96 entries start `** ACTIVE`, 1 starts `** START HERE` - all match
`PIN_TITLE_MARKERS`, so `is_pinned` is True for every one. The archive loop filters
`(e for e in keep if not is_pinned(e[1]))`, leaving ZERO candidates. This did not
CAUSE the 108KB (the cap bug did), but it means the archive fallback is inert for
this all-pinned corpus. Not a bug to fix here (see the pin note below); with cap_line
fixed, capping alone reaches budget so it never matters today.

## Fix

Rewrote `cap_line` (claude/hooks/compact-memory.py) to cap the whole rendered line
to MAX_LINE regardless of WHERE the hook text sits:
- Always keep `- [` + `](file)` whole (the retrievable pointer must survive).
- Trim the title from its TAIL first (so the leading `** ACTIVE`/`** START HERE`
  pin marker survives and is_pinned still classifies the entry), append "…".
- If the title fits, spend the remaining budget on `rest` and trim that - this
  reduces to the OLD rest-cap byte-for-byte for the older short-title/long-rest
  style, so it is backward compatible.
- Degenerate guard: if the link alone exceeds budget, keep the bare `- [](file)`
  pointer.

Why: capping the title is the minimal change that fixes the root cause; the index
is pointers + a short hook and the full detail lives in the beat FILE, so a 200-char
cap loses nothing real and is strictly better than the harness truncating (and
dropping whole pointers) at load.

**Deliberately did NOT touch the pin veto.** The existing test's Scenario C
enshrines "pins are NEVER archived" (with BUDGET=1). That is an intentional design
choice (the active-mission/start-here anchors must always stay live), not a bug.
With cap_line fixed, capping alone lands the index under budget so the pin veto
never engages. The "95/96 entries marked `** ACTIVE`" overuse is a separate
content-discipline issue flagged to the lead: once capped entries alone exceed
~114, the documented degenerate case returns, and the durable fix there is to
reserve `** ACTIVE` for a handful of true anchors, not to make pins sheddable.

## Before / after

Dry run (fixed compactor on a COPY of the live MEMORY.md):
- 109,390 bytes -> 19,671 bytes (under the 23,000 budget), 97 entries kept, 0 archived
- MEMORY-archive.md UNCHANGED; zero pointers lost (96 unique links before AND after)

Live (the wired PostToolUse hook fired on this session's real MEMORY.md edit):
- ~110KB -> 19,873 bytes (under budget), 98 entries (incl. this beat's pointer)
- Longest line capped 4106 -> 200 chars; my index line's `](file)` pointer survived intact
- 1126 beat `.md` files still on disk (none deleted); MEMORY-archive.md unchanged at 214,320 bytes
- The compactor only edits the index; every session_*.md is untouched and still grep-able.

## Verification

- `python3 -m py_compile claude/hooks/compact-memory.py` -> OK
- `bash claude/hooks/test-compact-memory.sh` -> ALL PASS (Scenarios A/B/C unchanged)
- Added Scenario D regression: a title-heavy one-liner must cap to <= MAX_LINE with
  its ](file) pointer + pin marker intact, and a 40-entry all-`** ACTIVE` index
  must land under budget by capping alone with every pointer retained + nothing
  archived - the exact shape the old code left 4x+ over budget.

## Files touched
- claude/hooks/compact-memory.py (cap_line rewrite + docstring)
- claude/hooks/test-compact-memory.sh (Scenario D regression + header)
- .claude/memory/MEMORY.md (compacted to under budget; index pointer for this beat)
- .claude/memory/session_2026-07-26_memory-compactor-fixed.md (this file)

LEAD-INTEGRATED 2026-07-26 (commit f80f80ba): re-ran test-compact-memory.sh independently (44/44 PASS incl. Scenario D), confirmed live MEMORY.md at 20,076 bytes (under 23,000 budget), committed with the orphan-skill beat.
