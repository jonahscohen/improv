/**
 * Brief loader for the efficacy trial. FAIL-CLOSED.
 *
 * The brief set is FROZEN by PREREGISTRATION.md section 1: every `*.md` in
 * sidecoach/eval/corpus/briefs EXCEPT the `_`-prefixed spec files, the three architect-authored
 * `calib-*` briefs, and (per AMENDMENT 1, recorded pre-data) the three `real-govuk-*` briefs,
 * which do not conform to the corpus template and which `_spec.md` itself says to avoid because a
 * design-system pattern page carries that system's implied right answer. That filter is implemented here once so no caller can quietly widen or narrow
 * the population.
 *
 * The parser is deliberately dumb: it reads the `key: value` lines and the bulleted blocks the
 * briefs already use and NEVER invents, normalises or rewords a value. If a required field is
 * missing the loader throws rather than substituting a default - a silently defaulted brief would
 * put words in the corpus that its Codex author did not write.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TRIAL_ROOT = path.dirname(HERE);
export const SIDECOACH_ROOT = path.dirname(TRIAL_ROOT);
export const BRIEF_DIR = path.join(SIDECOACH_ROOT, 'eval', 'corpus', 'briefs');

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** The frozen population filter. Exported so a test can assert it, not re-implement it. */
export const isTrialBrief = (file) =>
  file.endsWith('.md') && !file.startsWith('_') && !file.startsWith('calib-') && !file.startsWith('real-govuk-');

const SCALARS = ['title', 'register', 'aestheticStyle', 'audience', 'goal'];
const LISTS = ['requiredContent', 'constraints', 'successCriteria'];

/**
 * Parse one brief. Returns { id, file, raw, sha256, title, register, aestheticStyle, audience,
 * goal, requiredContent[], constraints[], successCriteria[], brandToneInWords|null }.
 */
export function parseBrief(file) {
  const full = path.join(BRIEF_DIR, file);
  const raw = readFileSync(full, 'utf8');
  const lines = raw.split('\n');
  const out = { id: file.replace(/\.md$/, ''), file, raw, sha256: sha256(raw) };
  for (const k of LISTS) out[k] = [];

  let listKey = null;
  for (const line of lines) {
    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet && listKey) { out[listKey].push(bullet[1].trim()); continue; }
    const kv = /^([A-Za-z][A-Za-z]*):\s*(.*)$/.exec(line);
    if (!kv) { if (line.trim() === '') continue; listKey = null; continue; }
    const [, key, value] = kv;
    if (LISTS.includes(key)) { listKey = key; if (value.trim()) out[key].push(value.trim()); continue; }
    listKey = null;
    if (SCALARS.includes(key)) out[key] = value.trim();
  }

  for (const k of SCALARS) {
    if (!out[k]) throw new Error(`brief ${file}: required scalar field "${k}" is missing or empty`);
  }
  for (const k of LISTS) {
    if (out[k].length === 0) throw new Error(`brief ${file}: required list field "${k}" is empty`);
  }

  // The brief's own brand-tone constraint, VERBATIM, or null. Never synthesised.
  const tone = out.constraints.find((c) => /^brand-tone-in-words:/i.test(c));
  out.brandToneInWords = tone ? tone.replace(/^brand-tone-in-words:\s*/i, '').trim() : null;
  return out;
}

/** The frozen, sorted trial population. Throws if it is not exactly the expected size. */
export function loadTrialBriefs({ expect = 17 } = {}) {
  const files = readdirSync(BRIEF_DIR).filter(isTrialBrief).sort();
  if (files.length !== expect) {
    throw new Error(`brief population is ${files.length}, pre-registration froze it at ${expect} - refusing to run on a changed corpus`);
  }
  return files.map(parseBrief);
}
