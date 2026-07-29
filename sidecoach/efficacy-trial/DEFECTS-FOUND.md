# Product defects found while building the trial

Reported, not fixed. Editing product code to change how a result comes out is exactly what this
trial must not do, so each of these is left in place and named here. Every one was found by
driving a shipped surface, not by reading source looking for trouble.

## D1 - `## Product Purpose` in PRODUCT.md is never parsed (guidance always says "Not specified")

`sidecoach-monitor` prints a `Brand metadata:` block into its `guidance` payload with a
`Purpose:` line. That line reads **`Purpose: Not specified`** for every project tested, including
**sidecoach's own `sidecoach/PRODUCT.md`**, which carries a full, well-formed
`## Product Purpose` section.

Mechanism: `src/project-context.ts` `parseMarkdownFrontmatter` has explicit section-body handlers
for `## Register` (via a bold `**Brand**`/`**Product**` marker), `## Primary Users`,
`## Brand Personality`, `## Anti-References` and `## Strategic Principles`. There is **no handler
for a purpose section**, so the field only ever populates from an inline `key: value` line.

Impact: the single sentence describing what the product is for never reaches the guidance the
model acts on. Every sidecoach run on every project has been missing it.

Reproduce:
```bash
cd sidecoach && sidecoach-monitor "/sidecoach craft Anything" --json \
  | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(r.guidance.find(g=>/Purpose:/.test(g)))"
```

## D2 - `## Users` is silently ignored (only `## Primary Users` is read)

Same function. A PRODUCT.md written with `## Users` parses to an empty users field and the
guidance prints `Users:` with nothing after it - no warning, no pre-flight complaint, despite the
same payload emitting pre-flight warnings for other missing context. This trial hit it directly:
the first mechanical PRODUCT.md transform used `## Users` and the treatment arm ran with an empty
users field until it was caught. Nothing in the output said so.

Related: with sidecoach's own PRODUCT.md the same line renders as
`Users: [object Object],[object Object]` - the users value reaching the renderer is an array of
objects that is string-concatenated without being formatted.

## D3 - `sidecoach-monitor --json` stdout truncates when read through a pipe

Reading the monitor's stdout through a pipe returned **8178 of 188893 bytes** for
`coverage-app-ui-corporate-dense-it-operations`, producing an unterminated-JSON parse error. The
same command redirected to a file returns the full document and parses.

This is the failure `eval/oracle-comparator.mjs` already documents in its header ("reading a pipe
in chunks truncated output (observed: 8156 of 14045 bytes)") for the same underlying reason - the
process spawns a Chrome grandchild that inherits the stdio. The monitor is a second surface with
the same hazard and no equivalent guard.

Why it matters beyond this trial: a caller that pipes the monitor and parses leniently would
receive a **silently shortened guidance payload** rather than an error. Here it happened to fail
loudly because JSON.parse rejects a truncated object; a consumer reading `guidance` from a
tolerant parser would not have noticed.

## D4 - `/sidecoach craft <feature>` routes to `flowA_brand_verify` on all 17 briefs

Every brief in this trial, across five registers, produced `detectedFlow.flowId =
flowA_brand_verify` - never a craft/build flow. Recorded as an observation rather than a verdict:
it may be intended (brand verification is gate 1 of the mandatory workflow) but it means the
`craft` verb never reached a build flow in 17 attempts with a valid PRODUCT.md present.

## D5 - the emitted guidance contains a warning-sign emoji

The payload's pre-flight warnings are prefixed with a warning-sign emoji character (U+26A0
U+FE0F). This repo's own `content-guard` hook blocks emoji on write, so a producer that echoes
any part of the guidance into a file is blocked and must retry. Observed live: producers in this
trial hit content-guard and rewrote. Cosmetic for the product, but it means sidecoach's own output
cannot be pasted into a file on a machine running this repo's own hooks.

(This file cannot quote the character directly - writing it trips the same hook.)
