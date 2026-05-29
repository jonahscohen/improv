# tilt-lab restore + fidelity - shared team brief

You are on the `tilt-restore` team. Mandate (non-negotiable, from Jonah): every tilt-lab effect must be **1:1 faithful to its original** - expose the original's FULL param/uniform set with REAL default values. **Nothing dropped, simplified, or fabricated; only additive.** Anything missing = failure. "Leave nothing out."

## Read first
- `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-29_tilt-lab-scope-reconciliation.md` - the authoritative target set + what was dropped/added.
- `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/feedback_tilt_lab_fidelity_mandate.md` - the fidelity rule.
- `docs/superpowers/tilt-lab-recon/ACQUIRE-BRIEF.md` - the Effect contract + headless-guard pattern (still applies).
- Your effect's recon report `docs/superpowers/tilt-lab-recon/lane-*.md` AND the GROUND-TRUTH original:
  - regent effects: local source `/Users/spare3/Documents/Github/regent/app/(app)/tools/<effect>/` (presets.ts/shaders.ts/types.ts) - this is authoritative.
  - paper/motion-core/cobe/unlumen: the recon report's verbatim capture + upstream repo if needed.

## The Effect contract (unchanged)
`init(canvas,{params,assets}); frame(t); resize(w,h); setParam(k,v); dispose(); onPointer?(x,y); mount?(host,opts)`. Externally driven (no internal RAF). Headless-guard GL so vitest passes (getContext null -> dead no-op). Per effect: `runtime/effects/<id>/{index.ts (export create<Name>Effect), manifest.json, index.test.ts}` (copy `_TEMPLATE.test.ts.md`).

## Fidelity audit method (per effect)
1. Read the ORIGINAL (local regent / recon verbatim / upstream).
2. Read the built `runtime/effects/<id>/{index.ts,manifest.json}`.
3. Diff: list EVERY original uniform/param/option/mode/preset/default. Flag anything the build dropped, simplified, or invented (e.g. mesh-gradient had FABRICATED colors + dropped scene presets; ascii dropped 3d/disco/shapes render modes; fluid left the GPU particle layer unwired).
4. Restore additively: manifest exposes every original tunable (use real defaults; add new ParamType only if truly needed); index.ts wires them; restore omitted modes/passes/presets.
5. Verify: `cd tilt-lab && npx vitest run runtime/effects/<id>` + `npx tsc --noEmit` green.

## Rules
- DO NOT edit `runtime/index.ts` (team-lead does central registration to avoid write conflicts). Just build/restore your effect dirs.
- DO NOT commit, DO NOT write beats (team-lead handles). Report your findings + what you restored.
- Use hyphens, never em dashes.
- When done with your assigned task, SendMessage team-lead a precise summary: per effect, what the original had, what was missing, what you restored, test/tsc status.
