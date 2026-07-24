// sidecoach/src/__tests__/typeface-vocabulary.test.ts
//
// SINGLE-SOURCE GUARD for the default-typeface system-font vocabulary (Stage 4a).
//
// The vocabulary lives in ONE place: reference-data.ts SYSTEM_FONT_STACK_FAMILIES, the concrete expansion of
// the font catalog's `system_fonts` entry. The detector cannot import it - inPageTypeface is serialized into
// the browser by page.evaluate and must be self-contained - so it carries a verbatim inline copy. That is the
// only duplication the render model permits, and an unnoticed divergence between the two would silently change
// what the shipping detector considers "a chosen typeface" while the declared vocabulary said otherwise.
//
// This test extracts the inlined SYSTEM_FAMILIES literal from the scanner SOURCE and asserts set equality with
// the exported vocabulary. Drift is a test failure, not a silent detector change.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SYSTEM_FONT_STACK_FAMILIES } from '../reference-data';
import { inPageTypeface } from '../validators/subjective-rendered-scanner';

function run(): void {
  const src = readFileSync(path.resolve(__dirname, '..', 'validators', 'subjective-rendered-scanner.ts'), 'utf8');

  // The inlined literal: `const SYSTEM_FAMILIES = new Set([ ... ]);` inside inPageTypeface.
  const m = src.match(/const SYSTEM_FAMILIES = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error('could not locate the inlined SYSTEM_FAMILIES literal in subjective-rendered-scanner.ts');
  const inlined = Array.from(m[1].matchAll(/'([^']+)'/g)).map((x) => x[1]);
  if (inlined.length === 0) throw new Error('the inlined SYSTEM_FAMILIES literal parsed as empty');

  const declared = [...SYSTEM_FONT_STACK_FAMILIES];
  const a = new Set(inlined), b = new Set(declared);
  const onlyInline = inlined.filter((f) => !b.has(f));
  const onlyDeclared = declared.filter((f) => !a.has(f));
  if (onlyInline.length || onlyDeclared.length) {
    throw new Error(
      'default-typeface vocabulary DRIFT between reference-data.ts and the inlined scanner copy:\n' +
      (onlyInline.length ? `  only in the scanner: ${onlyInline.join(', ')}\n` : '') +
      (onlyDeclared.length ? `  only in reference-data: ${onlyDeclared.join(', ')}\n` : ''),
    );
  }
  if (a.size !== inlined.length) throw new Error('the inlined SYSTEM_FAMILIES literal contains duplicate entries');
  if (b.size !== declared.length) throw new Error('SYSTEM_FONT_STACK_FAMILIES contains duplicate entries');

  // Vocabulary invariants that keep the class honest (each one is a decision, not a coincidence).
  const must = ['system-ui', 'ui-sans-serif', 'sans-serif', 'serif', 'monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica', 'times', 'georgia', 'verdana'];
  for (const f of must) if (!b.has(f)) throw new Error(`vocabulary is missing the required default family '${f}'`);
  // DELIBERATE EXCLUSIONS: real downloadable typefaces that only ever appear MID-stack in the system
  // boilerplate. Because the detector classifies on the LEADING family, excluding them costs nothing on a
  // genuine system stack, and including them would fire on pages that self-host these as their chosen face.
  const mustNot = ['roboto', 'noto sans', 'ubuntu', 'cantarell', 'fira sans', 'oxygen', 'droid sans', 'inter', 'poppins'];
  for (const f of mustNot) if (b.has(f)) throw new Error(`'${f}' must NOT be in the default vocabulary (it is a chosen typeface, see the reference-data comment)`);
  for (const f of declared) if (f !== f.trim().toLowerCase()) throw new Error(`vocabulary entry '${f}' must be pre-normalized (trimmed + lowercase) to match normFamily output`);

  if (typeof inPageTypeface !== 'function') throw new Error('inPageTypeface must be exported for page.evaluate');

  console.log(`typeface-vocabulary: OK (${declared.length} families, scanner copy identical, exclusions intact)`);
}

run();
