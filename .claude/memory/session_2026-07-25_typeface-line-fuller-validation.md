---
name: Typeface-selection guidance line - FULLER 3-provider validation
description: Extend the n=6 claude-only default-typeface ablation to ~10 briefs x claude/gpt/gemini via eval/prose-ablation.mjs; measure target + sibling deltas; apply to design-laws.ts if confirmed
type: project
relates_to: [session_2026-07-25_act-on-stage1-findings.md, session_2026-07-25_stage1d-prose-ablation.md, session_2026-07-24_stage1a-1b-provider-defect-mining.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: measured (3-provider WITH/WITHOUT ablation, N=10/condition, shipping scanner: default-typeface craters to 0% on all 3, claude/gpt/gemini -100/-80/-100pp; siblings non-systematic, net-beneficial aggregate) + build green + Codex clean. LEAD-INTEGRATED 2026-07-26: rebuilt dist (design-laws.js recompiled), re-gated = 140 suites no-drop, committed + pushed. The nested-cards line was NOT applied (unvalidated + non-systematic tick).
confidence: high
---

# Fuller validation of the default-typeface guidance line (3 providers)

Teammate task under lead integration. Extends beat `act-on-stage1-findings` (n=6 claude-only:
default-typeface 100%->0%, but nested-cards 0->2/6 + low-contrast 4->5/6 ticked up at small N,
plausibly noise). Goal: confirm the -100pp holds across ALL 3 providers and the sibling ticks are
noise, then APPLY the line to the surfaced guidance if it holds. Do NOT touch scripts/run-tests.ts or dist/.

## The exact line under test (verbatim from task; differs slightly from the beat draft)
"Choose a real typeface; never leave content on the bare system stack. Set body and headings to a
font-family you deliberately picked. The bare system-ui / -apple-system stack and its monoculture
members (Arial, Helvetica, Times, Georgia, Verdana, Segoe UI) are what you get when nobody chose, not
a decision. Because this document must stay self-contained with no external fonts, lead your body and
heading font-family with a characterful OS-installed face (Iowan Old Style, Charter, Baskerville, or
Cambria for serif; Optima, Avenir, Futura, or Gill Sans for sans) ahead of any generic fallback,
rather than defaulting to the system stack."

## Harness recon (read, not guessed)
- `eval/prose-ablation.mjs`: paired WITH/WITHOUT generation ablation, per-rule fire-rate via the SHIPPING
  scanner (`measure()` from defect-distribution.mjs). Shared baseline default = 2N calls/provider (N without
  + N with). Candidate injected via `--candidates-file` (JSON `{id,line,source,targetRule,hypothesis,dryDelta?}`).
- The ranked report prints only the TARGET rule + a paired aggregate. To get SIBLING deltas I pass
  `--out <scratchpad-dir>` (retains pages; withWorkDir keep=true) and run `measure()` myself over the
  retained `baseline/` and `<id>__with/` dirs -> all per-rule rates from the SAME samples (no extra spend).
- Provider IDs: claude=`claude-opus-4-8` (default), gpt=`gpt-5.4` (default), gemini=`modelDefault:null` ON
  PURPOSE (harness refuses to guess a Gemini id) -> must pass `--model gemini-3.6-flash` (the id beat #3
  actually ran on 07-25). Keys in ~/.sidecoach-keys (ANTHROPIC/OPENAI/GEMINI_API_KEY), sourced per-command.
- 20 held-out briefs available; using `--n 10`. gemini adapter has a built-in single retry on empty doc.

## Plan (step -> verify)
1. Dry-run smoke of the candidates-file -> verify: `--dry-run --json` exit 0, ranks the candidate.
2. Live claude: `--provider claude --candidates-file f --n 10 --out sc/claude --json` -> verify exit 0 + pages retained.
3. Live gpt: `--provider gpt ... --out sc/gpt` -> verify exit 0.
4. Live gemini: `--provider gemini --model gemini-3.6-flash ... --out sc/gemini` -> verify exit 0.
5. measure() over each provider's baseline + with dirs -> verify: per-rule rates for default-typeface +
   nested-cards/low-contrast/gray-on-color/tiny-text for all 3 providers.
6. DECIDE: substantial default-typeface drop across all 3 AND siblings not systematically worse -> apply.
7. If confirmed: append the line to `SHARED_DESIGN_LAWS.typography.rules` (src/design-laws.ts) -> verify
   `npm run build` green + foreground Codex review; fold findings. NOT committed (lead integrates).

## Guidance home (confirmed)
`src/design-laws.ts` `SHARED_DESIGN_LAWS.typography.rules` (currently 8 rules, no typeface-choice line);
surfaced to building models via flow-handler-font-research / design-tokens / brand-verify (per beat #2).
Existing nested-cards line lives at `spatial.rules` ("Cards are lazy answer ... never nested").

## RESULT (all 3 runs landed exit 0; 10 briefs each, shared baseline, N/condition=10, MDE ~63pp)

default-typeface WITH vs WITHOUT (the TARGET), measured via the shipping scanner over the retained pages:
- claude-opus-4-8:   100% (10/10) -> 0% (0/10) = **-100pp**
- gpt-5.4:            80% (8/10)  -> 0% (0/10) = **-80pp**
- gemini-3.6-flash:  100% (10/10) -> 0% (0/10) = **-100pp**
ALL THREE crater to 0% WITH the line. Every drop is far above the N=10 MDE (~63pp). Reproduces the n=6
claude -100pp and extends it to gpt + gemini. (gpt baseline 80% here vs 90% in Stage-1 mining = 10-brief
sampling variance; WITH is 0/10 regardless.)

Sibling rules (the n=6 pilot's nested-cards +2/6 and low-contrast +1/6 were the concern):
| rule          | claude | gpt   | gemini | cross-provider read |
|---------------|--------|-------|--------|---------------------|
| nested-cards  | +20pp  | +0pp  | -20pp  | NET ~0; non-systematic (claude up, gemini down) -> NOISE |
| low-contrast  | +0pp   | +0pp  | +0pp   | FLAT everywhere -> the pilot's +1/6 was pure noise |
| gray-on-color | +10pp  | -10pp | -10pp  | NET slightly negative; non-systematic |
| tiny-text     | -10pp  | -10pp | +10pp  | NET slightly negative; non-systematic |
No sibling systematically worsens. Every per-provider sibling delta is <=20pp i.e. BELOW the ~63pp MDE.

Harness paired aggregate delta (net over ALL rules, matched denominators) is NEGATIVE = defect-reducing
for all three: claude -1.8pp, gpt -4.6pp, gemini -6.8pp. The huge default-typeface win dominates and the
siblings net out neutral-to-beneficial.

Other rules that moved (all <=20pp, below MDE, scattered, non-systematic -> noise): claude skipped-heading
+10 / marketing-buzzword +10 / soft-radial-glow +20; gpt skipped-heading +10 / marketing-buzzword -20;
gemini skipped-heading -20 / numbered-section-markers -20 / soft-radial-glow +20 / repeating-stripe -10.

Token spend (60 calls total): claude 20 calls, 13.7k in / 226.6k out ~= $5.73 (only claude has a recorded
rate); gpt 20 calls, 8.5k in / 155.2k out; gemini 20 calls, 8.7k in / 247.5k out. gemini-3.6-flash resolved
and generated all 20 pages (tokensComplete=true) - the task's id was valid in this env; --model was required
because the harness deliberately carries no default Gemini id.

## DECISION: CONFIRMED -> APPLY the typeface line
default-typeface drops to 0% across ALL 3 providers; no sibling systematically worsens (low-contrast dead
flat, nested-cards nets ~0, gray-on-color + tiny-text net negative); net aggregate is beneficial on every
provider. The n=6 sibling ticks were noise: low-contrast is now flat 0/0/0, and the nested-cards uptick is
claude-specific and non-replicating (gemini moves the opposite way by the same magnitude), which is exactly
what generation noise looks like for a line that says nothing about cards.

nested-cards DRAFTED line: NOT applied. Two reasons: (1) it is unvalidated for its OWN efficacy (never
ablated), and (2) my run shows a non-systematic +20pp nested-cards tick on claude WITH the typeface line.
The task gates the nested-cards line on "not worsened by the typeface line"; the evidence is mixed (claude
+20 offset by gemini -20), so shipping an unvalidated line on ambiguous evidence is against the discipline.
Left for a dedicated ablation. (Recommended next: ablate the nested-cards line the same way, all 3 providers.)

## APPLIED (not committed - lead integrates)
Edit: `src/design-laws.ts`, `SHARED_DESIGN_LAWS.typography.rules` - appended ONE new string entry, VERBATIM
and byte-identical to the validated 640-char line (verified in code: length 640==640, no emdash, no emoji),
directly after the existing "Minimum 16px for web, 44px+ touch targets..." rule (now the last typography rule,
src line 249). This is the surfaced guidance home reaching building models via flow-handler-font-research /
design-tokens / brand-verify. No other line changed. The nested-cards DRAFTED line was NOT applied (unvalidated
+ non-systematic claude uptick; see DECISION above).

Verification gate (all green):
- `npm run build` GREEN (exit 0): generate-lanes / generate-validators / generate-counter-rules all `--check`
  OK (no drift), `tsc` clean. The edit does NOT propagate to any `*.generated.ts` (byte-identical to HEAD) -
  it is pure guidance content, isolated to design-laws.ts.
- dist/ RESTORED to HEAD after confirming the green build (only design-laws.js/.js.map/.d.ts.map recompiled);
  dist left physically untouched per task - lead rebuilds + commits dist at integration.
- Independent Codex review (codex-cli 0.142.5, `codex exec --sandbox read-only`): "No findings. The change
  looks correct and safe" - all 4 checks pass (valid TS single-quoted literal + array intact; no emoji/emdash;
  single-element diff; typography.rules is the correct domain). Nothing to fold.

## Lead integration notes
- ONLY deliverable src edit: `src/design-laws.ts` (+1 typography rule). NOT committed.
- NOT touched: `scripts/run-tests.ts`, `dist/` (restored), `*.generated.ts` (unchanged by the edit).
- To ship: re-run `npm run build` (regenerates only design-laws.js in dist) + commit src/design-laws.ts + dist.
- Recommended follow-up: ablate the drafted nested-cards line the same way (3 providers, N>=10) before applying it.

## Files touched (final)
- src/design-laws.ts (typography.rules += 1 validated guidance line) - the ONLY repo deliverable, NOT committed
- .claude/memory/session_2026-07-25_typeface-line-fuller-validation.md (this beat) + MEMORY.md index pointer
- scratchpad only (NOT in repo): typeface-candidate.json, measure-siblings.mjs, run-{claude,gpt,gemini}/, logs
