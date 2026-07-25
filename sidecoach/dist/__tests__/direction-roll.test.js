"use strict";
// sidecoach/src/__tests__/direction-roll.test.ts
//
// Contract for the Stage 2c outside-ranking roll: bin/sidecoach-roll.js + src/direction-deck.ts.
//
// The load-bearing properties are three STRUCTURAL invariants (each holds for EVERY seed, because they are
// properties of the pool filter, not of the random pick):
//   1. Outside-ranking - the draw is NEVER the model-top (the id ranked last).
//   2. No-repeat re-roll - the draw is NEVER a previously excluded id.
//   3. Full-sweep termination - accumulating excludes visits every non-model-top direction exactly once, then
//      reports exhausted.
// Plus DETERMINISM: same (seed, model-top, exclude) => same draw, byte-identical through the binary.
//
// These are proven two ways:
//   1. PURE (always runs, no build needed): roll() / mixSeed() / resolveModelTopId() directly on src, plus the
//      CLI's parseArgs. The bin lazy-loads dist, so require-ing it for parseArgs does NOT force a built dist.
//   2. E2E (build-gated): the real binary over dist/direction-deck.js. Skips gracefully with a warning if dist
//      is not built (bare `ts-node` without `npm run build`); under `npm test` the build runs first, so it
//      runs for real in the committed gate.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const direction_deck_1 = require("../direction-deck");
const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-roll.js');
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function runCli(args) {
    let code = 0;
    let stdout = '';
    let stderr = '';
    try {
        stdout = (0, child_process_1.execFileSync)('node', [BIN, ...args], {
            encoding: 'utf8', cwd: SC, stdio: ['ignore', 'pipe', 'pipe'],
        });
    }
    catch (e) {
        const err = e;
        code = typeof err.status === 'number' ? err.status : -1;
        stdout = err.stdout ?? '';
        stderr = err.stderr ?? '';
    }
    return { code, stdout, stderr };
}
// ---------------------------------------------------------------------------
// 1. Deck integrity: unique ids, well-formed entries, model-default present.
// ---------------------------------------------------------------------------
function testDeckIntegrity() {
    assert(direction_deck_1.DIRECTION_DECK.length >= 12, `deck should be a small curated set (>=12), got ${direction_deck_1.DIRECTION_DECK.length}`);
    const ids = (0, direction_deck_1.deckIds)();
    assert(new Set(ids).size === ids.length, 'every direction id must be unique');
    assert(ids.includes(direction_deck_1.MODEL_DEFAULT_ID), 'MODEL_DEFAULT_ID must be a real deck entry');
    for (const d of direction_deck_1.DIRECTION_DECK) {
        assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id), `id "${d.id}" must be kebab-case`);
        assert(d.name.length > 0, `direction ${d.id} needs a name`);
        assert(d.premise.length > 0, `direction ${d.id} needs a premise`);
        assert(Array.isArray(d.moves) && d.moves.length >= 3, `direction ${d.id} needs >=3 concrete moves`);
        assert(d.avoid.length > 0, `direction ${d.id} needs an avoid`);
    }
    assert((0, direction_deck_1.directionById)(direction_deck_1.MODEL_DEFAULT_ID) !== undefined, 'directionById resolves the default');
    assert((0, direction_deck_1.directionById)('not-a-real-id') === undefined, 'directionById returns undefined for a non-deck id');
}
// ---------------------------------------------------------------------------
// 2. RNG + seed folding: deterministic, order-independent, seed-sensitive.
// ---------------------------------------------------------------------------
function testRngAndSeed() {
    // mulberry32 is deterministic and stays in [0, 1).
    const a = (0, direction_deck_1.mulberry32)(42);
    const b = (0, direction_deck_1.mulberry32)(42);
    for (let i = 0; i < 100; i++) {
        const va = a();
        const vb = b();
        assert(va === vb, 'mulberry32 must be deterministic for a fixed seed');
        assert(va >= 0 && va < 1, `mulberry32 output must be in [0,1), got ${va}`);
    }
    // mixSeed folds the exclusion SET order-independently, and an empty set is the base seed.
    assert((0, direction_deck_1.mixSeed)(42, []) === (42 >>> 0), 'mixSeed with no excludes returns the base seed');
    assert((0, direction_deck_1.mixSeed)(42, ['a', 'b', 'c']) === (0, direction_deck_1.mixSeed)(42, ['c', 'b', 'a']), 'mixSeed is order-independent over the exclusion set');
    assert((0, direction_deck_1.mixSeed)(42, ['a', 'b']) !== (0, direction_deck_1.mixSeed)(42, ['a', 'b', 'c']), 'a different exclusion set changes the seed');
    assert((0, direction_deck_1.mixSeed)(42, []) !== (0, direction_deck_1.mixSeed)(43, []), 'a different base seed changes the fold');
}
// ---------------------------------------------------------------------------
// 3. resolveModelTopId + unknownIds - fail-loud id validation.
// ---------------------------------------------------------------------------
function testResolveAndValidate() {
    assert((0, direction_deck_1.resolveModelTopId)(undefined) === direction_deck_1.MODEL_DEFAULT_ID, 'no explicit model-top => the default-instinct id');
    assert((0, direction_deck_1.resolveModelTopId)(null) === direction_deck_1.MODEL_DEFAULT_ID, 'null model-top => the default-instinct id');
    assert((0, direction_deck_1.resolveModelTopId)('') === direction_deck_1.MODEL_DEFAULT_ID, 'empty model-top => the default-instinct id');
    const someOther = (0, direction_deck_1.deckIds)().find((id) => id !== direction_deck_1.MODEL_DEFAULT_ID);
    assert((0, direction_deck_1.resolveModelTopId)(someOther) === someOther, 'a valid explicit model-top is respected');
    let threw = false;
    try {
        (0, direction_deck_1.resolveModelTopId)('does-not-exist');
    }
    catch {
        threw = true;
    }
    assert(threw, 'an unknown explicit model-top must throw (fail loud)');
    assert((0, direction_deck_1.unknownIds)([]).length === 0, 'no ids => nothing unknown');
    assert((0, direction_deck_1.unknownIds)((0, direction_deck_1.deckIds)()).length === 0, 'every deck id is known');
    assert((0, direction_deck_1.unknownIds)([someOther, 'nope', 'also-nope']).sort().join(',') === 'also-nope,nope', 'unknownIds flags exactly the non-deck ids');
}
// ---------------------------------------------------------------------------
// 4. Determinism: same seed => same draw; the roll actually varies across seeds.
// ---------------------------------------------------------------------------
function testDeterminism() {
    const one = (0, direction_deck_1.roll)({ seed: 42, modelTopId: direction_deck_1.MODEL_DEFAULT_ID });
    const two = (0, direction_deck_1.roll)({ seed: 42, modelTopId: direction_deck_1.MODEL_DEFAULT_ID });
    assert(one.status === 'drawn' && two.status === 'drawn', 'a fresh roll draws');
    assert(one.draw.id === two.draw.id, 'same seed must yield the same draw');
    assert(JSON.stringify(one) === JSON.stringify(two), 'same inputs => byte-identical outcome');
    // It must be a real roll, not a constant: across many seeds the draw takes more than one value.
    const seen = new Set();
    for (let s = 0; s < 80; s++)
        seen.add((0, direction_deck_1.roll)({ seed: s, modelTopId: direction_deck_1.MODEL_DEFAULT_ID }).draw.id);
    assert(seen.size > 1, `the roll must vary across seeds, saw only ${seen.size} distinct draw(s)`);
}
// ---------------------------------------------------------------------------
// 4b. Seed domain: roll canonicalizes the seed as UNSIGNED 32-bit (the echoed seed round-trips as re-runnable).
// ---------------------------------------------------------------------------
function testSeedDomain() {
    // A seed at or above 2^31 must be echoed unsigned, never surfaced as a negative (which the CLI would reject).
    const hi = (0, direction_deck_1.roll)({ seed: 2147483648, modelTopId: direction_deck_1.MODEL_DEFAULT_ID });
    assert(hi.seed === 2147483648, `seed 2^31 must echo unsigned, got ${hi.seed}`);
    const max = (0, direction_deck_1.roll)({ seed: 0xffffffff, modelTopId: direction_deck_1.MODEL_DEFAULT_ID });
    assert(max.seed === 0xffffffff, `seed 2^32-1 must echo unchanged, got ${max.seed}`);
    // Deterministic at the boundary, and the signed twin bit-pattern draws identically (same 32-bit seed).
    assert((0, direction_deck_1.roll)({ seed: 2147483648, modelTopId: direction_deck_1.MODEL_DEFAULT_ID }).draw.id === hi.draw.id, 'high seed is deterministic');
    assert((0, direction_deck_1.roll)({ seed: 0, modelTopId: direction_deck_1.MODEL_DEFAULT_ID }).status === 'drawn', 'seed 0 is a valid seed');
}
// ---------------------------------------------------------------------------
// 5. Outside-ranking: the draw is NEVER the model-top, default OR overridden.
// ---------------------------------------------------------------------------
function testOutsideRanking() {
    for (let s = 0; s < 300; s++) {
        const out = (0, direction_deck_1.roll)({ seed: s, modelTopId: direction_deck_1.MODEL_DEFAULT_ID });
        assert(out.draw.id !== direction_deck_1.MODEL_DEFAULT_ID, `seed ${s}: draw must be outside the default model-top`);
        assert(!out.eligibleIds.includes(direction_deck_1.MODEL_DEFAULT_ID), 'the model-top must not appear in the eligible pool');
    }
    // With an explicit model-top the drawn id is never that id, and the former default is now eligible.
    const top = 'editorial-print';
    let sawDefaultDrawn = false;
    for (let s = 0; s < 300; s++) {
        const out = (0, direction_deck_1.roll)({ seed: s, modelTopId: top });
        assert(out.draw.id !== top, `seed ${s}: draw must be outside the overridden model-top`);
        if (out.draw.id === direction_deck_1.MODEL_DEFAULT_ID)
            sawDefaultDrawn = true;
    }
    assert(sawDefaultDrawn, 'with a different model-top, the former default-instinct becomes drawable');
}
// ---------------------------------------------------------------------------
// 6. Exclusion re-roll: never a used id, and never the model-top even with excludes.
// ---------------------------------------------------------------------------
function testExclusion() {
    const first = (0, direction_deck_1.roll)({ seed: 42, modelTopId: direction_deck_1.MODEL_DEFAULT_ID }).draw.id;
    for (let s = 0; s < 300; s++) {
        const out = (0, direction_deck_1.roll)({ seed: s, modelTopId: direction_deck_1.MODEL_DEFAULT_ID, exclude: [first] });
        assert(out.draw.id !== first, `seed ${s}: a re-roll must not return the excluded prior draw`);
        assert(out.draw.id !== direction_deck_1.MODEL_DEFAULT_ID, `seed ${s}: a re-roll must still never return the model-top`);
        assert(out.excluded.includes(first) && out.excluded.includes(direction_deck_1.MODEL_DEFAULT_ID), 'the applied exclusion set includes both the prior draw and the model-top');
    }
    // A larger exclusion set: a used id passed in any order is never returned.
    const twoDraws = [first, (0, direction_deck_1.roll)({ seed: 1, modelTopId: direction_deck_1.MODEL_DEFAULT_ID, exclude: [first] }).draw.id];
    for (let s = 0; s < 200; s++) {
        const out = (0, direction_deck_1.roll)({ seed: s, modelTopId: direction_deck_1.MODEL_DEFAULT_ID, exclude: [...twoDraws].reverse() });
        assert(!twoDraws.includes(out.draw.id), `seed ${s}: no excluded id may be redrawn regardless of order`);
        assert(out.draw.id !== direction_deck_1.MODEL_DEFAULT_ID, 'model-top still excluded');
    }
}
// ---------------------------------------------------------------------------
// 7. Full-deck sweep: no repeats, visits every non-model-top exactly once, then exhausts.
// ---------------------------------------------------------------------------
function sweep(seed, modelTopId) {
    const seen = new Set();
    const visited = [];
    let exclude = [];
    let steps = 0;
    for (;;) {
        const out = (0, direction_deck_1.roll)({ seed, modelTopId, exclude });
        if (out.status === 'exhausted') {
            assert(out.draw === null, 'an exhausted roll must carry no draw');
            break;
        }
        const id = out.draw.id;
        assert(id !== modelTopId, 'sweep: never the model-top');
        assert(!seen.has(id), `sweep: repeated a used id (${id})`);
        assert(!exclude.includes(id), 'sweep: drew an excluded id');
        seen.add(id);
        visited.push(id);
        exclude = [...exclude, id];
        steps++;
        assert(steps <= direction_deck_1.DIRECTION_DECK.length + 1, 'sweep must terminate');
    }
    return { visited, steps };
}
function testFullSweep() {
    const expected = direction_deck_1.DIRECTION_DECK.length - 1; // everything except the model-top
    const s1 = sweep(42, direction_deck_1.MODEL_DEFAULT_ID);
    assert(s1.steps === expected, `sweep must draw every non-model-top once (expected ${expected}, got ${s1.steps})`);
    assert(new Set(s1.visited).size === expected, 'sweep visits are all distinct');
    assert(!s1.visited.includes(direction_deck_1.MODEL_DEFAULT_ID), 'sweep never includes the model-top');
    // Independent of the seed, the SET of visited directions is the whole deck minus the model-top.
    const s2 = sweep(7, direction_deck_1.MODEL_DEFAULT_ID);
    assert([...new Set(s2.visited)].sort().join(',') === (0, direction_deck_1.deckIds)().filter((id) => id !== direction_deck_1.MODEL_DEFAULT_ID).sort().join(','), 'a sweep covers exactly the deck minus the model-top');
    // With an overridden model-top the sweep covers the deck minus THAT id (including the former default).
    const top = 'swiss-objective';
    const s3 = sweep(99, top);
    assert(s3.visited.includes(direction_deck_1.MODEL_DEFAULT_ID), 'with an override, the sweep includes the former default');
    assert(!s3.visited.includes(top), 'the sweep excludes the overridden model-top');
    assert(s3.steps === expected, 'sweep length is deck-minus-one for any model-top');
}
// ---------------------------------------------------------------------------
// 8. CLI arg parsing (pure) - exported parseArgs + exit constants.
// ---------------------------------------------------------------------------
function testParseArgs() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli = require(BIN);
    const a = cli.parseArgs(['--seed', '42', '--model-top', 'editorial-print', '--exclude', 'quiet-minimal,warm-analog', '--quiet']);
    assert(a.seed === 42, 'parseArgs reads --seed as an int');
    assert(a.modelTop === 'editorial-print', 'parseArgs reads --model-top');
    assert(a.exclude.join(',') === 'quiet-minimal,warm-analog', 'parseArgs splits a comma exclude list');
    assert(a.quiet === true, 'parseArgs reads --quiet');
    const b = cli.parseArgs(['--exclude', 'a', '--exclude', 'b']);
    assert(b.exclude.join(',') === 'a,b', '--exclude is repeatable and accumulates');
    const c = cli.parseArgs([]);
    assert(c.seed === null && c.exclude.length === 0 && c.list === false, 'defaults: no seed, empty exclude, not listing');
    const d = cli.parseArgs(['--seed', '4294967295']);
    assert(d.seed === 0xffffffff, 'parseArgs accepts the max unsigned 32-bit seed');
    assert(cli.EXIT_DRAWN === 0 && cli.EXIT_USAGE === 2 && cli.EXIT_EXHAUSTED === 3, 'exit constants are the documented distinct classes');
}
// ---------------------------------------------------------------------------
// 9. E2E through the real binary (build-gated: skips gracefully if dist is absent).
// ---------------------------------------------------------------------------
function distReady() {
    // --list loads dist before it can print. If dist is unbuilt the bin exits 2 with a build hint.
    return runCli(['--list']).code === 0;
}
function testE2E() {
    if (!distReady()) {
        console.warn('direction-roll: SKIP e2e (dist/direction-deck.js not built; pure invariants already verified above)');
        return;
    }
    // (a) Determinism: two identical seeded runs are byte-identical on stdout, exit 0.
    const r1 = runCli(['--seed', '42', '--quiet']);
    const r2 = runCli(['--seed', '42', '--quiet']);
    assert(r1.code === 0, `a seeded roll must exit 0, got ${r1.code}\n${r1.stderr.slice(0, 300)}`);
    assert(r1.stdout === r2.stdout, 'same seed must yield byte-identical stdout');
    const o1 = JSON.parse(r1.stdout);
    assert(o1.status === 'drawn' && o1.draw && o1.draw.id, 'a roll emits a drawn result with a direction');
    assert(o1.draw.id !== o1.modelTop, 'e2e: the drawn id is outside the model-top');
    assert(o1.seedSource === 'provided' && o1.seed === 42, 'a provided seed is echoed as provided');
    // (b) Re-roll excluding the prior draw: never the used id, never the model-top.
    const r3 = runCli(['--seed', '42', '--exclude', o1.draw.id, '--quiet']);
    assert(r3.code === 0, 're-roll exits 0');
    const o3 = JSON.parse(r3.stdout);
    assert(o3.draw.id !== o1.draw.id, 'e2e: re-roll does not return the excluded prior draw');
    assert(o3.draw.id !== o3.modelTop, 'e2e: re-roll is still outside the model-top');
    assert(o3.excluded.includes(o1.draw.id), 'e2e: the excluded prior draw is recorded in the applied set');
    // (c) An explicit --model-top is ranked last and never drawn.
    const r4 = runCli(['--seed', '5', '--model-top', 'editorial-print', '--quiet']);
    const o4 = JSON.parse(r4.stdout);
    assert(o4.modelTop === 'editorial-print' && o4.draw.id !== 'editorial-print', 'e2e: explicit model-top is never the draw');
    // (d) Unknown --model-top and unknown --exclude both fail loud with exit 2, no result JSON.
    const badTop = runCli(['--seed', '1', '--model-top', 'nope-not-real', '--quiet']);
    assert(badTop.code === 2, `unknown model-top must exit 2, got ${badTop.code}`);
    assert(badTop.stdout.trim() === '', 'a usage error emits no result JSON');
    const badExc = runCli(['--seed', '1', '--exclude', 'quiet-minimal,ghost-id', '--quiet']);
    assert(badExc.code === 2, `unknown exclude id must exit 2, got ${badExc.code}`);
    assert(/ghost-id/.test(badExc.stderr), 'the offending exclude id is named on stderr');
    // (e) Seed domain, fail-loud: a non-integer, an out-of-range, and a negative seed are all usage errors (2),
    //     while a seed at/above 2^31 is VALID and round-trips unsigned (never echoed as a mangled/negative value).
    const badSeed = runCli(['--seed', 'not-a-number', '--quiet']);
    assert(badSeed.code === 2, `a non-integer seed must exit 2, got ${badSeed.code}`);
    const overSeed = runCli(['--seed', '4294967297', '--quiet']);
    assert(overSeed.code === 2, `an out-of-range seed must exit 2 (never silent coercion), got ${overSeed.code}`);
    assert(overSeed.stdout.trim() === '', 'an out-of-range seed emits no result JSON');
    const negSeed = runCli(['--seed', '-1', '--quiet']);
    assert(negSeed.code === 2, `a negative seed must exit 2, got ${negSeed.code}`);
    const hiSeed = runCli(['--seed', '2147483648', '--quiet']);
    assert(hiSeed.code === 0, `a seed at 2^31 is valid, got ${hiSeed.code}`);
    const oHi = JSON.parse(hiSeed.stdout);
    assert(oHi.seed === 2147483648, `a high seed must echo unsigned (re-runnable), got ${oHi.seed}`);
    assert(runCli(['--seed', '2147483648', '--quiet']).stdout === hiSeed.stdout, 'a high seed is deterministic');
    // (f) Exhaustion: exclude every non-model-top id => exit 3, draw null, no false draw.
    const allButTop = (0, direction_deck_1.deckIds)().filter((id) => id !== direction_deck_1.MODEL_DEFAULT_ID);
    const exh = runCli(['--seed', '7', '--exclude', allButTop.join(','), '--quiet']);
    assert(exh.code === 3, `an exhausted pool must exit 3, got ${exh.code}`);
    const oExh = JSON.parse(exh.stdout);
    assert(oExh.status === 'exhausted' && oExh.draw === null, 'exhausted result carries a null draw, never a fallback');
    assert(exh.code !== 0, 'exhausted must never look like a successful draw');
    // (g) --list is a query mode: exit 0, a listing (not a result JSON).
    const list = runCli(['--list']);
    assert(list.code === 0, '--list exits 0');
    assert(/direction deck:/.test(list.stdout) && !/"status"/.test(list.stdout), '--list prints a listing, not a result JSON');
}
function main() {
    testDeckIntegrity();
    testRngAndSeed();
    testResolveAndValidate();
    testDeterminism();
    testSeedDomain();
    testOutsideRanking();
    testExclusion();
    testFullSweep();
    testParseArgs();
    testE2E();
    console.log('direction-roll: OK (deck integrity, deterministic seeded RNG, fail-loud id validation, determinism, unsigned seed domain, outside-ranking, exclusion re-roll, full-sweep no-repeat + exhaustion, CLI parse + e2e)');
}
main();
//# sourceMappingURL=direction-roll.test.js.map