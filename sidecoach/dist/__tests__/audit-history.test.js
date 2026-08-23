"use strict";
// sidecoach/src/__tests__/audit-history.test.ts
//
// Contract for the append-only AUDIT-HISTORY capture (bin/audit-history.js) and its wiring
// into bin/sidecoach-detect.js.
//
// WHY THIS SUITE EXISTS. Every detect scan's fire-data used to evaporate: the result JSON went
// to stdout, the CLI and the taste-gate hook read it, and it was dropped. The taste miner needs
// that data to ACCRUE. This capture is the persistence point. The three things that must never
// regress are load-bearing:
//   1. detect's stdout JSON is a machine contract the taste-gate hook parses - capture must NOT
//      change a single byte of it.
//   2. capture is best-effort / FAIL-OPEN - a capture failure must never change a scan's verdict
//      or exit code.
//   3. the log is append-only - a scan adds a line, never overwrites.
// Each is asserted below, at the module level (fast, pure) and end-to-end through the real binary
// (--no-render, so no browser: fast and deterministic).
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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-detect.js');
const CAP = path.join(SC, 'bin', 'audit-history.js');
const CLEAN_FIXTURE = path.join(SC, 'eval', 'fixtures', 'known-good', 'clean-page.html');
const DEFECT_FIXTURE = path.join(SC, 'eval', 'fixtures', 'known-defect', 'gradient-text.html');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cap = require(CAP);
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-audit-hist-'));
}
/** Run the real detect binary, returning exit code + raw stdout. Never throws on a nonzero exit. */
function runDetect(args, extraEnv) {
    let code = 0;
    let stdout = '';
    try {
        stdout = (0, child_process_1.execFileSync)('node', [BIN, ...args, '--quiet'], {
            encoding: 'utf8',
            cwd: SC,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, ...extraEnv },
        });
    }
    catch (e) {
        const err = e;
        code = typeof err.status === 'number' ? err.status : -1;
        stdout = err.stdout ?? '';
    }
    return { code, stdout };
}
function main() {
    // ---------------------------------------------------------------------
    // 1. buildEntry: the v1 line shape, and findings REDUCED to (rule, severity, lens).
    //    Heavy per-finding fields (detail, selector, remediation) must be dropped - the
    //    accruing log only carries the fire-rate signal, not the full transient report.
    // ---------------------------------------------------------------------
    const richResult = {
        target: 'x.html',
        targetKind: 'file',
        verdict: 'blocked',
        severityCounts: { blocking: 1, warning: 2, info: 0 },
        findings: [
            { rule: 'anti-pattern.gradient-text', severity: 'blocking', lens: 'static-check', detail: 'HEAVY', selector: '.h', remediation: 'DROP' },
            { rule: 'tiny-text', severity: 'warning', lens: 'subjective', detail: 'HEAVY' },
        ],
    };
    const e = cap.buildEntry(richResult, '2026-08-23T00:00:00.000Z');
    assert(e.v === cap.SCHEMA_VERSION, 'entry carries the schema version');
    assert(e.utc === '2026-08-23T00:00:00.000Z', 'entry carries the passed utc verbatim');
    assert(e.target === 'x.html' && e.targetKind === 'file' && e.verdict === 'blocked', 'entry carries target/kind/verdict');
    assert(e.counts.blocking === 1 && e.counts.warning === 2 && e.counts.info === 0, 'counts come from severityCounts');
    assert(e.findings.length === 2, 'every finding is recorded');
    const first = e.findings[0];
    assert(Object.keys(first).sort().join(',') === 'lens,rule,severity', `a captured finding is exactly {rule,severity,lens}, got keys [${Object.keys(first).join(',')}]`);
    assert(first.detail === undefined, 'the heavy detail field is NOT persisted');
    assert(first.selector === undefined, 'the selector field is NOT persisted');
    // ---------------------------------------------------------------------
    // 2. buildEntry is TOTAL: a junk/empty result never throws, it degrades to a valid entry.
    //    A malformed result must still record that a scan happened, not crash the capture.
    // ---------------------------------------------------------------------
    const empty = cap.buildEntry(null, '2026-08-23T00:00:00.000Z');
    assert(empty.target === null && empty.verdict === 'unknown' && Array.isArray(empty.findings), 'null result yields a valid entry');
    assert(empty.counts.blocking === 0 && empty.counts.warning === 0 && empty.counts.info === 0, 'missing counts default to zero');
    const junk = cap.summarizeFindings([null, { rule: 42 }, 'nope', { severity: 'x', lens: 'y' }]);
    assert(junk.length === 4, 'summarizeFindings keeps one entry per input, junk-safe');
    assert(junk[0].rule === 'unknown' && junk[0].severity === 'unknown' && junk[0].lens === 'unknown', 'a junk finding degrades to unknown triple');
    assert(junk[1].rule === '42', 'a numeric rule is stringified, not dropped');
    assert(cap.summarizeFindings('not-an-array').length === 0, 'a non-array findings value yields []');
    // ---------------------------------------------------------------------
    // 3. captureScan writes ONE parseable JSONL line, and is APPEND-ONLY (2 calls => 2 lines).
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        assert(cap.captureScan(richResult, { file, now: '2026-08-23T00:00:00.000Z' }) === true, 'first capture returns true');
        assert(cap.captureScan({ target: 'y.html', targetKind: 'file', verdict: 'clean', severityCounts: {}, findings: [] }, { file }) === true, 'second capture returns true');
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        assert(lines.length === 2, `append-only: two captures produce two lines, got ${lines.length}`);
        const l0 = JSON.parse(lines[0]);
        const l1 = JSON.parse(lines[1]);
        assert(l0.verdict === 'blocked' && l1.verdict === 'clean', 'each line is the scan it recorded, in order');
        assert(l1.findings.length === 0, 'a clean scan records an empty findings array');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 4. FAIL-OPEN: an unwritable path returns false and NEVER throws.
    //    Parent-is-a-file makes both mkdir and append fail; capture must swallow it.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const notDir = path.join(dir, 'a-file');
        fs.writeFileSync(notDir, 'x');
        const badPath = path.join(notDir, 'sub', 'hist.jsonl');
        let threw = false;
        let ret = true;
        try {
            ret = cap.captureScan(richResult, { file: badPath });
        }
        catch {
            threw = true;
        }
        assert(threw === false, 'captureScan must NEVER throw, even on an unwritable path');
        assert(ret === false, 'captureScan returns false when it could not write');
        assert(fs.existsSync(badPath) === false, 'nothing is created at the bad path');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 5. Disabling capture: opts.disabled and SIDECOACH_NO_AUDIT_HISTORY both short-circuit.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        assert(cap.captureScan(richResult, { file, disabled: true }) === false, 'opts.disabled short-circuits');
        assert(fs.existsSync(file) === false, 'disabled capture writes nothing');
        const prev = process.env.SIDECOACH_NO_AUDIT_HISTORY;
        process.env.SIDECOACH_NO_AUDIT_HISTORY = '1';
        try {
            assert(cap.captureScan(richResult, { file }) === false, 'SIDECOACH_NO_AUDIT_HISTORY=1 disables capture');
            assert(fs.existsSync(file) === false, 'env-disabled capture writes nothing');
        }
        finally {
            if (prev === undefined)
                delete process.env.SIDECOACH_NO_AUDIT_HISTORY;
            else
                process.env.SIDECOACH_NO_AUDIT_HISTORY = prev;
        }
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 6a. Rotation: crossing the size threshold rolls the log to a single `.1` sidecar,
    //     bounding unbounded growth. Best-effort, one generation retained.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        // maxBytes 1 forces a roll on the second write (the first write leaves a nonzero file).
        assert(cap.captureScan(richResult, { file, maxBytes: 1 }) === true, 'first write lands');
        assert(fs.existsSync(file + '.1') === false, 'no sidecar before the threshold is crossed');
        assert(cap.captureScan(richResult, { file, maxBytes: 1 }) === true, 'second write lands after a rotation');
        assert(fs.existsSync(file + '.1') === true, 'the over-threshold log rolled to a .1 sidecar');
        assert(fs.readFileSync(file, 'utf8').trim().split('\n').length === 1, 'the live log holds only the post-roll line');
        assert(fs.existsSync(file + '.rotate.lock') === false, 'the rotation lock is released after the roll');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 6b. Rotation is RE-CHECKED under the lock: a freshly-rotated (small) live file is NOT
    //     rolled over the sidecar. This is the property that makes rotation concurrency-safe -
    //     without the re-stat, a second writer would clobber `.1` with a one-line live and drop
    //     a whole generation of history (Codex review 2026-08-23, findings 1 + 3).
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        // Each entry below is ~200B; a 300B threshold rolls after the second write, leaving a
        // one-line (~200B, sub-threshold) live that the NEXT write must NOT roll again. The roll
        // fires on the write AFTER the file crosses (the size is checked before appending), so the
        // loop runs a few times until `.1` appears.
        const maxBytes = 300;
        const entry = {
            target: 'page.html', targetKind: 'file', verdict: 'blocked',
            severityCounts: { blocking: 1, warning: 1, info: 0 },
            findings: [{ rule: 'anti-pattern.gradient-text', severity: 'blocking', lens: 'static-check' }],
        };
        let rolled = false;
        for (let i = 0; i < 8 && !rolled; i++) {
            cap.captureScan(entry, { file, maxBytes });
            rolled = fs.existsSync(file + '.1');
        }
        assert(rolled, 'accumulating writes eventually cross the threshold and roll to .1');
        const sidecarBefore = fs.readFileSync(file + '.1', 'utf8');
        const liveLines = fs.readFileSync(file, 'utf8').trim().split('\n').length;
        assert(liveLines >= 1 && liveLines < 3, `the post-roll live log is small (sub-threshold), got ${liveLines} line(s)`);
        // The next write sees a small live and must NOT roll it over the sidecar.
        cap.captureScan({ target: 'next.html', targetKind: 'file', verdict: 'clean', severityCounts: {}, findings: [] }, { file, maxBytes });
        assert(fs.readFileSync(file + '.1', 'utf8') === sidecarBefore, 'a sub-threshold live is NOT rolled over .1 - the sidecar generation is preserved');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 6c. TOTAL on HOSTILE input: a result with a Symbol count and a throwing getter must still
    //     produce a valid entry and record a line - "a malformed result still records that a scan
    //     happened" must be TRUE, not just "does not crash detect" (Codex review 2026-08-23, finding 2).
    // ---------------------------------------------------------------------
    {
        const hostileFinding = { severity: 'blocking', lens: 'static-check' };
        Object.defineProperty(hostileFinding, 'rule', { enumerable: true, get() { throw new Error('boom'); } });
        const hostile = {
            target: 'h.html',
            targetKind: 'file',
            verdict: 'blocked',
            severityCounts: { blocking: Symbol('x'), warning: 2, info: 0 },
            findings: [hostileFinding],
        };
        let entry;
        let threw = false;
        try {
            entry = cap.buildEntry(hostile, '2026-08-23T00:00:00.000Z');
        }
        catch {
            threw = true;
        }
        assert(threw === false, 'buildEntry must not throw on hostile input');
        assert(entry.counts.blocking === 0, 'an un-coercible (Symbol) count degrades to 0, not a throw');
        assert(entry.counts.warning === 2, 'a valid sibling count still comes through');
        assert(entry.findings.length === 1 && entry.findings[0].rule === 'unknown', 'a throwing getter degrades to an unknown rule, still recorded');
        // And the whole capture still lands a line (records that the scan happened).
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        assert(cap.captureScan(hostile, { file }) === true, 'a hostile result still records a line');
        assert(fs.readFileSync(file, 'utf8').trim().split('\n').length === 1, 'exactly one line for the hostile scan');
        fs.rmSync(dir, { recursive: true, force: true });
        // A hostile findings ITERATOR (Array.isArray sees through a Proxy, then Symbol.iterator
        // throws) must not make buildEntry throw - the iteration is guarded (Codex re-review 2026-08-23).
        const hostileIter = new Proxy([], {
            get(t, prop, r) {
                if (prop === Symbol.iterator)
                    return function () { throw new Error('iter boom'); };
                return Reflect.get(t, prop, r);
            },
        });
        const withHostileIter = { target: 'i.html', targetKind: 'file', verdict: 'blocked', severityCounts: { blocking: 1 }, findings: hostileIter };
        let iterThrew = false;
        let iterEntry;
        try {
            iterEntry = cap.buildEntry(withHostileIter, '2026-08-23T00:00:00.000Z');
        }
        catch {
            iterThrew = true;
        }
        assert(iterThrew === false, 'a throwing findings iterator must NOT make buildEntry throw');
        assert(Array.isArray(iterEntry.findings) && iterEntry.findings.length === 0, 'a throwing iterator degrades to an empty findings array');
        const dir2 = tmpDir();
        const file2 = path.join(dir2, 'hist.jsonl');
        assert(cap.captureScan(withHostileIter, { file: file2 }) === true, 'a hostile-iterator result still records a line (scan happened)');
        assert(fs.readFileSync(file2, 'utf8').trim().split('\n').length === 1, 'exactly one line for the hostile-iterator scan');
        fs.rmSync(dir2, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 7. e2e STDOUT PARITY: detect's stdout is BYTE-IDENTICAL with capture on vs off.
    //    The taste-gate hook parses this stdout; capture may not perturb it.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const on = runDetect([CLEAN_FIXTURE, '--no-render'], { SIDECOACH_AUDIT_HISTORY: path.join(dir, 'on.jsonl') });
        const off = runDetect([CLEAN_FIXTURE, '--no-render'], { SIDECOACH_NO_AUDIT_HISTORY: '1', SIDECOACH_AUDIT_HISTORY: path.join(dir, 'off.jsonl') });
        assert(on.stdout.length > 0, 'the scan produced a result JSON on stdout');
        assert(on.stdout === off.stdout, 'capture ON vs OFF must produce byte-identical stdout');
        assert(on.code === off.code, 'capture must not change the exit code');
        // And capture-on actually recorded a line while capture-off recorded nothing.
        assert(fs.existsSync(path.join(dir, 'on.jsonl')), 'capture-on wrote its log');
        assert(fs.existsSync(path.join(dir, 'off.jsonl')) === false, 'capture-off wrote no log');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 8. e2e CAPTURE: a real scan appends exactly one line carrying the scan's verdict + rules.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const file = path.join(dir, 'hist.jsonl');
        const defect = runDetect([DEFECT_FIXTURE, '--no-render'], { SIDECOACH_AUDIT_HISTORY: file });
        assert(defect.code !== 0, 'the defect fixture scan exits nonzero (findings)');
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        assert(lines.length === 1, `one scan appends exactly one line, got ${lines.length}`);
        const entry = JSON.parse(lines[0]);
        assert(entry.verdict === 'blocked', `the captured verdict matches the scan, got ${entry.verdict}`);
        assert(entry.counts.blocking >= 1, 'the captured blocking count is nonzero for a blocked scan');
        assert(entry.findings.some((f) => f.rule.includes('gradient-text') && f.severity === 'blocking'), `the fired gradient-text rule is captured at blocking, got [${entry.findings.map((f) => `${f.rule}/${f.severity}`).join(', ')}]`);
        // The captured target is what was scanned; the utc is a real ISO instant.
        assert(typeof entry.target === 'string' && entry.target.includes('gradient-text'), 'the captured target names the scanned file');
        assert(!Number.isNaN(Date.parse(entry.utc)), 'the captured utc is a parseable timestamp');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    // ---------------------------------------------------------------------
    // 9. e2e FAIL-OPEN through the real binary: a forced capture-write failure does NOT change
    //    the scan's exit code, and the result JSON is still on stdout.
    // ---------------------------------------------------------------------
    {
        const dir = tmpDir();
        const notDir = path.join(dir, 'a-file');
        fs.writeFileSync(notDir, 'x');
        const badPath = path.join(notDir, 'sub', 'hist.jsonl');
        const forced = runDetect([CLEAN_FIXTURE, '--no-render'], { SIDECOACH_AUDIT_HISTORY: badPath });
        const baseline = runDetect([CLEAN_FIXTURE, '--no-render'], { SIDECOACH_NO_AUDIT_HISTORY: '1' });
        assert(forced.code === baseline.code, `a capture-write failure must not change the exit code (forced ${forced.code} vs baseline ${baseline.code})`);
        assert(forced.stdout === baseline.stdout, 'a capture-write failure must not change stdout');
        const j = JSON.parse(forced.stdout);
        assert(j.verdict === 'clean' && !!j.lenses, 'the scan still produced its full result JSON despite the capture failure');
        assert(fs.existsSync(badPath) === false, 'the forced-failure path created nothing');
        fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log('audit-history: OK (v1 line shape, findings-reduced, append-only, fail-open, rotation, disable, e2e stdout parity + capture + fail-open)');
}
main();
//# sourceMappingURL=audit-history.test.js.map