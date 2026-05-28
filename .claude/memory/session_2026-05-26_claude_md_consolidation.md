---
name: CLAUDE.md consolidation - extracting sidecoach reference into SKILL.md
description: Jonah's CLAUDE.md hit 45.8k chars (limit 40k). Plan to extract sidecoach reference material into SKILL.md while keeping standing rules in CLAUDE.md. Without affecting sidecoach or improv functionality.
type: project
relates_to: [session_2026-05-23_sidecoach_100_complete.md]
---

Jonah's `/Users/spare3/.claude/CLAUDE.md` reached 45.8k chars (40k soft limit, performance warning). Asked which features could help consolidate without breaking sidecoach or improv. /reflect was ruled out (it analyzes memory corpus, not CLAUDE.md).

**Decision:** Extract sidecoach reference material into sidecoach SKILL.md. Skills load on demand, so reference/setup material can live there while always-on behavioral rules stay in CLAUDE.md.

**Approach selected (1 of 4 options):** Extract Sidecoach reference into skill. Biggest single win, roughly 6-7k chars saved.

**Important drift discovered:**
- Active file: `/Users/spare3/.claude/CLAUDE.md` (45,800 bytes)
- Dotfiles source: `/Users/spare3/Documents/Github/claude-dotfiles/claude/CLAUDE.md` (23,228 bytes, partial, starts at Question-Asking Protocol, missing Memory Discipline and Code Quality sections)
- They differ significantly. Recent commit f664b2a "sync CLAUDE.md drift back to source" suggests manual syncing is the pattern. Will edit active file and surface drift to Jonah after.

**SKILL.md additions complete** (file is symlinked from dotfiles, so editing either path edits both):
- Entry-command intent to command routing table (DONE)
- DESIGN.md Google-spec format paragraph (DONE)
- QA gate triad expanded detail (DONE, 5 steps)
- Tactical layer (make-interfaces-feel-better) integration notes (DONE)
- "What sidecoach is NOT for" section (DONE)
- Design stack diagram (DONE, under "Where sidecoach sits in the design stack")

**CLAUDE.md collapse target:**
Sidecoach section (about 63 lines, 253 to 315) plus Design Peer Skills section (about 39 lines, 316 to 354) collapsing to about 30 lines combined. Keeps standing rules: project setup gate, DESIGN.md lint mandate, 5-step QA gate triad, tactical layer pointer, peer skills one-liner.

**Files touched:**
- `/Users/spare3/Documents/Github/claude-dotfiles/claude/skills/sidecoach/SKILL.md` (routing table + DESIGN.md spec + QA gate triad + tactical layer + sidecoach NOT for + design stack diagram all added)
- `/Users/spare3/.claude/CLAUDE.md` (collapsed Sidecoach + Design Peer Skills sections from ~100 lines to ~25 lines)

**CLAUDE.md collapse complete.** Standing rules retained: front-door mandate, project setup gate, DESIGN.md lint, 5-step QA gate triad, tactical layer pointer, sidecoach NOT for, peer skills one-liners. Detail/reference material moved into SKILL.md.

**Drift note:** Active CLAUDE.md at `/Users/spare3/.claude/CLAUDE.md` was edited directly. Dotfiles version at `/Users/spare3/Documents/Github/claude-dotfiles/claude/CLAUDE.md` is a partial subset (starts at Question-Asking Protocol) and was NOT updated. Jonah will need to either (a) sync the cuts back to dotfiles version manually, or (b) accept they remain divergent as before.

**Next:** Verify final CLAUDE.md size is under 40k chars. Surface drift to Jonah.
