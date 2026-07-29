---
name: Detector findings now carry a source line, and the two that did were both wrong
description: Row 1 of the detector scoreboard - line-number coverage 2/16 (12%) to 15/15 (100%), plus the root cause that both pre-existing line numbers pointed at the wrong line
type: project
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: raw detector output on benchmark/fixtures/canary/canary.html, canary self-test gate PASS
confidence: high
---

Scoreboard row "Findings carrying a precise source line number": sidecoach 2/16 (12%) -> 15/15 (100%).
LOCALPROJECTX baseline on the identical canary is 4/5 (80%).

Command that proves it:

    node bin/sidecoach-detect.js benchmark/fixtures/canary/canary.html --no-render 2>&1 \
      | grep -E '^[[:space:]]+\[(blocking|warning)\]' | grep -c 'canary.html:'

**The finding that mattered more than the count: both of the two line numbers we already had
were WRONG.** The canary's gradient-text defect is on file line 6. `ban.gradient-text` reported
line 5 and `anti-pattern.gradient-text` reported line 3. A confidently-wrong location under a
real filename is more expensive than no location, and it is the same instrument-blindness class
this session has already destroyed five instruments over.

Two independent root causes:

1. **Off by one from the selector capture.** The ban scanners match a whole rule with
   `/([^{}]+)\{([^}]*)\}/` and reported `lineNumberAt(content, m.index)`. `[^{}]+` also eats the
   newline after the PREVIOUS rule's `}`, so `m.index` sits on the previous rule's closing-brace
   line. Fixed by anchoring to the offset of the TRIGGERING DECLARATION inside the body
   (`declarationLine`), which is correct in every layout - unlike "add one", which would break a
   rule sharing a line with the previous one - and is also the line a reader actually needs.

2. **A slice line printed as a file line.** `project-collector.extractInlineCss` concatenates
   `<style>` bodies into `CollectedFile.cssText` and discards the file positions.
   `anti-pattern-checks` scanned `ctx.cssText` and printed `${file}:${line}`, so it was reporting
   a line in an anonymous slice under a real filename. It also labelled every file's findings
   with `files[0].path`, so in a multi-file project a finding in the second file named the first.
   Fixed with `src/validators/source-locator.ts` `cssRegionsOf`, which re-derives the `<style>`
   regions FROM THE MARKUP with the file line each one starts on. The evidence pipeline is
   untouched - `cssText` is still what the predicates read - so no pass/fail verdict can move.

**Why the coverage went to 100% honestly.** Most of our findings are ABSENCE findings ("no
prefers-reduced-motion", "0/8 component states"), which have no defect line by nature - that is
why the count was 12% and why LOCALPROJECTX, whose canary findings are all presence findings,
sits at 80%. An absence finding's location is the ANCHOR: the site the rule's own applicability
probe matched, which is exactly where the missing rule has to be written. `withRuleApplicability`
fills it in at the one layer that knows both the rule key and that a target was found, reusing the
SAME exported regex the probe tested, so a reported line can never point somewhere the probe did
not look.

**Anchors are tagged, not conflated.** A new `locationKind: 'defect' | 'anchor'` is plumbed
RuleVerdict -> ProductRuleResult -> ProductFinding -> stdout, and the human summary prints
`(fix site)` on an anchor. Presenting a fix site as a defect site would be the same lie as root
cause 2. Where an aggregate mixes both, 'defect' wins (the stronger claim, and the line the
reader needs first). A rule that finds no anchor reports NO location - an invented location is
worse than none.

All 15 anchor/defect lines were hand-verified against the canary source, not assumed: body rule
line 5 for font-smoothing, `h1 {` line 6 for text-wrap-balance, `.card` line 7 for the shadow
rules, `transition:` line 9 for the motion rules, `<button>` line 18 for the interactive rules,
`<img>` line 20 for the image rules.

Gate checks after the change: canary self-test PASS (fires 15 on planted positive, 0 on
known-negative); all four fail-closed wins intact (missing file exit 2, garbage exit 3, no args
exit 2, linked stylesheet exit 3); `npx tsc --noEmit` exit 0.

Files touched: src/validators/source-locator.ts (new), src/validators/check-context.ts,
src/validators/checks/anti-pattern-checks.ts, src/validators/checks/polish-checks.ts,
src/validators/checks/a11y-checks.ts, src/validators/checks/page-quality-checks.ts,
src/absolute-ban-detector.ts, src/product-rule-types.ts, src/validators/run-validator.ts,
src/clean-evaluator.ts, bin/sidecoach-detect.js
