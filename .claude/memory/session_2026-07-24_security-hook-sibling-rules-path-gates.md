---
name: security_reminder_hook sibling rules gated by path
description: Added path_filter gates plus regex narrowing to the seven remaining substring-only rules so the hook stops blocking markdown, prose, and cross-language files
type: project
relates_to: [session_2026-07-24_security-hook-exec-detection-fix.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (99 sibling-rule cases + 37 exec cases) + live hook probes + independent review folded
confidence: high
---

## Reproduction first (2026-07-24, Jonah)

Before changing anything, drove the live hook at
`~/.claude/plugins/cache/claude-plugins-official/security-guidance/unknown/hooks/security_reminder_hook.py`
against ten payloads. All ten returned **exit 2** - a blocking false positive:

| rule | file | payload shape |
|---|---|---|
| new_function_injection | beat.md | the two-word JS phrase in prose |
| eval_injection | beat.md | the call token in prose |
| react_dangerously_set_html | beat.md | the React prop name in prose |
| document_write_xss | beat.md | the DOM call in prose |
| innerHTML_xss | beat.md | the assignment form in prose |
| pickle_deserialization | beat.md | the bare word in an unrelated sentence |
| os_system_injection | beat.md | the call name in prose |
| eval_injection | model.py | a PyTorch model method call |
| eval_injection | cache.js | a redis client method call |
| pickle_deserialization | main.go | the bare word in a Go comment |

**Self-demonstrating, again:** the FIRST attempt to write this beat was blocked by
`pickle_deserialization`, because the table above contains the bare word in a `.md` file.

## What changed

**Why:** these seven rules were the sibling defect flagged at the end of the exec-fix beat.
Each matched a plain substring with no path gate, so the hook fired on prose, docs, and any
language, then `sys.exit(2)`. A security hook that cries wolf gets ignored when it is right.

**How:** the same two-part shape as the exec fix - a path gate plus a call-shape check.

| rule | gate | matching |
|---|---|---|
| new_function_injection | `_WEB_EXTS` | substring (unchanged) |
| eval_injection | NOT `_DOC_EXTS` | regex, dot-excluding lookbehind |
| react_dangerously_set_html | `_JS_EXTS` | substring (unchanged) |
| document_write_xss | `_WEB_EXTS` | substring (unchanged) |
| innerHTML_xss | `_WEB_EXTS` | substring (unchanged) |
| pickle_deserialization | `_PY_EXTS` | regex (deserialization only) + alias matcher |
| os_system_injection | `_PY_EXTS` | regex (call shape) + from-import substring |

New ext tuples: `_MARKUP_EXTS` / `_WEB_EXTS` / `_PY_EXTS` / `_DOC_EXTS`. New `regex` key
support in `check_patterns`, compiled once at import into `_COMPILED_RULE_REGEXES` - this
hook blocks the edit while it runs, so per-call compilation is a cost paid on every write.

**Deliberate divergences from upstream 2.0.6**, both to preserve recall the gate would
otherwise have destroyed:
- The browser-DOM rules use `_WEB_EXTS`, not `_JS_EXTS`. Upstream gates them to JS only,
  which drops inline `<script>` in HTML and in server-side templates. Those are the same
  XSS surface, and they fired before the gate existed.
- `pickle_deserialization` covers `cPickle` / `cloudpickle` / the pandas reader / the numpy
  opt-in, because every one of those names CONTAINS the module name and so was caught by
  the old bare-word rule. Narrowing to upstream's `pickle.load` alone would have been a
  recall regression dressed up as a fix.

## Independent review, and what it caught

Codex was probed and present (`codex-cli 0.142.5`), but proved **unreliable on this machine**:
six runs, all exit 0, none produced a final report. Runs aborted immediately after their
session hooks with `rmcp transport channel closed` against a dead local MCP server
(`[mcp_servers.paper]` -> `http://127.0.0.1:29979/mcp`). Two runs did real work - read the
files, ran the suite green - then were cut at the report boundary. `-c mcp_servers={}` did
not clear the entry, and an isolated `CODEX_HOME` aborted even earlier. Recorded honestly
rather than claimed: the cross-model reviewer did NOT deliver findings.

The gate still ran, via the sanctioned fallback (independent Claude reviewer) plus a direct
adversarial probe harness. **The probes found three real defects, all now fixed:**

**1. Case-sensitive gates - the original bug, reintroduced.** `str.endswith` is
case-sensitive, so `README.MD` skipped the doc exclusion and got **blocked for prose**,
while `mod.PY` and `app.JS` skipped their rules entirely and lost real findings. Fixed by
lowercasing the path once, at the single point the gate is applied.

**2. Executable extensions omitted by the gate.** `.pyw` / `.ipy` / `.pyx`, and the template
languages `.phtml` `.erb` `.jsp` `.cshtml` `.jinja` `.twig` `.liquid` `.njk`. Every one of
these fired BEFORE the gate existed, so omitting them was a recall loss the gate introduced.

**3. Aliased pickle import slipped through.** `import pickle as pk` then `pk.loads(...)`
names no module at the call site. The bare-word rule caught it by accident; the narrowed
regex did not. Added `_pickle_alias_match`, reusing the exec rule's capped-set-plus-one-
alternation shape so the alias scan cannot go quadratic.

**4. Found by my own new test, not by inspection - the most instructive one.** Fixing #3
did not work at first. A perf optimization added to `main()` read the on-disk file **only
for JS extensions** - correct while the exec matcher was the only consumer, and silently
starving any matcher on a non-JS rule the moment one was added. Replaced the hardcoded
language test with `_needs_file_evidence()`, which asks the rule table which paths a
matcher-bearing rule actually accepts. The perf intent is preserved; the coupling is gone.

### Second pass: the independent Claude reviewer landed, and I was wrong about perf

**CORRECTION.** I reported "backtracking: measured, clean, worst case 0.033s." That was
**wrong**, and the way it was wrong is the lesson.

The `[^\n]*` span inside the deserialization alternation IS quadratic: it runs greedily to
end of line and backtracks one character per position, for EVERY position where the
from-import prefix matches. Cost is Theta(N x L) in the number of occurrences times line
length. My perf case named that exact shape in its own docstring and then measured a
single occurrence on a long line - the one input that cannot exhibit an N x L cost. It
reported 0.003s. The reviewer varied the other axis:

| single-line payload | bytes | before | after |
|---|---|---|---|
| 1,000 occurrences | 23KB | 0.10s | 0.007s |
| 2,000 | 46KB | 0.41s | 0.013s |
| 4,000 | 92KB | 1.68s | 0.027s |
| 8,000 | 184KB | 6.61s | 0.052s |
| 32,000 | 608KB | **86.40s** | 0.215s |

Clean 4x per doubling before, ~2x after. Non-contrived trigger: a notebook is JSON,
`.ipynb` is in `_PY_EXTS`, and `json.dumps` emits ONE LINE by default - a 3,000-cell
notebook blocked the editor for 5 seconds and then found nothing. Neither `new_string` nor
`content` is size-capped and there is no timeout.

**Fix:** the from-import branch left the regex entirely. `_from_import_hit()` matches the
import prefix, then inspects a BOUNDED 400-char window. Work per match is capped, so total
cost is linear in the number of matches. The window also spans a parenthesized or
backslash-continued import, which the single-line regex could not - that is black's and
ruff's DEFAULT formatting for a long import list, so it was a real miss too.

The perf test now varies the COUNT of occurrences and asserts the GROWTH RATIO (4x input
must cost well under 8x, so a reintroduced quadratic fails even on a fast machine) rather
than checking one size against a threshold.

### The rest of the review, folded

- **eval gate inverted to an allowlist.** "Everything except prose" left `.patch`, `.diff`,
  `.snap`, `.toml`, `.sql`, `.tex`, `.adoc` and `Dockerfile` in scope and blocking. Worse,
  with no declaration guard it blocked `func eval(...)` in Go, `fn eval` in Rust,
  `def eval` in Python - writing an expression interpreter, where the name is not a sink at
  all, was a denial of editing. Now `_EVAL_EXTS` (an allowlist, like the other six rules)
  plus an `_EVAL_DECL_BEFORE_RE` guard mirroring the exec rule's.
- **`$` added to the eval lookbehind.** AngularJS `scope.$eval(expr)` fired. The exec rule
  already excluded `$`; this rule was inconsistent with it. My own fix script tripped this
  bug while being written.
- **Whitespace before the paren dropped** (deliberate trade, test-locked): `eval\s*\(`
  matches an English aside - "a function named eval (see below)" - which is realistic in
  comments, while a real call written that way violates PEP 8 and every JS formatter.
- **Extensionless executables** slipped all seven gates: `bin/deploy`, container
  entrypoints. Now falls back to sniffing the shebang.
- **More markup holes:** `.svg` (inline script is a documented XSS vector), `.xhtml`,
  `.aspx`, `.pug`, `.vm`, `.tpl`, `.heex`, `.es6`; and `.mdx`/`.astro` for the React prop,
  since MDX compiles to a React component and carries it verbatim.
- **os gaps:** an aliased `import os as o`, `from os import (system)`, multi-name imports,
  and a REGRESSION - `handler = os.system` then `handler(cmd)` reaches the same shell and
  the old substring caught it. The lookahead now accepts a call, an assignment, or an
  argument position while still rejecting prose. Note this needed an explicit `\n` branch:
  these regexes compile without `re.MULTILINE`, so `$` alone only matched end-of-string.
- **MultiEdit joined edits with a SPACE**, fabricating sinks across the seam - two edits
  reading `const s = el.innerHTML` and `= sanitized;` produced a match though neither
  contained one. Now joined with a newline.
- **`_COMPILED_RULE_REGEXES` built outside the fail-open guard** - a bad rule regex would
  abort with a traceback instead of failing open. Now compiled per rule with a guard.
- **`path_check` never got the lowercased path**, so `.github/WORKFLOWS/` slipped it.

### Classifier: the `stale` state

`classify()` was marker-presence only, so **any** copy containing the markers was "patched"
forever - it could never upgrade this script's OWN prior output. A plugin refresh restoring
an older patched build would be reported safe permanently. This was live during the review:
for a ~20 minute window the vendored copy and the installed one differed in size. Fixed by
embedding `_SG_PATCH_REV` in the hook and comparing revisions, giving a distinct upgradeable
`stale` state. Markers must also now appear as real CODE, not in a comment - a file that
merely discussed the patch set classified as carrying it.

### Known gaps, stated rather than hidden

`dill.loads`, `torch.load`, `joblib.load`, `marshal.loads`, `shelve.open`, `os.popen` and
`subprocess(..., shell=True)` are real sinks this hook does not detect. None was ever
caught (no module name in the text), so none is a regression here - but the deserialization
reminder TEXT names several of them, so it prints advice about sinks it cannot find.
Upstream 2.0.6 ships dedicated rules for these. Adding rules was out of scope.

## Self-analysis

The case-sensitivity defect is the one worth sitting with: I fixed a bug about a rule
matching too broadly, and my fix reintroduced that exact bug for anyone with an uppercase
extension. The failure mode was testing only the paths I had in mind (`beat.md`, `model.py`)
instead of the paths an adversary would pick. Writing the gate and writing its tests from
the same mental model produces tests that confirm the model rather than attack it. The
probe harness caught it in about a minute because it varied ONE axis I had not considered
at all. That is the argument for adversarial probing as a separate step from test-writing,
not a substitute for it.

Second: finding #4 only surfaced because the regression test drove the REAL subprocess with
an on-disk file, while my unit-level check of the matcher passed. Had I verified the matcher
in isolation and stopped, I would have shipped a matcher that never fired in production.

Third, and the sharpest: **I wrote a perf test that named the exact failure mode in its
docstring and then measured the one input that could not produce it.** I had the right
hypothesis, built the wrong probe, got a green number, and reported "measured, clean" with
confidence. A test that targets the correct shape but varies the wrong axis is worse than
no test, because it converts an open question into a false answer - and I then repeated
that false answer to the user. The concrete habit to carry forward: when a cost is
suspected to be `O(a x b)`, the test must vary BOTH `a` and `b`, and should assert the
GROWTH RATIO rather than a threshold at one size. A threshold passes on a fast machine; a
ratio does not.

Fourth, on process: the prior session's review found a quadratic scan, I recorded that
lesson in the beat, I re-read that beat at the start of this session, I wrote a perf test
BECAUSE of it - and still shipped a quadratic regex. Knowing the failure mode was not
enough; the check has to be built to falsify, not to confirm.

## Known gaps (pre-existing, NOT regressions from this change)

`torch.load`, `joblib.load`, and `dill.loads` are genuine deserialization RCE surfaces that
this rule does not cover. None contains the module name, so the old bare-word rule missed
them too. Upstream 2.0.6 handles them with separate rules; adding rules was out of scope here.

## Verification (real output)

- `test-security-guidance-rules.py` -> **99 passed, 0 failed** (new sibling suite)
- `test-security-guidance-exec.py` -> **37 passed, 0 failed** (no collateral damage)
- All ten original repro payloads -> **exit 0** (were exit 2)
- Reviewer's own repro set (40 payloads across all 12 findings) -> **ALL PASS**
- Suite now asserts WHICH rule fired, not just the exit code, and exercises `Write` and
  `MultiEdit` (neither tool path was covered at all before)
- Perf growth ratio: **3.8x / 4.0x for 4x input** (linear; quadratic would be ~16x)
- Vendored copy re-synced **byte-identical** to live (sha 83aee2023015993b3f51)
- `patch-security-guidance-exec.py --check` -> exit 0, all copies safe
- Durability round-trip on a synthetic tree: exec-only and fully-vulnerable copies both
  patched, upstream 2.0.6 left **byte-identical**, idempotent on re-run, and both suites
  pass against a freshly-patched copy (proving the vendored file is functional, not just
  marker-matching).

**Classifier hardened too.** `PATCHED_MARKER` alone proved only the exec fix, so a copy with
the exec narrowing but not the sibling gates would classify as done and be skipped. Now
requires BOTH markers, and treats the bare-word rule as its own vulnerable signature.
Verified against four variants, including the exec-only copy that motivated the change.

## Files touched

- `~/.claude/plugins/cache/.../security-guidance/unknown/hooks/security_reminder_hook.py` (live fix)
- `claude/hooks/test-security-guidance-rules.py` (new, 62-case sibling suite)
- `claude/hooks/patch-security-guidance-exec.py` (classifier requires both markers)
- `claude/hooks/vendored/security_reminder_hook.patched.py` (re-synced)
