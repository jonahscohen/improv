#!/usr/bin/env node
/**
 * PRE-DATA POWER / MDE PROBE for the sidecoach efficacy trial.
 *
 * Answers the only question that can be answered BEFORE any page is generated: at the n this
 * trial can afford, what is the SMALLEST effect it could detect? Every number printed here is
 * pure arithmetic over the pre-registered analysis plan - no data, no network, no key, no cost.
 *
 * It exists so the trial cannot be rescued after the fact by claiming an underpowered null was
 * "close". The MDE is frozen in PREREGISTRATION.md from this script's output.
 *
 * MEASURES SIZED HERE
 *   M1  paired blind preference (independent judge)  -> two-sided EXACT binomial sign test vs 0.5
 *   M2  paired axe-core violation delta              -> paired-difference test, sized via the
 *   M3  paired sidecoach-finding delta                  normal approximation on Cohen's d_z
 *
 * MULTIPLICITY: M1 and M2 are the two CONFIRMATORY measures and are Holm-corrected, so the
 * effective alpha for the first-tested hypothesis is 0.025. Both alphas are printed.
 *
 * Exit: 0 on success, 1 on bad args. Never prints a result line it did not compute.
 */
import { argv, exit } from 'node:process';

const EXIT = { OK: 0, USAGE: 1 };
const die = (code, msg) => { console.error(`power: ${msg}`); exit(code); };

// ---- pre-registered constants (frozen before any data existed) ------------------------------
const ALPHA_UNCORRECTED = 0.05;
const ALPHA_HOLM_FIRST = 0.05 / 2; // two confirmatory measures, Holm step 1
const POWER_TARGETS = [0.8, 0.9];
const Z = { 0.8: 0.8416212336, 0.9: 1.2815515655 };
const Z_ALPHA = { 0.05: 1.9599639845, 0.025: 2.2413867634 };

// ---- exact binomial helpers (log-space, no dependency) ---------------------------------------
function lnGamma(x) {
  // Lanczos g=7, n=9. Accurate to ~15 digits for x > 0.
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const lnChoose = (n, k) => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
const binomPmf = (n, k, p) => Math.exp(lnChoose(n, k) + (p === 0 ? (k === 0 ? 0 : -Infinity) : k * Math.log(p))
  + (p === 1 ? (k === n ? 0 : -Infinity) : (n - k) * Math.log(1 - p)));

/** Two-sided exact binomial p-value vs p=0.5 (symmetric, so doubling the smaller tail is exact). */
export function exactBinomTwoSided(n, k) {
  if (n === 0) return 1;
  const lo = Math.min(k, n - k);
  let tail = 0;
  for (let i = 0; i <= lo; i++) tail += binomPmf(n, i, 0.5);
  return Math.min(1, 2 * tail);
}

/** Smallest number of wins out of n that reaches significance at `alpha` (two-sided exact). */
export function criticalWins(n, alpha) {
  for (let k = Math.ceil(n / 2); k <= n; k++) if (exactBinomTwoSided(n, k) <= alpha) return k;
  return null; // unreachable at this n
}

/** Exact power of the two-sided sign test at true win-probability p. */
export function signTestPower(n, alpha, p) {
  const kc = criticalWins(n, alpha);
  if (kc === null) return 0;
  let up = 0, down = 0;
  for (let i = kc; i <= n; i++) up += binomPmf(n, i, p);
  for (let i = 0; i <= n - kc; i++) down += binomPmf(n, i, p);
  return up + down;
}

/** Smallest true win-probability >0.5 reaching `power` at this n (grid to 0.001). */
export function signTestMde(n, alpha, power) {
  for (let p = 0.500; p <= 1.0001; p += 0.001) {
    if (signTestPower(n, alpha, p) >= power) return Math.round(p * 1000) / 1000;
  }
  return null;
}

/** Paired-difference MDE in Cohen's d_z units: d = (z_alpha + z_beta)/sqrt(n). */
export const pairedMdeD = (n, alpha, power) => (Z_ALPHA[alpha] + Z[power]) / Math.sqrt(n);

// ---- CLI --------------------------------------------------------------------------------------
function main() {
  const args = argv.slice(2);
  let n = 22;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n') { n = Number(args[++i]); if (!Number.isInteger(n) || n < 1) die(EXIT.USAGE, `--n must be a positive integer, got ${args[i]}`); }
    else if (args[i] === '-h' || args[i] === '--help') { console.log('Usage: node power.mjs [--n <pairs>]'); exit(EXIT.OK); }
    else die(EXIT.USAGE, `unknown arg ${args[i]}`);
  }

  console.log('=== PRE-DATA POWER / MDE (sidecoach efficacy trial) ===');
  console.log(`pairs n = ${n}   (one treatment page and one control page per brief)`);
  console.log(`alpha: uncorrected ${ALPHA_UNCORRECTED}, Holm step-1 across the 2 confirmatory measures ${ALPHA_HOLM_FIRST}`);
  console.log('');

  console.log('M1 - paired blind preference, two-sided EXACT binomial sign test vs 0.5');
  for (const alpha of [ALPHA_UNCORRECTED, ALPHA_HOLM_FIRST]) {
    const kc = criticalWins(n, alpha);
    console.log(`  alpha=${alpha}: significance needs >= ${kc} of ${n} wins (or <= ${n - kc})` +
      (kc === null ? '  [UNREACHABLE at this n]' : `  -> observed win rate >= ${(kc / n).toFixed(3)}`));
    for (const pw of POWER_TARGETS) {
      const mde = signTestMde(n, alpha, pw);
      console.log(`    MDE at ${(pw * 100).toFixed(0)}% power: true win-rate ${mde === null ? 'UNREACHABLE' : mde.toFixed(3)}`);
    }
    for (const p of [0.60, 0.65, 0.70, 0.75, 0.80, 0.90]) {
      console.log(`    power at true p=${p.toFixed(2)}: ${(signTestPower(n, alpha, p) * 100).toFixed(1)}%`);
    }
  }
  console.log('');

  console.log('M2 / M3 - paired count delta, sized as Cohen d_z = mean(diff)/sd(diff)');
  for (const alpha of [ALPHA_UNCORRECTED, ALPHA_HOLM_FIRST]) {
    for (const pw of POWER_TARGETS) {
      console.log(`  alpha=${alpha}, power=${(pw * 100).toFixed(0)}%: MDE d_z = ${pairedMdeD(n, alpha, pw).toFixed(3)}`);
    }
  }
  console.log('');
  console.log('READ THIS BEFORE READING ANY RESULT');
  console.log('  These are LARGE effects. A non-significant result at this n means "no LARGE effect');
  console.log('  detected", never "no effect". A modest real improvement would be invisible here and');
  console.log('  the trial must not be reported as ruling one out.');
  exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
