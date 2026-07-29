/**
 * LENGTH-MATCHED PLACEBO PAYLOAD (PREREGISTRATION.md section 2.1).
 *
 * WHY IT EXISTS. Codex's first review of this trial's design rejected the two-arm version
 * outright: the sidecoach arm's prompt is far longer than the control's, so a sidecoach win could
 * be a length/salience effect with nothing to do with sidecoach. The placebo arm receives an
 * appended block matched to the sidecoach payload on line count, CHARACTER count, imperative
 * voice, sectioned structure and framing - but carrying NO design content.
 *
 * Matching is on CHARACTERS, not whitespace-delimited words. A first version matched words and
 * landed at 4164 vs 4164 while the two payloads were 32457 and 25374 characters - a 28% length
 * gap in the units a tokeniser actually charges for, which is the very confound this arm exists
 * to remove. Caught and fixed before any page was generated.
 *
 * WHO WROTE IT. I did, and PREREGISTRATION.md 2.1 records that as this trial's weakest link.
 * There was no zero-authorship option: word-shuffling the sidecoach payload yields gibberish (an
 * actively harmful placebo, biased toward sidecoach) and the repo's vendored external design
 * references are part of the corpus sidecoach's own guidance derives from (neither neutral nor
 * independent).
 *
 * BIAS DIRECTION, per Codex's second pass: software-engineering advice is not perfectly
 * orthogonal to building a page - testing, error handling and documentation do bear on
 * implementation quality - so this may help the placebo arm slightly, biasing AGAINST sidecoach.
 * Working the other way and more strongly, it contains no design advice at all, so sidecoach's
 * bar here is easier than it would be against real generic design advice.
 *
 * The tiler is DETERMINISTIC: same targets in, same bytes out. No seed, no randomness.
 */

/** Seed sections. Software-engineering practice only. No layout, colour, type, motion or copy advice. */
const SEED = [
  ['Version Control Discipline', [
    'Commit in small, self-contained units that each leave the tree in a working state',
    'Write the commit subject as the change, not the file that changed',
    'Never mix a refactor and a behaviour change in one commit',
    'Rebase local work before integrating rather than merging noise into history',
    'Tag anything a downstream consumer might need to pin',
    'Keep generated artefacts out of version control unless reproducing them is expensive',
    'Record the reason for a revert in the revert itself',
    'Branch names describe the work, not the ticket number alone',
  ]],
  ['Error Handling', [
    'Fail loudly and early; a silent fallback hides the defect that produced it',
    'Every failure class gets its own distinct exit code or error type',
    'Never catch an exception you cannot describe in the message you emit',
    'An empty result and an error are different outcomes and must not share a return shape',
    'Validate inputs at the boundary, then trust them inside it',
    'Include the offending value in the error, not just the fact that it was rejected',
    'A retry without a backoff is an outage amplifier',
    'Timeouts are a correctness property, not a tuning knob',
  ]],
  ['Testing Practice', [
    'A test that cannot fail proves nothing; mutate the code and confirm the assertion dies',
    'Test the contract at the seam, not the private helper behind it',
    'Fixtures belong next to the test that consumes them',
    'A flaky test is a broken test and is triaged like one',
    'Assert on behaviour, not on the shape of an intermediate value',
    'Cover the error paths at least as thoroughly as the happy path',
    'Keep the suite fast enough that nobody is tempted to skip it',
    'Deleting a test is a decision that needs the same review as deleting the code',
  ]],
  ['Documentation', [
    'Document the why in the source and the what in the interface',
    'A comment that restates the line above it is noise and should be removed',
    'Record the constraint that made a surprising decision necessary',
    'Keep the usage example runnable, and run it in the suite',
    'Name the failure modes a caller has to handle',
    'Update the doc in the same change as the code, never in a follow-up',
    'Prefer a short accurate note to a long aspirational one',
    'State the units, the ranges, and the ownership of every parameter',
  ]],
  ['Dependency Hygiene', [
    'Pin the versions you build against and record why each dependency is present',
    'Prefer the standard library when the standard library is sufficient',
    'A dependency added for one function is a liability, not a saving',
    'Audit transitive additions, not just direct ones',
    'Vendor anything whose upstream availability you cannot rely on',
    'Removing an unused dependency is a real improvement and needs no other justification',
    'Keep build-time and run-time dependencies separated',
    'Know the licence of everything you ship',
  ]],
  ['Code Review', [
    'Review the diff against the problem statement, not against your own preferences',
    'Ask a question when you do not understand rather than assuming a defect',
    'Block on correctness; comment on taste; never confuse the two',
    'A review that finds nothing should say what it checked',
    'Large changes get split before they get reviewed',
    'The author explains the reasoning; the reviewer verifies the claim',
    'Approve only what you would be willing to debug at 3am',
    'Re-review after a fold; the fix is code too',
  ]],
  ['Observability', [
    'Log at the boundary where a decision was made, not everywhere it is used',
    'Structured fields beat interpolated prose when something has to be searched later',
    'Never log a secret, a token, or a full payload that might contain one',
    'A metric without an owner will not be looked at',
    'Alert on symptoms a user would notice, not on internal thresholds',
    'Keep the noisy debug channel separate from the operational one',
    'Correlate work across processes with an identifier chosen at the entry point',
    'Sample high-volume traces rather than dropping them silently',
  ]],
  ['Configuration and Secrets', [
    'Configuration belongs outside the artefact that consumes it',
    'A missing required setting is a startup failure, not a default',
    'Secrets are read from the environment or a vault and never from the tree',
    'Make the safe configuration the default one',
    'Document every setting where it is defined, with its type and its effect',
    'Never branch on an environment name; branch on the capability you need',
    'Rotate anything that has ever been written to a log',
    'Keep local overrides out of the shared configuration file',
  ]],
  ['Performance Work', [
    'Measure before changing anything; an unprofiled optimisation is a guess',
    'Fix the algorithm before tuning the constant factor',
    'Record the benchmark alongside the change so a regression is visible',
    'Cache only what is expensive and stable, and state the invalidation rule',
    'Batch at the boundary that dominates, not at every boundary',
    'Do not trade correctness for speed without writing the trade down',
    'Watch allocation and I/O before watching CPU',
    'A speedup that nobody can reproduce did not happen',
  ]],
  ['Change Management', [
    'Make the change easy, then make the easy change',
    'Prefer a reversible step to a clever irreversible one',
    'Keep migrations forward-compatible so a rollback is survivable',
    'Ship behind a switch when the blast radius is wider than the test suite',
    'Delete dead code rather than commenting it out',
    'Leave the module better indexed than you found it',
    'Write the rollback procedure before you need it',
    'Announce a breaking change one release before it breaks',
  ]],
];

const HEADER = 'PROJECT GUIDANCE (ordered steps to execute)';

const countTokens = (s) => (s.match(/\S+/g) || []).length;

/**
 * Produce a placebo block of exactly `targetLines` lines whose token count is within
 * `tolerance` of `targetTokens`. Deterministic. Throws (never silently returns a mismatched
 * block) if the targets cannot be met - a placebo that is not length-matched is not a placebo.
 */
export function buildPlacebo({ targetLines, targetChars, tolerance = 0.02 }) {
  if (!Number.isInteger(targetLines) || targetLines < 4) throw new Error(`targetLines must be an integer >= 4, got ${targetLines}`);
  if (!Number.isInteger(targetChars) || targetChars < 4) throw new Error(`targetChars must be an integer >= 4, got ${targetChars}`);

  // Flatten the seed into a repeating line stream: section header, blank, bullets, blank...
  const stream = [];
  for (const [title, bullets] of SEED) {
    stream.push(`${title}:`);
    for (const b of bullets) stream.push(`- ${b}`);
    stream.push('');
  }

  const lines = [];
  for (let i = 0; lines.length < targetLines; i++) lines.push(stream[i % stream.length]);

  // Token match: pad the LAST non-empty bullet or trim from the tail of bullets until inside
  // tolerance. Padding uses more seed bullets, never invented text.
  // Converge from ABOVE onto the target rather than onto the +tolerance ceiling. An earlier
  // version used [target*0.9, target*1.1] and the trimmer stopped at the ceiling every time,
  // handing the placebo arm a systematic 10% length advantage - the exact confound this arm
  // exists to remove. Fixed before any page was generated.
  const lo = Math.round(targetChars * (1 - tolerance));
  const hi = targetChars;
  const total = () => lines.join('\n').length;

  // Too few tokens for the allotted lines: lengthen lines by appending a further seed clause.
  const allBullets = SEED.flatMap(([, b]) => b);
  let guard = 0;
  while (total() < lo) {
    if (guard++ > 100000) throw new Error('placebo tiler failed to reach the token floor');
    for (let i = 0; i < lines.length && total() < lo; i++) {
      if (lines[i].startsWith('- ')) lines[i] = `${lines[i]}; ${allBullets[(i + guard) % allBullets.length].toLowerCase()}`;
    }
  }
  // Too many tokens: shorten from the tail of the longest lines.
  guard = 0;
  while (total() > hi) {
    if (guard++ > 100000) throw new Error('placebo tiler failed to reach the token ceiling');
    let idx = -1, len = -1;
    for (let i = 0; i < lines.length; i++) { const l = countTokens(lines[i]); if (l > len) { len = l; idx = i; } }
    if (idx < 0 || len <= 3) throw new Error('placebo tiler cannot shorten further without emptying lines');
    lines[idx] = lines[idx].split(/\s+/).slice(0, -1).join(' ');
  }

  const chars = total();
  if (lines.length !== targetLines) throw new Error(`placebo line count ${lines.length} != target ${targetLines}`);
  if (chars < lo || chars > hi) throw new Error(`placebo char count ${chars} outside [${lo}, ${hi}]`);
  const body = lines.join('\n');
  return { header: HEADER, body, lines: lines.length, tokens: countTokens(body), chars };
}

export { HEADER as PLACEBO_HEADER, countTokens };
