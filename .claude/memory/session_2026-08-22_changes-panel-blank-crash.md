---
name: Changes panel blank-crash from non-array `changes`
description: Review panel went blank / no clear bar / broken Back because an entry's `changes` was a prose STRING and `(changes||[]).map` threw in render()
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests + browser
confidence: high
relates_to: [session_2026-08-20_cross-page-highlight.md]
---

Symptom (Jonah reported, 2026-08-22): Justify "Changes" panel on ethos/web was blank; clicking a task then pressing Back left it blank; no "Clear" buttons visible.

Root cause (one bug, three symptoms). 10 of 107 persisted entries in `~/.claude/justify/responses.json` had `changes` set to a prose STRING (e.g. "No change made - deferred, unverifiable in automation.") instead of an array. Every panel consumer calls `(entry.changes || []).map(...)`; `|| []` only rescues null/undefined, so a truthy string passes through and `.map` throws `TypeError: (o.changes||[]).map is not a function` inside `render()`. render() clears the list at the top then throws mid-forEach -> blank body, and it never reaches `_updateClearBtn()` -> clear bar stays hidden. Detail view opened fine; pressing Back re-runs render() which re-throws -> stays blank. Confirmed via browser console (justify-core.js render stack) and a node scan of responses.json.

Where the bad data entered: the HTTP POST /respond path is NOT schema-validated (the `justify_respond` MCP tool IS - zod `changes: z.array(...)`), so the headless daemon writing a prose note into `changes` landed a string. `emitResponse` (ws-server.ts) used `input.changes || []`, same weak guard, so it persisted + broadcast.

Fix (defense in depth, 3 layers + data):
- New pure module `justify/core/normalize-entry.ts` (`normalizeEntry`/`normalizeEntries`): coerce `changes`/`diffs`/`filesChanged`/`targetSelectors` with `Array.isArray(x) ? x : []`. No index signature on the `EntryArrays` interface (so `ChangeEntry` stays assignable to the generic constraint).
- Client boundary `core/index.ts`: normalize each `justify_response` on ingest (live handler + the `/responses` fetch) so both the panel and `_previewChanges` get clean arrays.
- Panel `core/changes-panel.ts` `show()`: `this.entries = normalizeEntries(entries)` - belt and suspenders so one bad entry never blanks the whole list.
- Server `ws-server.ts` `emitResponse`: `Array.isArray(...) ? ... : []` for the three array fields, so malformed payloads never persist/broadcast again.
- Data scrub: coerced the 10 string `changes` in `~/.claude/justify/responses.json` to `[]` (backup `responses.json.bak-*`), 0 remaining bad, 107 total.

Verification: 328/328 vitest pass (added `__tests__/core/normalize-entry.test.ts` 7 tests + 2 coercion tests in `__tests__/server/respond-parity.test.ts`). Rebuilt core bundle + server, `deploy.sh` synced to `~/.claude/justify`. Browser (localhost:3000, fresh bundle): panel renders full list, click a task -> detail, Back -> full list + BOTH clear buttons ("Clear All Completed" / "Clear All Tasks"), zero console errors.

Note: server ingest guard is live in the deployed dist but the running justify server (pid 45683, serving the armed ethos/web watch) still has old code in memory - the guard activates on next justify server / Claude Code restart. The CLIENT bundle fix + data scrub already fully stop the blank-panel symptom without a restart, because the client now tolerates a bad entry.

Codex cross-model review (folded, re-verified). Codex found 3 real issues in the first cut:
1. IDENTITY (regression I introduced): `show()` used `normalizeEntries` which object-spread each entry into a CLONE. The panel shares its entry objects with the host's `_changeHistory` - `setOnDone` sets `entry.reviewed=true` then persists that same object, and Clear All Completed filters `_changeHistory` by `reviewed`. Cloning broke Mark Done persistence + Clear All Completed. Fix: `normalizeEntriesInPlace` coerces fields on the SAME objects (no clone); `show()` uses it. `toggle(this._changeHistory)` passes history by reference, so identity now holds end-to-end.
2. ELEMENT-LEVEL junk: coercing only the container missed well-typed arrays holding junk elements (changes:[null], filesChanged:[42], diffs:["prose"]) - render still throws on c.selector / f.split / d.hunks. Fix: coerceArrayFields now also drops bad elements (changes->objects, filesChanged/targetSelectors->strings, diffs->objects with an array hunks).
3. TYPE-SOUNDNESS: `return out as T` from a Record tripped tsc TS2352. Fix: mutate through a local Record alias and return the original typed param; the pure clone casts the spread, not a Record. normalize-entry.ts is now tsc-clean.

Re-verified after fold: 331/331 vitest pass (normalize-entry.test.ts now 10 tests incl. identity + element-junk + purity; respond-parity +2). tsc: normalize-entry.ts and changes-panel show() both clean (171 pre-existing core errors unrelated, core ships via esbuild). Rebuilt + redeployed. Browser (fresh bundle): panel full list -> click task -> detail -> Back -> full list + BOTH clear buttons, zero console errors.

Lesson (self-analysis): the first fix cloned at the panel boundary without checking that the panel and host SHARE entry objects by reference - a "defense in depth" copy silently broke an identity contract two files away (Mark Done/Clear). Coercion that must stay compatible with in-place mutation has to be in-place. The independent review caught it; my own tests hadn't covered the mutate-then-persist path until the fold.

Files touched: justify/core/normalize-entry.ts (new), justify/core/changes-panel.ts, justify/core/index.ts, justify/server/ws-server.ts, justify/__tests__/core/normalize-entry.test.ts (new), justify/__tests__/server/respond-parity.test.ts; deployed to ~/.claude/justify/dist; scrubbed ~/.claude/justify/responses.json.
