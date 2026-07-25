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
// sidecoach/src/__tests__/pre-authorship.test.ts
//
// Contract for the Stage 2b pre-render authorship step: bin/sidecoach-preauthor.js + src/pre-authorship.ts.
//
// The load-bearing behavior: from a brief, AUTHOR a design-system board + a first-surface mock, RENDER both
// headless through the SHIPPING engine (runRenderedAudit), and PROCEED only when the mock returns a REAL
// verdict with no blockers - never on an inconclusive (a scan that did not run), and HALT on a blocked mock.
//
// Proven two ways (mirrors palette-recipe.test.ts / direction-roll.test.ts):
//   1. PURE (always runs, no browser, no build): parseBrief validation, the deterministic HTML builders, and
//      decidePreauthorGate's fail-closed matrix - directly on src - plus the CLI's exported parseArgs.
//   2. E2E (dist- + browser-gated): the real binary writes both artifacts, renders them through the shipping
//      audit, and gates. Skips gracefully if dist is unbuilt (bare ts-node) or no Chromium is cached; under
//      `npm test` the build runs first and a cached browser makes it run for real in the committed gate.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const pre_authorship_1 = require("../pre-authorship");
const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-preauthor.js');
const PASS_FIXTURE = path.join(SC, 'eval', 'fixtures', 'preauthor', 'brief-pass.json');
const BROKEN_FIXTURE = path.join(SC, 'eval', 'fixtures', 'preauthor', 'brief-broken.json');
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
// A minimal valid brief object (for pure builder/parse tests without touching the fixtures on disk).
const RAW_BRIEF = {
    name: 'Acme',
    surface: {
        kind: 'settings',
        headline: 'Update your billing email',
        subhead: 'Receipts go to this address.',
        sections: [{ heading: 'Current address', body: 'Receipts currently go to finance@acme.example.' }],
        primaryCta: 'Save billing email',
    },
    palette: { ink: '#14181f', canvas: '#ffffff', muted: '#55606e', primary: '#1f4f8f', onPrimary: '#ffffff', border: '#d0d5dd' },
    type: { display: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif' },
};
function runCli(args, env) {
    let code = 0;
    let stdout = '';
    let stderr = '';
    try {
        stdout = (0, child_process_1.execFileSync)('node', [BIN, ...args], {
            encoding: 'utf8', cwd: SC, stdio: ['ignore', 'pipe', 'pipe'],
            env: env ? { ...process.env, ...env } : process.env,
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
const audit = (verdict, blocking = 0, warning = 0) => ({ verdict, severityCounts: { blocking, warning, info: 0 } });
// ---------------------------------------------------------------------------
// 1. parseBrief - validate + normalize, throw precisely on garbage (never a partial brief).
// ---------------------------------------------------------------------------
function testParseBrief() {
    const b = (0, pre_authorship_1.parseBrief)(RAW_BRIEF);
    assert(b.name === 'Acme', 'valid brief parses name');
    assert(b.surface.sections.length === 1, 'sections parsed');
    assert(b.palette.ink === '#14181f', 'palette hex normalized/lowercased');
    assert(b.components.length >= 1 && b.components.includes('card'), 'components default to a base set when omitted');
    const throws = (raw, label) => {
        let threw = false;
        try {
            (0, pre_authorship_1.parseBrief)(raw);
        }
        catch {
            threw = true;
        }
        assert(threw, `parseBrief must throw on ${label}`);
    };
    throws(null, 'null');
    throws({}, 'missing name');
    throws({ ...RAW_BRIEF, name: '' }, 'empty name');
    throws({ ...RAW_BRIEF, surface: { ...RAW_BRIEF.surface, sections: [] } }, 'empty sections');
    throws({ ...RAW_BRIEF, palette: { ...RAW_BRIEF.palette, ink: 'blue' } }, 'non-hex palette value');
    throws({ ...RAW_BRIEF, palette: { ...RAW_BRIEF.palette, ink: '#12g456' } }, 'malformed hex');
    throws({ ...RAW_BRIEF, type: { display: 'Inter' } }, 'missing body font');
    throws({ ...RAW_BRIEF, components: ['ok', ''] }, 'empty component name');
    // A 3-digit hex is valid.
    assert((0, pre_authorship_1.parseBrief)({ ...RAW_BRIEF, palette: { ...RAW_BRIEF.palette, canvas: '#fff' } }).palette.canvas === '#fff', '#rgb short hex accepted');
    // Font stacks are interpolated into CSS, so a CSS-structural value is rejected LOUDLY (it could otherwise
    // break out of `font-family:` and inject rules that override the palette to fake a contrast pass).
    throws({ ...RAW_BRIEF, type: { display: 'Inter; } * { color: #000; background: #fff } /*', body: 'Inter' } }, 'CSS-injection font stack (braces/semicolons)');
    throws({ ...RAW_BRIEF, type: { display: 'Inter, sans-serif', body: 'a<script>b' } }, 'font stack with angle brackets');
    // A real quoted / hyphenated font stack is still accepted.
    const realFonts = (0, pre_authorship_1.parseBrief)({ ...RAW_BRIEF, type: { display: "'Segoe UI', -apple-system, sans-serif", body: 'ui-monospace, "JetBrains Mono", monospace' } });
    assert(realFonts.type.body.includes('JetBrains Mono') && realFonts.type.display.includes('Segoe UI'), 'a real quoted/hyphenated font stack is accepted');
}
// ---------------------------------------------------------------------------
// 2. HTML builders - self-contained, well-formed, deterministic, and HTML-escaped.
// ---------------------------------------------------------------------------
function testBuilders() {
    const brief = (0, pre_authorship_1.parseBrief)(RAW_BRIEF);
    const mock = (0, pre_authorship_1.buildMockHtml)(brief);
    const board = (0, pre_authorship_1.buildBoardHtml)(brief);
    // Both are self-contained documents with a single sequential heading outline start.
    for (const [name, html] of [['mock', mock], ['board', board]]) {
        assert(html.startsWith('<!doctype html>'), `${name}: is a full HTML document`);
        assert(/<html lang="en">/.test(html), `${name}: has a lang`);
        assert((html.match(/<h1>/g) || []).length === 1, `${name}: exactly one h1`);
        assert(/<meta name="viewport"/.test(html), `${name}: responsive viewport meta`);
        assert(html.includes('Inter'), `${name}: uses the committed typeface from the brief`);
        // No <img> is authored, so broken-image can never fire on a well-formed brief.
        assert(!/<img/i.test(html), `${name}: authors no images (no broken-image risk)`);
    }
    // The mock paints the brief's real content + palette.
    assert(mock.includes('Update your billing email'), 'mock carries the headline');
    assert(mock.includes('Save billing email'), 'mock carries the primary CTA');
    assert(mock.includes('#14181f') && mock.includes('#1f4f8f'), 'mock applies the brief palette (real text/bg pairs)');
    // The board documents tokens + type scale + inventory.
    assert(board.includes('Tokens') && board.includes('Type scale') && board.includes('Components'), 'board has token/type/component sections');
    assert(board.includes('#55606e') && board.includes('#d0d5dd'), 'board shows the palette hex values');
    assert(brief.components.every((c) => board.includes(c)), 'board lists every inventory component');
    // Determinism: same brief => byte-identical HTML.
    assert((0, pre_authorship_1.buildMockHtml)(brief) === mock && (0, pre_authorship_1.buildBoardHtml)(brief) === board, 'builders are pure/deterministic');
    // HTML escaping: angle brackets and quotes in brief copy never break out into markup.
    const nasty = (0, pre_authorship_1.parseBrief)({ ...RAW_BRIEF, surface: { ...RAW_BRIEF.surface, headline: 'A <b>bold</b> & "quoted" title' } });
    const escaped = (0, pre_authorship_1.buildMockHtml)(nasty);
    assert(escaped.includes('&lt;b&gt;') && escaped.includes('&amp;') && escaped.includes('&quot;'), 'brief copy is HTML-escaped');
    assert(!escaped.includes('<b>bold</b>'), 'raw markup from a brief field never lands unescaped');
}
// ---------------------------------------------------------------------------
// 3. decidePreauthorGate - THE fail-closed decision (pure; audit verdicts in, proceed/halt out).
// ---------------------------------------------------------------------------
function testGate() {
    const clean = audit('clean');
    // proceed: mock clean or warnings-only, board rendered.
    assert((0, pre_authorship_1.decidePreauthorGate)(audit('clean'), clean).decision === 'proceed', 'clean mock => proceed');
    assert((0, pre_authorship_1.decidePreauthorGate)(audit('clean'), clean).exit === pre_authorship_1.PREAUTHOR_EXIT.PROCEED, 'proceed => exit 0');
    assert((0, pre_authorship_1.decidePreauthorGate)(audit('warnings-only', 0, 3), clean).decision === 'proceed', 'warnings-only mock (no blockers) => proceed');
    assert((0, pre_authorship_1.decidePreauthorGate)(audit('warnings-only', 0, 3), clean).exit === 0, 'warnings-only => exit 0');
    // halt on a blocked mock.
    const blockedGate = (0, pre_authorship_1.decidePreauthorGate)(audit('blocked', 2), clean);
    assert(blockedGate.decision === 'halt' && blockedGate.exit === pre_authorship_1.PREAUTHOR_EXIT.BLOCKED, 'blocked mock => halt exit 1');
    assert(/blocking/.test(blockedGate.reason), 'blocked reason names the blocking findings');
    // fail-closed: an inconclusive artifact (did not render) HALTS, never proceeds.
    const incMock = (0, pre_authorship_1.decidePreauthorGate)(audit('inconclusive'), clean);
    assert(incMock.decision === 'halt' && incMock.exit === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE, 'inconclusive mock => halt exit 3');
    assert(incMock.exit !== pre_authorship_1.PREAUTHOR_EXIT.PROCEED, 'inconclusive must NEVER proceed');
    // "renders both": an inconclusive BOARD halts even when the mock is clean.
    assert((0, pre_authorship_1.decidePreauthorGate)(clean, audit('inconclusive')).exit === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE, 'inconclusive board => halt exit 3 (renders both)');
    // A non-render dominates a blocker: board inconclusive + mock blocked => the render failure (exit 3) wins.
    assert((0, pre_authorship_1.decidePreauthorGate)(audit('blocked', 1), audit('inconclusive')).exit === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE, 'render failure dominates a blocker');
    // fail-closed on an UNKNOWN verdict: proceed is an explicit allow-set (clean/warnings-only), so anything
    // outside the vocabulary halts rather than failing open.
    const bogus = (0, pre_authorship_1.decidePreauthorGate)(audit('bogus'), clean);
    assert(bogus.decision === 'halt' && bogus.exit === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE, 'an unrecognized mock verdict halts (exit 3), never proceeds');
    // The exit classes are the documented distinct codes.
    assert(pre_authorship_1.PREAUTHOR_EXIT.PROCEED === 0 && pre_authorship_1.PREAUTHOR_EXIT.BLOCKED === 1 && pre_authorship_1.PREAUTHOR_EXIT.USAGE === 2 && pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE === 3, 'exit constants are the documented classes');
}
// ---------------------------------------------------------------------------
// 4. CLI arg parsing (pure) - exported parseArgs + exit constants (no dist needed: the bin lazy-loads dist).
// ---------------------------------------------------------------------------
function testParseArgs() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli = require(BIN);
    const a = cli.parseArgs(['--brief', 'b.json', '--out-dir', '/tmp/x', '--quiet']);
    assert(a.brief === 'b.json' && a.outDir === '/tmp/x' && a.quiet === true, 'parseArgs reads --brief/--out-dir/--quiet');
    const b = cli.parseArgs(['b.json']);
    assert(b.brief === 'b.json' && b.outDir === null, 'a positional brief is accepted; out-dir defaults null');
    assert(cli.EXIT_PROCEED === 0 && cli.EXIT_BLOCKED === 1 && cli.EXIT_USAGE === 2 && cli.EXIT_INCONCLUSIVE === 3, 'exit constants match the module + are distinct');
}
// ---------------------------------------------------------------------------
// 5. E2E through the real binary (dist- + browser-gated).
// ---------------------------------------------------------------------------
function distReady() {
    return fs.existsSync(path.join(SC, 'dist', 'pre-authorship.js')) && fs.existsSync(path.join(SC, 'dist', 'audit-rendered.js'));
}
function tmpOut(tag) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `preauthor-e2e-${tag}-`));
}
function testE2E() {
    if (!distReady()) {
        console.warn('pre-authorship: SKIP e2e (dist not built; pure invariants + gate matrix already verified above)');
        return;
    }
    // (a) Well-formed brief: writes board + mock, renders both, mock returns a REAL verdict, build PROCEEDS.
    const passOut = tmpOut('pass');
    const pass = runCli(['--brief', PASS_FIXTURE, '--out-dir', passOut, '--quiet']);
    if (pass.code === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE) {
        console.warn('pre-authorship: SKIP e2e render (no Chromium cache; pure fail-closed logic already verified above)');
        return;
    }
    assert(pass.code === pre_authorship_1.PREAUTHOR_EXIT.PROCEED, `a well-formed brief must proceed (exit 0), got ${pass.code}\n${pass.stderr.slice(0, 400)}`);
    const passResult = JSON.parse(pass.stdout);
    // The two artifacts were actually written.
    assert(fs.existsSync(passResult.board.path) && fs.existsSync(passResult.mock.path), 'e2e: board.html + mock.html were written');
    assert(passResult.board.path.endsWith('board.html') && passResult.mock.path.endsWith('mock.html'), 'e2e: artifact filenames');
    // The mock rendered a REAL verdict - never inconclusive on a well-formed mock (the load-bearing assertion).
    assert(passResult.mock.verdict !== 'inconclusive', `e2e: a well-formed mock must NOT be inconclusive, got ${passResult.mock.verdict}`);
    assert(['clean', 'warnings-only'].includes(passResult.mock.verdict), `e2e: well-formed mock verdict is clean/warnings-only, got ${passResult.mock.verdict}`);
    assert(passResult.mock.rendered === true, 'e2e: the mock actually rendered');
    assert(passResult.mock.severityCounts.blocking === 0, 'e2e: a well-formed mock carries no blocking findings');
    assert(passResult.decision === 'proceed', 'e2e: the gate decision is proceed');
    // (b) Deliberately-broken brief (near-white text on white): the mock is BLOCKED and the build HALTS.
    const brokenOut = tmpOut('broken');
    const broken = runCli(['--brief', BROKEN_FIXTURE, '--out-dir', brokenOut, '--quiet']);
    assert(broken.code === pre_authorship_1.PREAUTHOR_EXIT.BLOCKED, `a broken mock must halt (exit 1), got ${broken.code}\n${broken.stderr.slice(0, 400)}`);
    const brokenResult = JSON.parse(broken.stdout);
    assert(brokenResult.mock.verdict === 'blocked', `e2e: broken mock verdict must be blocked, got ${brokenResult.mock.verdict}`);
    assert(brokenResult.mock.severityCounts.blocking > 0, 'e2e: the broken mock carries >=1 blocking finding');
    assert(brokenResult.mock.findings.some((f) => f.rule === 'low-contrast'), 'e2e: the blocker is a low-contrast finding');
    assert(brokenResult.decision === 'halt', 'e2e: the gate decision is halt');
    assert(broken.code !== pre_authorship_1.PREAUTHOR_EXIT.PROCEED, 'e2e: a broken mock must never look like a proceed');
    // (c) Forced inconclusive: point Playwright at a nonexistent browser cache -> neither artifact renders ->
    //     the gate is inconclusive (exit 3), NEVER a proceed. Deterministic even where a browser IS present.
    const incOut = tmpOut('inc');
    const inc = runCli(['--brief', PASS_FIXTURE, '--out-dir', incOut, '--quiet'], { PLAYWRIGHT_BROWSERS_PATH: path.join(os.tmpdir(), 'sidecoach-no-browser-xyz') });
    assert(inc.code === pre_authorship_1.PREAUTHOR_EXIT.INCONCLUSIVE, `a render that cannot run must be inconclusive (3), got ${inc.code}`);
    const incResult = JSON.parse(inc.stdout);
    assert(incResult.mock.verdict === 'inconclusive', 'e2e: a non-rendering mock is inconclusive');
    assert(incResult.decision === 'halt' && inc.code !== pre_authorship_1.PREAUTHOR_EXIT.PROCEED, 'e2e: inconclusive halts, never proceeds');
    // (d) Usage: an unreadable brief file -> exit 2 (never a render, never a gate).
    const bad = runCli(['--brief', path.join(SC, 'eval', 'fixtures', 'preauthor', 'nope.json'), '--quiet']);
    assert(bad.code === pre_authorship_1.PREAUTHOR_EXIT.USAGE, `a missing brief file must exit 2, got ${bad.code}`);
}
function main() {
    testParseBrief();
    testBuilders();
    testGate();
    testParseArgs();
    testE2E();
    console.log('pre-authorship: OK (brief validation, well-formed deterministic builders, fail-closed gate matrix, CLI parse + e2e render/halt/inconclusive)');
}
main();
//# sourceMappingURL=pre-authorship.test.js.map