---
name: T-0017 verify-before-done.sh over-fire fix
description: is_verification_only(cmd) gate added so test/typecheck/lint/bench runs do not trip the screenshot mandate
type: project
relates_to: [session_2026-05-22_phase5_progress_update.md, decision_hook_layer_as_enforcement.md]
---

# T-0017 fix - verify-before-done over-fire on Bash test runs

Jonah, 2026-05-28.

## Problem

`claude/hooks/verify-before-done.sh` was firing the screenshot mandate on
plain test runs because the `write_indicators` substring list contained a
literal `"npx "` token. Any `npx ts-node ./foo.test.ts`, `npx tsc --noEmit`,
`npx eslint`, `npx prettier --check`, `npx @google/design.md lint`, and even
`npm run bench` could fall through to the indicator check and emit a
`CODE DEPLOYED/BUILT. You MUST verify before reporting.` block. Same
category as T-0005's three over-fire patterns: hook could not tell
"shipped new code" from "running checks against already-shipped code."

Reported on the 2026-05-28 roadmap session - mandate fired 4+ times on
plain test invocations.

## Fix

New `is_verification_only(cmd)` helper in the python block of
`verify-before-done.sh`. Two-stage:

1. Deploy-pattern guard - if ANY shell segment matches `npm run build`,
   `npm run deploy`, `npm start`, `npm run dev`, `npm run serve`,
   `vite build`, `next build`, `nodemon`, `tsx watch`, `webpack`,
   `rollup`, `esbuild`, the function returns False (let the
   `write_indicators` branch fire on its own).
2. Verification-pattern match - token-anchored regex against `(^|[\s;&|]+)`
   for ~40 patterns across five categories:
   - Test runners: npm test, npm run test:*, yarn/pnpm test, npx vitest,
     npx jest, npx mocha, npx playwright test, npx ts-node *test*.ts,
     npx tsx test/spec, node *.test.ts, bash test-*.sh, cargo test,
     pytest, python -m pytest, python -m unittest, go test, bun test,
     deno test, rspec, rake test
   - Type checks: npx tsc, tsc, --noEmit, npm run typecheck,
     npm run type-check, npm run check
   - Lint runs: npm run lint, npx eslint, eslint, npx prettier --check,
     prettier --check, npx prettier --list-different,
     npx @google/design.md lint, npx stylelint
   - Benchmark runs: npm run bench(:.*)?, yarn bench, pnpm bench
   - Pure introspection (chain-aware): git status, git log, git diff,
     git show, git branch

Called from the Bash branch after `is_read_only_command` and before the
`write_indicators` check. Exits silently (`print("{}"); sys.exit(0)`) -
does NOT clear the verify flag (this command did not visually confirm
anything) and does NOT set it (it is not a deploy).

## Why this shape

Distinct from the existing `is_verification_command` (which CLEARS the
flag because tests/curl-localhost count as visual verification of the
prior build). `is_verification_only` is the gate that says "do not fire
the mandate" without claiming the verification happened. The two
functions are intentionally separate:

- is_verification_command: positive verification action -> clear flag
- is_verification_only: negative gate -> just do not fire mandate

The deploy-pattern guard inside is_verification_only handles the chained
case `npx ts-node test.ts && npm run build` correctly: it sees the
`npm run build` segment, returns False, falls through to write_indicators
which matches and fires the mandate.

## How

`is_verification_only(cmd)` defined right after `is_read_only_command`,
called from the Bash branch in this order:

1. is_verification_command -> clear flag, exit
2. is_read_only_command -> exit silent
3. NEW: is_verification_only -> exit silent
4. write_indicators -> set flag, fire mandate
5. else exit silent

## Failure mode that put the apostrophe trap in play

First attempt at the new function had `don't` and `that's` inside the
python block comments. The whole python script is wrapped in a
single-quoted `python3 -c '...'` heredoc, so an unescaped `'` closes the
quote and bash starts interpreting the rest of the script. Hook started
firing `command not found` errors on every PostToolUse and broke
unrelated Edit/Read/Bash calls. Fix: write contractions without
apostrophes ("do not", "that is"). The existing code uses
`sq = chr(39)` for literal single quotes inside regex - same trick was
not needed here once the comments were de-apostrophized.

Lesson logged: when editing a `python3 -c '...'` heredoc block, never
use apostrophes in comments. The block has no syntactic awareness of
prose; bash sees the next `'` and unwinds the heredoc.

## Tests

New: `claude/hooks/test-verify-before-done.sh` - 73/73 PASS.

Coverage:
- 31 test-runner skip tests (every category in the spec)
- 6 type-check skip tests
- 8 lint-run skip tests
- 5 benchmark skip tests
- 10 introspection skip tests
- 5 deploy-build fire tests (regression coverage for write_indicators)
- 7 chained-command edge cases (verification + build mix, two-verify
  chains, piped, semicolon-joined)
- 1 build look-alike negative

Known limitation noted in the test file: chains that START with a
read-only command (`git diff && X`) get intercepted by
`is_read_only_command`'s startswith() check before the chain-aware
deploy-pattern fallthrough can run. Fixing requires chain-aware
tokenization in is_read_only_command - separate task, not in scope.

Existing regressions still green:
- `bash claude/hooks/test-validation-guards.sh` -> 51/51 PASS
- `bash claude/hooks/test-multiple-choice-enforce.sh` -> 29/29 PASS

## Files touched

- claude/hooks/verify-before-done.sh (added `is_verification_only` helper
  and call site)
- claude/hooks/test-verify-before-done.sh (new, 73 cases)
- TASKS.md (T-0017 filed under dotfiles / Active, then marked done)
