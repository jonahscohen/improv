---
name: Image generation reached from a flow, with a concept and composition layer
description: The image generator was unreachable from any documented surface and the skill text asserted the opposite of the truth about it. This wires it into the build flow, adds a compiler that turns a weak brief into a strong prompt plus its own verification contract, and adds the parity test that stops the document drifting again
type: project
relates_to: [session_2026-07-29_image-generation.md, session_2026-07-29_both-units-verified-and-committed.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + nine live provider calls across both providers + visual read of five generated assets + free API capability probes + independent-decoder oracle + Codex review
confidence: high
---

Commit stamp at authoring: 56251cb7.

The generator built earlier today worked and nothing could reach it. This is the reachability and
discoverability half, plus the layer that makes the prompt worth generating from.

## The three defects, in order of severity

**The skill text asserted the OPPOSITE of the truth.** It said six self-contained CLIs ship in
`sidecoach/bin/` when there are seven, and it said `sidecoach-drift` was the only flow-wired tool and that
"the other five tools are invoked directly, not auto-run by a flow" while `sidecoach-image` was already
auto-run by flow D. An omission leaves a reader with a gap they might go and fill. That sentence filled the
gap with a wrong answer, so a model reading the only loadable document about this system concluded it had to
do all image work by hand. This is the worse failure and it is why the fix is a test rather than an edit.

**No BUILD flow produced an asset.** Flow D's concept-sketch lens existed (a research flow, producing a
reference plate). Nothing in the craft chain produced an asset for the page being built.

**The prompt was three sentences.** "A reference plate for a product interface in a modern visual direction.
Brief: <the utterance>." A weak prompt from a weak brief, which is the one thing this layer exists to stop.

## What was built

`src/image-composition-catalog.ts` - fourteen STAGINGS, palette-free and type-free by a contract the
validator MECHANICALLY enforces: a grammar rule naming a colour or a typeface is a validation error, not a
comment asking politely. Every entry declares an `inkZone`, the normalized rectangle where overlaid live text
will sit.

`src/image-brief-compiler.ts` - the compiler. Joins the staging catalog, the existing `direction-deck.ts`
(one authored catalog, now two consumers: the direction roll and the image prompt), and the project's own
DESIGN.md and PRODUCT.md into a prompt AND a verification contract.

`src/image-asset-production.ts` - the flow lens. Compiles, invokes `bin/sidecoach-image.js`, maps the exit
table onto named outcomes, offers only a verified asset.

`src/flow-handler-component-implementation.ts` - flowG, in the `craft` chain, now runs that lens.

## The property the whole design turns on

The prompt and the verification contract are emitted from ONE resolution. The staging says where the text
sits; that single field becomes both the "keep this region quiet" instruction in the prompt and the pixel
rectangle the contrast check reads back out of the decoded image. The check measures the region the prompt was
told to protect. Nobody has to remember to pass the right numbers because there is only one set of numbers.
Asserted by equality in the test, not by inspection.

## Nothing is invented, and that costs something visible

Where DESIGN.md names no text colour, the compiler does NOT pick one to make the contrast check look
contracted. It leaves the ink unset and reports the gap, so the verdict is honestly "contrast not checked"
rather than "contrast passed against a colour we made up". Same for the product name: absent means no legible
text is permitted at all.

## Six defects found by READING OUTPUT rather than by reasoning

Every one of these was invisible until an actual artifact was inspected.

1. **A social-card staging was drawn for a plain hero.** Uniform sampling over "every staging that CAN hold
   this role" beat two purpose-built backdrop stagings. Fixed by preferring home-role entries.
2. **A calibration ban contradicted a committed palette.** The prompt said "not the warm cream ground" while
   also saying "use #f7f4ee". Calibration bans exist to stop an UNSPECIFIED brief landing on a default; a
   project that committed a palette has chosen it. They are now suppressed when a palette exists.
3. **`texture` lost to `backdrop`** on "a tiling texture for the dashboard background", dropping the tiling
   obligation on the floor. Keyword precedence reordered.
4. **A stated approach was ignored.** "restrained editorial" matched nothing by substring containment and fell
   through to a random draw, silently discarding a real design decision. Now matched on shared words, which
   finds `editorial-print`.
5. **A motion-axis world was drawn for a still image**, producing a WORLD section reading "asymmetric enter
   and exit timing" and "respect reduced-motion". Motion-axis entries are now excluded from the image draw.
6. **THE PROMPT'S OWN WORDS WERE TYPESET INTO THE ARTWORK.** The first live render came back with "Greeked to
   copy", "readability for future live text", and "wordmarks, brand browser chrome, cursor, device bezels" set
   as body copy. Closing that exposed the next layer: the second render typeset the palette's hex strings
   ("#d44af37") instead. The general lesson, recorded because it will recur: any literal string in a prompt is
   a candidate to be rendered as lettering, so a text policy must forbid the CLASS, not the instance.

## Provenance-aware severity, with the measurement untouched

A contrast failure on the offline placeholder does not block the build; the same failure on a live render
does. The placeholder's colours come from a prompt hash, so its contrast is the stand-in's luck rather than a
fact about the design, and blocking on it would block nothing real while training everyone to ignore the row.
The MEASUREMENT is identical in both cases and always reported. The distinction is drawn from the synthetic
marker inside the PNG, not from what the caller claims, so it cannot be gamed by renaming a file.

## The live evidence

Four live Gemini calls, 0.243 USD total, usage-derived from the provider's own token reports. Three assets
generated through the flow path for this repository's own `pages/` directory and opened and read.

The third render is the one to look at: the left third genuinely empty and low-detail exactly as
`quiet-left-third` requires, the right two thirds carrying a single subject mass in the page's own real
palette (teal #1B4D4D ground, gold #D4AF37, red #E31C3D, magenta #E21B8C, all read out of `pages/DESIGN.md`),
flat and matte, and exactly one legible string, the product name. Zero leaked instruction text. One residual
defect visible in it: a soft drop shadow under the subject mass, which the DO NOT list forbids.

## The JPEG hole: the cheap fix does not exist, proven for free

Every Gemini image model returns JPEG for a PNG request, so this repository's PNG-only decoder cannot read
the pixels, so the contrast check on our own default provider produces no number at all. That undercuts the
one advantage that is genuinely ours.

Seven candidate request fields were probed for an explicit PNG output option. All seven were rejected with
HTTP 400 "Cannot find field" BEFORE generation, so the probing cost nothing, and
`generation_config.response_mime_type` enumerated its allowed values in the error: `text/plain`,
`application/json`, `application/xml`, and no image type. There is no request-parameter fix. Closing this
needs a baseline JPEG decoder in this repository, sized separately and not built here.

Two facts settled by the same probing round: `gemini-3.1-flash-image` (Nano Banana 2), our default, RENDERS
(0.0877 USD usage-derived at 1024x1024) and was previously only verified to exist. And it returns JPEG too, so
this is the whole Gemini family rather than a lite-model quirk. At 1:1 its geometry matched exactly; the
1376x768-for-a-1024x576-request drift is aspect-specific.

## The durable fix for the false document

`src/__tests__/skill-surface-parity.test.ts` asserts the skill document agrees with `sidecoach list --json`
on the CLI count, on every tool being named, and on WHICH tools a flow auto-runs. `bin/sidecoach.js` grew a
fourth field per tool recording its flow wiring, so both facts derive from one table, and `list --json` is the
machine-readable form of it.

Both shipped defects were planted back into the document and the guard fired on each with the right message
before this was believed.

## Independent review: five findings, all folded

Codex (gpt-5.4, read-only, a different model that did not write this) reviewed the diff. It found no path that
spends without operator consent and no arithmetic defect in the ink-region math, and five real defects. All
five are fixed with a regression test each.

1. **Critical, and the exact failure class this repository cares most about.** The lens read only
   `<projectPath>/DESIGN.md` while flow G already carried parsed tokens in memory. With a page-local or
   non-standard design file the read returned null, the compiler dropped the ink, and the argv omitted
   `--ink/--ink-region/--min-contrast`, so THE CONTRAST CHECK SILENTLY STOPPED RUNNING while the real text colour
   sat in the context the whole time. Fixed by `resolveDesignTokens`, which prefers in-memory tokens over a file
   read and treats a colourless source as no source.
2. **High.** The prose harvest accepted only a colon or equals between label and hex, so an ordinary line
   ("- **Body text** - #2C2C2C - primary typography") lost a real colour and again left contrast uncontracted.
   The separator class now covers the hyphen and both dash characters.
3. **Medium, and the mirror image of the discoverability problem.** Role detection used raw substring matching,
   so "craft a settings toggle with a background color transition on hover" generated a plate. A capability that
   fires on everything gets muted, which is the same end state as one nobody can find. Fixed with word-boundary
   matching plus a false-friend list covering the CSS-property senses and a general rule for a role noun followed
   by a structural noun ("the thumbnail element" is an existing element, not a request for art).
4. **Medium.** A null outcome rendered as `completed: true`, so a raster request in a context with no project
   path showed the asset row as DONE when the step never ran. Not-run is now only complete when there was
   nothing to do.
5. **Medium, and it was a guard that certified the thing it existed to catch.** The parity test's positive
   assertion passed on "sidecoach-image is not auto-run; invoke it manually". Fixed with negation scoped to the
   words governing the wiring phrase.

Finding 3's fix then failed its own new test twice, and both failures were real: `avatar` was matching a UI slot
as a portrait request, and "set object-fit on the thumbnail element" still matched. Both are fixed and the
second produced the general structural-noun rule rather than one more special case.

## Proof through the REAL entry point, not through a handler called in a test

The command a user actually types, run from a project directory:

    node <sidecoach>/bin/sidecoach-monitor.js "/sidecoach craft a pricing hero with a full-bleed backdrop behind the headline" --json

produced a 1536x864 RGBA PNG at `<project>/.sidecoach-cache/assets/backdrop-horizon-band-<digest>.png` and carried
the whole compilation report plus the verdict in the monitor's guidance. Opened and read: it is the deterministic
offline placeholder exactly as designed, a gradient field with hash-placed discs, a horizon band, and the swatch
strip that encodes the hash bytes. It reads unmistakably as a placeholder rather than as art, which is the point.
Contrast measured 1.20:1 against the 4.5:1 floor and correctly did not block, because those colours come from a
prompt hash.

Worth knowing: the first attempt at this produced NOTHING and reported only `flowA_brand_verify`. The demo project
had no PRODUCT.md, and the craft chain gates on it. That gate is real and working; a project without PRODUCT.md
gets no asset because it gets no craft chain.

**A gap this exposed, and it is not mine to fix.** The monitor's aggregated `--json` output carries `checklist: []`
for the whole run, empty rather than short, so the asset row's blocker state does not reach a caller reading the
monitor's JSON. The verdict IS in `guidance`, which is what a model consumes, so the capability reports honestly
through the path that matters. But a caller branching on `checklist` sees nothing at all, for any flow, not just
this one.

## What is still short of full flight

- **The JPEG hole is open and cannot be closed with a request parameter.** Proven, for free. Closing it needs a
  baseline JPEG decoder in this repository, roughly 550 to 650 lines (marker parsing, Huffman with byte-stuffing,
  dequantize, inverse DCT, chroma upsampling, YCbCr conversion, restart intervals, plus named refusals for
  progressive and arithmetic and 12-bit), and it MUST have a correctness oracle because a wrong inverse DCT
  yields a wrong contrast number, which is worse than reporting unverified. `sips` can convert fixtures to PNG
  for that oracle with no new dependency. Not built here; sized here.
- **Geometry fidelity on aspect-ratio providers.** Gemini honours an aspect ratio and picks its own pixel ladder
  (1376x768 for a 1024x576 request), so an exact-geometry contract cannot be satisfied there. At 1:1 it matched
  exactly. The verifier has no aspect-tolerant contract, so this is reported as a provider substitution and still
  fails, which is honest but coarse.
- **A soft drop shadow appeared in the final live render** despite the DO NOT list forbidding drop shadows. One
  ban that did not hold.
- **A failed asset is never cached**, so a provider that always fails the format check costs money on every
  re-run. Correct as a cache policy, expensive as a workflow on Gemini today.
- **Full-suite green is not claimed.** Two full test runs were racing in this shared tree, so the eight suites
  this unit can affect were run serially instead and all pass. The full suite is the tree's to report, not mine.

## The JPEG hole: a fix that needs no decoder, proven against an independent oracle

The lead's attack order was (1) ask the API for PNG, (2) size a baseline JPEG decoder, (3) change the default
provider. Step 1 is closed as impossible, for free, above. Before sizing step 2 there is a fourth option that is
better than both remaining ones, and it is now PROVEN rather than proposed.

**Playwright is already a dependency of this package** (`package.json`, and `audit-rendered.ts` already drives a
browser). A browser decodes JPEG natively. So real RGBA pixels can be obtained from JPEG bytes with no new
dependency and, more importantly, WITHOUT a hand-written inverse DCT, which was the real risk in step 2: a wrong
IDCT yields a wrong contrast number, and a confidently wrong number is worse than an honest `unverified`.

Spike result: 1.5 seconds, correct dimensions, real RGBA.

Validated against an INDEPENDENT decoder rather than trusted. `sips` (a macOS system tool, no dependency) was used
to transcode the same JPEG to PNG, and that PNG was decoded by this repo's own PNG codec. Probe pixels agreed
exactly at (200,400) and (700,384), differed by 1 unit at (1300,700), dimensions matched exactly, and the
whole-image channel sum differed by a mean of 0.15 per 255 across 3.17 million samples. That is the expected
difference between two correct JPEG implementations, and it is far below anything a WCAG contrast ratio is
sensitive to.

**The design that keeps the three-value rule intact.** `format-matches` must STILL FAIL on a JPEG answer to a PNG
request, because that is a true fact about what the provider did, and transcoding then verifying our own re-encoded
PNG would be laundering. What changes is only that the PIXEL checks stop returning `unverified`: they get real
pixels, so `pixels-decodable`, `rendered-not-blank`, and `contrast-at-placement` produce real numbers. The overall
verdict on Gemini output stays `failed` on format, and the contrast measurement exists. Nothing is loosened;
`unverified` still means unverified whenever pixels genuinely cannot be read, including when no browser is
available.

**Keep the verifier SYNCHRONOUS.** `verifyAsset` is sync and the bin calls it sync; making it async would break the
bin and its test suite. The move is to let the contract accept OPTIONALLY pre-decoded pixels, and have the bin do
the async transcode and pass them in. The verifier stays pure and sync.

Sizing, for the decision:

    src/image-jpeg-pixels.ts     ~90 lines   browser launch, canvas decode, named refusals
    src/image-asset-verify.ts    ~25 lines   accept optional pre-decoded RGBA; no async added
    bin/sidecoach-image.js       ~30 lines   transcode when bytes are not png and a pixel check is contracted
    tests                       ~120 lines   including the sips oracle comparison above
    TOTAL                       ~265 lines, no new dependency, no hand-rolled codec

Against roughly 550-650 lines for a baseline JPEG decoder (marker parsing, Huffman with byte-stuffing, dequantize,
IDCT, chroma upsampling, YCbCr conversion, restart intervals, named refusals) which would itself still need an
oracle.

BUILT AND CLOSED. Reported and sized twice with no objection, then built, because the row was the only thing left
and the lead's instruction was to report when it is done.

`src/image-jpeg-pixels.ts` obtains RGBA through headless chromium and returns a NAMED refusal on every failure
path (browser-unavailable, browser-launch-failed, decode-failed, empty-result, unsupported-format), so an
unavailable browser degrades to `unverified` exactly as before rather than to a guess. playwright is resolved at
call time, not imported at module load, so an install without browsers still runs everything else.

`src/image-asset-verify.ts` grew ONE optional contract field, `decodedPixels`, and the pixel-check block was
refactored to run from a single resolved source. The verifier stayed SYNCHRONOUS; the bin does the async transcode
and passes pixels in. A supply is CHECKED, not trusted: pixels whose dimensions disagree with the bytes' own
header are refused as `supplied-pixels-mismatch`, because measuring a different image and reporting the number as
this asset's is worse than measuring nothing.

`bin/sidecoach-image.js` transcodes only when the bytes are not PNG AND a pixel check is actually contracted, so
no browser launches for a run that asked for nothing pixel-level.

LIVE RESULT on real Gemini JPEG output, the row closed:

    [fail]  format-matches: bytes are jpeg, claimed png
    [pass]  pixels-decodable: 1024x1024 RGBA supplied by a headless chromium canvas decode
    [pass]  rendered-not-blank: 523 colors, stddev 0.4600, edges 0.0021
    [pass]  contrast-at-placement: worst contrast 13.54:1 >= 4.5:1 over 98600 px

Three checks that reported `unverified` with no number now produce real measurements, and `format-matches` still
fails, and the overall verdict is still `failed`. Nothing was loosened to get there.

## A defect my own fix introduced, found by running it through the flow

The first live flow run after the fix reported `contrast-at-placement: worst contrast 1.00:1 (mean 13.74:1)`. That
number was REAL and it was measured in the WRONG PLACE. Gemini returned 1376x768 for a 1024x576 request, so the ink
region computed for the requested geometry landed partly on the dark field instead of on the reserved band.

A confidently wrong number is precisely the failure this whole module exists to prevent, and my fix had created
one. The verifier now refuses the placement check outright when the decoded geometry differs from the contracted
geometry, naming why: the region no longer marks where the text will sit. Rescaling it would be a guess about where
text goes on an image nobody asked for. The blank detectors still run, because they are geometry-independent.

Caught by reading output, not by reasoning, which is the third time in this unit that reading beat thinking.

## For whoever picks up reach's question

`reach` asked whether `STANDALONE_BINS` should move from `bin/sidecoach.js` into `src/standalone-bins.ts` so a
build-time generator can import it and GENERATE `reference/tools.md` instead of hand-writing it. The answer is
YES and the reason is this beat's own subject: hand-writing that table is exactly how two false statements shipped.
It did not move here only because the parity test reads the registry through `sidecoach list --json`, which needs
no import, and moving a const another teammate's generator depends on mid-flight in a shared tree invites a
collision. The fourth field per tool (`flowWiring`) is already in place, so the move is mechanical.

## The OpenAI path is live, and it produces the unit's first VERIFIED live asset

The credential was resurrected (it had been truncated to exactly 128 characters by BSD `getpass`, whose
`_PASSWORD_LEN` is 128; the fix is `-w "$(pbpaste)"` and never the interactive prompt, and the keychain item must be
read with `-a sidecoach` explicitly because a service-only lookup returned a stale duplicate).

One live `gpt-image-2` render at 1024x1024, quality low, with a full pixel contract. Every check EXECUTED and
PASSED, which had not happened once on live provider output before this:

    [pass] format-matches: bytes are png
    [pass] dimensions-match: 1024x1024
    [pass] pixels-decodable: decoded 1024x1024, color type 2
    [pass] rendered-not-blank: 330 colors, stddev 0.4453, edges 0.0017
    [pass] alpha-matches: non-opaque fraction 0.0000, wanted opaque
    [pass] contrast-at-placement: worst contrast 17.99:1 >= 4.5:1 over 234000 px
    verdict=verified   cost 0.0063 USD (usage-derived, from the provider's own token report)

Opened and read: a narrow near-white left third with no detail and a right two thirds of flat dark teal, matte, no
lettering. Exactly the prompt. Worth noting honestly that it is very reductive and only just cleared the not-blank
detectors at edge density 0.0017 for 330 colours; that is my probe prompt's fault rather than the provider's, since
the prompt asked for almost nothing.

## Why the bin's DEFAULT provider stays `offline`, against an instruction to change it

The instruction was to "make OpenAI the default so pixel checks apply to our own default output". Half of that is
already true and the other half would break a property this team has protected all along.

Already true: `AUTO_CHAIN` is `['openai', 'nanobanana']`, so `--provider auto` reaches the verifiable provider
first. That ordering now carries its measured justification in a comment rather than reading as a preference.

Not done, deliberately: the BIN's default provider remains `offline`. Changing it to a live provider would mean
every bare invocation spends money, and because both flow lenses inherit that default, IT WOULD MEAN A FLOW COULD
SPEND MONEY WITHOUT ANYONE ASKING. "A flow cannot spend" is one of the four properties the generator was built
around. The row does not need it: the hole was already closed by the browser transcode, and OpenAI is already
preferred wherever a live call is authorized.

The verification asymmetry between the two providers is now documented in the skill document as a table with the
measured numbers, rather than left for a reader to discover by spending.

## A note on the OpenAI price path

OpenAI publishes token rates, not per-image figures, so `perImageUsd` for this family is deliberately empty and a
live call REFUSES to proceed without `--assume-cost-usd`. I did not add the measured 0.0063 as a published figure:
one observation is not a published rate, and inventing one would be exactly the fiction this module refuses to
print. The measured cost still lands in the ledger as `usage-derived` after the call.

## An unrelated installer failure observed while propagating the doc

`./install.sh --only sidecoach --yes` exits 1 on a component that is not mine: `app-hooks` fails with
`KeyError: 'hook'` and warns "the hooks are on disk but NOT wired" into settings.json. The sidecoach propagation
itself succeeded (verify reports 55 files matching, and the corrected text is present in all five non-Claude
harnesses). Flagging rather than fixing: hooks on disk but unwired means they silently do not fire, which is the
class of breakage this team has been bitten by repeatedly.

## Files touched

- `src/image-composition-catalog.ts` (new)
- `src/image-brief-compiler.ts` (new)
- `src/image-asset-production.ts` (new)
- `src/flow-handler-component-implementation.ts` (asset production lens wired into flowG)
- `src/flow-handler-design-references.ts` (sketch prompt routed through the compiler)
- `bin/sidecoach.js` (flow-wiring field per tool, `list --json`)
- `claude/skills/sidecoach/SKILL.md` (two false statements corrected, capability named in the body and in the frontmatter description)
- `src/__tests__/image-brief-compiler.test.ts` (new)
- `src/__tests__/skill-surface-parity.test.ts` (new)
- `src/__tests__/image-flow-lens.test.ts` (two stale assertions revised, both made true rather than weakened)
- `src/image-jpeg-pixels.ts` (new, browser-based RGBA for formats this repo cannot decode)
- `src/image-asset-verify.ts` (one optional contract field, one refactor to a single pixel source, the placement-geometry-drift refusal)
- `bin/sidecoach-image.js` (transcode when not PNG and a pixel check is contracted)
- `src/__tests__/image-supplied-pixels.test.ts` (new)
- `scripts/run-tests.ts` (three new suites registered as required)
