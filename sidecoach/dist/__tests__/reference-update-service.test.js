"use strict";
// Standalone test for the reference update service (run: npx ts-node <this file>).
// Exercises the real check/apply/merge/fail-closed paths against tmp fixtures - no
// network, no touching of the real ~/.claude home. Exits nonzero on the first
// failure, prints PASS at the end. Matches the repo's framework-free test convention.
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
const assert = __importStar(require("assert"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const reference_update_service_1 = require("../reference-update-service");
function fail(msg) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
}
function ok(cond, msg) {
    try {
        assert.ok(cond);
    }
    catch {
        fail(msg);
    }
}
function eq(a, b, msg) {
    if (a !== b)
        fail(`${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}
// The two required top-level keys per system (must match the service's validation).
const REQ = {
    'component-gallery': ['interactionStates', 'components'],
    'design-references': ['colorPalettes', 'spatialSystems'],
    fontshare: ['fontCategories', 'useCases'],
    'icon-source': ['libraries', 'categories'],
    'motion-reference': ['easingCurves', 'motionPatterns'],
};
function makeBundle(system, version, marker = 'base') {
    const b = {
        metadata: { name: system, version, lastUpdated: '2026-07-25', provider: 'sidecoach' },
        versions: { current: version, changelog: [{ version, date: '2026-07-25', changes: marker }] },
    };
    for (const key of REQ[system])
        b[key] = { _marker: marker };
    return b;
}
function writeBundle(dir, system, bundle) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${system}.json`), JSON.stringify(bundle, null, 2) + '\n');
}
function writeUpstream(dir, version = '1.0.0') {
    for (const system of reference_update_service_1.REFERENCE_SYSTEMS)
        writeBundle(dir, system, makeBundle(system, version));
}
function plantCapture(capturesDir, slug, title) {
    const d = path.join(capturesDir, slug);
    fs.mkdirSync(d, { recursive: true });
    const md = `---
title: "${title}"
category: interactive-element
patterns: [test-pattern, planted]
feel: [snappy, test]
source: "example.com"
url: "https://example.com/${slug}"
saved: 2026-07-25
---
Body describing ${slug}. This is the capture that must survive an upstream refresh.
`;
    fs.writeFileSync(path.join(d, 'ref.md'), md);
}
function sha(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function tmpFiles(dir) {
    if (!fs.existsSync(dir))
        return [];
    return fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));
}
function makeWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-refs-'));
    return {
        root,
        upstream: path.join(root, 'upstream'),
        local: path.join(root, 'local'),
        captures: path.join(root, 'captures'),
        designMd: path.join(root, 'DESIGN.md'),
    };
}
const created = [];
function ws() {
    const w = makeWorkspace();
    created.push(w.root);
    return w;
}
function cleanup() {
    for (const r of created) {
        try {
            fs.rmSync(r, { recursive: true, force: true });
        }
        catch {
            /* best effort */
        }
    }
}
// ---------------------------------------------------------------------------
// 1. Pure helpers: validation + union-preserving merge
// ---------------------------------------------------------------------------
(function testHelpers() {
    ok((0, reference_update_service_1.validateBundle)(makeBundle('fontshare', '1.0.0'), 'fontshare'), 'valid bundle should validate');
    const missing = makeBundle('fontshare', '1.0.0');
    delete missing.useCases;
    ok(!(0, reference_update_service_1.validateBundle)(missing, 'fontshare'), 'missing required key should fail validation');
    const noMeta = makeBundle('fontshare', '1.0.0');
    delete noMeta.metadata;
    ok(!(0, reference_update_service_1.validateBundle)(noMeta, 'fontshare'), 'missing metadata should fail validation');
    // merge unions existing-local captures with catalog captures; catalog wins on conflict.
    const upstream = makeBundle('design-references', '2.0.0');
    const existingLocal = makeBundle('design-references', '1.0.0');
    existingLocal.userCaptured = {
        'only-in-local': { id: 'only-in-local', title: 'Local only' },
        shared: { id: 'shared', title: 'STALE from local' },
    };
    const catalog = {
        shared: { id: 'shared', title: 'FRESH from catalog' },
        'only-in-catalog': { id: 'only-in-catalog', title: 'Catalog only' },
    };
    const { merged, mergedCount } = (0, reference_update_service_1.mergeBundle)('design-references', upstream, existingLocal, catalog);
    eq(mergedCount, 3, 'union should be 3 captures');
    eq(merged.metadata.version, '2.0.0', 'merged carries fresh upstream version');
    ok(merged.userCaptured['only-in-local'], 'local-only capture preserved');
    ok(merged.userCaptured['only-in-catalog'], 'catalog-only capture merged');
    eq(merged.userCaptured['shared'].title, 'FRESH from catalog', 'catalog wins slug conflict');
    // Non-design-references systems still carry forward pre-existing local captures.
    const mLocal = makeBundle('motion-reference', '1.0.0');
    mLocal.userCaptured = { keep: { id: 'keep' } };
    const mm = (0, reference_update_service_1.mergeBundle)('motion-reference', makeBundle('motion-reference', '2.0.0'), mLocal, catalog);
    eq(mm.mergedCount, 1, 'motion keeps its own capture, ignores design catalog');
    ok(mm.merged.userCaptured['keep'], 'motion local capture preserved across refresh');
    console.log('  [1] helpers: validation + union merge OK');
})();
// ---------------------------------------------------------------------------
// 2. check() on an empty local: everything not-installed, captures counted
// ---------------------------------------------------------------------------
(function testCheckEmpty() {
    const w = ws();
    writeUpstream(w.upstream);
    plantCapture(w.captures, 'planted-a-2026-07-25', 'Planted A');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    const results = svc.check();
    eq(results.length, 5, 'check returns all 5 systems');
    ok(results.every((r) => r.status === 'not-installed'), 'all not-installed on empty local');
    const dref = results.find((r) => r.system === 'design-references');
    eq(dref.userCaptures, 1, 'design-references sees the 1 planted capture');
    ok(!fs.existsSync(w.local), 'check created no local dir');
    console.log('  [2] check on empty local OK');
})();
// ---------------------------------------------------------------------------
// 3. apply() fresh install: bundles land, capture merged, DESIGN.md stamped
// ---------------------------------------------------------------------------
(function testApplyInstall() {
    const w = ws();
    writeUpstream(w.upstream);
    fs.writeFileSync(w.designMd, '# Project DESIGN\n\nBody.\n');
    plantCapture(w.captures, 'planted-a-2026-07-25', 'Planted A');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    const { results, designMd } = svc.apply();
    eq(results.length, 5, 'apply processed all 5');
    ok(results.every((r) => r.status === 'installed'), 'all installed');
    for (const system of reference_update_service_1.REFERENCE_SYSTEMS) {
        ok(fs.existsSync(path.join(w.local, `${system}.json`)), `${system} written to local`);
    }
    const localDref = JSON.parse(fs.readFileSync(path.join(w.local, 'design-references.json'), 'utf-8'));
    ok(localDref.userCaptured, 'design-references local has userCaptured');
    ok(localDref.userCaptured['planted-a-2026-07-25'], 'planted capture present in local bundle');
    eq(localDref.userCaptured['planted-a-2026-07-25'].title, 'Planted A', 'capture title parsed from ref.md');
    ok(Array.isArray(localDref.userCaptured['planted-a-2026-07-25'].patterns), 'capture patterns parsed as array');
    ok(designMd.updated, 'DESIGN.md stamped');
    const dm = fs.readFileSync(w.designMd, 'utf-8');
    ok(dm.includes('sidecoach:reference-bundles:start'), 'DESIGN.md has managed start marker');
    ok(dm.includes('| design-references | 1.0.0 |'), 'DESIGN.md lists installed version');
    ok(dm.startsWith('# Project DESIGN'), 'DESIGN.md original content preserved');
    console.log('  [3] apply fresh install + capture merge + DESIGN.md stamp OK');
})();
// ---------------------------------------------------------------------------
// 4. THE MONEY PROOF: upstream refresh preserves user captures (union)
// ---------------------------------------------------------------------------
(function testRefreshPreservesCaptures() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    plantCapture(w.captures, 'catalog-cap-2026-07-25', 'From catalog');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    // First install.
    svc.apply();
    // Simulate a capture that lives ONLY in the local bundle (came from a prior merge,
    // not currently in the catalog) - the kind an upstream refresh must never lose.
    const localPath = path.join(w.local, 'design-references.json');
    const local1 = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    local1.userCaptured['legacy-local-only'] = { id: 'legacy-local-only', title: 'Legacy local capture' };
    fs.writeFileSync(localPath, JSON.stringify(local1, null, 2) + '\n');
    // Upstream ships a NEW version with drifted content.
    writeUpstream(w.upstream, '2.0.0');
    const check = svc.check().find((r) => r.system === 'design-references');
    eq(check.status, 'stale', 'design-references reads stale after upstream bump');
    eq(check.reason, 'version', 'stale reason is version');
    // Refresh.
    const { results } = svc.apply();
    const dref = results.find((r) => r.system === 'design-references');
    eq(dref.status, 'refreshed', 'design-references refreshed');
    eq(dref.newVersion, '2.0.0', 'picked up new upstream version');
    const local2 = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    eq(local2.metadata.version, '2.0.0', 'local now on upstream version');
    ok(local2.userCaptured['catalog-cap-2026-07-25'], 'catalog capture survived refresh');
    ok(local2.userCaptured['legacy-local-only'], 'legacy local-only capture survived refresh (never clobbered)');
    eq(Object.keys(local2.userCaptured).length, 2, 'both captures present, none lost');
    console.log('  [4] upstream refresh preserves ALL user captures (union) OK');
})();
// ---------------------------------------------------------------------------
// 5. FAIL-CLOSED (validation): a structurally invalid upstream leaves local intact
// ---------------------------------------------------------------------------
(function testFailClosedValidation() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    svc.apply(); // seed a good local
    const localPath = path.join(w.local, 'fontshare.json');
    const before = sha(localPath);
    // Corrupt the upstream fontshare so the MERGED bundle fails validation.
    const badUpstream = makeBundle('fontshare', '9.9.9');
    delete badUpstream.useCases; // required key missing -> validation must fail
    writeBundle(w.upstream, 'fontshare', badUpstream);
    const { results } = svc.apply({ systems: ['fontshare'], onlyStale: false });
    const r = results[0];
    eq(r.status, 'failed', 'invalid upstream apply fails');
    eq(r.errorClass, 'validation', 'error class is validation');
    eq(sha(localPath), before, 'local fontshare byte-unchanged after validation failure');
    eq(tmpFiles(w.local).length, 0, 'no temp file left behind');
    console.log('  [5] fail-closed on validation: local byte-unchanged, no partial write OK');
})();
// ---------------------------------------------------------------------------
// 6. FAIL-CLOSED (upstream): unreadable/invalid-JSON upstream leaves local intact
// ---------------------------------------------------------------------------
(function testFailClosedUpstream() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    svc.apply();
    const localPath = path.join(w.local, 'icon-source.json');
    const before = sha(localPath);
    // Upstream icon-source is now invalid JSON (a truncated/corrupt "fetch").
    fs.writeFileSync(path.join(w.upstream, 'icon-source.json'), '{ this is not valid json ');
    const { results } = svc.apply({ systems: ['icon-source'], onlyStale: false });
    const r = results[0];
    eq(r.status, 'failed', 'unreadable upstream apply fails');
    eq(r.errorClass, 'upstream', 'error class is upstream');
    eq(sha(localPath), before, 'local icon-source byte-unchanged after upstream failure');
    eq(tmpFiles(w.local).length, 0, 'no temp file left behind');
    console.log('  [6] fail-closed on bad upstream: local byte-unchanged OK');
})();
// ---------------------------------------------------------------------------
// 7. content-drift detection + idempotent apply
// ---------------------------------------------------------------------------
(function testDriftAndIdempotency() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    svc.apply();
    // Second apply with nothing changed -> unchanged, zero bytes written.
    const second = svc.apply({ onlyStale: false });
    ok(second.results.every((r) => r.status === 'unchanged'), 're-apply is idempotent (all unchanged)');
    ok(second.results.every((r) => r.bytesWritten === 0), 'idempotent apply writes zero bytes');
    // Same version but drifted content on upstream -> stale via content hash.
    const drift = makeBundle('component-gallery', '1.0.0', 'DRIFTED');
    writeBundle(w.upstream, 'component-gallery', drift);
    const c = svc.check().find((r) => r.system === 'component-gallery');
    eq(c.status, 'stale', 'same-version drifted content reads stale');
    eq(c.reason, 'content', 'stale reason is content hash');
    console.log('  [7] content-drift detection + idempotent apply OK');
})();
// ---------------------------------------------------------------------------
// 8. Default apply must NOT silently drop an error-status system (Codex High #1)
// ---------------------------------------------------------------------------
(function testDefaultApplySurfacesUpstreamError() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    svc.apply(); // install all cleanly
    // Break one upstream so check() marks it 'error' (not stale/not-installed).
    fs.writeFileSync(path.join(w.upstream, 'fontshare.json'), '{ broken json ');
    const chk = svc.check().find((r) => r.system === 'fontshare');
    eq(chk.status, 'error', 'broken upstream reads as error in check');
    // Default apply (no --systems, onlyStale) must still pick it up and FAIL on it,
    // not omit it and report success.
    const { results } = svc.apply();
    const r = results.find((x) => x.system === 'fontshare');
    ok(r, 'default apply includes the error-status system');
    eq(r.status, 'failed', 'error-status system fails the apply');
    eq(r.errorClass, 'upstream', 'surfaced as upstream error class');
    console.log('  [8] default apply surfaces (not hides) upstream error OK');
})();
// ---------------------------------------------------------------------------
// 9. A corrupt LOCAL bundle is refused, never overwritten (Codex High #2)
// ---------------------------------------------------------------------------
(function testCorruptLocalRefused() {
    const w = ws();
    writeUpstream(w.upstream, '1.0.0');
    const svc = new reference_update_service_1.ReferenceUpdateService({ upstreamDir: w.upstream, localDir: w.local, capturesDir: w.captures, designMdPath: w.designMd });
    svc.apply();
    // A local copy holding a capture NOT in the catalog, then corrupted on disk.
    const localPath = path.join(w.local, 'design-references.json');
    const local = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    local.userCaptured = { 'precious-local': { id: 'precious-local', title: 'irreplaceable' } };
    const goodJson = JSON.stringify(local, null, 2) + '\n';
    fs.writeFileSync(localPath, goodJson);
    // Now truncate/corrupt it so it cannot be parsed.
    fs.writeFileSync(localPath, goodJson.slice(0, 40) + '   <<corrupt');
    const before = sha(localPath);
    // Bump upstream so an apply is attempted.
    writeUpstream(w.upstream, '2.0.0');
    const { results } = svc.apply({ systems: ['design-references'], onlyStale: false });
    const r = results[0];
    eq(r.status, 'failed', 'corrupt local apply fails (refuses to overwrite)');
    eq(r.errorClass, 'io', 'error class io - cannot safely read local to preserve captures');
    eq(sha(localPath), before, 'corrupt local left byte-unchanged (not clobbered)');
    eq(tmpFiles(w.local).length, 0, 'no temp file left behind');
    console.log('  [9] corrupt local refused, never overwritten OK');
})();
cleanup();
console.log('reference-update-service test PASS');
//# sourceMappingURL=reference-update-service.test.js.map