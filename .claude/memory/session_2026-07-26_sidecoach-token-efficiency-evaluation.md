---
name: Sidecoach token-efficiency evaluation (measured baseline + ranked optimizations)
description: Measured every sidecoach context surface (SKILL.md, hooks, design-laws, monitor JSON) against 4 live invocations; 64% of per-invocation payload is structural redundancy, not prose; answered from sidecoach's own numbers, no oracle materials exist in-repo
type: project
relates_to: [session_2026-07-25_prose-ablation-sweep.md, session_2026-07-26_oracle-identity-correction.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: measured file sizes + 4 live sidecoach-monitor --json runs at HEAD a50465d3 (no code changed)
confidence: high
---

# Sidecoach token-efficiency evaluation

Read-only evaluation. NOTHING in the repo was modified. Collaborator: Jonah. All numbers are
measured, not estimated: `wc -c` on every surface plus 4 real `sidecoach-monitor --json` runs
(craft / audit / polish / shape) at HEAD `a50465d3`. Token figures are chars/4.

## Scope correction (lead, mid-flight - applied)

The original brief equated "oracle" with a public competitor repo. Per
`session_2026-07-26_oracle-identity-correction.md`, oracle is a SEPARATE product and its real name
stays out of all documentation. **This repo holds no oracle primary-source material, so no
oracle-vs-sidecoach footprint comparison is possible.** The evaluation is therefore anchored in
sidecoach's OWN measured baseline plus first-principles token-efficiency patterns. Where an
oracle-specific number would be needed, it is listed below as an open question for Jonah, never
substituted for.

taste-skill (the public Leonxlnx repo) appears once below as a correctly-labelled general
comparison point for skill-file shape. It is NOT oracle and its data is NOT presented as oracle's.

## Baseline (measured)

Always-paid per session (no invocation needed):

| Surface | chars | tokens | When paid |
|---|---|---|---|
| CLAUDE.md sidecoach-bearing sections | 7,596 | 1,899 | Every session, unconditional |
| `sidecoach-preamble.sh` PRODUCT+DESIGN injection | <=8,704 | <=2,176 | SessionStart AND again on every PostCompact, when both files exist |
| SKILL.md frontmatter (skill listing) | 819 | 205 | Every session |
| `sidecoach-keyword.sh` nudge / route line | 200-1,251 | 50-313 | Per matching prompt, cooldown-gated |

Paid on skill load: SKILL.md 27,158 chars (6,790t). CHEATSHEET.md 13,637 chars (3,409t),
conditional. `sidecoach/reference/*.md` (79,487 chars total) are ALREADY on-demand.

Per invocation - `sidecoach-monitor "<cmd>" --json`, the dominant cost:

| Flow | flows chained | raw pretty JSON | usable subset | report only |
|---|---|---|---|---|
| craft | 11 | 214,535 (53,634t) | 82,693 (20,673t) | 5,222 (1,306t) |
| polish | ~5 | 63,676 (15,919t) | 28,480 (7,120t) | 3,257 (814t) |
| audit | ~4 | 32,002 (8,001t) | 12,905 (3,226t) | 603 (151t) |
| shape | 2 | 14,881 (3,720t) | 5,184 (1,296t) | 1,048 (262t) |

## Hot spots - all structural, none prose

Field breakdown of the craft run (compact): `flowResults` 113,402 / `guidance` 37,247 /
`panel` 6,511 / `buildReport` 5,412 / `renderedReport` 5,376 / `renderedPanel` 5,376.

Five measured redundancies:

1. **`renderedPanel` is a byte-identical alias of `renderedReport`** (5,376 chars duplicated on craft).
   Confirmed at `bin/sidecoach-monitor.js:119`, which emits both from the same variable.
2. **100% of per-flow `guidance` is re-emitted at top level.** 601 of 601 inner items appear in
   the 629-item top-level array. 36,002 chars carried twice.
3. **`executionMetadata.executionChain` is O(n^2).** Flow k carries the chain of all k prior flows -
   chain lengths 1,2,3,4,5,0,6,7,8,9,10 across the 11-flow craft run. 14,010 chars where ~2,800 suffices.
4. **`memory.appliedRules` (9,871 chars) restates guidance**; `memory.validationResults` (1,878)
   duplicates `flowResults.validationResults`.
5. **Pretty-printing costs 19.1%** (`JSON.stringify(..., null, 2)` at monitor:119): 40,941 chars on craft.

Plus a same-payload repetition: the PRODUCT.md brand-personality block (508 chars) is emitted
**5 times** in one craft run - once per flow that reads project context.

**`SHARED_DESIGN_LAWS` is NOT a hot spot.** All 7 domains total 5,938 chars (1,485t), and its rules
account for 6,831 of the 35,291 guidance chars (19%). Lazy-loading design laws by domain would
save under 1,500t and would touch protected prose.

**Validator output is NOT a hot spot.** `sidecoach-taste-check.js` prints 116-123 chars per run.

**Hook injections are NOT a hot spot.** The 17,870-char `sidecoach-keyword.sh` and 7,297-char
`sidecoach-intent.json` are shell/data that never enter context; the injected string is 200-1,251 chars.

## First-principles read: where sidecoach's shape costs it

Two cost curves exist for a design skill.

- **Flat / pay-once:** a pure-prompt skill loads a fixed payload at skill-load and costs nothing
  per invocation. Cost = K, independent of how many design tasks the session runs.
- **Linear / pay-per-call:** an engine-backed skill loads a smaller skill file, then pays a tool
  result on EVERY invocation. Cost = K + c*N.

Sidecoach is linear, and its `c` is large: 20,673t per craft on the usable path, 53,634t if the
raw `--json` ever lands unfiltered. Measured session totals:

| | contract-literal | usable JSON | raw --json |
|---|---|---|---|
| K (always-paid + skill load) | 10,865t | 10,865t | 10,865t |
| one craft | 12,171t | 31,538t | 64,499t |
| one audit | 11,016t | 14,091t | 18,866t |
| craft+audit+critique+polish | ~14,000t | ~45,100t | ~90,000t |

The structural conclusion is independent of any competitor: **sidecoach's K is small and its `c` is
the problem.** Optimizing the skill file (K) is worth ~3,650t once; optimizing the wire format (`c`)
is worth 20,000t+ per craft and compounds with every invocation in the session.

General comparison point (correctly labelled, NOT oracle): the public taste-skill repo is the
flat-curve shape taken to an extreme - ONE file, `skills/taste-skill/SKILL.md`, 87,126 chars
= 21,781 tokens, no reference/ dir and no conditional-read language anywhere (grepped). Its only
progressive disclosure is a 1,846-char `skills/llms.txt` router that picks ONE of 14 skills to
install. Useful as evidence that a big K with c=0 is a viable competing shape - sidecoach's SKILL.md
is already 3.2x leaner than that file, so K is not where sidecoach is behind.

## Open questions for Jonah (cannot be answered in-repo)

1. What is oracle's actual per-invocation context footprint, and is oracle flat-curve (pure prompt)
   or linear (engine-backed)? The optimization target changes completely between the two.
2. Does oracle use progressive disclosure (thin router + on-demand reference files), and at what
   granularity? Sidecoach already does this for `sidecoach/reference/*.md`.
3. Is oracle's efficiency claim about skill-load size, per-invocation size, or total session spend?
   Sidecoach wins on the first today and loses on the second.

## The constraint that shapes every proposal

Per `session_2026-07-25_prose-ablation-sweep.md`: the ablation harness has an MDE of ~70pp at N=8
and real prose effects are single-to-low-double-digit pp; distinguishing sub-15pp effects costs
~$40k. The sweep's own verdict was "delete nothing." **So no guidance-line deletion can be certified
safe at reasonable cost.** PROTECTED (do not touch): the default-typeface line in
`SHARED_DESIGN_LAWS.typography.rules` (642 chars), validated at -100/-80/-100pp across
claude/gpt/gemini at N=10 (`session_2026-07-25_typeface-line-fuller-validation.md`), already shipped.

Consequence: **all safe savings are structural (serialization, duplication, bookkeeping), and they
are verifiable by byte-diff and the 140-suite gate rather than by ablation.**

## Ranked proposals (measured savings)

Cumulative, applied to the craft run, all zero-prose:

| # | Change | cumulative | cut | risk | effort |
|---|---|---|---|---|---|
| 1 | Compact JSON (drop `null, 2`) | 173,594 (43,399t) | -19% | none | 1 line |
| 2 | Drop `renderedPanel` alias | 168,201 (42,050t) | -22% | low (1 hook reads it) | ~5 lines |
| 3 | Drop legacy `panel` field | 161,681 (40,420t) | -25% | low | small |
| 4 | Emit `executionChain` once, not per flow | 147,463 (36,866t) | -31% | none | small |
| 5 | Drop per-flow `memory` from wire format | 126,884 (31,721t) | -41% | low | small |
| 6 | Drop per-flow `guidance`/`validationResults` dup | 85,396 (21,349t) | **-60%** | none (100% dup) | small |
| 7 | Hoist deduped `checklist`/`artifacts`, stub `flowResults` | 82,314 (20,579t) | -62% | low | medium |
| 8 | Dedup top-level `guidance` exact strings | 78,102 (19,526t) | **-64%** | none | trivial |

Same pipeline on the other flows: audit -59%, polish -56%, shape -64%.

Non-payload items:
- **Thin SKILL.md into a router + on-demand sections.** Measured split of its 26,332 section chars:
  the routing core (intro, the 6 command tables, Invoking the Engine, Using Output Correctly) is
  12,545 chars (3,136t); the rest - Standalone tools 3,242, QA Gate Triad 1,874, intent detection
  1,757, Workflow Gates 1,346, tactical layer 1,059, stack diagram 1,038, Project Setup 996,
  DESIGN.md format 894, Dependent capabilities 757, Verb commands 683, NOT-for 141 - is 13,787
  chars (3,447t) that only some invocations need. Router-only SKILL.md = **-54%, ~3,650t saved per
  skill load.** This is the K-side fix and is worth once what item 6 is worth per call.
- **CHEATSHEET.md is stale AND contradicts SKILL.md** - its Section 0 documents the RETIRED
  forge/kiln/bloom/trim/ralph modes that SKILL.md line 25 says are retired, and it cites the
  deprecated `sidecoach-modes.json`. 3,409t of conditionally-loaded contradiction.
- **Preamble double-charge:** the 8KB PRODUCT+DESIGN injection fires on SessionStart AND PostCompact.

## Bottom line

Yes, materially - **64% off the per-invocation payload with zero prose touched.** The single
highest-leverage change is **item 6: stop emitting per-flow `guidance` in `flowResults`** (100%
duplicated into the top-level array, -19% alone, -60% cumulative), and the whole top-6 stack lands
in `bin/sidecoach-monitor.js` around line 119 plus the flow-result assembler.

Sidecoach's cost problem is NOT its guidance corpus (design-laws is 1,485t and partly
evidence-protected). It is the **wire format of the engine result**, which is a debug dump being
used as an agent contract. Fix the serializer, not the prose.

Framed as cost curves: sidecoach's always-paid K is already small (10,865t) and can go to ~7,200t
with the SKILL.md router split. Its per-invocation `c` is what makes long design sessions expensive,
and items 1-8 cut `c` by 56-64% on every flow measured. Do the `c` work first.

Second-order structural note: `craft` chains 11 flows, and each flow independently re-emits
project context (brand personality x5). Fixing the serializer does not fix the chain depth;
that is the flow-redundancy evaluation's territory.

## Files touched
- `.claude/memory/session_2026-07-26_sidecoach-token-efficiency-evaluation.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
- No sidecoach source, no hooks, no skill files modified.
