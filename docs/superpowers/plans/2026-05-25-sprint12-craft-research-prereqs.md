# Sidecoach Sprint 12 - craft chain declares research prereqs

**Spec:** `docs/superpowers/specs/2026-05-25-sidecoach-sprint12-craft-research-prereqs-design.md`
**Mode:** Autonomous (chief-architect directive). Inline execution, no subagent dispatch - 1-file edit + test + dogfood reset.

---

## T1: Expand craft chain to include flowB + flowE

**Files:**
- Modify: `sidecoach/src/verb-command-registry.ts:47-54` (craft.flowIds), and adjust `guidanceAppend` + `parityChecklist` to mention research.
- Modify: `sidecoach/src/__tests__/sprint11-craft-chain-includes-motion-a11y.test.ts` - update length expectation from 6 -> 8, add 2 assertions for B and E.

**Steps:**

1. Edit craft.flowIds order to `[A, B, E, F, G, H, I, J]`.
2. Add to `guidanceAppend`: `'Component patterns researched before any UI is built; design references vetted for AI-slop.'` and `'Motion patterns researched before motion was integrated; easing tokens selected, not invented.'`
3. Add to `parityChecklist`: `'component research'` and `'motion patterns researched'`.
4. Rename test file or in-place update length check + add B/E inclusion assertions.
5. Compile + run test.

**Verify:** `npx tsc --noEmit` clean; new test passes.

---

## T2: Clear dogfood flow history before run

**Files:**
- Modify: `sidecoach/src/dogfood-craft-step2.ts` - add `fs.rmSync(historyPath, { force: true })` at the top of `run()`.

**Steps:**

1. Import path/os helpers.
2. Resolve history path: `path.join(os.homedir(), '.claude', 'sidecoach-flow-history.json')`.
3. `fs.rmSync(historyPath, { force: true })` before constructing the engine.
4. Print a one-line note so the dogfood output records that history was cleared.

**Verify:** dogfood file compiles via tsc.

---

## T3: Re-dogfood + close

**Steps:**

1. Build: `npm --prefix sidecoach run build`.
2. Run: `cd sidecoach && npx ts-node src/dogfood-craft-step2.ts`.
3. Read `/tmp/sidecoach-craft-output.md`. Verify all 8 flows executed; no `Flow prerequisites not met` error.
4. If clean: write close memory, update MEMORY.md, commit, push. Marketing-site build unblocked.
5. If a new bug surfaces: file Sprint 13 (note in close memory), still close Sprint 12 since its 2 fixes landed.

**Verify:** Re-dogfood output shows 8 flows; no prereq errors.

---

## Self-review

- Spec coverage: T1 implements the chain change + acceptance test, T2 implements dogfood cleanliness, T3 verifies via re-dogfood. All spec sections covered.
- Placeholders: none.
- Type consistency: `flowB_component_research` and `flowE_motion_patterns` both exist as `FlowId` literals (verified in flow-prerequisites.ts and types.ts).
