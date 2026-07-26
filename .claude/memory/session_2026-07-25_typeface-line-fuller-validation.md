---
name: Typeface-selection guidance line - FULLER 3-provider validation
description: Extend the n=6 claude-only default-typeface ablation to ~10 briefs x claude/gpt/gemini via eval/prose-ablation.mjs; measure target + sibling deltas; apply to design-laws.ts if confirmed
type: project
relates_to: [session_2026-07-25_act-on-stage1-findings.md, session_2026-07-25_stage1d-prose-ablation.md, session_2026-07-24_stage1a-1b-provider-defect-mining.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: pending (live 3-provider ablation running)
confidence: medium
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

## Status: RUNNING (results + decision + edits appended on landing)
Background run handles (each: 10 briefs, shared baseline = 20 calls; --out retains pages under scratchpad):
claude=b6nbz6ntd, gpt=b740dqgof, gemini=b7m7pl4at (model gemini-3.6-flash). Post-run sibling measurement
script staged at scratchpad/measure-siblings.mjs (runs shipping `measure()` over each retained baseline/with dir).

## Files touched (this session)
- scratchpad/typeface-candidate.json (candidates-file, NOT in repo)
- .claude/memory/session_2026-07-25_typeface-line-fuller-validation.md (this beat)
