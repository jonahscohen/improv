"use strict";
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
// sidecoach/src/__tests__/direction-deck-present.test.ts
//
// Contract for the Stage 2d exclusion-safe presentation: bin/sidecoach-deck.js + src/direction-deck-present.ts.
//
// The load-bearing properties:
//   1. Dual-surface: N distinct rolled directions present as a Markdown TABLE (text) and as a static HTML
//      ARTIFACT (rich), both carrying every direction.
//   2. HARD EXCLUSION: NO in-browser variant surface. The rich rendering is static HTML only - no network
//      server, no client runtime, no embedded preview frame, no variant-preview code path. This is proven by a
//      SELF-SOURCE scan of the bin + module (below) and by grepping the diff at review time.
//   3. Reuse-by-import: the deck comes from Stage 2c (direction-deck), imported, never re-authored here.
//
// Proven two ways (mirrors direction-roll.test.ts):
//   1. PURE (always runs, no build): resolveDirections + the two renderers directly on src, plus the CLI's
//      exported parseArgs / idsFromRollJson, plus the exclusion self-scan of the source files.
//   2. E2E (dist-gated): the real binary over dist/direction-deck-present.js; skips gracefully if unbuilt.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const direction_deck_present_1 = require("../direction-deck-present");
const direction_deck_1 = require("../direction-deck");
const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-deck.js');
const MODULE_SRC = path.join(SC, 'src', 'direction-deck-present.ts');
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
// Three real deck ids for the presentation tests (order is the presented order).
const IDS = (0, direction_deck_1.deckIds)().slice(0, 3);
function runCli(args, input) {
    let code = 0;
    let stdout = '';
    let stderr = '';
    try {
        stdout = (0, child_process_1.execFileSync)('node', [BIN, ...args], {
            encoding: 'utf8', cwd: SC,
            stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
            input,
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
// 1. resolveDirections - fail-loud on an unknown or duplicate id (never a silent drop on a decision surface).
// ---------------------------------------------------------------------------
function testResolve() {
    const ok = (0, direction_deck_present_1.resolveDirections)(IDS);
    assert(ok.directions.length === 3 && ok.unknown.length === 0 && ok.duplicates.length === 0, 'three known ids resolve cleanly');
    assert(ok.directions.map((d) => d.id).join(',') === IDS.join(','), 'resolved order matches the input order');
    const unknown = (0, direction_deck_present_1.resolveDirections)([IDS[0], 'ghost-id', 'also-ghost']);
    assert(unknown.unknown.join(',') === 'ghost-id,also-ghost', 'unknown ids are reported');
    assert(unknown.directions.length === 1, 'only the known id resolves');
    const dup = (0, direction_deck_present_1.resolveDirections)([IDS[0], IDS[0], IDS[1]]);
    assert(dup.duplicates.join(',') === IDS[0], 'a repeated id is flagged as a duplicate');
    assert(dup.directions.length === 2, 'a duplicate is not presented twice');
}
// ---------------------------------------------------------------------------
// 2. renderDeckMarkdown - a clean Markdown table + per-direction detail, all N directions present.
// ---------------------------------------------------------------------------
function testMarkdown() {
    const dirs = (0, direction_deck_present_1.resolveDirections)(IDS).directions;
    const md = (0, direction_deck_present_1.renderDeckMarkdown)(dirs, { title: 'Pick a direction' });
    assert(md.includes('## Pick a direction'), 'title heading present');
    assert(md.includes('| # | Direction | Axis | Premise |'), 'a Markdown table header is present');
    assert(md.includes('| --- | --- | --- | --- |'), 'the table divider row is present');
    // Every rolled direction shows up, by name AND id, exactly once as a numbered row.
    for (const d of dirs) {
        assert(md.includes(d.name), `markdown carries the name ${d.name}`);
        assert(md.includes(`\`${d.id}\``), `markdown carries the id ${d.id}`);
    }
    const rows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    assert(rows.length === dirs.length, `one numbered table row per direction (got ${rows.length}, want ${dirs.length})`);
    assert(md.includes('sidecoach-roll'), 're-roll instruction points back at Stage 2c');
    // It is Markdown, not HTML: no document tag.
    assert(!md.includes('<!doctype') && !md.includes('<html'), 'the text surface is Markdown, never an HTML document');
    // Determinism.
    assert((0, direction_deck_present_1.renderDeckMarkdown)(dirs, { title: 'Pick a direction' }) === md, 'markdown render is deterministic');
    // Inline sanitization: an external --title with a pipe/newline can never break the heading or the table -
    // the newline collapses to a space and the pipe is escaped.
    const injected = (0, direction_deck_present_1.renderDeckMarkdown)(dirs, { title: 'Bad | Title\nsecond line' });
    assert(injected.includes('## Bad \\| Title second line'), 'a title pipe is escaped and its newline collapsed onto one line');
}
// ---------------------------------------------------------------------------
// 3. renderDeckArtifactHtml - a self-contained, static, theme-aware artifact carrying all N directions.
// ---------------------------------------------------------------------------
// The exclusion applies to the emitted artifact string too: a runtime/server/preview surface would surface as
// one of these code tokens. English prose ("network server", "preview frame") never matches a code token.
const FORBIDDEN = ['createServer', '.listen(', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'fetch(', '<script', '<iframe', 'srcdoc'];
function testArtifact() {
    const dirs = (0, direction_deck_present_1.resolveDirections)(IDS).directions;
    const html = (0, direction_deck_present_1.renderDeckArtifactHtml)(dirs, { title: 'Pick a direction' });
    assert(html.startsWith('<!doctype html>'), 'the rich surface is a full HTML document');
    assert(/<title>Pick a direction<\/title>/.test(html), 'the artifact carries the title');
    // Theme-aware per the artifact contract (light/dark).
    assert(html.includes('prefers-color-scheme: dark') && html.includes('data-theme'), 'artifact is theme-aware (media query + data-theme override)');
    // Responsive: a fluid grid, no fixed pixel width on the body.
    assert(html.includes('grid-template-columns: repeat(auto-fill'), 'artifact uses a responsive fluid grid');
    // Every rolled direction is a card, by name and id.
    const cards = html.split('<article class="card">').length - 1;
    assert(cards === dirs.length, `one card per direction (got ${cards}, want ${dirs.length})`);
    for (const d of dirs) {
        assert(html.includes(d.name) && html.includes(d.id), `artifact carries ${d.id}`);
    }
    // EXCLUSION on the emitted artifact: it is inert static HTML - none of the runtime/network/frame tokens.
    for (const tok of FORBIDDEN) {
        assert(!html.includes(tok), `emitted artifact must be inert static HTML - found forbidden token ${JSON.stringify(tok)}`);
    }
    assert((0, direction_deck_present_1.renderDeckArtifactHtml)(dirs, { title: 'Pick a direction' }) === html, 'artifact render is deterministic');
}
// ---------------------------------------------------------------------------
// 4. EXCLUSION self-scan (the permanent guard): the bin + module source carry NO in-browser variant surface.
//    This is the "grep the diff for none" from the plan, baked into the committed gate so a future edit that
//    reintroduces a server / client runtime / preview frame fails this test.
// ---------------------------------------------------------------------------
function testExclusionSelfScan() {
    for (const file of [BIN, MODULE_SRC]) {
        const src = fs.readFileSync(file, 'utf8');
        for (const tok of FORBIDDEN) {
            assert(!src.includes(tok), `${path.basename(file)} must contain no in-browser-surface token, found ${JSON.stringify(tok)}`);
        }
        // Extra server/network guards beyond the shared list.
        for (const tok of ['http.createServer', 'net.createServer', 'require(\'http\')', 'require("http")', 'require(\'ws\')']) {
            assert(!src.includes(tok), `${path.basename(file)} must not open a network surface, found ${JSON.stringify(tok)}`);
        }
    }
}
// ---------------------------------------------------------------------------
// 5. idsFromRollJson (bin export) - collect draw ids from Stage 2c roll output (object / array / NDJSON).
// ---------------------------------------------------------------------------
function testIdsFromRollJson() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli = require(BIN);
    const one = cli.idsFromRollJson(JSON.stringify({ status: 'drawn', draw: { id: IDS[0] } }));
    assert(one.ids.join(',') === IDS[0] && one.malformed.length === 0, 'a single roll object yields its draw id');
    const arr = cli.idsFromRollJson(JSON.stringify([{ draw: { id: IDS[0] } }, { draw: { id: IDS[1] } }]));
    assert(arr.ids.join(',') === `${IDS[0]},${IDS[1]}` && arr.malformed.length === 0, 'a JSON array yields all draw ids in order');
    const ndjson = cli.idsFromRollJson(`${JSON.stringify({ draw: { id: IDS[0] } })}\n${JSON.stringify({ draw: { id: IDS[1] } })}`);
    assert(ndjson.ids.join(',') === `${IDS[0]},${IDS[1]}` && ndjson.malformed.length === 0, 'NDJSON stream yields all draw ids');
    const exhausted = cli.idsFromRollJson(JSON.stringify({ status: 'exhausted', draw: null }));
    assert(exhausted.ids.length === 0 && exhausted.malformed.length === 0, 'an exhausted roll (null draw) is valid-but-empty, not malformed');
    assert(cli.idsFromRollJson('').ids.length === 0 && cli.idsFromRollJson('  ').ids.length === 0, 'empty input yields no ids');
    // FAIL-LOUD (no silent drop): a non-blank unparseable payload / line is reported as malformed.
    const bad = cli.idsFromRollJson('not json at all');
    assert(bad.ids.length === 0 && bad.malformed.length === 1, 'a non-JSON payload is reported malformed, never silently empty');
    const mixed = cli.idsFromRollJson(`${JSON.stringify({ draw: { id: IDS[0] } })}\ngarbage-line`);
    assert(mixed.ids.join(',') === IDS[0] && mixed.malformed.length === 1, 'a malformed NDJSON line is flagged even when another line is valid');
}
// ---------------------------------------------------------------------------
// 6. CLI arg parsing (pure) - exported parseArgs + exit constants (valid parses; invalid-arg exits via E2E).
// ---------------------------------------------------------------------------
function testParseArgs() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli = require(BIN);
    const a = cli.parseArgs(['--ids', 'x,y', '--surface', 'rich', '--title', 'T', '--out', 'd.html', '--quiet']);
    assert(a.ids.join(',') === 'x,y' && a.surface === 'rich' && a.title === 'T' && a.out === 'd.html' && a.quiet === true, 'parseArgs reads all options');
    const b = cli.parseArgs(['--ids', 'a', '--ids', 'b']);
    assert(b.ids.join(',') === 'a,b', '--ids is repeatable and accumulates');
    const c = cli.parseArgs([]);
    assert(c.surface === 'text' && c.ids.length === 0, 'surface defaults to text; no ids by default');
    assert(cli.EXIT_OK === 0 && cli.EXIT_USAGE === 2, 'exit constants are the documented classes');
}
// ---------------------------------------------------------------------------
// 7. E2E through the real binary (dist-gated: skips gracefully if dist is absent).
// ---------------------------------------------------------------------------
function distReady() {
    return fs.existsSync(path.join(SC, 'dist', 'direction-deck-present.js')) && fs.existsSync(path.join(SC, 'dist', 'direction-deck.js'));
}
function testE2E() {
    if (!distReady()) {
        console.warn('direction-deck-present: SKIP e2e (dist not built; pure invariants + exclusion self-scan already verified above)');
        return;
    }
    const idsArg = IDS.join(',');
    // (a) text surface -> a Markdown table with all N directions, exit 0.
    const text = runCli(['--ids', idsArg, '--surface', 'text', '--quiet']);
    assert(text.code === 0, `text present must exit 0, got ${text.code}\n${text.stderr.slice(0, 300)}`);
    assert(text.stdout.includes('| # | Direction | Axis | Premise |'), 'e2e text: a Markdown table');
    for (const id of IDS)
        assert(text.stdout.includes(id), `e2e text: carries ${id}`);
    assert(!text.stdout.includes('<!doctype'), 'e2e text: never an HTML document');
    // (b) rich surface -> a static HTML artifact with all N directions, exit 0, and NONE of the forbidden tokens.
    const rich = runCli(['--ids', idsArg, '--surface', 'rich', '--quiet']);
    assert(rich.code === 0, `rich present must exit 0, got ${rich.code}`);
    assert(rich.stdout.startsWith('<!doctype html>'), 'e2e rich: an HTML document artifact');
    for (const id of IDS)
        assert(rich.stdout.includes(id), `e2e rich: carries ${id}`);
    for (const tok of FORBIDDEN)
        assert(!rich.stdout.includes(tok), `e2e rich: inert static HTML (no ${tok})`);
    // (c) rich --out writes the artifact to a file; stdout stays empty.
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-e2e-'));
    const outFile = path.join(outDir, 'deck.html');
    const richOut = runCli(['--ids', idsArg, '--surface', 'rich', '--out', outFile, '--quiet']);
    assert(richOut.code === 0 && fs.existsSync(outFile), 'e2e rich --out: the artifact file is written');
    assert(fs.readFileSync(outFile, 'utf8').startsWith('<!doctype html>'), 'e2e rich --out: file is the HTML artifact');
    assert(richOut.stdout.trim() === '', 'e2e rich --out: nothing on stdout when writing to a file');
    // (d) fail-loud: an unknown id and a duplicate id both exit 2 and name the offender.
    const badId = runCli(['--ids', `${IDS[0]},ghost-xyz`, '--quiet']);
    assert(badId.code === 2, `unknown id must exit 2, got ${badId.code}`);
    assert(/ghost-xyz/.test(badId.stderr), 'the unknown id is named on stderr');
    const dupId = runCli(['--ids', `${IDS[0]},${IDS[0]}`, '--quiet']);
    assert(dupId.code === 2, `duplicate id must exit 2, got ${dupId.code}`);
    // (e) a bad --surface value and an empty id set both exit 2.
    assert(runCli(['--ids', idsArg, '--surface', 'browser', '--quiet']).code === 2, 'an unknown surface must exit 2');
    assert(runCli(['--quiet']).code === 2, 'no ids and no stdin must exit 2');
    // (e2) --out is rich-only: pairing it with the text surface is a loud usage error, never silently ignored.
    assert(runCli(['--ids', idsArg, '--surface', 'text', '--out', path.join(outDir, 'nope.html'), '--quiet']).code === 2, '--out with --surface text must exit 2');
    // (e3) a malformed piped roll payload fails loud rather than presenting a partial deck.
    assert(runCli(['--surface', 'text', '--quiet'], 'not-json').code === 2, 'a malformed stdin payload must exit 2');
    // (f) stdin composition: piped Stage 2c roll JSON is presented (sidecoach-roll | sidecoach-deck).
    const rollJson = JSON.stringify({ status: 'drawn', draw: { id: IDS[0] } });
    const piped = runCli(['--surface', 'text', '--quiet'], rollJson);
    assert(piped.code === 0 && piped.stdout.includes(IDS[0]), 'e2e stdin: a piped roll result is presented');
}
function main() {
    testResolve();
    testMarkdown();
    testArtifact();
    testExclusionSelfScan();
    testIdsFromRollJson();
    testParseArgs();
    testE2E();
    console.log('direction-deck-present: OK (resolve fail-loud, dual-surface markdown+artifact, exclusion self-scan, roll-json ids, CLI parse + e2e)');
}
main();
// Reference the imported deck so an unused-import pass stays quiet.
void direction_deck_1.DIRECTION_DECK;
//# sourceMappingURL=direction-deck-present.test.js.map