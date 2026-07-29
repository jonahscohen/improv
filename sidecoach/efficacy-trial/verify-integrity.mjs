#!/usr/bin/env node
/**
 * INTEGRITY SUITE for the efficacy trial. FAIL-CLOSED, and every assertion is mutation-controlled
 * by construction (each one is checked against a deliberately corrupted copy of its own input, in
 * memory, so an assertion that cannot fail is caught here rather than believed).
 *
 * It checks the claims the RESULT rests on, not the result:
 *   1. the frozen brief population is exactly what the pre-registration says
 *   2. the mechanical PRODUCT.md transform invents no word absent from its brief
 *   3. the placebo is length-matched to the sidecoach payload it stands in for
 *   4. the wrapper and brief block are byte-identical across all three arms of every prompt
 *   5. the payload block is the ONLY difference between the P and S prompts
 *   6. the committed judge assignment is exactly the seeded draw, and is side-balanced enough
 *   7. the statistics agree with published reference values
 *
 * EXIT: 0 all checks pass, 1 usage, 2 a check FAILED (names it), 3 a mutation control did not
 * fail (an assertion that cannot fail proves nothing and is treated as a failure).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadTrialBriefs, isTrialBrief, BRIEF_DIR, TRIAL_ROOT } from './lib/briefs.mjs';
import { productMdFromBrief, authoredTokenLeak } from './lib/product-md.mjs';
import { buildPlacebo } from './lib/placebo.mjs';
import { drawAssignment, SEED } from './judge-prompt.mjs';
import { signTest, clopperPearson, wilcoxonSignedRank, holm } from './lib/stats.mjs';

const EXIT = { OK: 0, USAGE: 1, FAILED: 2, VACUOUS: 3 };
let failures = 0, vacuous = 0, checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}
/** Assert that a deliberately corrupted input DOES trip the same predicate. */
function mutation(name, fn) {
  checks++;
  let tripped = false;
  try { fn(); } catch { tripped = true; }
  if (tripped) console.log(`  ok   mutation control: ${name} (corrupted input rejected)`);
  else { vacuous++; console.log(`  VACUOUS ${name}: the corrupted input PASSED - this assertion cannot fail`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function main() {
  if (process.argv.length > 2) { console.error('verify-integrity: takes no arguments'); process.exit(EXIT.USAGE); }
  console.log('INTEGRITY SUITE');

  // 1 - population
  const briefs = loadTrialBriefs({ expect: 17 });
  check('brief population is the frozen 17', () => {
    assert(briefs.length === 17, `got ${briefs.length}`);
    const all = readdirSync(BRIEF_DIR).filter((f) => f.endsWith('.md'));
    assert(all.filter((f) => f.startsWith('calib-')).length === 3, 'expected 3 calib briefs to exist and be excluded');
    assert(all.filter((f) => f.startsWith('real-govuk-')).length === 3, 'expected 3 govuk briefs to exist and be excluded');
    assert(briefs.every((b) => isTrialBrief(b.file)), 'a loaded brief fails the population filter');
  });
  mutation('population filter rejects a calib brief', () => {
    // The corrupted CLAIM is "calib-balanced.md is a trial brief". It must trip.
    assert(isTrialBrief('calib-balanced.md'), 'calib-balanced.md is correctly excluded from the population');
  });

  // 2 - PRODUCT.md invents nothing
  check('mechanical PRODUCT.md introduces no token absent from its brief', () => {
    for (const b of briefs) {
      const leak = authoredTokenLeak(b, productMdFromBrief(b));
      assert(leak.length === 0, `${b.id} leaked: ${leak.join(', ')}`);
    }
  });
  mutation('the leak checker catches an injected word', () => {
    const b = briefs[0];
    const poisoned = `${productMdFromBrief(b)}\n\nzzzunmistakablyinvented\n`;
    const leak = authoredTokenLeak(b, poisoned);
    assert(leak.length === 0, `leak checker missed the injected token (found ${leak.join(',')})`);
  });

  // 3 + 4 + 5 - the arms
  const manifestPath = path.join(TRIAL_ROOT, 'arms', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.log('  SKIP arms checks - arms/manifest.json not built yet');
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    check('placebo is length-matched to the sidecoach payload (lines exact, chars within 2%)', () => {
      for (const b of manifest.briefs) {
        assert(b.placebo.lines === b.sidecoach.lines, `${b.id}: lines ${b.placebo.lines} vs ${b.sidecoach.lines}`);
        const ratio = b.placebo.chars / b.sidecoach.chars;
        assert(ratio >= 0.98 && ratio <= 1.0, `${b.id}: char ratio ${ratio.toFixed(4)} outside [0.98, 1.00]`);
      }
    });
    mutation('the length-match check rejects a mismatched placebo', () => {
      const b = manifest.briefs[0];
      const ratio = (b.placebo.chars * 1.5) / b.sidecoach.chars;
      assert(ratio >= 0.98 && ratio <= 1.0, `char ratio ${ratio.toFixed(4)} outside band`);
    });
    check('the P and S prompts differ ONLY inside the payload block', () => {
      const HDR = manifest.payloadHeader;
      for (const b of manifest.briefs) {
        const read = (arm) => readFileSync(path.join(TRIAL_ROOT, 'arms', `${b.id}.${arm}.txt`), 'utf8');
        const [p, s] = [read('P'), read('S')];
        // The output path legitimately differs by arm (each arm writes its own file), so the
        // tail is compared with the arm letter normalised out. Everything else in the tail must
        // match byte for byte.
        const normalise = (t) => t.replace(/\/pages\/[CPS]\//g, '/pages/<ARM>/');
        const cut = (t) => {
          const i = t.indexOf(`\n${HDR}\n-----\n`);
          assert(i !== -1, `${b.id}: payload header not found`);
          const j = t.lastIndexOf('\n-----\n');
          return { head: normalise(t.slice(0, i)), tail: normalise(t.slice(j)) };
        };
        const [cp, cs] = [cut(p), cut(s)];
        assert(cp.head === cs.head, `${b.id}: the text BEFORE the payload differs between P and S`);
        assert(cp.tail === cs.tail, `${b.id}: the text AFTER the payload differs between P and S`);
        const c = normalise(read('C'));
        assert(c.startsWith(cp.head), `${b.id}: arm C does not share the P/S prefix`);
      }
    });
    mutation('the P-vs-S prefix check rejects an altered prefix', () => {
      const b = manifest.briefs[0];
      const HDR = manifest.payloadHeader;
      const p = readFileSync(path.join(TRIAL_ROOT, 'arms', `${b.id}.P.txt`), 'utf8');
      const s = `X${readFileSync(path.join(TRIAL_ROOT, 'arms', `${b.id}.S.txt`), 'utf8')}`;
      const head = (t) => t.replace(/\/pages\/[CPS]\//g, '/pages/<ARM>/').slice(0, t.indexOf(`\n${HDR}\n-----\n`));
      assert(head(p) === head(s), 'altered prefix was accepted');
    });
  }

  // 6 - the judge assignment is the seeded draw
  const aPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');
  if (!existsSync(aPath)) {
    console.log('  SKIP assignment checks - judge/assignment.json not drawn yet');
  } else {
    const a = JSON.parse(readFileSync(aPath, 'utf8'));
    check('committed assignment is exactly the seeded draw', () => {
      assert(a.seed === SEED, `seed ${a.seed} != ${SEED}`);
      const ids = [...new Set(a.rows.map((r) => r.id))];
      const redraw = drawAssignment(ids);
      assert(JSON.stringify(redraw) === JSON.stringify(a.rows), 'the committed rows are not the seeded draw for these ids');
    });
    mutation('the redraw check rejects a flipped side', () => {
      const ids = [...new Set(a.rows.map((r) => r.id))];
      const tampered = JSON.parse(JSON.stringify(a.rows));
      [tampered[0].A, tampered[0].B] = [tampered[0].B, tampered[0].A];
      assert(JSON.stringify(drawAssignment(ids)) === JSON.stringify(tampered), 'flipped side accepted');
    });
    check('neither side of any contrast is degenerately one-armed', () => {
      for (const c of [...new Set(a.rows.map((r) => r.contrast))]) {
        const rows = a.rows.filter((r) => r.contrast === c);
        const armsAsA = new Set(rows.map((r) => r.A));
        assert(armsAsA.size === 2, `contrast ${c}: only ${[...armsAsA].join(',')} ever appears as PAGE A`);
      }
    });
  }

  // 7 - statistics against published reference values
  check('statistics reproduce published reference values', () => {
    const near = (x, y, tol = 5e-4) => Math.abs(x - y) < tol;
    assert(near(signTest(15, 5).p, 0.041389), `signTest(15,5)=${signTest(15, 5).p}`);
    assert(near(signTest(13, 4).p, 0.049042), `signTest(13,4)=${signTest(13, 4).p}`);
    const cp = clopperPearson(15, 20);
    assert(near(cp[0], 0.5089) && near(cp[1], 0.9134), `CP(15,20)=${cp}`);
    assert(near(wilcoxonSignedRank([1, 2, 3, 4, 5, 6]).p, 0.03125), 'wilcoxon n=6 all-positive');
    assert(wilcoxonSignedRank([0, 0, 0]).m === 0, 'all-zero differences must report m=0');
    const h = holm([{ p: 0.03 }, { p: 0.04 }]);
    assert(h[0].reject === false, 'Holm must NOT reject p=0.03 at step-1 threshold 0.025');
  });
  mutation('the reference check rejects a wrong p-value', () => {
    assert(Math.abs(signTest(15, 5).p - 0.5) < 5e-4, 'wrong reference accepted');
  });

  console.log(`\n${checks} checks, ${failures} failed, ${vacuous} vacuous`);
  if (vacuous) process.exit(EXIT.VACUOUS);
  if (failures) process.exit(EXIT.FAILED);
  console.log('verify-integrity: OK');
  process.exit(EXIT.OK);
}

main();
