# Incident: three arm-S pages were rewritten after their first measurement

Recorded because it is exactly the kind of silent corruption that produces a number nobody can
trust, and because the repair changes which artefacts the reported result rests on.

## What happened

The runtime caps concurrent subagents at 20. Producer spawns beyond that cap were rejected, so
missing cells were relaunched in later rounds. Some of the *earlier* spawns for those same cells
were still alive and completed later, writing the same output path a second time.

Three arm-S pages were therefore rewritten AFTER `collect.mjs`, `measure-axe.mjs` and
`measure-sidecoach.mjs` had already run over them:

- `S/coverage-forms-multi-step-corporate-vendor-onboarding`
- `S/coverage-product-data-dense-climate-risk-dashboard`
- `S/coverage-product-minimal-utility-password-manager`

## How it was caught

Not by a statistic. `collect.mjs` records a sha256 per page; comparing those hashes against the
files on disk showed three mismatches. Nothing in axe, the scanner, or the judge would have
flagged it - each would have reported a perfectly normal number for an artefact that no longer
existed.

## Why it matters

Measuring one artefact and judging another is undetectable downstream. Had it gone unnoticed, up
to three of the seventeen primary pairs would have carried a measurement of page X and a verdict
about page Y, and the reported n would have been a lie about which artefacts produced it.

## Repair

1. Confirmed the page set had stopped changing (a full re-hash of all 51 files was byte-identical
   to a snapshot taken 15+ minutes earlier, and no producer remained live).
2. Re-ran `collect.mjs` to re-freeze the manifest against the FINAL artefacts.
3. Re-ran `measure-axe.mjs` and `measure-sidecoach.mjs` over the whole set. Both are deterministic
   given the files, so this is a full replacement of the measurement, not a patch.
4. Deleted the Codex verdicts for the three affected S-vs-P comparisons and re-judged them, so
   every verdict corresponds to the artefact that was measured.
5. Re-rendered the screenshots for those three ids and re-ran the secondary visual judgement on
   them.

The P-vs-C comparison is unaffected: no arm-C or arm-P page changed.

## The durable fix

`collect.mjs --verify` now re-checks every recorded hash against disk and exits 6 with the list of
changed pages. It is the gate to run before any measurement or judging pass, and before reporting.
It was written in response to this incident and its first run reproduced the three mismatches.

## The generalisable lesson

A concurrency cap turned a retry into a race. The retry loop assumed a rejected spawn meant no
work was in flight for that cell, and the rejection said nothing about the earlier spawn still
running. **When a launcher retries on a rejection, the rejection must be distinguished from a
completion, or the retry is a second writer.** The cheap structural fix would have been one
output path per spawn attempt rather than per cell, with the cell resolved afterwards.
