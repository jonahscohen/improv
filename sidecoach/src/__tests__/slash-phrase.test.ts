import * as path from 'path';
import * as assert from 'assert';
import { resolveSidecoachPhrase } from '../slash-command-router';

const LANES = path.resolve(__dirname, '..', '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json');

function check(phrase: string, kind: string, lane?: string) {
  const r = resolveSidecoachPhrase(phrase, LANES);
  assert.strictEqual(r.kind, kind, `${phrase} -> ${r.kind}`);
  if (lane) assert.strictEqual(r.lane, lane, `${phrase} lane`);
}

check('make this production-ready', 'ROUTE', 'lane_ship');        // SCOPE_UNKNOWN proceeds under explicit address
check('build the API from scratch', 'OUT_OF_SCOPE');               // positive negative evidence refuses
check('make the landing page production-ready', 'ROUTE', 'lane_ship');

// A known verb word typed as the command wins outright (existing command path).
const known = resolveSidecoachPhrase('polish the button', LANES);
assert.strictEqual(known.kind, 'ROUTE', `polish -> ${known.kind}`);
assert.strictEqual(known.command, 'polish', `polish command`);

// UNKNOWN: no lane evidence at all -> a BUILT near-miss suggestion. Assert the
// actual suggestion string, not merely kind==='UNKNOWN', so an empty stub FAILS.
const miss = resolveSidecoachPhrase('polsih the button', LANES);
assert.strictEqual(miss.kind, 'UNKNOWN', `polsih -> ${miss.kind}`);
assert.ok(
  miss.suggestion && /did you mean/i.test(miss.suggestion) && /\bpolish\b/i.test(miss.suggestion),
  `expected a "did you mean ... polish" near-miss suggestion, got: ${miss.suggestion}`,
);

// UNKNOWN with no plausible near-miss -> helpful UNKNOWN, no suggestion (a typo
// must NEVER become an interview/route).
const foo = resolveSidecoachPhrase('foo', LANES);
assert.strictEqual(foo.kind, 'UNKNOWN', `foo -> ${foo.kind}`);
assert.ok(!foo.lane && !foo.command, `foo must not route/command, got lane=${foo.lane} command=${foo.command}`);

console.log('slash-phrase: OK');
