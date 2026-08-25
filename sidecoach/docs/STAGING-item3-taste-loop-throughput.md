# Staging handoff: taste-loop throughput (promote -> enforce) and the miner schedule

Authored against commit `ecef379c`. Collaborator: Jonah.
Builder-E pre-staging for the drive-to-green campaign. Both items are HUMAN-GATED by
design: green is reached only after a user action (a typed consent token) that an agent
cannot perform. This handoff does NOT perform the gated action and signs no token.

If HEAD has moved since `ecef379c`, re-verify the two digests below - they move if the
candidate content, the corpus, or the interpreter source (pattern-spec.ts /
pattern-interpreter.ts) changes.

---

## Item 3: one real detector through PROMOTE -> ENFORCE

A real, corpus-grounded taste detector was authored end to end and clears the PRODUCTION
precision floor on a fair held-out corpus. The two existing quarantined candidates carry no
detector, so a new one was authored (a distinct new file; the concurrent owner's two files
were not touched).

### The defect chosen

`motion.no-scale-zero-enter` - an element that animates to or from `transform: scale(0)`
(appears or disappears from literal nothing).

- NOT among the 63 existing registry rules. The lead's easy suggestions are all already
  rules (`a11y.justified-text`, `polish.tiny-text`, `anti-pattern.bounce-easing`,
  `polish.no-transition-all`), which is why a new defect was chosen.
- Presence-signal: the CSS token `scale(0)` is itself the defect, so it is detectable at
  high precision - unlike all-caps, where `text-transform: uppercase` is legitimate on short
  labels and would false-positive on a fair corpus.
- Corpus source: Emil Kowalski, `review-animations` skill
  (`reference/_extracted/external/emil-kowalski-skills/skills/review-animations/SKILL.md`).
  Line 49: "Never animate from scale(0) - start from scale(0.9-0.97) + opacity". Line 105:
  "transform: scale(0) -> transform: scale(0.95); opacity: 0 (Nothing appears from
  nothing)". Line 122 lists `scale(0)` as a block-level regression. The corpus supplies the
  CORRECT values (scale 0.9-0.98), which become the realistic hard negatives.

### The detector (patternSpec, data only - the interpreter runs it, never executes code)

- engine `static-css-regex`; applicability `scale\(` (scope both); defect
  `scale\(\s*0(?:\.0+)?\s*\)` flags `i` (scope both). Matches `scale(0)`, `scale(0.0)`,
  `scale( 0 )`, `SCALE(0)`, `-webkit-transform: scale(0)`. Does NOT match `scale(0.9)`,
  `scale(0.95)`, `scale(1)`, `scale(1.05)`, `scaleX(0)`, `scale3d(0,0,1)`. Passes the ReDoS
  screen + re2 compile.

### The held-out corpus (fair, frozen)

`data/taste-corpus/motion.no-scale-zero-enter/` - 11 positives + 12 negatives, all
`split: heldout`, each frozen by `contentSha256`.

- Positives (11): varied realistic surfaces that hit literal `scale(0)` on ENTER (modal,
  toast, tooltip, card, dropdown, badge, FAB, context menu, notification, popover) AND on
  EXIT (a dialog collapsing to zero) - across CSS keyframes, transition initial state,
  inline style, and vendor-prefixed forms.
- Negatives (12): motion-rich surfaces that use scale CORRECTLY - 0.9-0.98 enters, 0.96-0.98
  press feedback, 1.02-1.05 hover, an exit that shrinks to 0.9 (not zero), and an axis wipe
  (`scaleX(0)`). All are applicable (contain `scale(`) but clean (no uniform `scale(0)`), so
  precision is a real discrimination, not "animated vs static".

### Measured precision (PRODUCTION floor, honest)

`node eval/taste-enforce-precision.mjs measure motion.no-scale-zero-enter --rule-file
data/proposed-rules/motion.no-scale-zero-enter.json --base-dir <sidecoach>`:

```
held-out positives : 11  (floor >= 8: met)
TP=11 FP=0 FN=0 TN=12  fires=11 (floor >= 8: met)
precision          : 1.000  (threshold >= 0.9)
VERDICT            : PASS - eligible for enforce
build stamp        : ac7331d138f33883
PRECISION DIGEST   : d21e6f2f78ec7fadf44a499fac1b957c39af9d3670dbc447f3f76be3145b8c0d
```

P=1.000 is honest: all 11 positives fire, zero of 12 hard negatives fire, at the fixed
production floor (8 held-out positives, 8 fires, threshold 0.90 - no test-seam override).

### Independent Codex review (real cross-model pass, exit 0)

An independent Codex review was run on the candidate + corpus. Verdict: "not rigged" on the
`scale(0)` vs `scale(0.9x/1.x)` boundary, no false positives on any negative, P=1.0
mechanically honest. It raised two fair points, both now addressed:

1. The original message overclaimed "enter animation" while the detector is a file-scope
   PRESENCE check. Fixed: the message/rationale now describe it as "animates to or from
   literal scale(0)" (enter OR exit), which is what the detector does and is defensible per
   Emil (scaling to literal zero is the tell in both directions). An exit-to-`scale(0)`
   positive and an exit-to-`scale(0.9)` negative were added, so the direction is now tested.
2. The corpus did not test scale(0) in non-enter contexts. Added exit and axis-wipe cases.

Known, accepted limitations (documented, not hidden): the detector shares the static-css-regex
comment/string false-positive surface of the shipping static detectors (e.g.
`polish.no-transition-all`) - a `scale(0)` inside a CSS comment would still match; and it
under-detects sibling forms (`scale(0,0)`, `scale3d(0,0,1)`, `scaleX(0)`), which lowers
recall, NOT precision. The P=1.0 claim is for the fair `scale(0)` vs `scale(0.9x)`
discrimination on real declarations, not a claim of zero false positives on commented-out code.

### Staged files (non-colliding; the concurrent owner's two files untouched)

- `data/proposed-rules/motion.no-scale-zero-enter.json` - the candidate (distinct new file).
- `data/taste-corpus/motion.no-scale-zero-enter/` - the 23 frozen corpus files.

### Pre-verified (no token needed; the human token is NOT forged)

- `promote show` -> `validation: PASS`; content digest below.
- patternSpec preflight `screenPatternSpec` -> ok, no errors; re2 available.
- Certification dress-rehearsal (pure `deriveEnforcedRules` at the production floor) ->
  certifies exactly 1 rule, 0 errors; the rendered `enforced-rules.generated.ts` compiles
  under the project tsc; `validateRegistry([...RULES, myRule])` adds ZERO new errors over a
  clean baseline. So once enforced, the codegen certifies it and the build stays green.
- `npm run build` green with the candidate present; enforce + promote ledgers clean.

### HUMAN-GATED RESIDUAL - the two user commands (real digests)

Order matters: promote first (creates the guidance rule + promotion-ledger entry the enforce
gate requires), then enforce. The user types each `*-confirm` line in their OWN REPL (it
mints a single-use consent token via the arm hook; an agent cannot).

1) Promote into the `design-laws` guidance store:

```
promote-confirm motion.no-scale-zero-enter design-laws 467ea04d70d27ab4e206a973da57fc2e6fd209ab7aa21b93d52dc189e5be6a33
```
```
node sidecoach/bin/sidecoach-taste-promote.js promote motion.no-scale-zero-enter --store design-laws
```

2) Enforce (flip to blocking; the enforce CLI re-measures precision fresh and runs its own
`npm run build` gate). Optionally run `node sidecoach/bin/sidecoach-taste-enforce.js approve
motion.no-scale-zero-enter` first - it re-measures and prints the exact line below (use its
digest if it ever differs, e.g. after an interpreter change):

```
enforce-confirm motion.no-scale-zero-enter d21e6f2f78ec7fadf44a499fac1b957c39af9d3670dbc447f3f76be3145b8c0d
```
```
node sidecoach/bin/sidecoach-taste-enforce.js enforce motion.no-scale-zero-enter
```

### VERIFY GREEN after signing (run from the sidecoach dir)

```
node bin/sidecoach-taste-enforce.js verify-ledger      # exit 0
node bin/sidecoach-taste-enforce.js audit              # exit 0
node bin/sidecoach-taste-promote.js verify-ledger      # exit 0
npm run build                                          # exit 0 (regenerates the enforced module)
grep -c motion.no-scale-zero-enter src/validators/enforced-rules.generated.ts   # ENFORCED_RULE_IDS non-empty
npx ts-node src/__tests__/mined-taste-invariant.test.ts                         # passes, now NON-vacuous
```

Caveats: (1) The promote content digest is over the candidate file; `data/proposed-rules/`
is owned by a concurrent process. If it rewrites the candidate before the user promotes, the
digest changes - re-derive via `promote show`. It will not, because the id is distinct and
the miner does not generate it. (2) The precision digest holds while the interpreter source
and the frozen corpus are unchanged; `enforce approve` is the canonical source of the digest
at sign time.

---

## Item 4: miner runs on a schedule

### Verified this session

- Plist `claude/launchd/com.yesand.sidecoach-mine-daily.plist`: `plutil -lint` OK. Paths
  match this machine ($HOME=/Users/spare3, repo=/Users/spare3/Documents/Github/improv).
- Wrapper `claude/hooks/sidecoach-mine-daily.sh` resolves the repo, the shared runner, and
  the miner bin. `DRY_RUN=1 bash claude/hooks/sidecoach-mine-daily.sh` exits 0 and prints
  the flow command (precheck decided "run").
- install.sh ALREADY copies the wrapper + shared runner into `~/.claude/hooks/` and
  templates + places the plist into `~/Library/LaunchAgents/` (lines ~7668-7712), and
  prints the activation command. No code change was needed.
- `~/.claude/logs/` exists (launchd StandardOutPath parent). The cursor dir
  `~/.claude/sidecoach-mine/` is created at runtime by the miner's `advance`
  (`sidecoach-mine.js:1255`), so a manual load without install.sh still succeeds.
- Job is NOT currently loaded (`launchctl list | grep sidecoach-mine-daily` -> empty), and
  the plist is NOT yet in `~/Library/LaunchAgents/`.

### HUMAN-GATED RESIDUAL (place the plist, then bootstrap)

```
cp /Users/spare3/Documents/Github/improv/claude/launchd/com.yesand.sidecoach-mine-daily.plist ~/Library/LaunchAgents/com.yesand.sidecoach-mine-daily.plist
launchctl bootstrap gui/502 ~/Library/LaunchAgents/com.yesand.sidecoach-mine-daily.plist
```

(`502` is `id -u` on this machine; `gui/$(id -u)` is equivalent.) Verify:

```
launchctl list | grep com.yesand.sidecoach-mine-daily
ls -la ~/Library/LaunchAgents/com.yesand.sidecoach-mine-daily.plist
```

Equivalently, running `install.sh` (or `ampersand`) performs the cp + templating step for
you; activation (`launchctl bootstrap`) is still the user's step by design.
