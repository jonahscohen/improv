#!/usr/bin/env node
/**
 * Stage 1d - SKILL-PROSE ABLATION LOOP (upgrade plan 2026-07-23, Stage 1d).
 *
 * GOAL: find and flag skill-prose guidance lines that PRIME defects rather than reduce them (self-improving
 * prose). For each candidate guidance line we generate the HELD-OUT briefs WITH the line injected into the
 * generation prompt and WITHOUT it, measure the per-rule defect fire-rate of each condition through the
 * SHIPPING scanner (Stage 1b `measure()`), and rank lines by the defect-rate DELTA. A line whose target rule's
 * rate goes UP when the line is present (positive delta) is PRIMING the very defect it names and is flagged as a
 * DELETION CANDIDATE; a negative delta confirms the line earns its place. Deletion is a HUMAN-REVIEWED action -
 * this tool RECOMMENDS, it never edits guidance prose.
 *
 * PAIRING + INDEPENDENCE. Each candidate is compared over the SAME held-out briefs (paired at the brief level,
 * which removes brief-to-brief variance). The brief pool is HELD-OUT ONLY (`kind !== "calibration"`), inherited
 * verbatim from Stage 1a's `loadHeldoutBriefs()` - calibration briefs are architect-authored and excluded with
 * no flag to weaken it. By default the WITHOUT ("baseline") condition is generated ONCE per brief and reused as
 * the common reference for every candidate (`--shared-baseline`, the default): this is a tighter pairing (the
 * baseline draw is held fixed across candidates) and roughly halves cost, at the price of correlated candidate
 * deltas - correct for a RANKING tool. `--independent-baseline` regenerates a fresh WITHOUT set per candidate
 * (2N pages/line, the cost model `prose-ablation-power.mjs` sizes against) when independent per-line deltas are
 * wanted.
 *
 * HONESTY ABOUT POWER (see eval/prose-ablation-power.mjs). Generation is stochastic, so a per-page fire
 * indicator is a Bernoulli draw and each condition's rate has binomial sampling noise. The power probe's
 * headline: only COARSE effects (>=~15pp) are distinguishable from generation noise at an affordable N. A small
 * pilot (a handful of briefs) is a PLUMBING + coarse-signal proof, not a powered result. This tool therefore
 * prints the run's approximate minimum-detectable-effect and labels any delta below it as "within noise"; the
 * deletion RECOMMENDATION gate is deliberately coarse (|delta| >= DELETION_DELTA) so a tiny pilot never
 * over-claims a deletion on noise.
 *
 * FAIL-CLOSED (mirrors provider-sample.mjs, in this order, before any success line):
 *   - unknown/missing provider, bad args, or a synthetic candidate in a LIVE run -> exit 1 (usage)
 *   - live mode with no provider key present   -> exit 2  (writes nothing; never fabricates output)
 *   - live mode with no resolvable model id    -> exit 3  (refuses to guess/pin a stale id)
 *   - a generation call fails or returns empty -> exit 4  (loud; no partial-success ranking)
 *   - a measurement is unusable (no conclusive page in a condition) -> exit 5
 *   - brief corpus missing/unreadable          -> exit 6
 * There is no path that prints a ranked table unless every page in every condition was generated AND measured.
 *
 * `--dry-run` proves the whole pipeline with a MOCKED, injection-aware generator: no key, no network, zero API
 * cost. The mock is grounded (its planted/suppressed HTML was verified to fire/not-fire each target rule through
 * the real scanner) and deterministic, so the ranked table is reproducible. `--self-test` runs the dry-run over
 * a seeded priming line and a seeded protective line and ASSERTS the ordering (priming delta > 0, protective
 * delta < 0), exiting nonzero on violation - this is the registered regression gate.
 *
 * INDEPENDENCE: eval-side. The SHARED ORACLE (the scanner) is single-sourced through Stage 1b `measure()`; this
 * file imports only the published eval surface and never product code.
 *
 * Usage:
 *   node eval/prose-ablation.mjs --dry-run                       # full named set, mocked, zero cost
 *   node eval/prose-ablation.mjs --self-test                     # seeded ordering assertion (CI gate)
 *   node eval/prose-ablation.mjs --provider claude --candidates counter-default-typeface,counter-nested-cards --n 6
 *   node eval/prose-ablation.mjs --list                          # print the named candidate registry
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { measure, loadScanner } from './defect-distribution.mjs';
import { PROVIDERS, loadHeldoutBriefs, extractHtml, selfContainmentIssues } from './provider-sample.mjs';

// A candidate id and a provider name both become on-disk path components; constrain them to a safe basename.
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

export const EXIT = { OK: 0, USAGE: 1, NO_KEY: 2, NO_MODEL: 3, GENERATION: 4, MEASURE: 5, CORPUS: 6 };
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const die = (code, msg) => { console.error(`prose-ablation: ${msg}`); process.exit(code); };

// The deletion RECOMMENDATION gate: a target-rule delta at or above this magnitude is treated as real signal
// (the power probe's coarse-feasibility floor). Deltas below it are reported but labeled "within noise".
export const DELETION_DELTA = 0.15;
// Self-test tolerance: the seeded mock effect is a clean +/-0.5, so a generous 0.2 sign-margin is unambiguous.
const SELFTEST_MARGIN = 0.2;

// ---------------------------------------------------------------------------------------------------------
// PROMPT construction. Mirrors provider-sample.mjs (Stage 1a) so the generated page differs from a Stage 1a
// page ONLY by the injected DESIGN GUIDANCE block. PROMPT_SYSTEM / PROMPT_RULES are a verbatim mirror of
// Stage 1a's constants (they are not exported by provider-sample.mjs); if Stage 1a's prompt ever changes, this
// mirror must be updated (or the lead can export them from Stage 1a so both share one copy - flagged in report).
// ---------------------------------------------------------------------------------------------------------
const PROMPT_SYSTEM =
  'You are a senior product designer and front-end engineer. You produce a single, complete, self-contained ' +
  'HTML document for the brief you are given.';

const PROMPT_RULES = [
  'Return ONE complete HTML document and nothing else. No prose before or after, no markdown fences.',
  'The document must be fully self-contained: all CSS in a single <style> block, no external stylesheets, no',
  'external fonts, no external images, no scripts, no network requests of any kind. Use inline SVG or CSS for',
  'any visual element. Use placeholder copy only - no real personal data.',
  'Design the page as you judge best for the brief. Do not ask questions; produce the page.',
].join(' ');

/**
 * Build the generation prompt. `injected` is the list of candidate guidance lines to inject (0 or 1 in this
 * harness). WITHOUT condition passes [] and reproduces the Stage 1a prompt exactly; WITH condition passes the
 * one candidate line, inside a labeled DESIGN GUIDANCE block, so the ablation isolates that single line.
 */
export function buildPrompt(briefText, injected = []) {
  const guidance = injected.length
    ? `DESIGN GUIDANCE\n---------------\n${injected.map((l) => `- ${l}`).join('\n')}\n\n`
    : '';
  return `${PROMPT_RULES}\n\n${guidance}BRIEF\n-----\n${briefText}\n`;
}

// ---------------------------------------------------------------------------------------------------------
// Provider adapters. ONE interface: async (prompt, ctx) => { text, usage }. A faithful mirror of Stage 1a's
// adapters (not exported there). gemini gets a single retry on an empty document (it transiently returns one).
// A non-2xx or empty body throws; the caller turns that into exit 4 (never a silent empty page).
// ---------------------------------------------------------------------------------------------------------
async function generateClaude(prompt, ctx) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const stream = client.messages.stream({
    model: ctx.modelId,
    max_tokens: 32000,
    system: PROMPT_SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    text,
    usage: { inputTokens: msg.usage?.input_tokens ?? null, outputTokens: msg.usage?.output_tokens ?? null },
  };
}

async function generateGpt(prompt, ctx) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.apiKey}` },
    body: JSON.stringify({
      model: ctx.modelId,
      messages: [{ role: 'system', content: PROMPT_SYSTEM }, { role: 'user', content: prompt }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`openai ${res.status}: ${body.slice(0, 400)}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error(`openai: unparseable body: ${body.slice(0, 200)}`); }
  const text = json?.choices?.[0]?.message?.content ?? '';
  return {
    text,
    usage: { inputTokens: json?.usage?.prompt_tokens ?? null, outputTokens: json?.usage?.completion_tokens ?? null },
  };
}

async function geminiOnce(prompt, ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ctx.modelId)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': ctx.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`gemini ${res.status}: ${body.slice(0, 400)}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error(`gemini: unparseable body: ${body.slice(0, 200)}`); }
  const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return {
    text,
    usage: {
      inputTokens: json?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: json?.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
}

async function generateGemini(prompt, ctx) {
  const first = await geminiOnce(prompt, ctx);
  if (extractHtml(first.text)) return first;      // usable document -> keep it
  const retry = await geminiOnce(prompt, ctx);    // transient empty doc -> one retry (per plan)
  return retry;
}

const ADAPTERS = { claude: generateClaude, gpt: generateGpt, gemini: generateGemini };

// ---------------------------------------------------------------------------------------------------------
// NAMED candidate registry. Each candidate = one guidance line to ablate. `targetRule` is the shipping-scanner
// class the line is hypothesized to move (asserted to be in the live rule universe). `hypothesis` is the PRIOR
// (reporting only - the ablation MEASURES the truth). `synthetic` candidates exist ONLY to prove the harness
// (dry-run / self-test) and are REFUSED in a live run. `dryDelta` steers the mock ONLY (ignored by real
// generation): it is the target-rule rate shift the mock applies to the WITH page.
//
// The three real candidates are the counter-rule guidance lines Stage 1c appends to the orchestrator per
// provider (verbatim from src/counter-rules.generated.ts). They are the ONE piece of prose sidecoach actually
// injects into a build per-provider, which makes them the sharpest self-improving-prose test: does "watch
// default-typeface ... counter it deliberately" REDUCE default-typeface, or does naming it ironically PRIME it?
// ---------------------------------------------------------------------------------------------------------
export const CANDIDATES = [
  {
    id: 'counter-default-typeface',
    line: 'watch default-typeface: claude pages fired it on 100% of the sample (20/20) - counter it deliberately',
    source: 'src/counter-rules.generated.ts (Stage 1c claude counter-rule)',
    targetRule: 'default-typeface',
    hypothesis: 'protective',
    dryDelta: -0.5,
  },
  {
    id: 'counter-nested-cards',
    line: 'watch nested-cards: claude pages fired it on 35% of the sample (7/20) - counter it deliberately',
    source: 'src/counter-rules.generated.ts (Stage 1c claude counter-rule)',
    targetRule: 'nested-cards',
    hypothesis: 'protective',
    dryDelta: -0.4,
  },
  {
    id: 'counter-low-contrast',
    line: 'watch low-contrast: claude pages fired it on 55% of the sample (11/20) - counter it deliberately',
    source: 'src/counter-rules.generated.ts (Stage 1c claude counter-rule)',
    targetRule: 'low-contrast',
    hypothesis: 'protective',
    dryDelta: -0.3,
  },
  {
    id: 'seed-primes-nested-cards',
    line: '(synthetic ablation probe: seeded to PRIME nested-cards in the mock - never a real guidance line)',
    source: 'synthetic (dry-run/self-test only)',
    targetRule: 'nested-cards',
    hypothesis: 'priming',
    synthetic: true,
    dryDelta: 0.5,
  },
  {
    id: 'seed-protects-tiny-text',
    line: '(synthetic ablation probe: seeded to PROTECT against tiny-text in the mock - never a real guidance line)',
    source: 'synthetic (dry-run/self-test only)',
    targetRule: 'tiny-text',
    hypothesis: 'protective',
    synthetic: true,
    dryDelta: -0.5,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Mock generator (--dry-run). Injection-aware and GROUNDED: the planted/suppressed HTML below was verified to
// fire / not-fire each target rule through the real scanner (measure()) before it was baked in. The controllable
// rules are the six a page can plant deterministically: default-typeface, nested-cards, tiny-text, low-contrast,
// gray-on-color, skipped-heading. Costs nothing; touches no key.
//
// Determinism model: a page is a function of WHICH controllable rules it plants. The baseline (WITHOUT) page for
// brief index i plants a rule on the FIRST floor(N/2) briefs (a ~50% reference rate, shared across candidates).
// The WITH page for a candidate is the baseline page with ONLY the candidate's target rule shifted: it plants
// the target on the first k briefs where k = clamp(round(baseRate*N + dryDelta*N)), so the WITH-minus-WITHOUT
// target-rule delta tracks dryDelta while every non-target rule is byte-identical between the two conditions.
// ---------------------------------------------------------------------------------------------------------
// The mock can RENDER all six of these on demand. The BASELINE plants only the five below - gray-on-color is
// deliberately excluded from the baseline because the scanner treats it as a SUBTYPE of low-contrast (it emits
// BOTH findings when gray text fails contrast on a chromatic bg), so co-planting it would keep low-contrast
// firing and mask a low-contrast candidate's delta. gray-on-color stays renderable, so a candidate that TARGETS
// gray-on-color still moves it (and its low-contrast shadow) - it is only kept out of the shared baseline.
const BASELINE_RULES = ['default-typeface', 'nested-cards', 'tiny-text', 'low-contrast', 'skipped-heading'];

function mockPage(brief, plant) {
  // `plant` is a Set of controllable rule ids to trigger on this page.
  const system = plant.has('default-typeface');
  const tiny = plant.has('tiny-text');
  const nested = plant.has('nested-cards');
  const lowContrast = plant.has('low-contrast');
  const grayOnColor = plant.has('gray-on-color');
  const skip = plant.has('skipped-heading');

  const face = system ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '"Fraunces"';
  const bodyPx = tiny ? 11 : 17;
  const textColor = lowContrast ? '#9a9a9a' : '#141414';
  const h2 = skip ? 'h3' : 'h2';
  const card = nested
    ? `<div style="border:1px solid #ccc;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:24px;width:600px;min-height:200px;background:#fff">
         <p>Outer card body copy to give it panel presence and real height on the page.</p>
         <div style="border:1px solid #bbb;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,.1);padding:16px;width:300px;min-height:90px;background:#fafafa">
           <p>Nested inner card paragraph with enough words to render as a real sub-panel.</p>
         </div>
       </div>`
    : '<div style="padding:24px;width:600px"><p>Flat section, no card treatment.</p></div>';
  const gray = grayOnColor
    ? '<div style="background:#2f5bea;padding:20px;width:400px"><p style="color:#8a8a8a">Gray text sitting on a saturated blue background block.</p></div>'
    : '';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<title>${brief.title}</title>`,
    `<style>body{margin:0;padding:48px;background:#fff;color:${textColor};font-family:${face};font-size:${bodyPx}px;line-height:1.6}`,
    'h1{font-size:40px}h2,h3{font-size:22px}p{max-width:62ch}</style></head><body>',
    `<h1>${brief.title}</h1>`,
    '<p>Intro paragraph of readable body copy to establish the content region for the density-based checks. This sentence carries enough characters to count as real content text on the page for the tiny-text and default-typeface proportion math.</p>',
    `<section><${h2}>Section heading</${h2}>`,
    '<p>Section paragraph one with a decent amount of prose so the content-region proportion is meaningful and not discarded as too short to judge readability against.</p>',
    '<p>Section paragraph two with more prose so the small-text density and typeface proportion both have a solid denominator to work against for the page.</p>',
    card,
    gray,
    '</section></body></html>',
  ].join('\n');
}

// The controllable rules the baseline plants, by brief index (first-half => ~50% reference rate). Deterministic
// and candidate-independent. Returns a Set.
function baselinePlant(briefIndex, n) {
  const firstHalf = briefIndex < Math.floor(n / 2);
  return new Set(firstHalf ? BASELINE_RULES : []);
}

// The WITH page's plant set for a candidate: baseline, but the target rule is planted on the first k briefs
// (k tracks dryDelta), leaving every non-target rule identical to baseline.
function withPlant(briefIndex, n, cand) {
  const baseRate = Math.floor(n / 2) / n;
  const k = Math.max(0, Math.min(n, Math.round((baseRate + (cand.dryDelta || 0)) * n)));
  const set = new Set(baselinePlant(briefIndex, n));
  if (briefIndex < k) set.add(cand.targetRule); else set.delete(cand.targetRule);
  return set;
}

// ---------------------------------------------------------------------------------------------------------
// Generation of one CONDITION (a set of pages, one per brief) into its own directory + manifest, so measure()
// can read it. `injected` is [] for the baseline or [candidate.line] for a WITH condition. In dry-run the page
// comes from the mock; live it comes from the provider adapter (a failure throws -> exit 4).
// ---------------------------------------------------------------------------------------------------------
async function generateCondition({ dir, provider, modelId, briefs, injected, cand, condition, dryRun, apiKey, repeats, totals }) {
  mkdirSync(dir, { recursive: true });
  const pages = [];
  const n = briefs.length;
  for (let i = 0; i < n; i += 1) {
    const brief = briefs[i];
    for (let r = 0; r < repeats; r += 1) {
      let html;
      let usage = { inputTokens: null, outputTokens: null };
      if (dryRun) {
        const plant = condition === 'with' ? withPlant(i, n, cand) : baselinePlant(i, n);
        html = mockPage(brief, plant);
      } else {
        let out;
        try { out = await ADAPTERS[provider](buildPrompt(brief.text, injected), { apiKey, modelId }); }
        catch (e) { throw Object.assign(new Error(`generation failed for ${provider}/${brief.id}#${r} [${condition}${cand ? '/' + cand.id : ''}]: ${e.message}`), { generation: true }); }
        usage = out.usage || usage;
        totals.calls += 1;
        if (usage.inputTokens == null || usage.outputTokens == null) totals.tokensKnown = false;
        totals.inputTokens += usage.inputTokens || 0;
        totals.outputTokens += usage.outputTokens || 0;
        html = extractHtml(out.text);
        if (!html) throw Object.assign(new Error(`generation returned no usable HTML document for ${provider}/${brief.id}#${r} [${condition}] (${String(out.text || '').length} chars)`), { generation: true });
      }
      const file = `${provider}__${brief.id}__r${r}.html`;
      writeFileSync(path.join(dir, file), html);
      pages.push({
        provider, briefId: brief.id, modelId, file, repeat: r, register: brief.register,
        synthetic: dryRun, selfContainmentIssues: dryRun ? [] : selfContainmentIssues(html),
        usage,
      });
    }
  }
  writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify({
    schema: 'sidecoach-provider-sample/v1', mode: dryRun ? 'dry-run' : 'live', provider, modelId,
    condition, candidate: cand ? cand.id : null, pages,
  }, null, 2)}\n`);
  return pages.length;
}

// Measure a condition dir -> the per-rule rate map for the provider under test. Fail-closed and COMPLETENESS-
// strict: a paired ablation delta is only honest if EVERY page in the condition was generated AND rendered with
// BOTH lenses. `measure()` counts a page "conclusive" when EITHER lens rendered and skips a rule's denominator
// on pages where that rule's own lens failed (defect-distribution.mjs) - so a subjective rule could carry a
// SHORT denominator (total < expected) with a still-numeric rate and slip past the null check downstream (Codex
// 2nd-pass HIGH). Requiring both lens-availability counts === expected guarantees EVERY rule's denominator is
// exactly `expected`, so both the target-rule delta and the aggregate are over complete, matched denominators.
// Throws a typed measure error (mapped to exit 5 by the caller AFTER work-dir cleanup - must NOT die() here,
// which would bypass withWorkDir's finally; Codex 1st-pass MEDIUM).
async function measureCondition(dir, provider, expected) {
  const art = await measure(dir);
  const provRates = art.distribution[provider] || art.distribution.unknown || {};
  const meta = art.providers[provider] || art.providers.unknown || { pagesConclusive: 0, pagesTotal: 0, lens: {} };
  const objLens = meta.lens?.objective?.available;
  const subjLens = meta.lens?.subjective?.available;
  if (meta.pagesTotal !== expected || meta.pagesConclusive !== expected || objLens !== expected || subjLens !== expected) {
    throw Object.assign(new Error(`incomplete measurement in ${dir}: expected ${expected} page(s) with BOTH lenses, got total=${meta.pagesTotal} conclusive=${meta.pagesConclusive} objectiveLens=${objLens} subjectiveLens=${subjLens} - refusing to compute a delta over a partial scan`), { measure: true });
  }
  return { rates: provRates, ruleUniverse: art.ruleUniverse, meta };
}

// Paired aggregate: mean of per-rule rate deltas over ONLY the rules with a numeric rate in BOTH conditions, so
// nulls can never make the two sides average different rule sets (Codex MEDIUM). null when nothing is shared.
function pairedAggregateDelta(withoutRates, withRates, ruleUniverse) {
  const deltas = [];
  for (const r of ruleUniverse) {
    const wo = withoutRates[r]?.rate; const wi = withRates[r]?.rate;
    if (typeof wo === 'number' && typeof wi === 'number') deltas.push(wi - wo);
  }
  return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
}

// ---------------------------------------------------------------------------------------------------------
// The ablation. Returns { rows, baselineMeta, ruleUniverse }. `rows` is one result per candidate.
// ---------------------------------------------------------------------------------------------------------
async function runAblation({ provider, modelId, briefs, candidates, dryRun, apiKey, repeats, sharedBaseline, workRoot, totals }) {
  const rows = [];
  let ruleUniverse = null;
  let sharedBaselineRates = null;
  const expected = briefs.length * repeats; // pages per condition; measurement must be complete over exactly this

  if (sharedBaseline) {
    const dir = path.join(workRoot, 'baseline');
    await generateCondition({ dir, provider, modelId, briefs, injected: [], cand: null, condition: 'without', dryRun, apiKey, repeats, totals });
    const m = await measureCondition(dir, provider, expected);
    sharedBaselineRates = m.rates; ruleUniverse = m.ruleUniverse;
  }

  for (const cand of candidates) {
    let withoutRates;
    if (sharedBaseline) {
      withoutRates = sharedBaselineRates;
    } else {
      const wdir = path.join(workRoot, `${cand.id}__without`);
      await generateCondition({ dir: wdir, provider, modelId, briefs, injected: [], cand, condition: 'without', dryRun, apiKey, repeats, totals });
      const m = await measureCondition(wdir, provider, expected);
      withoutRates = m.rates; ruleUniverse = ruleUniverse || m.ruleUniverse;
    }
    const wdir = path.join(workRoot, `${cand.id}__with`);
    await generateCondition({ dir: wdir, provider, modelId, briefs, injected: [cand.line], cand, condition: 'with', dryRun, apiKey, repeats, totals });
    const mw = await measureCondition(wdir, provider, expected);
    ruleUniverse = ruleUniverse || mw.ruleUniverse;
    const withRates = mw.rates;

    // FAIL-CLOSED (Codex HIGH): a candidate whose TARGET rule has no numeric rate in either condition (its
    // detecting lens did not run on every page) is UNMEASURABLE. Ranking or reporting "no deletion" for it would
    // be a false-clean. Refuse the whole run with exit 5 rather than emit a null-target row.
    const tr = cand.targetRule;
    const wo = withoutRates[tr]?.rate;
    const wi = withRates[tr]?.rate;
    if (typeof wo !== 'number' || typeof wi !== 'number') {
      throw Object.assign(new Error(`candidate "${cand.id}": target rule "${tr}" is unmeasurable (rate null in the ${typeof wo !== 'number' ? 'without' : 'with'} condition - its lens did not run on every page). Refusing to rank on an unmeasurable target.`), { measure: true });
    }
    const targetDelta = Number((wi - wo).toFixed(4));
    const agg = pairedAggregateDelta(withoutRates, withRates, ruleUniverse);
    const aggregateDelta = typeof agg === 'number' ? Number(agg.toFixed(4)) : null;

    rows.push({
      id: cand.id, targetRule: tr, hypothesis: cand.hypothesis, synthetic: !!cand.synthetic, source: cand.source, line: cand.line,
      withoutRate: typeof wo === 'number' ? Number(wo.toFixed(4)) : null,
      withRate: typeof wi === 'number' ? Number(wi.toFixed(4)) : null,
      targetDelta, aggregateDelta,
    });
  }
  return { rows, ruleUniverse };
}

// Rough two-proportion minimum-detectable-effect at 80% power for this run's N (pages per condition), so the
// report can honestly label sub-threshold deltas as noise. Uses the worst-case p=0.5 variance (conservative).
function minDetectableEffect(nPerCondition) {
  if (!nPerCondition || nPerCondition < 1) return 1;
  const z = 1.959964 + 0.841621; // alpha 0.05 two-sided + 80% power
  // d such that N = z^2 * (0.25 + 0.25) / d^2  =>  d = z * sqrt(0.5 / N)
  return z * Math.sqrt(0.5 / nPerCondition);
}

function classify(targetDelta, mde) {
  if (targetDelta === null) return 'unmeasurable';
  if (targetDelta >= DELETION_DELTA && targetDelta >= mde) return 'DELETE (primes its target)';
  if (targetDelta <= -DELETION_DELTA && -targetDelta >= mde) return 'keep (earns its place)';
  if (Math.abs(targetDelta) < mde) return 'within noise (underpowered)';
  return targetDelta > 0 ? 'lean-prime' : 'lean-keep';
}

function report({ rows, provider, modelId, briefs, repeats, sharedBaseline, dryRun, cost }) {
  const nPerCond = briefs.length * repeats;
  const mde = minDetectableEffect(nPerCond);
  const ranked = [...rows].sort((a, b) => {
    const av = a.targetDelta === null ? -Infinity : a.targetDelta;
    const bv = b.targetDelta === null ? -Infinity : b.targetDelta;
    return bv - av; // most-priming (positive) first
  });
  const lines = [];
  lines.push('=== STAGE 1d PROSE-ABLATION ===');
  lines.push(`mode=${dryRun ? 'dry-run' : 'live'}  provider=${provider}  model=${modelId}  briefs=${briefs.length}  repeats=${repeats}  N/condition=${nPerCond}  baseline=${sharedBaseline ? 'shared' : 'independent'}`);
  lines.push(`min-detectable-effect (80% power, this N): ~${(mde * 100).toFixed(0)}pp - deltas below this are within generation noise`);
  lines.push('');
  lines.push('RANKED by target-rule defect delta (with - without); positive = the line PRIMES the defect it names:');
  lines.push('  candidate                      target-rule        without   with    dDELTA   net    verdict');
  for (const r of ranked) {
    const wo = r.withoutRate === null ? '  n/a' : `${(r.withoutRate * 100).toFixed(0).padStart(4)}%`;
    const wi = r.withRate === null ? '  n/a' : `${(r.withRate * 100).toFixed(0).padStart(4)}%`;
    const dd = r.targetDelta === null ? '   n/a' : `${(r.targetDelta * 100 >= 0 ? '+' : '')}${(r.targetDelta * 100).toFixed(0)}pp`;
    const net = r.aggregateDelta === null ? ' n/a' : `${(r.aggregateDelta * 100 >= 0 ? '+' : '')}${(r.aggregateDelta * 100).toFixed(0)}pp`;
    lines.push(`  ${r.id.padEnd(30)} ${r.targetRule.padEnd(18)} ${wo}    ${wi}   ${dd.padStart(6)}  ${net.padStart(5)}  ${classify(r.targetDelta, mde)}${r.synthetic ? ' [synthetic]' : ''}`);
  }
  lines.push('');
  const deletions = ranked.filter((r) => r.targetDelta !== null && r.targetDelta >= DELETION_DELTA && r.targetDelta >= mde && !r.synthetic);
  if (deletions.length) {
    lines.push('DELETION RECOMMENDATIONS (human-reviewed - this tool does not edit prose):');
    for (const r of deletions) lines.push(`  - ${r.id}: +${(r.targetDelta * 100).toFixed(0)}pp on ${r.targetRule}. Source: ${r.source}. Line: "${r.line}"`);
  } else {
    lines.push('DELETION RECOMMENDATIONS: none cleared the coarse gate at this N (no real guidance line primed its target above noise).');
  }
  if (!dryRun) {
    lines.push('');
    lines.push(`cost: calls=${cost.calls} inTok=${cost.inputTokens} outTok=${cost.outputTokens}` +
      `${cost.estimatedUsd !== null ? ` estUsd=$${cost.estimatedUsd}` : ' estUsd=n/a (no recorded rate)'}` +
      `${cost.tokensComplete ? '' : ' [token counts INCOMPLETE - provider did not report usage]'}`);
  }
  return { text: lines.join('\n'), ranked, mde, nPerCond, deletions };
}

// ---------------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { provider: null, n: null, briefs: null, candidates: null, candidatesFile: null, model: null,
    dryRun: false, selfTest: false, independentBaseline: false, repeats: 1, out: null, json: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    // A value-taking flag must be followed by a real value, never end-of-args or another flag (Codex LOW: a
    // missing value would otherwise swallow the next flag or throw an uncaught TypeError).
    const next = () => { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) die(EXIT.USAGE, `${k} requires a value`); i += 1; return v; };
    if (k === '--provider') a.provider = next();
    else if (k === '--n') a.n = Number(next());
    else if (k === '--briefs') a.briefs = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--candidates') a.candidates = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--candidates-file') a.candidatesFile = next();
    else if (k === '--model') a.model = next();
    else if (k === '--repeats') a.repeats = Number(next());
    else if (k === '--out') a.out = next();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--self-test') a.selfTest = true;
    else if (k === '--independent-baseline') a.independentBaseline = true;
    else if (k === '--json') a.json = true;
    else if (k === '--list') a.list = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else die(EXIT.USAGE, `unknown argument: ${k}`);
  }
  return a;
}

const HELP = `prose-ablation.mjs - Stage 1d skill-prose ablation loop

  --dry-run                 mocked, injection-aware generator: no key, no network, zero cost
  --self-test               dry-run over a seeded priming + protective line; ASSERT ordering (CI gate)
  --list                    print the named candidate registry and exit
  --provider <claude|gpt|gemini>   live provider (key-gated)
  --candidates <id,...>     subset of the registry to ablate (default: all non-synthetic in dry-run;
                            required to name a set in live mode; synthetic ids are refused live)
  --candidates-file <path>  load a JSON array of {id,line,source,targetRule,hypothesis,dryDelta?} instead
  --n <int>                 number of held-out briefs (default: all)
  --briefs <id,...>         pin specific held-out briefs (mutually exclusive with --n)
  --repeats <int>           generations per brief per condition (default 1)
  --independent-baseline    regenerate a fresh WITHOUT set per candidate (2N/line); default reuses one baseline
  --model <id>              override the provider model id
  --out <dir>               working dir for generated pages (default: a temp dir, cleaned up)
  --json                    print the structured result as JSON

exit: 0 ok | 1 usage | 2 no key | 3 no model id | 4 generation failed | 5 measurement unusable | 6 corpus`;

function validateRegistry(registry, whichFile) {
  // Schema + path-safety validation (Codex MEDIUM): every candidate's id becomes an on-disk directory component,
  // and the delta math relies on id/line/targetRule being real strings. Reject anything malformed rather than
  // letting it flow into a filesystem path or a null comparison.
  const seen = new Set();
  for (const c of registry) {
    if (!c || typeof c !== 'object') die(EXIT.USAGE, `${whichFile}: every entry must be an object`);
    for (const f of ['id', 'line', 'source', 'targetRule', 'hypothesis']) {
      if (typeof c[f] !== 'string' || !c[f].trim()) die(EXIT.USAGE, `${whichFile}: candidate ${JSON.stringify(c.id) || '(no id)'} missing required string field "${f}"`);
    }
    if (!SAFE_ID.test(c.id)) die(EXIT.USAGE, `${whichFile}: candidate id "${c.id}" is not a safe basename (allowed: letters, digits, . _ -)`);
    if (seen.has(c.id)) die(EXIT.USAGE, `${whichFile}: duplicate candidate id "${c.id}"`);
    seen.add(c.id);
    if (c.dryDelta !== undefined && !Number.isFinite(c.dryDelta)) die(EXIT.USAGE, `${whichFile}: candidate "${c.id}" dryDelta must be a finite number`);
  }
  return registry;
}

function resolveCandidates(args, forLive) {
  let registry = validateRegistry(CANDIDATES, 'built-in registry');
  if (args.candidatesFile) {
    let arr;
    try { arr = JSON.parse(readFileSync(path.resolve(args.candidatesFile), 'utf8')); }
    catch (e) { die(EXIT.USAGE, `--candidates-file unreadable: ${e.message}`); }
    if (!Array.isArray(arr) || !arr.length) die(EXIT.USAGE, '--candidates-file must be a non-empty JSON array');
    registry = validateRegistry(arr, '--candidates-file');
  }
  let selected;
  if (args.candidates) {
    selected = args.candidates.map((id) => {
      const c = registry.find((x) => x.id === id);
      if (!c) die(EXIT.USAGE, `unknown candidate id "${id}" (known: ${registry.map((x) => x.id).join(', ')})`);
      return c;
    });
  } else {
    // default: all non-synthetic for a live run; all for dry-run (so the demo shows a priming line too)
    selected = forLive ? registry.filter((c) => !c.synthetic) : registry;
  }
  if (forLive) {
    const synth = selected.filter((c) => c.synthetic);
    if (synth.length) die(EXIT.USAGE, `synthetic candidate(s) cannot run live (dry-run only): ${synth.map((c) => c.id).join(', ')}`);
    if (!selected.length) die(EXIT.USAGE, 'no candidates selected for the live run');
  }
  // integrity: every target rule must be a real scanner class (checked against the measured universe later too)
  return selected;
}

function selectBriefs(args) {
  const all = loadHeldoutBriefs(); // fail-closed corpus loader (exit 6) inherited from Stage 1a
  if (args.briefs && args.n !== null) die(EXIT.USAGE, '--briefs and --n are mutually exclusive');
  if (args.briefs) {
    return args.briefs.map((id) => {
      const b = all.find((x) => x.id === id);
      if (!b) die(EXIT.USAGE, `--briefs "${id}" is not a held-out brief (pool has ${all.length}; calibration excluded)`);
      return b;
    });
  }
  if (args.n !== null) {
    if (!Number.isInteger(args.n) || args.n < 1) die(EXIT.USAGE, `--n must be a positive integer (got ${args.n})`);
    if (args.n > all.length) die(EXIT.USAGE, `--n ${args.n} exceeds the held-out pool size (${all.length})`);
    return all.slice(0, args.n);
  }
  return all;
}

async function withWorkDir(preferred, fn) {
  // Default work dir lives in the OS temp dir, NEVER inside the repo, so transient generated samples can never
  // pollute the tree (even if a run is killed before cleanup). --out overrides for when the operator wants to
  // keep the samples somewhere specific.
  const root = preferred
    ? path.resolve(preferred)
    : path.join(os.tmpdir(), 'sidecoach-prose-ablation', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  if (existsSync(root) && readdirSync(root).length > 0) die(EXIT.USAGE, `work dir not empty: ${root}`);
  mkdirSync(root, { recursive: true });
  const keep = !!preferred; // if the user named --out, keep it; otherwise clean the temp tree
  try { return await fn(root); }
  finally { if (!keep) { try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }
  if (args.list) {
    console.log('Named candidate registry:');
    for (const c of CANDIDATES) console.log(`  ${c.id.padEnd(30)} target=${c.targetRule.padEnd(18)} ${c.synthetic ? '[synthetic] ' : ''}hyp=${c.hypothesis}\n      source: ${c.source}\n      line: "${c.line}"`);
    process.exit(EXIT.OK);
  }

  if (!Number.isInteger(args.repeats) || args.repeats < 1) die(EXIT.USAGE, `--repeats must be a positive integer (got ${args.repeats})`);

  // ---- SELF-TEST: seeded ordering assertion over the mock. The registered regression gate. ----
  if (args.selfTest) {
    const briefs = (args.n !== null || args.briefs) ? selectBriefs(args) : loadHeldoutBriefs().slice(0, 4);
    const candidates = [CANDIDATES.find((c) => c.id === 'seed-primes-nested-cards'), CANDIDATES.find((c) => c.id === 'seed-protects-tiny-text')];
    const totals = { inputTokens: 0, outputTokens: 0, calls: 0, tokensKnown: true };
    let rows;
    try {
      ({ rows } = await withWorkDir(null, (root) => runAblation({
        provider: 'claude', modelId: 'mock', briefs, candidates, dryRun: true, apiKey: null,
        repeats: args.repeats, sharedBaseline: !args.independentBaseline, workRoot: root, totals,
      })));
    } catch (e) {
      // Typed generation/measurement failures are legitimate self-test failures (exit nonzero); an UNKNOWN
      // error is a real bug and should surface its stack, not be masked as a measurement failure (Codex LOW).
      if (e && (e.generation || e.measure)) {
        console.error(`prose-ablation --self-test FAILED (pipeline ${e.generation ? 'generation' : 'measurement'} error): ${e.message}`);
        process.exit(e.generation ? EXIT.GENERATION : EXIT.MEASURE);
      }
      throw e;
    }
    const prime = rows.find((r) => r.id === 'seed-primes-nested-cards');
    const protect = rows.find((r) => r.id === 'seed-protects-tiny-text');
    const problems = [];
    if (!prime || prime.targetDelta === null || prime.targetDelta <= SELFTEST_MARGIN) problems.push(`seeded PRIMING line must have targetDelta > +${SELFTEST_MARGIN} (got ${prime ? prime.targetDelta : 'missing'})`);
    if (!protect || protect.targetDelta === null || protect.targetDelta >= -SELFTEST_MARGIN) problems.push(`seeded PROTECTIVE line must have targetDelta < -${SELFTEST_MARGIN} (got ${protect ? protect.targetDelta : 'missing'})`);
    if (prime && protect && !(prime.targetDelta > protect.targetDelta)) problems.push('priming line must rank above protective line by delta');
    if (problems.length) {
      console.error('prose-ablation --self-test FAILED:');
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(EXIT.MEASURE);
    }
    console.log(`prose-ablation --self-test OK: seeded priming +${(prime.targetDelta * 100).toFixed(0)}pp on ${prime.targetRule}, protective ${(protect.targetDelta * 100).toFixed(0)}pp on ${protect.targetRule} (ordering holds).`);
    process.exit(EXIT.OK);
  }

  // ---- preflight (fail-closed; NOTHING is generated until every check passes) ----
  const forLive = !args.dryRun;
  const briefs = selectBriefs(args);
  const candidates = resolveCandidates(args, forLive);

  let apiKey = null;
  let modelId = args.model || null;
  let provider = args.provider;
  let spec = null;
  if (forLive) {
    if (!provider) die(EXIT.USAGE, 'missing --provider (or pass --dry-run). live mode is key-gated.');
    spec = PROVIDERS[provider];
    if (!spec) die(EXIT.USAGE, `unknown provider "${provider}" (expected: ${Object.keys(PROVIDERS).join(', ')})`);
    const keyName = spec.keyEnv.find((kk) => process.env[kk]);
    if (!keyName) die(EXIT.NO_KEY, `no key for provider "${provider}": set ${spec.keyEnv.join(' or ')}. Writing nothing (fail-closed). Use --dry-run to exercise the pipeline without a key.`);
    apiKey = process.env[keyName];
    modelId = modelId || process.env[spec.modelEnv] || spec.modelDefault;
    if (!modelId) die(EXIT.NO_MODEL, `no model id for provider "${provider}": set ${spec.modelEnv} (or pass --model). Refusing to guess or pin a stale id.`);
  } else {
    provider = provider || 'claude';
    // dry-run does not require a KNOWN provider, but the name becomes a filename component, so keep it safe
    // (Codex MEDIUM: an arbitrary --provider would otherwise flow straight into an on-disk path).
    if (!SAFE_ID.test(provider)) die(EXIT.USAGE, `--provider "${provider}" is not a safe basename (allowed: letters, digits, . _ -)`);
    modelId = modelId || 'mock';
  }

  // Validate every selected candidate targets a REAL scanner class BEFORE spending any generation (no orphan
  // guidance). loadScanner reads the dist rule arrays only - no rendering, no key.
  const { ruleUniverse: universe } = await loadScanner();
  for (const c of candidates) {
    if (!universe.includes(c.targetRule)) die(EXIT.USAGE, `candidate "${c.id}" targets "${c.targetRule}" which is not a scanner rule (universe has ${universe.length} rules)`);
  }

  const totals = { inputTokens: 0, outputTokens: 0, calls: 0, tokensKnown: true };
  let rows;
  try {
    // withWorkDir's finally cleans the temp tree even when runAblation throws; the catch then maps the typed
    // generation/measurement error to its fail-closed exit code (Codex HIGH: these were exiting as uncaught 1).
    ({ rows } = await withWorkDir(args.out, (root) => runAblation({
      provider, modelId, briefs, candidates, dryRun: args.dryRun, apiKey,
      repeats: args.repeats, sharedBaseline: !args.independentBaseline, workRoot: root, totals,
    })));
  } catch (e) {
    if (e && e.generation) die(EXIT.GENERATION, e.message);
    if (e && e.measure) die(EXIT.MEASURE, e.message);
    throw e; // unexpected internal error - surface the real stack, not a misleading exit code
  }

  const cost = {
    calls: totals.calls,
    inputTokens: args.dryRun ? 0 : totals.inputTokens,
    outputTokens: args.dryRun ? 0 : totals.outputTokens,
    tokensComplete: args.dryRun ? true : totals.tokensKnown,
    estimatedUsd: args.dryRun ? 0
      : (spec && spec.usd && totals.tokensKnown
        ? Number((totals.inputTokens * spec.usd.in + totals.outputTokens * spec.usd.out).toFixed(4))
        : null),
  };

  const out = report({ rows, provider, modelId, briefs, repeats: args.repeats, sharedBaseline: !args.independentBaseline, dryRun: args.dryRun, cost });
  console.log(out.text);
  if (args.json) {
    console.log(JSON.stringify({
      schema: 'sidecoach-prose-ablation/v1', generatedUtc: new Date().toISOString(),
      mode: args.dryRun ? 'dry-run' : 'live', provider, modelId,
      briefs: briefs.map((b) => b.id), repeats: args.repeats, sharedBaseline: !args.independentBaseline,
      minDetectableEffect: Number(out.mde.toFixed(4)), nPerCondition: out.nPerCond,
      deletionDelta: DELETION_DELTA, cost, rows: out.ranked,
    }, null, 2));
  }
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
