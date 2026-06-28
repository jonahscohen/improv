---
name: Marketing homepage - third "feels off" ask (no fix attempted)
description: Jonah asked the same diagnosis question a THIRD time; page still byte-unchanged; surfaced standing diagnosis from prior beats and asked whether to fix
type: project
relates_to: [session_2026-06-27_marketing-homepage-rediagnosis.md, session_2026-06-26_marketing-homepage-diagnosis.md, session_2026-06-26_marketing-homepage-critique.md]
---

Jonah asked "something about the marketing homepage feels off, what's actually wrong" about localhost:4830 for the THIRD time (Jun 26, Jun 27 earlier, Jun 27 again).

**File state:** `marketing-site/index.html` unchanged since 85052a7b (Jun 22). HEAD is 95cb51e1 (sidecoach Phase 2), did not touch marketing. Nothing has drifted between asks.

**What I did this pass:**
1. Ran `/sidecoach audit localhost:4830` - same result: blocked, grade F, 20 contrast findings on the secondary-text layer (`stat__caption` 3.02, `process__num` 3.26, `tool-card__tag` 3.26, `section__eyebrow` 3.86/4.23, `install-block__copy` 4.23 + gray-on-color).
2. Ran `/sidecoach critique localhost:4830` - multi_lens_audit errored again (still gated on flowJ_tactical_polish not running, same bug noted in the Jun 27 rediagnosis beat). Default "clean / A / 0 findings" is not real signal.
3. Read prior diagnosis beats (Jun 26 + Jun 27 rediagnosis) per beats discipline.
4. Surfaced the standing diagnosis to Jonah verbatim rather than re-deriving as if new, and named the pattern: third ask, page unchanged, no fix attempted.

**Why it kept happening:** Jonah does not appear to remember the prior asks (or the diagnosis didn't stick). Possible failure modes worth watching:
- I (Claude) re-deliver diagnosis as if it's a fresh question instead of surfacing existing beats - I caught it this pass by checking beats at the audit stage, but it would be easy to miss if I treated this as a one-shot question.
- The diagnosis is correct but heavy on findings (20 contrast + 8 message-architecture items), so it reads as overwhelming and gets bookmarked-for-later three asks in a row.
- The single-token contrast fix (lift secondary-text above 4.5:1) is the obvious lever and could have been offered as a one-line fix in the FIRST diagnosis, before the message-architecture critique. I added a direct "want me to fix this now" ask at the end of THIS pass.

**Standing standing diagnosis (unchanged):** root cause is the bold/quiet mismatch - confident high-contrast serif headlines vs. an entire supporting layer (eyebrows, tags, process nums, stat captions, install text) below WCAG AA. Single highest-leverage fix: token-level lift of secondary-text contrast above 4.5:1 - clears all 20 audit findings. Message-architecture issues (inverted hero, dark-default + ampersand-blob, CTA echo, vanity numbers, alignment wobble, identical "See in reference >" labels, FAQ-buried explanation) are tier two.

**Sidecoach bugs re-confirmed (still unfiled):**
- critique flowK_multi_lens_audit errors when run standalone (gated on flowJ_tactical_polish having run).
- critique persona extraction falls back to Alex/Jordan/Sam template even when PRODUCT.md is present + resolved.

Files touched: none (diagnosis only). Collaborator: Jonah.
