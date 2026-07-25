---
name: Sidecoach Stage 2b + 2d SHIPPED (pre-render authorship + exclusion-safe deck)
description: bin/sidecoach-preauthor.js + src/pre-authorship.ts (2b) and bin/sidecoach-deck.js + src/direction-deck-present.ts (2d), rendered-before-build gate + dual-surface deck, Codex-folded, not committed
type: project
relates_to: [session_2026-07-24_stage2a-palette-recipe.md, session_2026-07-24_stage2c-direction-roll.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + real-headless-render + codex-review
confidence: high
---

Stage 2b + 2d of the sidecoach upgrade plan (`docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`), the
generative-authoring track. Executed as the `stage2bd` unit. NOT committed; dist NOT rebuilt (lead runs
`npm run build` at integration). All 6 new files are additions in my ownership lane.

### What shipped

**2b - pre-render authorship (`bin/sidecoach-preauthor.js` + `src/pre-authorship.ts`)**
- From a brief JSON (name + surface + palette + type + optional component inventory), AUTHOR two artifacts:
  a design-system BOARD (token swatches + type scale + component inventory) and a first-surface MOCK, both as
  self-contained HTML.
- RENDER both headless through the SHIPPING engine by IMPORTING `runRenderedAudit` (audit-rendered.ts). A local
  artifact renders over its `pathToFileURL(...).href` (the same file:// path detect uses).
- FAIL-CLOSED gate `decidePreauthorGate(mock, board)`: either artifact `inconclusive` (did not render) -> HALT
  exit 3; mock `blocked` -> HALT exit 1; mock `clean`|`warnings-only` -> PROCEED exit 0. Exit classes mirror
  palette (0 proceed / 1 blocked / 2 usage / 3 inconclusive).
- Why the board and mock BOTH use the brief palette but only the MOCK gates blockers: faithful to the plan ("the
  build proceeds only if the MOCK audit returns a real verdict and clears blocking findings"); "renders both" is
  honored by halting fail-closed if EITHER fails to render.
- PROVEN on the real headless engine: well-formed brief -> mock `clean`, board `warnings-only` (8 legit 13px
  swatch-label tiny-text warnings), PROCEED exit 0. brief-broken.json (near-white text on white) -> mock
  `blocked` (low-contrast 1.74:1), HALT exit 1. Forced inconclusive (bogus PLAYWRIGHT_BROWSERS_PATH) -> mock
  `inconclusive`, HALT exit 3, never a proceed.

**2d - direction presentation (`bin/sidecoach-deck.js` + `src/direction-deck-present.ts`)**
- Consumes 2c's `direction-deck` by IMPORTING it (directionById/Direction). Presents rolled directions for a
  decision, surface-aware: `--surface rich` -> a self-contained STATIC HTML visualizer artifact (theme-aware,
  responsive grid, one card per direction); `--surface text` -> a clean Markdown table + per-direction detail.
- Input: `--ids a,b,c` OR piped Stage 2c roll-result JSON on stdin (`sidecoach-roll ... | sidecoach-deck`).
- HARD EXCLUSION honored (no in-browser variant surface): the artifact is inert static HTML - grep of all 4 new
  files for `createServer|.listen(|WebSocket|<script|<iframe|srcdoc|XMLHttpRequest|EventSource|fetch(` = ZERO.
  A permanent EXCLUSION SELF-SCAN test reads the bin+module source and fails if any such token is reintroduced.
- The user picks by RESPONDING; re-roll = re-invoking 2c. No server, no client runtime, no preview frame.

### The stdout-flush bug I found and fixed (both bins)
`process.stdout.write(json); process.exit(code)` TRUNCATES over a pipe: process.stdout is async on a pipe, so
process.exit cuts an unflushed write. Reproduced: the broken-mock result (8236 bytes, 7 findings) came back
EMPTY through execFileSync while a file redirect got the full valid JSON (small clean results survived, the
findings-heavy one did not). Fix: `process.stdout.write(payload, () => process.exit(code))` - the callback fires
once flushed. Applied to both bins.

### Codex review (foreground, gpt-5.4, blocking) - no P0, 8 findings, 6 folded + re-verified
- P1 CSS-injection via font stacks: `type.display/body` were HTML-escaped but interpolated into `font-family:`
  CSS; a value like `Inter; } * { color:#000; background:#fff } /*` breaks out and could force a broken mock to
  PASS. FOLDED: `reqFontStack` allowlist `/^[A-Za-z0-9 ,'"._-]+$/` rejects CSS-structural chars, loud usage exit 2.
- P1 gate fail-open on unknown verdict: FOLDED to an explicit allow-set (only clean/warnings-only proceed; any
  other verdict halts exit 3).
- P1 `readFileSync(0)` hangs on an interactive TTY: FOLDED with a `process.stdin.isTTY` guard.
- P1 `idsFromRollJson` silent-drop of malformed lines: FOLDED to return `{ids, malformed}`; the CLI fails loud
  (exit 2) on any malformed piped input rather than presenting a partial deck.
- P1 `--surface text --out` silently ignored: FOLDED to a loud usage error (exit 2).
- P1 markdown injection: FOLDED a uniform `mdInline` sanitizer (collapse newlines, escape pipe + backtick) over
  the title and every interpolated field.
- P1 tests not in run-tests.ts: NOT folded by instruction (task forbids editing run-tests.ts) - lines handed to lead.
- P2 unused `DIRECTION_DECK` import: FOLDED (removed).
All folds re-verified: tsc --noEmit clean, both suites green (pure + real-render E2E), each fold probed live.

### run-tests.ts lines for the lead (insert after line 105, the Stage 2c direction-roll entry)
```
  { rel: 'src/__tests__/pre-authorship.test.ts', required: true },                     // Stage 2b bin/sidecoach-preauthor.js: author board+mock, render both, fail-closed gate (proceed/blocked/inconclusive) + e2e render/halt
  { rel: 'src/__tests__/direction-deck-present.test.ts', required: true },             // Stage 2d bin/sidecoach-deck.js: dual-surface deck (markdown table + static artifact), exclusion self-scan, roll-json ids + e2e
```

### Notes
- Tests are dist- + browser-gated: they run all pure invariants under bare ts-node and SKIP the E2E when dist is
  unbuilt or no Chromium is cached (mirrors palette/direction-roll). Under `npm test` (build first) the E2E runs
  for real. I proved the E2E live by compiling only the two new modules into dist, running, then removing them -
  dist left byte-clean (the pre-existing dist modifications from other waves untouched).
- The concurrent `D` deletions in the tree (src/dogfood-*.ts, src/phase*.ts) are the Simplification Phase 2
  teammate's 8-harness removal, NOT mine.

### Files (all new)
- bin/sidecoach-preauthor.js, src/pre-authorship.ts
- bin/sidecoach-deck.js, src/direction-deck-present.ts
- src/__tests__/pre-authorship.test.ts, src/__tests__/direction-deck-present.test.ts
- eval/fixtures/preauthor/brief-pass.json, eval/fixtures/preauthor/brief-broken.json
