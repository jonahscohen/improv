---
name: Agent routing Task 3 - suppression rules shipped
description: route-intent.sh now scrubs code fences/backticks/URLs/XML bodies then gates on min_prompt_chars then exempt patterns before tier matching; route-intent.json exempt list populated; TDD RED 2/5 genuinely failing (3 already silent for unrelated reasons) then GREEN 15/15.
type: project
relates_to: [session_2026-07-26_agent-routing-task2-classifier.md]
author_human: Jonah
source: session
verified: "tests - bash claude/hooks/test-route-intent.sh, GREEN 15 passed/0 failed; manual fail-open probes (empty stdin, malformed JSON, empty prompt, whitespace-only prompt, missing lexicon via env override) all exit 0 with no output; grep for emoji/emdash/attribution clean"
confidence: high
---

# Task 3: suppression rules

Collaborator: Jonah. Implemented Task 3 of the agent-routing plan per
`.superpowers/sdd/2026-07-26-agent-routing/task-3-brief.md`, as a dispatched
teammate under the branch `agent-routing`.

## What shipped

- `claude/hooks/route-intent.sh` - replaced `text = prompt.lower()` with a
  scrub-then-gate block: strips ```` ``` ```` fenced blocks, `~~~` fenced
  blocks, inline single-backtick spans, `https?://` URLs, and matched XML/HTML
  tag bodies (`<tag>...</tag>`) before lowercasing. Then gates on
  `cfg.get("min_prompt_chars", 40)` measured against the **scrubbed** text
  (so a short question wrapped in a long code block still gets suppressed).
  Then walks `lex.get("exempt", [])` and exits silently on any match, with
  `except re.error: continue` so one bad lexicon pattern cannot break the
  hook. Order is scrub -> length gate -> exempt check -> tier matching, per
  the brief and the controller's explicit note on why that order matters.
- `claude/hooks/route-intent.json` - populated `"exempt"` (was `[]` from
  Task 2 scaffolding) with 5 anchored patterns: `what/which/who/when is/are`
  openers, `explain/define/describe/summarize/tell me about` openers,
  `how do/does/did/would/should` openers, an unanchored
  agreement-seeking-framing group (`what do you think`, `does that look
  right`, etc - deliberately not anchored since these appear mid-prompt), and
  a closing-acknowledgment opener group (`thanks`, `ok`, `got it`, etc).
- `claude/hooks/test-route-intent.sh` - appended 5 `assert_silent` cases
  immediately before the RESULTS block: short prompt, informational framing,
  pattern-inside-code-fence, pattern-inside-inline-backticks, pattern-inside-
  URL. Reused the existing `run_hook`/`assert_silent` helpers from Task 2 -
  no new helpers needed.

## TDD evidence

RED: `bash claude/hooks/test-route-intent.sh` after adding the 5 assertions
but before touching `route-intent.sh`/`route-intent.json` ->
`RESULTS: 13 passed, 2 failed`. Only 2 of the 5 new cases genuinely failed
pre-implementation (code-fence case routed to sonnet-impl, inline-backtick
case routed to Explore) - both real proof the scrub step is needed. The other
3 ("short prompt", "informational framing", "URL") were already silent
*before* any suppression code existed, for reasons independent of this task:
"where is X set" fails the existing quick_answer pattern's `{2,40}` minimum
on the captured group (single-char "X"); the informational-framing prompt's
phrasing doesn't match any existing tier regex shape; and the URL's
hyphenated `find-all-the-callers-guide` doesn't match `find (all|every|each)
` because that pattern requires a literal space after "all", not a hyphen.
Flagging this as a genuine deviation from the brief's stated expectation
("FAIL on all 5 new cases") - the brief's prediction didn't match the actual
tier-pattern shapes from Task 2. This is not a code defect; it means 3 of the
5 assertions lock in intended behavior for the future (min_chars gate,
informational exemption, URL scrubbing) without being disprovable via this
particular RED run. Ran the min_chars gate and URL-scrub logic by hand
afterward to confirm each is genuinely exercised (see self-review).

GREEN: same command after both files were edited ->
`RESULTS: 15 passed, 0 failed`.

## Self-review

- Confirmed the min_chars gate is real, not vacuously true: manually ran the
  scrubbed text through the gate math (`len(text) < min_chars` with
  `min_chars=40` from `route-intent.json`'s `config.min_prompt_chars`) -
  "where is X set" scrubs to itself (15 chars) and would be gated even if it
  also happened to match a tier pattern.
- Confirmed the URL scrub is real, not vacuously true: manually substituted
  a URL that DOES contain matchable spaces post-scrub-failure (n/a here,
  since the brief's own URL case uses hyphens) by testing
  `re.sub(r"https?://\S+", " ", ...)` against the exact brief string in
  isolation - the URL is fully removed regardless of its internal content,
  so the test would hold even if `find all ` (with real spaces) were placed
  inside a URL path.
- Re-ran the 4 Task 2 `assert_routes` cases after the scrub/gate changes -
  all 4 still pass (visible in the GREEN 15/15 output above), so the
  scrubbing did not eat real routable prompts.
- Traced every failure path in the new code: `re.sub` calls have no
  user-controlled pattern (patterns are hardcoded, not lexicon-sourced) so
  they cannot raise `re.error`; `cfg.get("min_prompt_chars", 40)` wrapped in
  try/except Exception with an int() cast in case the lexicon value is a
  non-numeric string; the exempt-pattern loop wraps each `re.search` in
  `except re.error: continue` per the brief, covering a malformed lexicon
  pattern. All of this sits inside the existing outer try/except that exits
  0 on any error. Manually probed empty stdin, malformed JSON, empty prompt,
  whitespace-only prompt, and missing lexicon via `ROUTE_INTENT_LEXICON` env
  override - all exit 0 with no output.
- `python3 -c "import json; json.load(...)"` confirms `route-intent.json`
  stays valid JSON after the exempt-list edit. `bash -n` clean on both
  shell files.
- Scanned all three touched files for emoji, emdash, and AI-attribution
  strings - none found.
- `.claude/memory/MEMORY.md` and `MEMORY-archive.md` were already modified
  in the working tree before this task started (visible in `git status` at
  session start, matches the same note in the Task 2 beat) - left untouched
  and unstaged; not part of this task's file set, appears to be concurrent
  memory-compactor/other-teammate churn.

## Files touched
- `claude/hooks/route-intent.sh` (modified - scrub + min_chars gate + exempt check)
- `claude/hooks/route-intent.json` (modified - exempt list populated)
- `claude/hooks/test-route-intent.sh` (modified - 5 new assertions)
- `.claude/memory/session_2026-07-26_agent-routing-task3-suppression.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
