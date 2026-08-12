---
name: Justify uninstall WordPress branch fix (remove.sh)
description: remove.sh had no WordPress branch, so the // justify:dev block init.sh appends to functions.php was never removed; added a stack-correct removal with a start/end marker
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 13-check hermetic fixture (legacy + delimited + clean/idempotent), old-pattern bug reproduced
confidence: high
relates_to: [session_2026-08-09_justify-connected-semantics-and-process-model.md]
---

A boss ran the Justify install via preset, added Justify to a WordPress project, and his Claude reported a real toolchain bug. Confirmed it in the source and fixed it.

**The bug (justify/cli/remove.sh, 33 lines):** it cleaned only the Drupal `*.libraries.yml` block, the (unused) static `justify-core.js` copy, and the `.justify` marker. It had NO WordPress branch, so the `// justify:dev ... }` block that `justify/cli/init.sh` appends to `wp-content/themes/*/functions.php` was never removed. Second defect: the Drupal sed uses `/# justify:dev/` (a YAML `#` comment) which can never match the PHP `//` comment, so even the existing line couldn't have cleaned it.

**The fix:**
- `justify/cli/init.sh`: the appended functions.php block now ends with a `// justify:dev:end` marker, so future removals are an exact delimited delete.
- `justify/cli/remove.sh`: new WordPress branch iterating `wp-content/themes/*/functions.php`. Guards on the EXACT start marker (`^// justify:dev$`), not a bare `justify-dev` substring. Removal uses awk (NOT a sed range): it buffers the block from the start marker and only drops it once the terminator is actually seen (`// justify:dev:end` for new installs, else a column-0 `}` for legacy); if the terminator is never found in-range it RESTORES the buffer verbatim, so it deletes exactly the delimited block or nothing - it can never run the delete through EOF.

**Codex cross-model review folded (real Codex, first pass 96.9s):** the first draft used a sed range and Codex flagged a HIGH - the delimited branch was picked by an unanchored grep but the sed end address was `$`-anchored, so an end marker with TRAILING WHITESPACE passed grep, sed never matched it, and it deleted from the start marker through EOF, eating user code. Also MED (edited legacy braces) and LOW (guarding on the `justify-dev` substring rewrites unrelated themes). All three folded via the awk rewrite + exact-marker guard + whitespace-tolerant patterns.

**Verified (produce-and-verify, hermetic fixtures):** first pass 13/13 (old `#`-pattern miss reproduced; legacy + delimited removal; original code intact; clean project untouched, no `.bak`). Post-fold 13/13 covering each Codex scenario: trailing-whitespace end marker + user code after -> block removed, user code preserved (HIGH averted); malformed no-terminator block -> file restored byte-identical + warning (MED); unrelated `justify-dev` handle -> untouched, no false "Removed" (LOW); idempotent second run no-op. bash -n clean on both scripts.

**SECOND Codex review -> PYTHON REWRITE (the awk was still unsafe).** The re-review (159.9s) found the awk still had TWO over-delete HIGHs: (1) the terminator was chosen per-FILE by grep, so a legacy block followed by user code and a later stray `// justify:dev:end` would delete across the user code; (2) the legacy `^[}]` fallback could stop at a user function's column-0 brace if the block's own brace was edited/indented. Rewrote the removal in python doing EXACT-TEMPLATE matching, which removes the range/brace heuristic entirely: at each start marker it only deletes when the 5 lines after it match the exact block init generates (URL wildcarded), optionally consuming an adjacent end marker; a body that is not the generated block is removed only if BOTH markers bound it, paired PER-BLOCK (next end marker before any next start). Writes atomically (mkstemp+os.replace, mode preserved). Guard uses `[[:blank:]]` (fixes the grep/awk `[ \t]` divergence LOW). No python3 -> warn + manual-removal message, never a fragile shell fallback.

**Re-verified (post-python, hermetic fixtures):** both re-review HIGHs directly tested and AVERTED - legacy block + user code + stray end marker leaves the user code intact; edited/indented legacy brace + later user column-0 brace leaves the file byte-identical with a manual-removal warning. Plus: two blocks (legacy + delimited) in one file both removed with the middle user code kept; delimited block + trailing content; unrelated `justify-dev` handle untouched (no false "Removed"); idempotent; atomic write leaves no temp/bak file. bash -n clean.

**THIRD Codex review (109.9s) -> three bounded edge cases folded.** It confirmed BOTH prior HIGH over-delete classes are CLOSED (no delete across unmarked user code). Remaining, all folded: (1) MED - a marker-delimited delete would remove arbitrary user code a person placed BETWEEN the installer's own markers; now the marker-delimited path also requires the block to OPEN with the WP_DEBUG guard line, so only a recognizably-Justify block is removed (arbitrary content between markers is left + warned). (2) MED - a symlinked functions.php was being replaced by a regular file, orphaning the real target; now the atomic write targets `os.path.realpath(path)`, so the symlink is preserved and the real file is edited. (3) LOW - CRLF marker lines silently under-deleted; fixed by `[ \t\r]*$`-tolerant regexes and a colon-substring bash guard (which also still excludes hyphen `justify-dev` handles).

**Re-verified (post-third-fold, 14/14):** user code between markers preserved + warned; an edited-but-ours block (URL changed, still opens with the guard) removed via marker+guard; symlinked functions.php -> real target edited, symlink kept, original intact; CRLF block removed and reported (not silent), original intact; unrelated handle untouched. bash -n clean.

**Status: DONE.** Three cross-model Codex reviews, every finding folded and re-verified. The two prior HIGH over-delete classes and all MED/LOW edge cases are closed.

**Also flagged by Codex (unreversed, out of scope, surfaced to Jonah):** the Drupal `page.html.twig` `attach_library(...)` injection, the vite/static index.html script tag, and the wp-config WP_DEBUG edit - remove.sh still does not reverse these (same defect class as the reported bug, but separate from it).

**Related gaps NOT fixed (flagged for decision, out of the reported scope):** remove.sh also does NOT remove (1) the vite/static `<script src=...justify-core.js>` tag init.sh injects into index.html / src/index.html, nor (2) revert the `WP_DEBUG` change init.sh makes to wp-config.php (reverting is arguably wrong - the user may want debug on). Same defect class as the reported bug; surfaced to Jonah rather than silently expanding scope.

Files touched: justify/cli/init.sh, justify/cli/remove.sh
