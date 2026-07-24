---
name: security_reminder_hook child_process exec detection narrowed
description: Replaced the bare exec-token substring with a three-tier import-aware matcher so RegExp .exec() stops blocking edits while real child_process shell calls still fire; 26 regression cases green
type: project
relates_to: [session_2026-07-24_security-hook-regexp-exec-false-positive.md, session_2026-07-24_security-hook-sibling-rules-path-gates.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (16 exec cases + 10 other-rule cases) + live hook probes
confidence: high
---

## What changed (2026-07-24, Jonah)

Narrowed the `child_process_exec` rule in the LIVE hook at
`~/.claude/plugins/cache/claude-plugins-official/security-guidance/unknown/hooks/security_reminder_hook.py`.

Before: the rule's `substrings` list held the bare call token as a PLAIN SUBSTRING, with no path
gate, so a RegExp string-match call blocked the edit with `sys.exit(2)`.

After: a JS/TS `path_filter` plus a callable `matcher`, `_child_process_exec_match(content, file_text)`,
with three tiers:

1. **Qualified forms** - always fire, no import evidence needed: the module member call, the
   `require(...)` member call, and the Sync variant (dot-preceded allowed, since no JS builtin
   exposes a method by that name).
2. **Namespace alias** - a `const cp = require(...)` or `import * as cp` binding, then `cp.exec(`.
   Deliberately does NOT treat a braced named import as a namespace, or every member call in the
   file would fire again.
3. **Bare unqualified call** - fires ONLY when the module imports child_process.

**Why the dot-exclusion is the load-bearing part:** the lookbehind excludes every dot-preceded
call, which is exactly the shape of RegExp string matching (a regex literal, a variable, optional
chaining, a constructed RegExp). The import gate ALONE would not have fixed the reported repro,
because that file legitimately imports the Sync variant from node:child_process at line 23. Both
guards were needed - a detail that only surfaced by testing against the real file.

**How import evidence is gathered:** an Edit's `new_string` is usually one line and will not
contain the file's import header, so `_read_file_evidence()` reads the on-disk file (capped at
512KB, never raises, missing file is normal for Write). Without this, tier 3 would have lost the
most common real-world true positive.

### Deliberate narrowing, stated honestly

The rule no longer fires on Python files. It is a Node-specific rule whose message recommends a
`.ts` utility, so firing on `.py` was itself a wrong-advice false positive. This does mean Python
dynamic-execution calls are no longer flagged by ANY rule in this hook - recorded as a known
coverage gap, not an oversight.

Accepted false negatives (both explicitly sanctioned by the task's "at minimum require the call be
on an identifier known to be from child_process"): aliased destructuring, and a bare call in a
file with no import evidence anywhere.

## Verification (real output, not assumed)

- **Before the fix:** ran the live hook against the exact repro fixture -> **exit 2**, blocking,
  with the execFileNoThrow message. Reproduced the bug first, per the debugging protocol.
- **After:** `claude/hooks/test-security-guidance-exec.py` -> **16 passed, 0 failed**.
  8 true positives still block (exit 2), 8 false positives now pass (exit 0), including the
  reported repro run against the real `subjective-label-harness.mjs`.
- **Collateral check:** all 10 other rules still behave correctly. The `check_patterns` signature
  change is backward compatible.
- **Self-demonstrating:** the buggy hook blocked BOTH the diagnosis beat and its own fix mid-session.

## Durability

The hook lives in the plugin CACHE, which a plugin refresh can overwrite. Two committed artifacts
make the fix reproducible instead of a one-off hand edit:

- `claude/hooks/vendored/security_reminder_hook.patched.py` - the patched hook.
- `claude/hooks/patch-security-guidance-exec.py` - idempotent re-apply. Classifies each installed
  copy as patched / vulnerable / unrecognized; backs up before writing; and **refuses to touch an
  unrecognized version**, so it can never downgrade a newer upstream (2.0.6 already fixed this bug
  its own way and is correctly skipped). Round-trip tested against a synthetic vulnerable tree.

**Why vendor rather than hand-patch again:** the machine is pinned to a stale `unknown` cache entry,
so upstream's fix never arrived. Until that resolves, the fix has to survive on its own.

## Sibling defect found while writing this beat

Writing this beat was blocked by a DIFFERENT rule in the same hook: `new_function_injection`,
whose substring is a two-word JS phrase, matched against PROSE in a `.md` file. Seven of the eight
remaining rules still have no `path_filter`, so they all fire on markdown, prose, and any language.
The narrowing applied here fixes only the reported rule; the same class of defect remains in the
siblings. Flagged as follow-up rather than silently widened, since the task scoped to the exec rule.

## Files touched

- `~/.claude/plugins/cache/.../security-guidance/unknown/hooks/security_reminder_hook.py` (live fix)
- `claude/hooks/test-security-guidance-exec.py` (new, regression suite)
- `claude/hooks/patch-security-guidance-exec.py` (new, idempotent re-apply)
- `claude/hooks/vendored/security_reminder_hook.patched.py` (new, vendored copy)

## Cross-model review (Codex / gpt-5.5, xhigh) - findings folded

The review did not just read the code, it RAN it, and caught a P0 the 16-case suite missed.

### P0 - quadratic alias scan, a denial-of-editing on a BLOCKING hook

The first cut looped over every module binding and, for each, compiled a FRESH regex and
rescanned the whole file. Codex measured it:

| module bindings | content | before | after |
|---|---|---|---|
| 1,000  | 39KB  | 0.375s | 0.002s |
| 3,000  | 122KB | 3.345s | 0.005s |
| 10,000 | -     | hung (killed) | 0.016s |

**Why it mattered:** this is a PreToolUse hook that BLOCKS the edit while it runs, and `file_text`
feeds it up to 512KB of on-disk content. A large bundled file would have stalled or frozen every
single edit. **Fix:** collect distinct aliases into a capped set (`_MAX_ALIASES = 25`) and build ONE
alternation regex instead of N regexes. Locked by a `perf_check()` in the suite at 1k/3k/10k.

**Self-analysis:** my own tests only ever exercised correctness on small inputs. I never asked what
happens at scale on a hook that runs on every keystroke-level edit. The lesson is that for a
blocking hook, a performance case IS a correctness case, and belongs in the suite from the start.

### False negatives found by execution - 4 fixed, 4 accepted

Fixed: dynamic `await import(...)` binding, TypeScript `import cp = require(...)`, optional-chaining
call `.exec?.(`, and a backtick module specifier. All realistic; all now covered by tests.

Accepted (each needs an arbitrary rename or computed access, undecidable without a real parser):
computed property `["exec"]` direct and via alias, promisify rename
(`const execP = promisify(cp.exec)`), and a member-extracted alias (`const sh = cp.exec`).

### False positives found by execution - 3 fixed, 2 accepted

Fixed: a database driver's own `.execSync()` method, a locally defined helper of the same name, and
`myrequire(...)` matching as `require(...)`. The first two came from the Sync variant being treated
as always-qualified; it now goes through the same three tiers as the base call, which was the
simplifying fix rather than three patches.

Accepted: a file that imports `spawn` from the module and defines its OWN local `exec` helper, and
the call name appearing inside a string literal. Both are inherent to substring/regex scanning.

### Re-verification after the fold

Whole unit re-run, not just the flagged lines: **22/22** in the exec suite (11 true positives block,
8 false positives pass, 3 perf cases), **10/10** other-rule regression still green, and the vendored
copy re-synced byte-identical to the live hook (sha 75b3cec45a17531e).

## Final proof: through the REAL harness, not a subprocess

Every check above ran the hook as a subprocess. The last test drove the actual Edit tool against a
scratch `.mjs` that DELIBERATELY imports the module (so import evidence is present and only the
dot-exclusion can save the false-positive case). Same file, same session:

- Edit adding the exact reported repro (a regex literal `.exec(str)`) -> **applied cleanly**.
- Edit adding a real bare shell call in that same file -> **BLOCKED**, warning shown.

Post-state confirmed by grep: the regex line is present at line 4, the shell call is absent. That is
the whole fix demonstrated in one file - the guard discriminates by call SHAPE, not by file.

## Second independent review - findings folded, including one of my own regressions

A second reviewer (independent Claude, clean context) verified every claim by RUNNING the hook.
It found two High items, one of which I had introduced and one of which I had wrongly declared safe.

### H1 - I INTRODUCED a 21-second stall while fixing the first round

Adding optional-chaining support changed the call-open pattern to `\s*(?:\?\.)?\s*\(`. Two adjacent
`\s*` separated by an optional group backtrack quadratically. Measured on the isolated regex:

| whitespace run | before | after |
|---|---|---|
| 8,000   | 0.079s  | 0.0002s |
| 32,000  | 1.234s  | 0.0008s |
| 64,000  | 4.954s  | 0.0020s |
| 128,000 | 19.699s | 0.0040s |

End to end the reviewer measured **exit 0 after 21.35 seconds** on a single Edit. Fix is one token:
`\s*(?:\?\.\s*)?\(`, one quantifier per branch.

**Self-analysis:** I added the perf guard for the exact failure Codex found (binding count) and
considered performance handled. But that path was already capped and could not regress; the NEW
uncapped path I had just created was untested. The lesson: when you fix a class of bug, the
regression test must cover the CLASS, not the one instance you were shown. The suite now has a
whitespace-run case with a wall-clock bound.

### H2 - my patcher claim was FALSE, and I stated it to Jonah

I wrote that the patcher "refuses to touch an unrecognized version, so it can never downgrade a
newer upstream." Not true as written. `classify()` decided on ONE substring, then replaced the
WHOLE file. The reviewer built a synthetic upstream that still carried the vulnerable rule but had
added two new rules, ran the patcher, and **both new rules were destroyed**. The installed 2.0.6
was safe only by luck (it is a rewrite with no matching marker).

**Fix:** classification now requires the target's rule-set to match the known-vulnerable set
EXACTLY. Any added, removed, or renamed rule disqualifies it. Install is also now `py_compile`
checked and atomic (`os.replace`), because installing a broken or torn hook would break editing for
every session on the machine. Re-ran the reviewer's exact scenario: the newer copy is now SKIPPED
with its 2 new rules intact, and the known-vulnerable copy still patches.

**Self-analysis:** I asserted a safety property from reading my own code rather than testing it,
and the one case that would have falsified it (vulnerable AND newer) was the one I did not
construct. Claims about what code REFUSES to do need a test that tries to make it do the thing.

### Also fixed

- **FP, the worst own-goal:** a safe `execFile` wrapper declared as `function exec(...)` fired,
  because a declaration is not dot-preceded and the file necessarily imports the module. The hook
  was blocking the exact remediation its own message recommends. Declaration contexts are now
  excluded.
- **FN, highest recall value:** `promisify(exec)` chains were invisible at every point in their
  lifecycle. The binding line is the only place they can be caught, since the result is invoked
  under an arbitrary name. All three forms now fire.
- **Hang:** `_read_file_evidence` blocked forever on a FIFO (stats as 0 bytes, so the size cap
  missed it). Now regular-files-only via `S_ISREG`.
- **Fail-open:** malformed tool_input shapes produced a raw traceback. `main()` is now wrapped so
  any unexpected error allows the edit through. An advisory guard must never be why an edit cannot
  be made.
- **Cost:** the on-disk read now happens only for JS paths, instead of on every edit to any file.
- **Stale comment** that contradicted two tests, corrected.
- **Test harness:** an uncaught `TimeoutExpired` would have crashed the whole suite, one input away
  from firing given H1. Now reported as a FAIL. The suite also asserts WHICH rule fired, so a true
  positive can no longer pass by tripping a different rule.

### Verification after the second fold

**37/37** in the exec suite (19 true positives, 12 false positives, 3 robustness, 2 perf, 1 FIFO),
**10/10** other-rule regression, vendored copy re-synced byte-identical (sha 976144c39ab2fa99).

### Accepted, not fixed

Computed `["exec"]` access, member-extracted aliases (`const sh = cp.exec`), aliased destructuring,
`import cp, { execFile }` default-plus-named, string-concatenated specifiers, and import evidence
beyond the 512KB cap. Each needs an arbitrary rename or a real parser. Two FPs remain by the same
logic: the call name inside a string literal or a comment, and a file that imports the module while
declaring its own unrelated `exec`. MultiEdit joins edits with a space, which can synthesize
`re. exec(`; the correct fix is per-edit evaluation, noted but not taken.

## Build-artifact litter, caught by the Stop gate

`install()` called `py_compile.compile(src)` with the default cfile, which writes a `__pycache__`
next to the vendored source - a build artifact appearing in the repo on every patcher run. Fixed by
compiling to a throwaway `cfile` and removing it in a `finally`. Re-ran the round trip: the vendored
directory now contains only the patched copy, and the target directory only the file plus its
backup.

## Stop-gate visual arm: false positive, diagnosed not assumed

The visual-verification Stop gate fired on this task twice. It corroborates an armed flag against
the WORKING TREE, and the tree carries pre-existing untracked `sidecoach/eval/fixtures/**` PNGs and
HTML fixtures from the a5a labeling work. Those are not this task's files.

Measured: this task's repo delta is 3 beats plus 4 Python files, and
`git status --untracked-files=all | grep -icE '\.(css|scss|html|vue|svelte|jsx|tsx|png|jpe?g|svg)$'`
over that delta returns **0**. There is no rendered surface here; verification was by execution.

Worth noting for the arm logic: the first fire was almost certainly the `.mjs` live-probe scratch
file, and the second the `.vue` / `.svelte` / `.jsx` / `.tsx` fixtures the suite creates inside a
`tempfile.TemporaryDirectory`. Both are throwaway one-line JS fixtures with nothing to render.
Corroborating against the whole working tree rather than the session's own change set means any
unrelated untracked visual file keeps the gate armed indefinitely.
