---
name: Browser render tear ROOT CAUSE - gum fed via stdin pipe, not argv (found by Codex)
description: The bucket browser rendered torn on first load (doubled rows, orphaned cursor, phantom separators, spurious pagination). Real cause was gum choose being fed rows through a stdin pipe inside command substitution, so fd 0 was never the terminal while gum ran a raw-mode TUI. Fixed by passing rows as argv after --. My two prior fixes treated symptoms.
type: project
relates_to: [decision_installer_bucket_browser.md, session_2026-07-16_browser-gum-viewport-overflow-fix.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: real Terminal.app screenshot at 80x24, first load, examined
confidence: high
---

Jonah caught the shipped browser rendering torn and escalated hard after two failed fixes of mine. He directed the work to Codex, which found the actual root cause.

**ROOT CAUSE (Codex):** `render_screen` invoked gum as `chosen="$(printf '%s\n' "${ROW_DISP[@]}" | gum choose "${gargs[@]}")"`. gum choose is an interactive RAW-MODE TUI, but a stdin pipe means fd 0 is NOT the terminal. gum's screen model desynced from the very first frame. That single defect explains every symptom: torn first load, `Up to date` and `Quit` doubled, a stale cursor on a row the cursor was not on, rows repairing only where the cursor passed (gum repaints what it touches), phantom stacked separator rows, and spurious pagination in a 40-row window. Under `/usr/bin/script` it fails raw mode outright.

**FIX:** `chosen="$(gum choose "${gargs[@]}" -- "${ROW_DISP[@]}")"` - pass rows as ARGV, leaving stdin on the terminal. `--` protects rows like the dashed separator from being parsed as flags. Row counts are in the tens, far below argv limits.

**SECOND DEFECT (same fix):** `_br_sep_line` built a separator of `terminal_width - 2`, which lands in the FINAL column once gum adds its own two-column prefix. Terminal.app holds autowrap-pending state after a printable char reaches that column, stranding divider rows on repaint. The gum path now leaves a spare column (`w-3`); the text path keeps `w-2` (no gum prefix).

**Why my two fixes failed.** Fix 1 (26bf0c13) rewrote the `--height` math to fit the terminal (`budget = term_rows - BR_HDR_LINES - gum_hdr - 3`). That math WAS wrong and worth fixing, but it was a symptom, not the cause - so the tear survived and, at 80x40, surfaced as phantom separators plus pagination. I had also earlier seen the doubled `Up to date` in my OWN screenshot and dismissed it as a "mid-redraw artifact".

**SELF-ANALYSIS (why this went wrong, per protocol):**
1. **I explained away contradicting evidence.** The doubled row was in a screenshot I took hours before Jonah reported it. I had the bug in hand and rationalized it instead of investigating. That is the single most expensive mistake of the session.
2. **I verified the wrong build.** My final screenshots were of the banner commit; the off-list fix changed things afterward and I verified that only with tests, then told Jonah to try it.
3. **I treated a symptom as a cause.** I found ONE defect (the height math), confirmed it was real, and stopped looking. A real defect is not proof it is THE defect.
4. **The test suite was structurally blind and I trusted it anyway.** 110 render assertions passed against a visibly broken screen, because a pty BYTE capture cannot observe a terminal reflow. Green tests meant nothing here, and I quoted them as if they meant something.

**Rule going forward:** for a terminal/visual defect, a byte capture is not evidence. Only a real screenshot of a real terminal, examined, counts. And when a screenshot disagrees with the model in my head, the screenshot is right.

Files: install.sh (render_screen ~2754, _br_sep_line ~2559).
