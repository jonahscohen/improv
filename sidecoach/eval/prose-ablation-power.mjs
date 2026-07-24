#!/usr/bin/env node
/**
 * PROBE 1 - THE POWER QUESTION FOR STAGE 1d (blocks Stage 1d).
 *
 * Stage 1d proposes ablating skill-prose lines by measuring a DEFECT-RATE DELTA with vs without each line
 * (upgrade plan 2026-07-23, Stage 1d). Nobody has asked what N makes such a delta distinguishable from
 * generation run-to-run noise. This probe answers it, following the `eval/power-analysis.mjs` precedent (fixed
 * pre-registered parameters, Wald/normal-approximation sizing) and stating plainly where the answer is
 * "infeasible at any affordable N".
 *
 * DESIGN. The ablation is a two-condition comparison of a per-page fire-rate for a rule R:
 *     p_with    = fraction of generated pages firing R WHEN the line is present
 *     p_without = fraction of generated pages firing R WHEN the line is removed
 * paired over the same held-out briefs. The effect of interest is d = |p_without - p_with|. Generation is
 * STOCHASTIC (the same brief+line yields a different page each run), so the per-page indicator is a Bernoulli
 * draw and d_hat has binomial sampling variance. That variance - not model quality - is what sets N.
 *
 * SIZING (normal approximation, two independent arms; the assumption-light FLOOR, exactly as power-analysis.mjs
 * reports the proportion-CI floor and defers the paired-McNemar refinement to measured discordance):
 *     N_per_arm = ceil( (z_alpha + z_beta)^2 * (p1(1-p1) + p2(1-p2)) / d^2 )
 * The paired McNemar refinement needs a PILOT DISCORDANCE probability, which requires repeated live generation
 * from the same brief (that is exactly Probe 2's `concept-sameness --repeats` byproduct). Until that exists,
 * the unpaired N is the honest pre-registered floor; pairing can only reduce it, never raise it.
 *
 * OUTPUT: a required-N grid over realistic (baseline rate, effect size) cells at 80% and 90% power, each
 * translated into repeats-per-brief over the held-out pool and into USD per candidate line, then a feasibility
 * verdict against an affordable periodic-eval budget. Optionally anchor the baseline rates to a real measured
 * distribution with `--from <defect-distribution.json>`.
 *
 * This probe is PURE ARITHMETIC: no key, no network, zero cost. Exit 0 always unless given bad args (exit 1)
 * or an unreadable --from file (exit 2).
 *
 * Usage:
 *   node eval/prose-ablation-power.mjs
 *   node eval/prose-ablation-power.mjs --pool 20 --usd-per-page 0.20 --budget 200 --lines 12
 *   node eval/prose-ablation-power.mjs --from eval/samples/<dir>/defect-distribution.json
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXIT = { OK: 0, USAGE: 1, INPUT: 2 };
const die = (code, msg) => { console.error(`prose-ablation-power: ${msg}`); process.exit(code); };

// Pre-registered constants (frozen before any result), mirroring power-analysis.mjs.
const Z_ALPHA = 1.959964;              // two-sided 95%
const Z_BETA = { 0.8: 0.841621, 0.9: 1.281552 }; // 80% / 90% power

/**
 * Two-proportion required N per arm (pages per condition) to detect an ABSOLUTE effect d at the given power.
 * The effect d = |p_without - p_with| is directionless, so from a fixed baseline p1 the ablated rate could be
 * p1-d OR p1+d. We size for the CONSERVATIVE (largest-N) valid side - the p2 with the largest variance
 * p2(1-p2), i.e. closest to 0.5 - so the reported N never understates the requirement. (Codex MAJOR: the prior
 * `p2 = p1 - d` clamped a 20pp move from a 0.10 baseline to 0.001, understating variance and making Stage 1d
 * look cheaper/more feasible than it is.)
 */
export function nPerArm(p1, d, power) {
  const zb = Z_BETA[power];
  const cands = [];
  if (p1 - d >= 0) cands.push(p1 - d);
  if (p1 + d <= 1) cands.push(p1 + d);
  if (cands.length === 0) cands.push(Math.min(0.999, Math.max(0.001, p1 - d))); // degenerate baseline; clamp
  let p2 = cands[0];
  for (const c of cands) if (c * (1 - c) > p2 * (1 - p2)) p2 = c; // maximize variance => most conservative N
  const num = (Z_ALPHA + zb) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil(num / (d * d));
}

function parseArgs(argv) {
  const a = { pool: 20, usdPerPage: 0.20, budget: 200, lines: 12, from: null, power: 0.8 };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => { const v = argv[i + 1]; i += 1; return v; };
    if (k === '--pool') a.pool = Number(next());
    else if (k === '--usd-per-page') a.usdPerPage = Number(next());
    else if (k === '--budget') a.budget = Number(next());
    else if (k === '--lines') a.lines = Number(next());
    else if (k === '--power') a.power = Number(next());
    else if (k === '--from') a.from = next();
    else if (k === '--help' || k === '-h') a.help = true;
    else die(EXIT.USAGE, `unknown argument: ${k}`);
  }
  if (a.help) return a;
  // Numeric-arg validation (Codex MAJOR): reject NaN / non-positive / non-integer counts rather than emitting
  // Infinity/NaN feasibility rows with exit 0. "bad args exit 1" must actually hold.
  if (!Number.isInteger(a.pool) || a.pool < 1) die(EXIT.USAGE, `--pool must be a positive integer (got ${a.pool})`);
  if (!Number.isFinite(a.usdPerPage) || a.usdPerPage <= 0) die(EXIT.USAGE, `--usd-per-page must be a positive number (got ${a.usdPerPage})`);
  if (!Number.isFinite(a.budget) || a.budget <= 0) die(EXIT.USAGE, `--budget must be a positive number (got ${a.budget})`);
  if (!Number.isInteger(a.lines) || a.lines < 1) die(EXIT.USAGE, `--lines must be a positive integer (got ${a.lines})`);
  if (!(a.power in Z_BETA)) die(EXIT.USAGE, `--power must be 0.8 or 0.9 (got ${a.power})`);
  return a;
}

const HELP = `prose-ablation-power.mjs - Probe 1: sample size to distinguish a real ablation effect from noise

  --pool <int>          held-out brief pool size (default 20)
  --usd-per-page <n>    cost of one generated page (default 0.20 = ~1.5k in + 8k out @ Opus 4.8 rate)
  --budget <n>          affordable USD per ablation pass (default 200)
  --lines <int>         candidate skill-prose lines to ablate (default 12)
  --power <0.8|0.9>     target power for the headline grid (default 0.8)
  --from <path>         anchor baseline rates to a real defect-distribution.json instead of the grid

  Pure arithmetic; no key, no network, zero cost.`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }

  // Baseline rates: measured (--from) or a realistic grid.
  let baselines;
  let baselineSource;
  if (args.from) {
    let art;
    try { art = JSON.parse(readFileSync(path.resolve(args.from), 'utf8')); }
    catch (e) { die(EXIT.INPUT, `--from unreadable: ${e.message}`); }
    const rates = [];
    for (const rules of Object.values(art.distribution || {})) {
      for (const e of Object.values(rules)) if (e && typeof e.rate === 'number') rates.push(e.rate);
    }
    if (!rates.length) die(EXIT.INPUT, `--from ${args.from} has no measured non-null rates to anchor on`);
    // use distinct observed rates, rounded, clamped away from 0/1 (a 0 or 1 baseline has no ablation room)
    baselines = [...new Set(rates.map((r) => Math.min(0.5, Math.max(0.1, Number(r.toFixed(2))))))].sort((a, b) => a - b).slice(0, 4);
    baselineSource = `measured (${args.from})`;
  } else {
    baselines = [0.1, 0.2, 0.3, 0.5];
    baselineSource = 'realistic grid (no measured distribution supplied)';
  }
  const effects = [0.02, 0.05, 0.10, 0.15, 0.20]; // 2pp .. 20pp ablation effect

  console.log('=== PROBE 1: STAGE 1d ABLATION POWER ===');
  console.log(`params: alpha=0.05 two-sided, power=${args.power}, pool=${args.pool} briefs, usdPerPage=$${args.usdPerPage}, budget=$${args.budget}/pass, candidateLines=${args.lines}`);
  console.log(`baseline rates: ${baselineSource} -> [${baselines.join(', ')}]`);
  console.log('sizing: two-proportion normal-approx floor (unpaired); paired McNemar can only lower N, and needs pilot discordance from a live repeats run (Probe 2).');
  console.log('');
  console.log('Required N per condition (pages), and $ per line (=2N*usdPerPage, both conditions):');
  console.log('  baseP  effect  N/cond  reps/brief   $ / line   feasible@budget');
  const rows = [];
  for (const p of baselines) {
    for (const d of effects) {
      const n = nPerArm(p, d, args.power);
      const reps = Math.ceil(n / args.pool);
      const usdPerLine = 2 * n * args.usdPerPage;
      const feasible = usdPerLine <= args.budget;
      rows.push({ p, d, n, reps, usdPerLine, feasible });
      console.log(`  ${p.toFixed(2)}   ${(d * 100).toFixed(0).padStart(2)}pp   ${String(n).padStart(5)}   ${String(reps).padStart(6)}     $${usdPerLine.toFixed(0).padStart(7)}     ${feasible ? 'yes' : 'NO'}`);
    }
  }

  // Verdict: find the smallest detectable effect within budget at a mid baseline, and the full-pass cost.
  const mid = baselines[Math.floor(baselines.length / 2)];
  const midRows = rows.filter((r) => r.p === mid).sort((a, b) => a.d - b.d);
  const smallestFeasible = midRows.find((r) => r.feasible);
  const twoPp = nPerArm(mid, 0.02, args.power);
  const twoPpUsd = 2 * twoPp * args.usdPerPage;
  const fullPassSmallestFeasible = smallestFeasible ? smallestFeasible.usdPerLine * args.lines : null;

  console.log('');
  console.log('VERDICT');
  console.log(`  At a ${mid.toFixed(2)} baseline and ${(args.power * 100)}% power:`);
  if (smallestFeasible) {
    console.log(`  - Smallest ablation effect detectable within $${args.budget}/line: ${(smallestFeasible.d * 100).toFixed(0)}pp` +
      ` (N=${smallestFeasible.n}/condition, ${smallestFeasible.reps} reps/brief, $${smallestFeasible.usdPerLine.toFixed(0)}/line).`);
    console.log(`  - A full ablation pass over ${args.lines} candidate lines at that resolution: ~$${fullPassSmallestFeasible.toFixed(0)}.`);
  } else {
    console.log(`  - NO effect size on the grid is detectable within $${args.budget}/line at this baseline.`);
  }
  console.log(`  - Detecting a SUBTLE 2pp effect needs N=${twoPp}/condition = $${twoPpUsd.toFixed(0)}/line` +
    ` = ~$${(twoPpUsd * args.lines).toFixed(0)} across ${args.lines} lines: ${twoPpUsd <= args.budget ? 'feasible' : 'INFEASIBLE at any affordable N'}.`);
  console.log('');
  console.log('  HEADLINE NUMBER: Stage 1d is feasible ONLY for coarse ablation effects.');
  console.log(`  A ${smallestFeasible ? (smallestFeasible.d * 100).toFixed(0) : '>20'}pp+ shift per line is measurable on the ${args.pool}-brief pool for a periodic budget;`);
  console.log('  a few-percentage-point ablation effect is NOT distinguishable from generation noise at any affordable N.');
  console.log('  Recommendation: gate Stage 1d on coarse (>=15pp) priming effects only, or treat it as infeasible for fine tuning.');
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
