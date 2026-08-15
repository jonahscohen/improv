---
name: artifact-open-mandate closes the binary-office-doc hole (script-made .docx never enforced)
description: A Word/Excel/PowerPoint doc created by a script (Bash) fell entirely outside the open-on-create hook, because documents were harvested from the Write tool ONLY and binary office files can only be produced via Bash
type: feedback
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 51/51 hook suite (6 new Word-doc-via-Bash cases) + live end-to-end record/name/open round-trip
confidence: high
relates_to: [session_2026-08-06_artifact-open-mandate-built.md, session_2026-08-07_artifact-open-flow-fix.md]
---

The ppai-pm session self-reported an incident (at Jonah's direction): it generated a Word review checklist, saved it to Jonah's Desktop, and only TOLD him the filename/location instead of OPENING it - forcing him to go dig. It "failed the hook designed to enforce open-on-create." Jonah's response to my first reply: "That's not good enough. Suggestive language doesn't help me." - i.e. the rule was suggestive; fix the enforcement.

**Root cause (found in the hook, not guessed):** `claude/hooks/artifact-open-mandate.sh` harvests DOCUMENT extensions (.md .txt .csv .rtf .doc .docx) from the **Write tool ONLY** - documents were "intentionally NOT harvested from Bash" to avoid scratch/intermediate noise. But a Word/Excel/PowerPoint file is BINARY: the Write tool cannot author it, so it can ONLY be produced by a script run through Bash (python-docx, pandoc). Therefore a real .docx was NEVER recorded, the Stop gate never fired, and open-on-create was unenforced for exactly the format a "review checklist" uses.

**Fix (surgical, `artifact-open-mandate.sh`):** binary office formats (.docx .doc .xlsx .xls .pptx .ppt .odt .ods .odp) are now (a) IN SCOPE (added to DOC_EXTS so `in_scope` accepts them, and they keep the docs temp-exclusion), and (b) harvested from BASH via a new `OFFICE_BASH` set + widened `BASH_PATH_RE`, because unlike TEXT docs they are never scratch/intermediate and never a consumer target - always a deliverable. Text docs (.md/.txt/.csv/.rtf) stay Write-only (unchanged), so no new false positives. The `CONSUMER_RE` and require-exists guards still apply.

**Why it is now MECHANICAL, not suggestive:** the clear hook (`artifact-open-clear.sh`) was ALREADY built for this - it discharges a pending entry when `open <path>` runs (it even names "a document Read cannot render inline (a .docx)" in its own comments). The machinery was ready; the mandate hook simply never fed it a script-made .docx. Now: record on create -> Stop gate blocks -> only `open <path>` (opening it in Word) clears it. Naming the location does NOT clear it.

**Verified:** hook suite 45 -> 51 passing (new R7a-f: .docx via pandoc -o, .docx via python-docx .save(), .xlsx, .pptx all recorded; .docx in /tmp still excluded; `cat .docx` consumer not recorded). Live end-to-end: script creates the doc -> RECORDED; `echo saved to <path>` -> STILL PENDING; `open <path>` -> CLEARED.

**Self-analysis (my own miss, same class as the peer's):** my first reply treated the incident report as "just log it" and answered with hedging ("very likely", "just logged", "nothing needed"). That is the SAME failure mode the peer reported - treating a soft acknowledgment as complete instead of doing the work. An incident that exposes a broken guardrail, arriving in the dotfiles-HOME repo where the hook lives, IS a call to fix the guardrail. Signal I missed: "failed the hook designed to enforce" = an enforcement bug I own here, not an FYI to file.

**Codex review -> HARVEST REWORK (my first cut over-broadened).** The review found my first version harvested office docs from EVERYWHERE (bare command paths + stdout), which caught office INPUTS/mentions, not just creations: HIGH `soffice --convert-to docx --outdir DIR src.odt` recorded the input .odt; MED a template merely named in stdout got recorded; MED a spaced path (`.save('/Desktop/Project Plan.docx')`) was still missed. Reworked to harvest office docs ONLY from an EXPLICIT OUTPUT position: an -o/--output flag or redirect (shared `_harvestable`), OR a new `OFFICE_SAVE_RE` that matches a `save|save_as|write|to_excel|dump(...)` call naming a quoted absolute office path (this catches the python-docx incident shape AND, via quoted-capture, paths WITH SPACES). Bare command-path and stdout scans stay VISUAL-only. Net: office is output-position-only, visuals keep the balanced any-mention harvest. Residual (documented): a `soffice --convert-to ... --outdir` output is derived from outdir+basename and is not literally named, so it is simply MISSED (no false positive) rather than mis-recorded.

**Live-parse incident (my own, caught by hook-registry-guard):** mid-edit I put a literal apostrophe in a comment ("Jonah's") and in a regex class (`['\"]`) inside the `python3 -c '...'` single-quoted block, which closed the shell quote early and broke the bash parse of a hook that is SYMLINKED LIVE. The `hook-registry-guard` PostToolUse hook blocked and flagged it immediately; fixed by using `\x27` for single quotes (as the rest of the file does) and rewording the comment. Lesson: on a live-symlinked hook with an embedded `python3 -c '...'` block, single quotes in the python source must be `\x27`.

**Re-review (2nd, 195.6s) -> essentially clean, one LOW folded.** It confirmed the HIGH/MED are fixed and found no ReDoS/quoting/ordering issue; the only finding was a LOW: `unzip -o x.docx` where `-o` means OVERWRITE (not an output file), so the input archive was recorded. Fixed by adding archive extractors (unzip|zipinfo|tar|bsdtar|7z|7za|unar) to CONSUMER_RE - they name an INPUT archive and an extracted file is not a Claude-authored deliverable. R7k added.

**Re-verified after all folds:** suite 45 -> 56 passing (R7g soffice-input-not-recorded, R7h convert-input-docx-records-the-pdf, R7i stdout-mention-not-recorded, R7j spaced-path-save-recorded, R7k unzip-input-not-recorded), plus 8/8 live scenarios. bash -n clean on the live hook; pandoc `-o` and soffice-input still behave (not swept up by the new extractors). Two Codex reviews converged. Done.

Files touched: claude/hooks/artifact-open-mandate.sh, claude/hooks/test-artifact-open-mandate.sh
