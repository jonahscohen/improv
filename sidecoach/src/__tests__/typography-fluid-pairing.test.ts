// sidecoach/src/__tests__/typography-fluid-pairing.test.ts
//
// Guards the two long-tail typography guidance rules added for "capability breadth" (borrow-list
// reconciliation section 5, rows 20 + 21): font-pairing composition and clamp() fluid type-scale.
//
// These are GUIDANCE, not detectors: they live in SHARED_DESIGN_LAWS.typography.rules and reach building
// models verbatim, because flow-handler-design-tokens.ts and flow-handler-font-research.ts map that exact
// array into the guidance lines they emit. So this test proves three things a copy edit could silently
// break:
//   1. PRESENCE  - both rules are in the typography array, with their LOAD-BEARING clauses intact (the
//      clamp rule's mandatory-rem / WCAG-1.4.4 zoom caveat, without which the rule is actively harmful;
//      the pairing rule's two-family cap and concrete named pairings, without which it is vague).
//   2. CONSISTENCY - every human-face name in the pairing rule is ALSO named by the typeface-selection
//      rule. The two typography rules must not contradict each other about which faces count as "chosen".
//      Mirrors the single-source drift-guard in typeface-vocabulary.test.ts.
//   3. EMISSION   - the two consuming flow-handlers still map SHARED_DESIGN_LAWS.typography.rules into
//      their guidance, so any rule added to the array actually reaches a builder (membership == emission).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SHARED_DESIGN_LAWS } from '../design-laws';

function findRule(pred: (r: string) => boolean, label: string): string {
  const hit = SHARED_DESIGN_LAWS.typography.rules.find(pred);
  if (!hit) throw new Error(`typography.rules is missing the ${label} rule`);
  return hit;
}

// Prove a flow-handler MAPS AND EMITS typography.rules into its builder guidance, not merely that it
// mentions the array (a bare `rules: SHARED_DESIGN_LAWS.typography.rules` or a cached raw assignment must
// NOT satisfy this - Codex flagged that as a false pass). Both real handlers transform the array into
// `- ${rule}` lines and SPREAD the result into a guidance array; we require that exact map+spread shape in
// either of the two spellings they use:
//   direct  (design-tokens): `...SHARED_DESIGN_LAWS.typography.rules.map(...)`
//   aliased (font-research): `const D = SHARED_DESIGN_LAWS.typography; const G = D.rules.map(...); ...G`
// Tracing all hops means removing the emission (the spread) fails the guard even if a raw reference stays.
function assertEmitsTypographyRules(src: string, handlerName: string): void {
  // Direct form: mapped array spread inline into a guidance array.
  if (/\.\.\.\s*SHARED_DESIGN_LAWS\.typography\.rules\.map\(/.test(src)) return;

  // Aliased form: domain local -> mapped-guidance local -> spread of that local.
  const domain = src.match(/const\s+(\w+)\s*=\s*SHARED_DESIGN_LAWS\.typography\s*;/);
  if (domain) {
    const domainLocal = domain[1];
    const mapped = src.match(new RegExp(`const\\s+(\\w+)\\s*=\\s*${domainLocal}\\.rules\\.map\\(`));
    if (mapped) {
      const guidanceLocal = mapped[1];
      if (new RegExp(`\\.\\.\\.\\s*${guidanceLocal}\\b`).test(src)) return; // spread into a guidance array
    }
  }
  throw new Error(`${handlerName} does not map+spread typography.rules into guidance - added rules would not reach builders`);
}

// The characterful OS-installed faces the typeface-selection rule names as legitimate "chosen" faces.
// The pairing rule may name ONLY these (no invented faces, no system-monoculture members).
const ALLOWED_FACES = [
  'Iowan Old Style', 'Charter', 'Baskerville', 'Cambria', // serif
  'Optima', 'Avenir', 'Futura', 'Gill Sans',              // sans
];

function run(): void {
  const rules = SHARED_DESIGN_LAWS.typography.rules;
  if (!Array.isArray(rules) || rules.length === 0) throw new Error('SHARED_DESIGN_LAWS.typography.rules is empty');

  // --- 1a. clamp() fluid type-scale rule (row 21) ---------------------------------------------------
  const clampRule = findRule((r) => /\bclamp\(/.test(r) && /fluid/i.test(r), 'clamp() fluid type-scale');
  // The load-bearing accessibility clause: a clamp rule that omits the mandatory-rem / zoom caveat would
  // steer models toward pure-vw sizing, which defeats browser zoom. This assertion is the whole point.
  if (!/\brem\b/.test(clampRule)) throw new Error('clamp rule must require a rem term (pure vw defeats zoom)');
  if (!/pure-?vw/i.test(clampRule)) throw new Error('clamp rule must name the pure-vw failure mode');
  // Require the SPECIFIC criterion, not a bare "200%" that could appear incidentally (Codex Low).
  if (!/WCAG\s*1\.4\.4/.test(clampRule)) throw new Error('clamp rule must cite WCAG 1.4.4 (resize text) by number');
  if (!/\bvw\b/.test(clampRule)) throw new Error('clamp rule must show the viewport (vw) term');
  if (!/>=\s*1\.25|1\.25/.test(clampRule)) throw new Error('clamp rule must preserve the >=1.25 scale ratio at both ends');

  // --- 1b. font-pairing composition rule (row 20) ---------------------------------------------------
  const pairRule = findRule((r) => /\bpair(ing)?\b/i.test(r) && /typeface|face/i.test(r) && !/\bclamp\(/.test(r), 'font-pairing composition');
  // Anti-sprawl guarantee: the rule must cap the composition at two families, or it licenses typeface soup.
  if (!/third typeface is noise|cap it at two|at most two|no more than two/i.test(pairRule)) {
    throw new Error('pairing rule must cap the composition at two families (anti-sprawl clause missing)');
  }
  // Serif-with-sans contrast is the concrete borrow (cap-gap 14 "one sans + one serif").
  if (!/serif/i.test(pairRule) || !/sans/i.test(pairRule)) throw new Error('pairing rule must contrast serif with sans');
  // It must name CONCRETE pairings (at least two of the allowed faces appear), not just abstract advice.
  const named = ALLOWED_FACES.filter((f) => pairRule.includes(f));
  if (named.length < 2) throw new Error(`pairing rule must name concrete faces; found only [${named.join(', ')}]`);
  // NEGATIVE guard (Codex): the pairing rule must name NONE of the faces the typeface vocabulary rejects -
  // the system-monoculture members and the common downloadable faces excluded from the chosen-face set.
  // Without this, the rule could add 'Roboto' or 'Times New Roman' and still pass the concrete-faces check.
  const DISALLOWED_FACES = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Georgia', 'Verdana', 'Segoe UI',
    'Roboto', 'Inter', 'Poppins', 'Noto Sans', 'Ubuntu',
  ];
  for (const face of DISALLOWED_FACES) {
    if (new RegExp(`\\b${face.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(pairRule)) {
      throw new Error(`pairing rule names a non-sanctioned face '${face}' (system/monoculture/downloadable, not in the chosen-face vocabulary)`);
    }
  }

  // --- 2. CONSISTENCY: pairing rule names only faces the typeface-selection rule sanctions -----------
  const typefaceRule = findRule(
    (r) => /system stack|deliberately picked/i.test(r) && ALLOWED_FACES.every((f) => r.includes(f)),
    'typeface-selection (source of the sanctioned face vocabulary)',
  );
  // Extract capitalized multi-word face candidates from the pairing rule and confirm each is sanctioned.
  // (We only check names that look like the known faces to avoid tripping on ordinary Capitalized words.)
  for (const face of ALLOWED_FACES) {
    if (pairRule.includes(face) && !typefaceRule.includes(face)) {
      throw new Error(`pairing rule names '${face}' which the typeface-selection rule does not sanction (drift)`);
    }
  }
  // Guard the reverse failure a rename would cause: any characterful face the pairing rule mentions must be
  // spelled exactly as the typeface rule spells it. Catch a near-miss like "Gill sans" vs "Gill Sans".
  for (const face of ALLOWED_FACES) {
    const inPair = new RegExp(face.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(pairRule);
    if (inPair && !pairRule.includes(face)) {
      throw new Error(`pairing rule misspells the sanctioned face '${face}' (case/spelling drift)`);
    }
  }

  // --- 3. EMISSION: the consuming flow-handlers still map typography.rules to builder guidance ---------
  // Two spellings are both truthful emission: design-tokens uses the array directly
  // (`SHARED_DESIGN_LAWS.typography.rules`), font-research binds the domain to a local first
  // (`const typographyDomain = SHARED_DESIGN_LAWS.typography; ... typographyDomain.rules.map(...)`).
  // Accept either shape; reject a handler that references typography but never maps its rules.
  const handlers = ['flow-handler-design-tokens.ts', 'flow-handler-font-research.ts'];
  for (const h of handlers) {
    const src = readFileSync(path.resolve(__dirname, '..', h), 'utf8');
    assertEmitsTypographyRules(src, h);
  }

  console.log(
    `typography-fluid-pairing: OK (pairing names [${named.join(', ')}], clamp carries rem+WCAG-1.4.4 caveat, ` +
    `consistency vs typeface rule intact, emission via ${handlers.length} handlers)`,
  );
}

run();
