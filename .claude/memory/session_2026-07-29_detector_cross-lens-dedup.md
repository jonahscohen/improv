---
name: One defect seen by two lenses is now one finding that names both
description: Row 2 of the detector scoreboard - gradient-text reported twice, now once with an explicit corroboratedBy field
type: decision
relates_to: [session_2026-07-29_detector_finding-locations.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: raw detector output on the canary; canary self-test gate PASS
confidence: high
---

Scoreboard row "Same defect reported once (gradient-text de-duplication)": ours 2 reports -> 1.
LOCALPROJECTX baseline is 1.

Command that proves it:

    node bin/sidecoach-detect.js benchmark/fixtures/canary/canary.html --no-render 2>&1 \
      | grep -E '^[[:space:]]+\[(blocking|warning)\]' | grep -c 'gradient-text'

Choice made: merge the static-ban / static-check double report of ONE named ban at ONE location
into a single finding carrying `corroboratedBy: ['static-ban/ban.gradient-text']`.

**Alternatives considered:**
- Leave it as two findings: rejected. It double-counts our own numbers and asks the reader to
  notice that two lines are the same bug. The row is a genuine LOSS, not a scoring artifact.
- Silently drop one: rejected, and this is the interesting one - `bin/sidecoach-detect.js`'s own
  header comment already forbade it, because "a hidden dedupe would make a two-engine agreement
  indistinguishable from a single read." That objection is correct and still stands.

**Why this one:** `corroboratedBy` is what satisfies the old objection instead of overruling it.
Two-lens agreement was previously encoded as a coincidence between two output lines, which no
consumer read as agreement; it is now an explicit field on one finding. The reader gets one
defect, and the fact that two independent engines saw it is strictly MORE legible than before.

Two guards, because a dedupe is a gate-weakening operation if you are careless:
- EXACT location match required. A ban found at two different lines stays two findings (different
  sites, not one defect twice), and a finding with no location is never merged, since an unlocated
  pair cannot be shown to be the same site. Only `ban.<name>` / `anti-pattern.<name>` pairs from
  the same scanner in absolute-ban-detector.ts are eligible; `banIdentityOf` returns null for
  everything else, so nothing outside the deliberate overlap can be merged.
- The survivor inherits the group's HIGHEST severity. Without that, merging a blocking twin into a
  warning survivor would drop the blocking count and could flip the verdict from `blocked` to
  `warnings-only` - de-duplication silently weakening a gate. A merge may remove a REPEAT, never
  a severity.

Per-lens `findings` counts stay RAW on purpose. They answer "what did this lens see", which is
what makes an INCOMPLETE lens meaningful for the fail-closed verdict; the merged list answers
"what is wrong with this target". Blocking count on the canary went 8 -> 7, which is the one
removed repeat and nothing else.

**Revisit when:** a third lens starts emitting the same named bans (today only static-ban and
static-check do), or a rule outside the absolute-ban set gains a genuine cross-lens twin.

Files touched: bin/sidecoach-detect.js
