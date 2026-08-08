---
name: Artifact-open flow fix - close the two behavioral-layer gaps from the field report
description: Gap A (inline-returned images auto-satisfy surfacing) and Gap B (superseded-intermediate nudge) implemented in artifact-open-mandate.sh; Stop-gate backstop untouched; Codex-reviewed; all three suites green
type: project
relates_to: [session_2026-08-07_artifact-open-field-failure.md, session_2026-08-06_artifact-open-mandate-built.md, decision_2026-08-06_artifact-surface-scope.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests, codex-review
confidence: high
---

Collaborator: Jonah. Remedy for the two PROACTIVE-layer gaps the field report
(session_2026-08-07_artifact-open-field-failure.md) exposed. The hard Stop gate held as the
backstop; the in-flight discipline is what failed. Both fixes live ONLY in
`artifact-open-mandate.sh` + its test suite. The Stop gate (backstop) and the clear hook were
left untouched. Nothing committed. Authored against HEAD 6e079a7b.

## Gap A - inline-returned images (auto-satisfy, do NOT nag)

**Decision: auto-satisfy (do not record), not sharpen-the-nudge.** An image rendered inline in a
tool result IS shown to the user in the conversation - that is genuine, durable surfacing. So the
right move is to treat the create-and-render as satisfying the obligation, not to nag for a
redundant Read. This matches the task's default direction and the field report's own conclusion.

**How:** In the mandate hook's path-extractor, the `else:` branch (any tool that is not
Write/Bash/Artifact - i.e. an MCP image tool such as a Chrome-MCP screenshot with save_to_disk)
now first calls `has_inline_image(resp)`; if the same result carries an inline image, it records
NOTHING (`print(""); exit`) so the path never enters the pending list, never nags, never trips the
Stop gate. A saved image with NO inline render falls through and is still tracked.

`has_inline_image()` is STRUCTURE-based (descends only into dict/list nodes, never strings), so a
Bash stdout string that merely mentions `image/png` can never false-match - and it is scoped to
the else-branch, so Write and Bash behavior is byte-identical (they never return inline images).
After Codex review it was tightened to require BOTH an image LABEL (`{"type":"image"}` or an
`image/*` media type) AND an actual inline PAYLOAD (base64 `data`, or a `source` with `data`/`url`).
That second condition is load-bearing: a save-only result whose metadata merely reads
`{"type":"image","path":"/x/out.png","status":"saved"}` carries no rendered pixels, so it must
fall through and be tracked, not be mistaken for something already seen.

## Gap B - superseded intermediates (proactive nudge at creation time)

**How:** After the mandate records a new artifact, a sibling detector compares it against the other
still-outstanding pending entries. Two artifacts are siblings when they share the SAME directory,
SAME extension, and IDENTICAL core name, differing only by a known size/quality/version marker
(full, light, thumb, min, compressed, draft, temp, copy, final, orig, `v2`, ...). When a sibling is
found, a non-blocking `SUPERSEDE CHECK` hint is appended to the reminder naming the orphaned
original: surface it too or delete the orphan now, rather than let the Stop gate catch the leftover.

**Detection is deliberately conservative (avoid guessing intent):**
- Bare numbers are CORE tokens, so a numbered SEQUENCE (`slide_1` / `slide_2`) is NOT flagged (both
  are wanted); only `v\d+`/`version\d+` count as version markers.
- Different directory or different extension is never a sibling.
- Codex fix folded: a sibling that was already deleted from disk is skipped, mirroring the Stop
  hook's self-heal, so the nudge never points at an artifact that was already cleaned up.

The nudge is a HINT (additionalContext) and never blocks - the Stop gate remains the sole
enforcement teeth.

## Codex cross-model review (codex-cli 0.142.5)

Ran `codex exec --sandbox read-only` on the diff. Three findings, all folded or dispositioned:
1. `has_inline_image` suppressed on a bare image LABEL -> tightened to require a payload (fixed;
   new test A5 covers metadata-only-no-payload -> still recorded).
2. Mandate matcher is still `Write|Artifact|Bash`, so Chrome-MCP screenshots never reach this hook
   in production -> Gap A is DORMANT until the matcher is widened. This is a wiring change the lead
   owns (see below); not fixable in the hook file alone.
3. Sibling detector named deleted pending paths -> now filters to existing files (fixed; new test
   B6 covers a deleted sibling -> not named).
No shell-quoting / injection issues found; the Gap B Python uses a single-quoted heredoc with
argv-passed paths, and all shell vars are quoted.

## WIRING CHANGE NEEDED (lead to make - I am constrained from editing cluster-wirings.json)

For Gap A to activate in production, the mandate hook must actually be invoked for the tool that
returns the inline image. Today the matcher is `"Write|Artifact|Bash"` (cluster-wirings.json line
~134). Two viable options for the lead:
- **Option 1 (recommended): widen the mandate matcher** to include the Chrome-MCP image tools, e.g.
  `"Write|Artifact|Bash|mcp__claude-in-chrome__computer|mcp__claude-in-chrome__get_screenshot"`.
  With Gap A in place, inline-rendered screenshots are auto-satisfied (never nagged), and any
  hypothetical save-without-render is still tracked. This makes the mandate aware of Chrome-MCP
  saves while correctly suppressing the ones already shown.
- **Option 2 (do nothing): leave the matcher as-is.** Chrome-MCP screenshots are then simply never
  tracked, which also achieves "do not nag on inline images" - but loses the ability to catch a
  saved-but-never-shown MCP image. Note: browser-tree.json carries the same three hooks and would
  want a parallel touch only if Option 1 changes the registered matcher.

Either way the hook code is correct and tested; the wiring is the lead's call. Note also: if a
field .jpg reached the pending list via a LATER Bash command that referenced an
already-inline-shown image (not the same-result case), that is a separate vector this same-result
remedy does not cover - flagging for awareness, not fixing (the task scoped Gap A to the
same-tool-result inline case and warned against over-reach).

## Verification

- `bash claude/hooks/test-artifact-open-mandate.sh` -> 45 passed, 0 failed (was 34; +11 cases:
  A1-A5 Gap A, B1-B6 Gap B).
- `bash claude/hooks/test-artifact-open-clear.sh` -> 23 passed, 0 failed (unchanged).
- `bash claude/hooks/test-artifact-open-stop.sh` -> 12 passed, 0 failed (unchanged - backstop intact).
- `hook-registry-guard.sh` audit rc0 (the live symlinked hook parses).
- New cases prove: inline image not recorded + does not trip the Stop gate (A1/A2); save-only MCP
  image still tracked (A3); metadata-only image label still tracked (A5); an unshown non-inline file
  STILL trips the gate - no regression (A4); supersede nudge fires on preview_full/preview_light and
  names the original (B1); distinct artifacts, numbered sequences, cross-dir, and single-artifact
  flow do NOT over-fire (B2-B5); deleted sibling not named (B6).

## Self-analysis (process note)

One self-inflicted error: my first edit put an apostrophe ("hook's") inside a `python3 -c '...'`
single-quoted block, which terminated the shell string and left the LIVE symlinked hook
unparseable until the next edit fixed it. The registry-guard PostToolUse hook caught it immediately.
Lesson applied for Gap B: used a single-quoted heredoc (`python3 - "$a" "$b" <<'PY'`) for the
embedded Python so apostrophes in the body are opaque to the shell. Next time, prefer the heredoc
form for any multi-line embedded Python from the start.

## Files touched
- claude/hooks/artifact-open-mandate.sh (Gap A else-branch inline-image auto-satisfy +
  has_inline_image detector; Gap B sibling-detection nudge in the reminder-emit section)
- claude/hooks/test-artifact-open-mandate.sh (R8 Gap A: A1-A5; R9 Gap B: B1-B6)
