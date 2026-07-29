/**
 * Statistics for the efficacy trial. Self-contained, no dependencies, deterministic.
 *
 * Every test here is the one named in PREREGISTRATION.md section 4, implemented EXACTLY rather
 * than by normal approximation wherever n permits, so a borderline p-value is not an artefact of
 * an approximation chosen after seeing the data.
 */

// ---- exact binomial ---------------------------------------------------------------------------
function lnGamma(x) {
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

/** Two-sided exact binomial sign test vs p=0.5. Symmetric null, so doubling a tail is exact. */
export function signTest(wins, losses) {
  const n = wins + losses;
  if (n === 0) return { n, wins, losses, p: 1, winRate: NaN };
  const lo = Math.min(wins, losses);
  let tail = 0;
  for (let i = 0; i <= lo; i++) tail += Math.exp(lnChoose(n, i) + n * Math.log(0.5));
  return { n, wins, losses, p: Math.min(1, 2 * tail), winRate: wins / n };
}

/** Modified Lentz continued fraction for the regularised incomplete beta. */
function betacf(a, b, x) {
  const TINY = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a,b), with the standard symmetry switch. */
export function betaCdf(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betacf(a, b, x)) / a
    : 1 - (front * betacf(b, a, 1 - x)) / b;
}

/** Clopper-Pearson exact CI for a proportion, via bisection on the beta CDF. */
export function clopperPearson(k, n, alpha = 0.05) {
  if (n === 0) return [NaN, NaN];
  const solve = (target, a, b) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (betaCdf(mid, a, b) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // lower = BetaInv(alpha/2; k, n-k+1); upper = BetaInv(1-alpha/2; k+1, n-k).
  const lower = k === 0 ? 0 : solve(alpha / 2, k, n - k + 1);
  const upper = k === n ? 1 : solve(1 - alpha / 2, k + 1, n - k);
  return [lower, upper];
}

// ---- exact Wilcoxon signed-rank ----------------------------------------------------------------
/**
 * Two-sided Wilcoxon signed-rank test on paired differences.
 *
 * Zero differences are dropped (Wilcoxon's own convention) and the count is returned so a
 * degenerate all-ties result is visible rather than hidden inside a p-value. Ties among |d| get
 * average ranks, and the null distribution is the EXACT conditional permutation over the 2^m sign
 * flips of the observed ranks - which is correct in the presence of tied ranks, where the
 * textbook table is not.
 */
export function wilcoxonSignedRank(diffs) {
  const nonzero = diffs.filter((d) => d !== 0);
  const zeros = diffs.length - nonzero.length;
  const m = nonzero.length;
  if (m === 0) return { m, zeros, W: NaN, p: 1, exact: true, note: 'all differences are zero' };
  if (m > 22) throw new Error(`exact enumeration refuses m=${m} (2^m too large); this trial never reaches it`);

  const abs = nonzero.map(Math.abs);
  const order = abs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(m);
  for (let i = 0; i < m;) {
    let j = i;
    while (j + 1 < m && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j + 2) / 2; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
    i = j + 1;
  }

  const Wplus = nonzero.reduce((a, d, i) => a + (d > 0 ? ranks[i] : 0), 0);
  const total = ranks.reduce((a, r) => a + r, 0);
  const observed = Math.abs(Wplus - total / 2);

  let atLeast = 0;
  const N = 1 << m;
  for (let mask = 0; mask < N; mask++) {
    let w = 0;
    for (let i = 0; i < m; i++) if (mask & (1 << i)) w += ranks[i];
    if (Math.abs(w - total / 2) >= observed - 1e-12) atLeast++;
  }
  return { m, zeros, W: Wplus, p: atLeast / N, exact: true };
}

// ---- bootstrap ---------------------------------------------------------------------------------
export function mulberry32(a) {
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentile bootstrap CI for the mean of paired differences. Deterministic given the seed. */
export function bootstrapMeanCI(diffs, { resamples = 10000, seed = 20260728, alpha = 0.05 } = {}) {
  const n = diffs.length;
  if (n === 0) return { mean: NaN, lo: NaN, hi: NaN, resamples: 0 };
  const rnd = mulberry32(seed);
  const means = new Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += diffs[Math.floor(rnd() * n)];
    means[r] = s / n;
  }
  means.sort((a, b) => a - b);
  const mean = diffs.reduce((a, d) => a + d, 0) / n;
  return {
    mean,
    lo: means[Math.floor((alpha / 2) * resamples)],
    hi: means[Math.min(resamples - 1, Math.ceil((1 - alpha / 2) * resamples) - 1)],
    resamples,
  };
}

/** Cohen's d_z for paired differences (the effect-size unit power.mjs sized against). */
export function cohenDz(diffs) {
  const n = diffs.length;
  if (n < 2) return NaN;
  const mean = diffs.reduce((a, d) => a + d, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1));
  return sd === 0 ? (mean === 0 ? 0 : Infinity) : mean / sd;
}

// ---- multiplicity --------------------------------------------------------------------------------
/**
 * Holm-Bonferroni over a FIXED family. Returns each entry with its adjusted p and reject flag.
 * The family is fixed by the pre-registration and is never chosen from the data.
 */
export function holm(entries, alpha = 0.05) {
  const sorted = [...entries].sort((a, b) => a.p - b.p);
  const k = sorted.length;
  let stillRejecting = true;
  const out = sorted.map((e, i) => {
    const threshold = alpha / (k - i);
    const reject = stillRejecting && e.p <= threshold;
    if (!reject) stillRejecting = false;
    return { ...e, threshold, reject, adjustedP: Math.min(1, e.p * (k - i)) };
  });
  // enforce monotone adjusted p
  for (let i = 1; i < out.length; i++) out[i].adjustedP = Math.max(out[i].adjustedP, out[i - 1].adjustedP);
  return out;
}
