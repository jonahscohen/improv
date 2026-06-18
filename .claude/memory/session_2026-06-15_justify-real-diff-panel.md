---
name: Justify Review panel - real unified diffs + open-at-exact-line
description: Replaced the panel's fake CSS-property pseudo-diff with standard unified diffs (real file lines, old|new line-number gutter, +/-) and made the open button jump the editor to the exact changed line
type: project
relates_to: [session_2026-06-15_justify-working-stage-fix.md, session_2026-06-15_justify-validating-stage-diagnosis.md]
---

Jonah: the Review Changes panel diff was unacceptable - it rendered my
selector/property/oldValue/newValue rows as fake CSS-property "diffs"
(e.g. `structure: 6 bare <a> links` -> `<ul ...>`), meaningless for structural
code edits and with no way to reach the actual lines. "Code changes must be shown
as they would be in any other diff... open the file ... go directly to ... the
exact lines."

ROOT CAUSE: justify's change schema {selector,property,oldValue,newValue} was built
for visual CSS tweaks (color: red->blue). For code/structural edits I shoved prose
into oldValue/newValue and the panel rendered it literally as `property: prose`.
There was no real-diff path and the open button (/open-file) had no line support.

FIX (real unified diffs + open-at-line):
- justify/cli/justify-done.sh: new JUSTIFY_DIFF env - takes raw `git diff` output,
  parses it (python) into structured hunks [{file, hunks:[{oldStart,newStart,header,
  lines:[{t,oldNo,newNo,text}]}]}] with real 1-based line numbers, sends as
  payload.diffs. Usage: `JUSTIFY_DIFF="$(git diff HEAD -- <paths>)" justify-done ...`
  (run from repo root so paths are repo-relative).
- server/ws-server.ts: /respond passes diffs through to the justify_response
  broadcast. /open-file now accepts `line` (+ optional column); for code/cursor it
  invokes the editor CLI `code|cursor --goto <fullpath>:<line>:<col>` (real jump),
  falling back to `open -a` if the CLI is missing.
- core/changes-panel.ts: ChangeEntry gains diffs?: FileDiff[]. _showDetailContent
  branches: if entry.diffs present, _renderFileDiffs() draws a standard unified diff
  (old|new line-number gutter, +/-/context rows, monospace, red/green, @@ hunk
  headers) with an "Open at line N" button + editor picker; else the legacy
  selector/property render (kept for genuine CSS tweaks). _firstChangedLine() walks
  past leading context to the first real change (deletions map to their new-file
  position) so the jump is exact.
- diffs flow automatically: index.ts:121 pushes the whole response (incl diffs) to
  _changeHistory, which the panel reads.

DEPLOY: core via `npm run build && npm run deploy` (daemon serves core fresh per
request -> only a browser RELOAD needed, no daemon restart). Server via
`npm run build:server` (npx tsc -p tsconfig.server.json) then `npm run deploy`, then
RESTART the daemon (kill + justify-serve.sh) for the /open-file line + /respond diffs
passthrough. Run `npm run deploy` ALONE (bash-guard blocks any command literally
containing `bash deploy.sh` or referencing ~/.claude/justify with build keywords).

VERIFIED in browser (light theme, entry "prompt-diff-demo", screenshot ss_8270zi7rr):
real diff renders with @@ -4 +4 @@, old|new gutter (4 4 / 5 5 / 6 6 context, 7 -
removed <meta description> on red), "Open at line 7" (exact change, not hunk start
4) + Cursor dropdown. Server confirmed: POST /open-file resolves
marketing-site/index.html -> absolute path and captures line=7. Did NOT click-launch
Cursor (would steal focus); the --goto branch is standard correct code.

CORRECTION (Jonah): my first diff-view cut REPLACED the original "Open With"
split-button picker (icon + chevron dropdown) with a plain "Open at line N" button
+ <select>. He wanted the ORIGINAL picker kept. Fixed: extracted the original
"Open With" component into a shared _buildOpenWith(filename, line) method (icon
opens, chevron picks editor - byte-identical to the legacy design) and used it in
both the diff view and the legacy CSS-tweak view; its /open-file fetch now carries
`line` so a picked editor jumps to it. Verified (ss_6472qi8no): diff header shows
"Open With [Finder icon][v]" exactly like before, with the real diff below.
(Minor tech-debt: the legacy CSS-tweak path still has its own inline copy of the
picker rather than calling the helper - left to avoid a risky 147-line exact-match
edit; both render identically.)

CORRECTION 2 (Jonah): my diff-view file header used JustifyMono + the full path
(marketing-site/index.ht…). He wanted it to match the original header: ImprovSans
(JustifySans) + filename basename only. Fixed _renderFileDiffs header to
font-family:JustifySans,system-ui,sans-serif (color 0.5) and
fileLabel.textContent = fd.file.split('/').pop() (basename; full path stays in the
title tooltip; firstLine still drives the Open With jump, just not shown in the
label). Verified (zoom): header reads "index.html" in sans-serif + Open With picker.
LESSON: when reusing/forking an existing component, copy ALL of its presentation
(font, label format), not just the structure - I diverged on font + label twice on
the same header. Be precise the first time.

CORRECTION 3 (Jonah): the LIST-item render treated diff entries differently from
changes entries - it gated the subtitle, the +/- count, and the Revert button on
(entry.changes||[]).length>0. My diff entries have diffs[] but empty changes[], so
they fell to the contained "Files changed: X" box with NO Revert and NO count.
Wanted: match a normal entry (entry 10) - filename as a plain line above, a +/-
diff number, and Mark Done | Revert | Reply.
Fixed in the list-item render: subtitle now falls back to the diff filenames
(basename, plain line) when there are no selectors; the +/- badge computes real
added/removed line counts from the diff hunks (e.g. +583 -71) when diffs exist; the
"Files changed:" box is skipped when diffs OR changes exist; the Revert button now
shows when changes OR diffs exist. Also broadened the DETAIL-view Revert condition
to match (consistency). Verified (ss_74330aruq): entry 11 now reads
"index.html" + "+583 -71" + Mark Done|Revert|Reply, mirroring entry 10.
LESSON (3rd correction on this panel): every code path that branches on
entry.changes must also consider entry.diffs - I kept fixing one surface (detail
header, then list item) while leaving siblings on the old gate. When adding a new
data shape (diffs), grep ALL `entry.changes` branches and handle each.

CAVEAT: takes effect only after the user RELOADS the tab (new core). Going forward
every justify-done should pass JUSTIFY_DIFF="$(git diff HEAD -- <files>)" so the
panel shows real diffs; CSS-only Manipulate tweaks still use the selector/property
rows.

Collaborator: Jonah.
