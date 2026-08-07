---
name: model-router-guard red recommendation note
description: Added a red per-hook advisory ("Do not activate") to the model-router-guard card in the GUI installer via a new hook_note map
type: session
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: manifest-probe + browser screenshot
confidence: high
---

Jonah asked to append a red recommendation to the `model-router-guard` card in the GUI installer:
"Recommendation: designed to keep Anthropic from routing away from Fable 5 if erroneously detects unsafe behavior, but prevents Claude from routing agents based on LOE. Do not activate."

**Why a new field, not a concatenation:** hook descriptions render as `textContent` in the GUI (via `mk()`), so HTML colour markup embedded in the `hook_desc` string would print literally. The `hook_desc` string is ALSO shared with the terminal installer path (install.sh lines 4781/4995), so appending there would leak an un-styled recommendation into the terminal. A parallel `hook_note` map keeps the red advisory GUI-only and leaves the terminal untouched.

**How:** parallel-map pattern mirroring `hook_desc`.
- `claude/hooks/browser-tree.json` - new top-level `hook_note` object, one entry keyed by hook name.
- `claude/installer-gui/manifest.py` - forwards `hook_note` alongside `hook_desc`.
- `claude/installer-gui/index.html` - loads `HOOK_NOTE`, attaches `note` onto hook children in `walkMembers`, renders a block-level `.row__note` child inside the desc cell (main tree row AND review row). textContent-only, so the JSON string is never treated as markup.
- `claude/installer-gui/styles.css` - `.row__note` uses `--red-text` (the WCAG-calibrated readable-red text token, distinct from the `--red` fill), `display:block`, `font-weight:500`.

**Verification baseline (rule 9):** `test-component-browser.sh` had 1 PRE-EXISTING failure before my change - "installer and tree agree on every app hook": `fable: tree routes frontier-confirm-arm to fable but install_app_hooks never deploys it`. Unrelated to this change (hook-membership drift already in the dirty tree); my change adds no hooks so it cannot affect that test.

**Verified:** browser-tree.json is valid JSON; `manifest.py` forwards the note verbatim; GUI screenshot confirms the red recommendation renders on the model-router-guard card.

Files touched: claude/hooks/browser-tree.json, claude/installer-gui/manifest.py, claude/installer-gui/index.html, claude/installer-gui/styles.css
