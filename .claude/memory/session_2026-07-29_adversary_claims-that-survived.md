---
name: Six claims that survived an adversarial pass, with the control that could have broken each
description: Decoded-pixel contrast, the three-value verdict, the pre-flight budget cap, install.sh's sed ban, the teaching payload, and the green-while-failing guard - each attacked with a planted positive or a deliberately broken variant, each held.
type: project
relates_to: [session_2026-07-29_image-generation.md, session_2026-07-29_wire-the-coach.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: independent analytic ground truth for contrast; negative controls for the budget cap, the sed ban and the runner guard; non-vacuous finding counts for the payload
confidence: high
---

# What held (2026-07-29, adversary pass)

Commit stamp at authoring: 56251cb7. Recorded because a surviving claim is only worth
something if the attack on it is written down next to it.

## 1. Contrast is read from decoded pixels - HELD, and verified harder than claimed

The beats claim 2.61:1 failing and 4.97:1 passing on the same region of the same file. I did
not try to reproduce those numbers, because trusting a tool's own reported figure is not a
test. Instead I built a PNG with an **independent** encoder (python stdlib zlib + struct, no
repo code) containing an exactly-flat `#777777` patch at `32,32,64,64`, and computed the WCAG
ratio myself:

    #777777 vs white  -> 4.4781      #777777 vs black -> 4.6895

    node bin/sidecoach-image.js verify flat-patch.png --expect-size 256x256 \
      --ink '#ffffff' --ink-region 32,32,64,64 --min-contrast 4.5   # exit 1, "worst 4.48:1 over 4096 px"
    node bin/sidecoach-image.js verify flat-patch.png --expect-size 256x256 \
      --ink '#000000' --ink-region 32,32,64,64 --min-contrast 4.5   # exit 0, "worst 4.69:1 over 4096 px"

Both match my analytic values to two decimals, the region is exactly 64x64 = 4096 px, and the
verdict flips on ink alone. The tool is doing real WCAG math on real decoded pixels.

**The control that could have broken it.** "Worst case" is the load-bearing word, so I planted
ONE white pixel in an otherwise flat `#222222` region:

    no-bright-pixel   mode=worst  exit=0  worst 15.91:1
    one-bright-pixel  mode=worst  exit=1  worst 1.00:1  (mean 15.91:1)
    one-bright-pixel  mode=mean   exit=0  mean  15.91:1

One pixel in 4096 flips the verdict under `worst` and is invisible under `mean`. That is the
documented semantics exactly, and it is the "one bright patch that eats the headline" case the
design says it exists for.

## 2. The three-value verdict holds against its author's interest - HELD

    verify live-nanobanana.png --expect-format png   -> exit 1, verdict failed
        format-matches: fail (bytes are jpeg, claimed png); pixel checks unverified
    verify live-nanobanana.jpg --expect-format jpeg  -> exit 3, verdict unverified
        bytes, format, geometry, provenance ALL PASS; two pixel checks unverified

Four passes and two unverified still returns `unverified`, not `verified`. A fail outranks an
unverified. The file's real format is read from magic bytes (`ffd8ffe0`), not the extension -
which is why a `.png` filename holding JPEG bytes was caught.

## 3. The budget cap is pre-flight, not audited after - HELD, on a clean negative control

Two runs identical except the cap, both with a deliberately bogus key:

    --budget-usd 0.0001  -> exit 7 (budget). No output file. NO ledger file created at all.
    --budget-usd 1.00    -> exit 6 (provider). Google returned 400 "API key not valid".

The only variable was the cap, and it decided whether a network request happened. If the check
were post-flight, the tiny-cap run would have returned the provider error too. It did not, so
the key was never sent. The generous-cap run recorded the issued-and-failed attempt with
`entries: []` - an attempt trace carrying no cost, which is the documented behavior. No key
material appeared in stderr on either run.

`bin/sidecoach-image.js:633` (pre-flight, against the projection) precedes
`:654` (`callProvider`) with a `continue` between them; `:709` is the separate post-flight
overrun check against the measured cost.

## 4. install.sh has zero live in-place sed edits - HELD, with the guard controlled

All 10 `sed -i` occurrences are comment lines. More importantly, the repo's own guard in
`test-userfile-safe-edit.sh` is a token scan, and I ran it against planted input rather than
trusting its zero:

    12 planted real in-place edits -> 12 caught
      including sed -E -i.bak, sed -n -i.bak, sed --in-place, sed -Ei.bak, sed -ni.bak,
      sed -e 's/a/b/' -i FILE, LC_ALL=C sed -i.bak, a pipeline sed, /usr/bin/sed, gsed,
      and a backslash-continued sed -i split across two lines
    6 planted decoys -> 0 caught
      sed 's/-i/x/', echo parsed -i, echo sed -i, grep -i via pipe, sed -- -i,
      and a trailing-comment mention
    real install.sh -> 0

That is a guard that can express failure, on every spelling its own comments admit once escaped
it. `PARTIAL_FAILURES` exists and is routed: set at :74, appended by a helper at :84-88, and
consumed at :7438 and :7673-7676.

## 5. The polish payload teaches - HELD, and the zero is not vacuous

The claim is that `resolve the <rule name> issue on the affected element` went 7 -> 0. A zero
template count is worthless if the page produced no findings, so I checked both numbers:

    /sidecoach polish the incident dashboard   (65,839-byte page + PRODUCT.md in the workdir)
    -> 6 findings across 6 rule classes, grade B
    -> "issue on the affected element": 0
    -> "it undercuts the finished result": 0

Every After cell carries specific instruction and every closing line a rule-specific reason. I
read the payload rather than grepping it, which is the lesson the lead's fourth bad instrument
paid for.

**The templates are still live fallbacks**, at `bin/sidecoach-present.js:384` and `:387`, which
is correct: the renderer must work standalone with no `dist/` build. Codex already caught the
silent-degradation path and the corpus now announces its own unavailability once on stderr
(`:351-356`). Worth knowing that a stale build silently reverts the teaching layer to templates
with only a stderr line to say so.

One inconsistency, minor and not a defect I can demonstrate harm from: the documented resolution
order at `:348` is "finding.fix > craft corpus > audit map > template". `ruleFix` follows it;
`ruleWhy` at `:387` consults the audit map BEFORE the craft corpus. The two maps cover disjoint
rule sets today (8 audit rules vs the polish/ban/linguistic keys), so nothing is currently
shadowed - but the code and its stated contract disagree, and that gap closes silently the day
a rule appears in both.

## 6. The green-while-failing guard still holds - HELD, on a deliberately broken suite

Built two synthetic suites, registered them in a throwaway copy of the runner, and ran it:

    zz-adv-honest.test.ts     prints "Status: PASS",   exits 0  -> not flagged
    zz-adv-greenfail.test.ts  prints "Status: FAILED", exits 0  -> FLAGGED

    run-tests: 1 suite(s) failed
      zz-adv-greenfail.test.ts: UNDECLARED failure verdict [labelled-verdict]: Status: FAILED
    runner exit = 1

The guard catches the exact shape it was written for and leaves the honest suite alone. Both
synthetic files and the runner copy were deleted; `git status` confirms nothing of mine remains
in the tree.

## 7. Spend is actually ledgered - HELD, after my own instrument failed a fourth time

    sidecoach/.sidecoach-cache/images/spend-ledger.json
      entries:  1 x nanobanana gemini-3.1-flash-lite-image, usd 0.0447636, basis "usage-derived"
      attempts: 1 x http 400 "Image size 2K is not supported for this model", no cost field

One real charge with a labelled basis, and one issued-and-failed request recorded as a
cost-free attempt - exactly the shape Codex finding 10 required. The file is gitignored
(`.gitignore:29`), so real spend records cannot ride into a commit.

I first reported this ledger as "1 entry, cost 0" because my reader looked for `costUsd` and
`cost`. The field is `usd`. That is my fourth broken instrument of the pass and the same shape as
the other three: I probed for the field name I expected instead of reading the record. Printing
the raw JSON took one command and corrected it.

**One real discrepancy worth knowing, not a defect I can call.** The ledger records
**0.0447636 USD** for that call; `session_2026-07-29_image-generation.md` reports it as
**0.043901 USD** and totals the session at 0.056511. The ledger is the authoritative record and
it is the higher number, so the beat's stated total is understated by about 0.0009. Whichever
figure is right, the two surfaces disagree and the narrative one is the one that got quoted.

## An observation, deliberately not inflated into a finding

`bin/sidecoach-monitor.js` exits 0 for a page with 2 BLOCKING findings and grade B, and also
exits 0 for a clean page. `result.success` means "the flow executed", not "the design passed",
so the exit status carries no design verdict at all. The one live consumer,
`bin/sidecoach-daemon.sh:63`, only logs which branch it took, so nothing is currently misled.
I am recording it rather than ranking it: it is a trap for the next consumer that assumes the
repo's usual fail-closed exit contract applies here, and the fix is a documented contract, not
a code change.

## Files touched

- none (measurement only)
