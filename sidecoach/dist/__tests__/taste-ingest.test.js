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
// sidecoach/src/__tests__/taste-ingest.test.ts
//
// Contract for bin/sidecoach-taste-ingest.js - the SAFE external taste-source ingest.
//
// The thing this suite exists to protect is the ALLOWLIST / EXCLUSION guarantee. The
// upstream repos ship agent-config files (AGENTS.md, CLAUDE.md, opencode.json,
// .claude-plugin/) that carry agent directives - a prompt-injection vector. The single
// worst regression this tool can have is fetching one of those, so the guard is unit-
// tested exhaustively here (pure, fast), then the three data paths (verify-allowlist,
// offline ingest, diff-since-last) are exercised end to end through the real binary
// against committed fixtures. No network is used, so the suite is hermetic.
//
// It also asserts the SHIPPED manifest (data/taste-sources.json) only ever lists
// SKILL.md bodies and excludes every forbidden file - the manifest is the allowlist, so
// a drift there is a real defect this gate must catch.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-taste-ingest.js');
const REAL_MANIFEST = path.join(SC, 'data', 'taste-sources.json');
const FIX = path.join(SC, 'fixtures', 'taste-sources');
const GOOD_MANIFEST = path.join(FIX, 'manifest-good.json');
const FORBIDDEN_MANIFEST = path.join(FIX, 'manifest-forbidden.json');
const BODIES_V1 = path.join(FIX, 'bodies');
const BODIES_V2 = path.join(FIX, 'bodies-changed');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(BIN);
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function run(args) {
    let code = 0;
    let stdout = '';
    let stderr = '';
    try {
        stdout = (0, child_process_1.execFileSync)('node', [BIN, ...args], {
            encoding: 'utf8',
            cwd: SC,
            stdio: ['ignore', 'pipe', 'pipe'],
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
function tmpOut() {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'taste-ingest-')), 'quarantine');
}
function listFiles(dir) {
    const out = [];
    const walk = (d) => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, ent.name);
            if (ent.isDirectory())
                walk(full);
            else
                out.push(full);
        }
    };
    if (fs.existsSync(dir))
        walk(dir);
    return out;
}
function main() {
    const EXIT = mod.EXIT;
    // ---------------------------------------------------------------------
    // 1. guardPath - the load-bearing pure check. Forbidden files are rejected,
    //    non-SKILL.md is rejected, traversal is rejected, real SKILL.md passes.
    // ---------------------------------------------------------------------
    assert(mod.guardPath('skills/better-ui/SKILL.md').ok, 'a real SKILL.md body must pass');
    assert(mod.guardPath('SKILL.md').ok, 'a top-level SKILL.md must pass');
    for (const bad of ['AGENTS.md', 'CLAUDE.md', 'opencode.json', 'skills/x/AGENTS.md']) {
        assert(!mod.guardPath(bad).ok, `${bad} must be rejected (agent-config)`);
    }
    assert(!mod.guardPath('.claude-plugin/plugin.json').ok, '.claude-plugin/ must be rejected');
    assert(!mod.guardPath('skills/x/.claude-plugin/y.json').ok, 'nested .claude-plugin/ must be rejected');
    assert(!mod.guardPath('skills/better-ui/README.md').ok, 'a non-SKILL.md file must be rejected');
    assert(!mod.guardPath('../escape/SKILL.md').ok, 'path traversal must be rejected');
    assert(!mod.guardPath('/abs/SKILL.md').ok, 'an absolute path must be rejected');
    assert(!mod.guardPath('').ok, 'an empty path must be rejected');
    // ---------------------------------------------------------------------
    // 1b. Guard hardening (Codex cross-model review). Encoded and mixed-case forms of the
    //     forbidden segments/files must ALSO be rejected - a case-insensitive host or a
    //     %-decoding proxy must not sneak an agent-config file past the guard.
    // ---------------------------------------------------------------------
    assert(!mod.guardPath('skills/%2eclaude-plugin/SKILL.md').ok, 'percent-encoded path must be rejected');
    assert(!mod.guardPath('skills/x/%2e%2e/SKILL.md').ok, 'percent-encoded traversal must be rejected');
    assert(!mod.guardPath('skills/.CLAUDE-PLUGIN/SKILL.md').ok, 'uppercase .CLAUDE-PLUGIN must be rejected');
    assert(!mod.guardPath('AGENTS.MD').ok, 'uppercase AGENTS.MD must be rejected');
    assert(!mod.guardPath('agents.md').ok, 'lowercase agents.md must be rejected');
    assert(!mod.guardPath('OpenCode.JSON').ok, 'mixed-case opencode.json must be rejected');
    // ---------------------------------------------------------------------
    // 1c. Source slug guard: the slug becomes a directory name, so traversal / forbidden
    //     dir names / uppercase are rejected (Codex review #2).
    // ---------------------------------------------------------------------
    assert(mod.guardSource('emil-kowalski-skills').ok, 'a normal slug passes');
    for (const bad of ['../.claude-plugin', '.claude-plugin', '..', 'a/b', 'UPPER', '', '-leading']) {
        assert(!mod.guardSource(bad).ok, `bad source slug '${bad}' must be rejected`);
    }
    // A manifest whose source slug is a traversal must fail the whole guard.
    const evilSlug = mod.guardManifest({ sources: [{ source: '../.claude-plugin', allowlisted_paths: ['skills/x/SKILL.md'] }] });
    assert(!evilSlug.ok, 'a manifest with a traversal source slug must be rejected');
    // ---------------------------------------------------------------------
    // 1d. assertWithin: a destination escaping the quarantine root throws.
    // ---------------------------------------------------------------------
    const root = path.join(os.tmpdir(), 'qroot');
    assert(mod.assertWithin(root, path.join(root, 'demo', 'SKILL.md')).length > 0, 'an in-root path is allowed');
    let threw = false;
    try {
        mod.assertWithin(root, path.join(root, '..', 'escape'));
    }
    catch {
        threw = true;
    }
    assert(threw, 'a path escaping the quarantine root must throw');
    // 1d-symlink: a pre-placed SYMLINK inside the tree cannot smuggle a write outside the root.
    // Regression for the Codex review finding: lexical path.resolve() missed symlink escapes, so
    // skills/x -> ../outside would pass the check and writeFileSync would follow it into a live path.
    const symRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taste-sym-'));
    const quarantine = path.join(symRoot, 'quarantine');
    const outside = path.join(symRoot, 'outside');
    fs.mkdirSync(quarantine, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'target.md'), 'outside');
    fs.symlinkSync(outside, path.join(quarantine, 'skills')); // escaping DIRECTORY symlink
    let symDirThrew = false;
    try {
        mod.assertWithin(quarantine, path.join(quarantine, 'skills', 'x', 'SKILL.md'));
    }
    catch {
        symDirThrew = true;
    }
    assert(symDirThrew, 'a destination reached through an escaping directory symlink must throw');
    fs.symlinkSync(path.join(outside, 'target.md'), path.join(quarantine, 'evil.md')); // escaping FILE symlink -> real target
    let symFileThrew = false;
    try {
        mod.assertWithin(quarantine, path.join(quarantine, 'evil.md'));
    }
    catch {
        symFileThrew = true;
    }
    assert(symFileThrew, 'a destination that is itself a symlink escaping the root must throw');
    assert(mod.assertWithin(quarantine, path.join(quarantine, 'ok', 'SKILL.md')).length > 0, 'a normal in-root path still resolves under the symlink-safe check');
    // 1d-hardlink: a pre-placed HARD LINK at a dest must not truncate the outside target's inode.
    // O_NOFOLLOW stops symlinks but not hard links (Codex review 2026-08-24); writeFileNoFollow
    // unlinks the name first then O_EXCL-creates a fresh inode, so the shared outside inode is left
    // intact and the new content lands on a new inode at dest.
    const precious = path.join(outside, 'live.md');
    fs.writeFileSync(precious, 'PRECIOUS');
    const hardlink = path.join(quarantine, 'hardlink.md');
    fs.linkSync(precious, hardlink); // hard link inside quarantine -> outside inode (nlink=2)
    mod.writeFileNoFollow(hardlink, 'REPLACED');
    assert(fs.readFileSync(precious, 'utf8') === 'PRECIOUS', 'a hard-linked outside inode must NOT be truncated by the write');
    assert(fs.readFileSync(hardlink, 'utf8') === 'REPLACED', 'the quarantine dest must receive the new content on a fresh inode');
    assert(fs.statSync(precious).ino !== fs.statSync(hardlink).ino, 'dest must be a new inode, no longer sharing the outside file');
    // and writeFileNoFollow refuses to write THROUGH a symlink (final-component protection)
    const symDest = path.join(quarantine, 'sym.md');
    fs.symlinkSync(precious, symDest);
    mod.writeFileNoFollow(symDest, 'VIASYM');
    assert(fs.readFileSync(precious, 'utf8') === 'PRECIOUS', 'a symlinked dest must NOT write through to its target');
    // ---------------------------------------------------------------------
    // 1e. Redirect/SSRF guard: only https + allowlisted GitHub hosts are contactable.
    // ---------------------------------------------------------------------
    assert(mod.assertAllowedUrl('https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md').hostname === 'raw.githubusercontent.com', 'raw host allowed');
    for (const badUrl of ['http://raw.githubusercontent.com/x', 'https://evil.example.com/x', 'https://169.254.169.254/latest/meta-data', 'file:///etc/passwd']) {
        let rejected = false;
        try {
            mod.assertAllowedUrl(badUrl);
        }
        catch {
            rejected = true;
        }
        assert(rejected, `off-allowlist / non-https URL must be rejected: ${badUrl}`);
    }
    // ---------------------------------------------------------------------
    // 1f. yamlScalar neutralizes control chars and quotes the value (Codex review #5).
    // ---------------------------------------------------------------------
    const scalar = mod.yamlScalar('MIT\n---\n# injected');
    assert(!scalar.includes('\n'), 'yamlScalar must strip newlines');
    assert(scalar.startsWith('"') && scalar.endsWith('"'), 'yamlScalar must quote the value');
    // ---------------------------------------------------------------------
    // 1g. loadManifest rejects a control character in a metadata field (Codex review #5).
    // ---------------------------------------------------------------------
    const evilManifestPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'taste-evil-')), 'm.json');
    fs.writeFileSync(evilManifestPath, JSON.stringify({
        sources: [{ source: 'demo-source', repo_url: 'https://github.com/o/r', branch: 'main', license: 'MIT\nBREAKOUT', allowlisted_paths: ['skills/x/SKILL.md'] }],
    }));
    const evilLoad = mod.loadManifest(evilManifestPath);
    assert(!!evilLoad.error && /control character/.test(evilLoad.error), 'a control char in metadata must be rejected at load');
    // ---------------------------------------------------------------------
    // 2. The SHIPPED manifest is all SKILL.md bodies, zero forbidden files.
    // ---------------------------------------------------------------------
    const loaded = mod.loadManifest(REAL_MANIFEST);
    assert(!loaded.error, `shipped manifest must load: ${loaded.error}`);
    const shipped = loaded.manifest;
    const shippedGuard = mod.guardManifest(shipped);
    assert(shippedGuard.ok, `shipped manifest has forbidden paths: ${JSON.stringify(shippedGuard.violations)}`);
    // Every shipped path ends in SKILL.md, and the superseded repo B is absent.
    for (const src of shipped.sources) {
        assert(src.license === 'MIT', `${src.source} must be MIT`);
        assert(/Copyright \(c\) 2026/.test(src.upstream_copyright), `${src.source} must carry an upstream copyright line`);
        for (const p of src.allowlisted_paths) {
            assert(p.endsWith('/SKILL.md'), `shipped path must be a SKILL.md body: ${p}`);
        }
    }
    const slugs = shipped.sources.map((s) => s.source);
    assert(slugs.includes('jakub-krehel-skills') && slugs.includes('emil-kowalski-skills'), 'both canonical sources present');
    // ---------------------------------------------------------------------
    // 3. verify-allowlist on the shipped manifest exits 0.
    // ---------------------------------------------------------------------
    const va = run(['--verify-allowlist', '--quiet']);
    assert(va.code === EXIT.OK, `verify-allowlist on shipped manifest must exit 0 (got ${va.code})`);
    // ---------------------------------------------------------------------
    // 4. A forbidden manifest exits 4 (allowlist) and writes NOTHING.
    // ---------------------------------------------------------------------
    const outForbidden = tmpOut();
    const forbidden = run(['--offline', '--fixture', BODIES_V1, '--manifest', FORBIDDEN_MANIFEST, '--out', outForbidden, '--quiet']);
    assert(forbidden.code === EXIT.ALLOWLIST, `forbidden manifest must exit ${EXIT.ALLOWLIST} (got ${forbidden.code})`);
    assert(listFiles(outForbidden).length === 0, 'a forbidden manifest must write NOTHING to the quarantine dir');
    // The guard must also trip in the read-only verify mode.
    const forbiddenVa = run(['--verify-allowlist', '--manifest', FORBIDDEN_MANIFEST, '--quiet']);
    assert(forbiddenVa.code === EXIT.ALLOWLIST, `verify-allowlist on a forbidden manifest must exit ${EXIT.ALLOWLIST} (got ${forbiddenVa.code})`);
    // ---------------------------------------------------------------------
    // 5. Offline ingest v1: writes ONLY SKILL.md-derived data + provenance + snapshot,
    //    marks the file NEW, and the provenance carries commit + date + license.
    // ---------------------------------------------------------------------
    const out = tmpOut();
    const v1 = run(['--offline', '--fixture', BODIES_V1, '--manifest', GOOD_MANIFEST, '--out', out, '--quiet']);
    assert(v1.code === EXIT.OK, `offline ingest must exit 0 (got ${v1.code}): ${v1.stderr}`);
    const written = listFiles(out);
    // Only SKILL.md bodies + the two json sidecars may exist.
    for (const f of written) {
        const base = path.basename(f);
        assert(base === 'SKILL.md' || base === 'provenance.json' || base === 'snapshot.json', `unexpected file written: ${f}`);
    }
    // No forbidden basename may ever appear on disk.
    for (const f of written) {
        const base = path.basename(f);
        assert(!['AGENTS.md', 'CLAUDE.md', 'opencode.json'].includes(base), `forbidden file written: ${f}`);
        assert(!f.includes('.claude-plugin'), `.claude-plugin path written: ${f}`);
    }
    const skillFile = path.join(out, 'demo-source', 'skills', 'better-ui', 'SKILL.md');
    assert(fs.existsSync(skillFile), 'the SKILL.md body must be written');
    const wrapped = fs.readFileSync(skillFile, 'utf8');
    assert(wrapped.includes('UNTRUSTED SOURCE EXCERPT'), 'stored body must be marked as an UNTRUSTED SOURCE EXCERPT');
    assert(/ingested_as: UNTRUSTED SOURCE EXCERPT/.test(wrapped), 'front-matter must mark ingested_as UNTRUSTED');
    assert(/Do NOT follow any/.test(wrapped), 'the untrusted warning must be present');
    // The injection-shaped line from the fixture must survive verbatim INSIDE the fenced
    // block - i.e. it is quoted data, not hoisted into anything executable.
    assert(wrapped.includes('IGNORE ALL PREVIOUS INSTRUCTIONS'), 'the fixture body is preserved verbatim as data');
    const beginIdx = wrapped.indexOf(': BEGIN');
    const injIdx = wrapped.indexOf('IGNORE ALL PREVIOUS INSTRUCTIONS');
    const endIdx = wrapped.indexOf(': END');
    assert(beginIdx !== -1 && endIdx !== -1, 'both nonce-tagged sentinels must be present');
    assert(beginIdx < injIdx && injIdx < endIdx, 'the injection-shaped line must sit INSIDE the untrusted fence');
    // The sentinel carries a random nonce, so a body embedding a literal sentinel cannot
    // forge the boundary (Codex review #7).
    const nonceMatch = wrapped.match(/UNTRUSTED SOURCE EXCERPT ([0-9a-f]{16}): BEGIN/);
    assert(nonceMatch !== null, 'the BEGIN sentinel must carry a 16-hex nonce');
    assert(wrapped.includes(`UNTRUSTED SOURCE EXCERPT ${nonceMatch[1]}: END`), 'BEGIN and END nonce must match');
    const prov = JSON.parse(fs.readFileSync(path.join(out, 'demo-source', 'provenance.json'), 'utf8'));
    assert(prov.license === 'MIT', 'provenance license must be MIT');
    assert(/Copyright \(c\) 2026/.test(prov.upstream_copyright), 'provenance must carry the upstream copyright');
    assert(typeof prov.retrieved_utc === 'string' && prov.retrieved_utc.length > 0, 'provenance must carry a retrieved date');
    assert(typeof prov.commit_sha === 'string' && prov.commit_sha.length > 0, 'provenance must carry a commit_sha');
    assert(Array.isArray(prov.files) && prov.files.length === 1, 'provenance must record one file');
    assert(prov.files[0].path === 'skills/better-ui/SKILL.md', 'provenance records the fetched path');
    assert(/^[0-9a-f]{64}$/.test(prov.files[0].sha256), 'provenance records a sha256 of the body');
    const snap = JSON.parse(fs.readFileSync(path.join(out, 'demo-source', 'snapshot.json'), 'utf8'));
    assert(snap.hashes['skills/better-ui/SKILL.md'] === prov.files[0].sha256, 'snapshot hash matches provenance hash');
    // Snapshot the quarantine state before the gate runs, to prove the gate writes nothing.
    const snapBefore = fs.readFileSync(path.join(out, 'demo-source', 'snapshot.json'), 'utf8');
    const filesBefore = listFiles(out).sort().join('\n');
    // ---------------------------------------------------------------------
    // 6. Diff-since-last no-ops on an UNCHANGED source (--fail-on-change exits 0).
    // ---------------------------------------------------------------------
    const again = run(['--offline', '--fixture', BODIES_V1, '--manifest', GOOD_MANIFEST, '--out', out, '--fail-on-change', '--json', '--quiet']);
    assert(again.code === EXIT.OK, `re-running an unchanged source with --fail-on-change must exit 0 (got ${again.code})`);
    const againJson = JSON.parse(again.stdout);
    assert(againJson.diffOnly === true, 'a --fail-on-change run must report diffOnly');
    assert(againJson.results[0].files[0].status === 'unchanged', 'an unchanged body must diff as unchanged');
    // ---------------------------------------------------------------------
    // 7. Diff-since-last FLAGS a changed source (--fail-on-change exits 10) and, being a
    //    read-only gate, does NOT advance the baseline (Codex review #4). Otherwise a CI
    //    gate that exits 10 would mark the drift consumed and a rerun would say unchanged.
    // ---------------------------------------------------------------------
    const changed = run(['--offline', '--fixture', BODIES_V2, '--manifest', GOOD_MANIFEST, '--out', out, '--fail-on-change', '--json', '--quiet']);
    assert(changed.code === EXIT.CHANGES, `a changed source with --fail-on-change must exit ${EXIT.CHANGES} (got ${changed.code})`);
    const changedJson = JSON.parse(changed.stdout);
    assert(changedJson.results[0].files[0].status === 'changed', 'a changed body must diff as changed');
    const snapAfter = fs.readFileSync(path.join(out, 'demo-source', 'snapshot.json'), 'utf8');
    assert(snapBefore === snapAfter, 'a drift gate must NOT advance the snapshot baseline');
    assert(filesBefore === listFiles(out).sort().join('\n'), 'a drift gate must not add or remove quarantine files');
    // Re-running the gate still reports the change - it is idempotent until a real ingest.
    const changedAgain = run(['--offline', '--fixture', BODIES_V2, '--manifest', GOOD_MANIFEST, '--out', out, '--fail-on-change', '--json', '--quiet']);
    assert(changedAgain.code === EXIT.CHANGES, 'the gate stays red until a real ingest accepts the change');
    // ---------------------------------------------------------------------
    // 7b. A corrupt EXISTING snapshot fails loud (exit io), not silently overwritten
    //     (Codex review #6). A missing snapshot stays the legitimate first-run state.
    // ---------------------------------------------------------------------
    // Each malformed snapshot shape must fail loud - invalid JSON, a null hashes map, and an
    // array hashes map (the last two would otherwise read as an empty baseline and be
    // silently overwritten on a real ingest).
    for (const badSnap of ['{ this is not json', '{"hashes":null}', '{"hashes":[]}', '{"nope":1}']) {
        const corruptOut = tmpOut();
        fs.mkdirSync(path.join(corruptOut, 'demo-source'), { recursive: true });
        fs.writeFileSync(path.join(corruptOut, 'demo-source', 'snapshot.json'), badSnap, 'utf8');
        const corrupt = run(['--offline', '--fixture', BODIES_V1, '--manifest', GOOD_MANIFEST, '--out', corruptOut, '--quiet']);
        assert(corrupt.code === EXIT.IO, `a corrupt snapshot (${badSnap}) must exit ${EXIT.IO} (got ${corrupt.code})`);
    }
    // ---------------------------------------------------------------------
    // 8. The fetcher never executes anything. Assert its source has no exec/spawn/npx.
    //    (Defense against a future edit turning the data-only tool into a runner.)
    // ---------------------------------------------------------------------
    const binSrc = fs.readFileSync(BIN, 'utf8');
    // Strip comments/docstrings before scanning so the prose ban ("never `npx skills add`")
    // does not trip this - we care about executable calls, not the warnings that describe them.
    const codeOnly = binSrc
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//') && !l.trimStart().startsWith('/**'))
        .join('\n');
    for (const forbiddenCall of ['child_process', 'execSync', 'execFileSync', 'spawnSync', '.exec(', 'spawn(', 'npx ']) {
        assert(!codeOnly.includes(forbiddenCall), `the fetcher must not contain '${forbiddenCall}' - it is data-only, it never executes`);
    }
    // ---------------------------------------------------------------------
    // 9. wrapUntrusted uses a fence long enough that a tilde run in the body
    //    cannot break out early.
    // ---------------------------------------------------------------------
    const tricky = 'a\n~~~~~~~~ not a real close\nb';
    const w = mod.wrapUntrusted(tricky, {
        source: 's', repo_url: 'r', path: 'skills/x/SKILL.md', commit_sha: 'c',
        retrieved_utc: 't', license: 'MIT', upstream_copyright: 'Copyright (c) 2026 X', sha256: 'h',
    });
    assert(w.includes(tricky), 'wrapUntrusted preserves the body verbatim');
    assert(w.includes('~~~~~~~~~'), 'wrapUntrusted picks a fence longer than the longest tilde run in the body');
    console.log('taste-ingest: OK (allowlist guard, forbidden-manifest exit 4 writes nothing, offline provenance + untrusted wrap, diff no-op vs flag, no-execution, fence safety)');
}
main();
//# sourceMappingURL=taste-ingest.test.js.map