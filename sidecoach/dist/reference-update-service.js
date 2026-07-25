"use strict";
// Reference Update Service
//
// On-demand updater for the five bundled reference systems (component-gallery,
// design-references, fontshare, icon-source, motion-reference). This is the local,
// user-owned counterpart to a hosted reference catalog: the bundles live on disk,
// the user owns them, and an update MERGES an upstream refresh into the local copy
// WITHOUT clobbering the user's own captured references.
//
// TWO-LOCATION MODEL
//   upstream  - the canonical bundles that ship with sidecoach (repo `bundles/`,
//               resolved relative to this module). Read-only source of truth,
//               versioned via `metadata.version` + `versions.changelog`.
//   local     - the user-owned, writable copy a project actually consumes
//               (default `~/.claude/sidecoach/reference-bundles/`). This is what
//               carries the user's merged captures forward across refreshes.
//   captures  - the real `/curate` catalog at `~/.claude/design-references/`
//               (`<slug>/ref.md` with YAML frontmatter). Folded into the
//               design-references bundle's `userCaptured` map on apply.
//
// GUARANTEES
//   - check() is a pure read: it never writes. It compares local vs upstream by
//     version AND by a content hash (so a same-version-but-drifted local reads as
//     stale), and reports how many user captures would be preserved.
//   - apply() is fail-closed and atomic per system: it builds the merged bundle in
//     memory, validates it, writes to a temp file, then renames into place. A read,
//     parse, or validation failure leaves the local bundle BYTE-UNCHANGED - never a
//     partial or corrupt write.
//   - The merge is union-preserving: captures already present on the local copy AND
//     captures scanned from the curate catalog both survive an upstream refresh. A
//     user capture is never lost.
//
// This module does NO network I/O and starts NO scheduler. "Update" means "refresh
// the local copy from the bundles that shipped with this install, on request."
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
exports.ReferenceUpdateService = exports.REFERENCE_SYSTEMS = void 0;
exports.mergeBundle = mergeBundle;
exports.validateBundle = validateBundle;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// The five bundled reference systems. Names match the bundle filenames
// (`<name>.json`) in both the upstream and local directories.
exports.REFERENCE_SYSTEMS = [
    'component-gallery',
    'design-references',
    'fontshare',
    'icon-source',
    'motion-reference',
];
// Per-system required top-level keys, checked in addition to metadata. A bundle that
// is missing its required keys is treated as invalid and is never written to local.
const REQUIRED_KEYS = {
    'component-gallery': ['interactionStates', 'components'],
    'design-references': ['colorPalettes', 'spatialSystems'],
    fontshare: ['fontCategories', 'useCases'],
    'icon-source': ['libraries', 'categories'],
    'motion-reference': ['easingCurves', 'motionPatterns'],
};
const START_MARKER = '<!-- sidecoach:reference-bundles:start -->';
const END_MARKER = '<!-- sidecoach:reference-bundles:end -->';
class ReferenceUpdateService {
    constructor(options = {}) {
        this.upstreamDir =
            options.upstreamDir ?? path.resolve(__dirname, '..', 'bundles');
        this.localDir =
            options.localDir ??
                path.join(os.homedir(), '.claude', 'sidecoach', 'reference-bundles');
        this.capturesDir =
            options.capturesDir ?? path.join(os.homedir(), '.claude', 'design-references');
        this.designMdPath =
            options.designMdPath ?? path.join(process.cwd(), 'DESIGN.md');
    }
    getPaths() {
        return {
            upstreamDir: this.upstreamDir,
            localDir: this.localDir,
            capturesDir: this.capturesDir,
            designMdPath: this.designMdPath,
        };
    }
    // ----- CHECK (pure read; never writes) -----------------------------------
    check() {
        const catalog = this.scanCaptures();
        return exports.REFERENCE_SYSTEMS.map((system) => this.checkSystem(system, catalog));
    }
    checkSystem(system, catalog) {
        let upstream;
        try {
            upstream = this.readBundle(this.upstreamPath(system));
        }
        catch (err) {
            // A broken upstream is an error the caller must see, not a silent "current".
            return {
                system,
                status: 'error',
                localVersion: null,
                upstreamVersion: null,
                reason: `upstream unreadable: ${errMsg(err)}`,
                userCaptures: 0,
            };
        }
        const upstreamVersion = bundleVersion(upstream);
        const localExists = fs.existsSync(this.localPath(system));
        if (!localExists) {
            return {
                system,
                status: 'not-installed',
                localVersion: null,
                upstreamVersion,
                reason: 'missing-local',
                userCaptures: this.captureCountFor(system, null, catalog),
            };
        }
        let local;
        try {
            local = this.readBundle(this.localPath(system));
        }
        catch (err) {
            // A corrupt local copy is stale by definition - an apply would replace it.
            return {
                system,
                status: 'stale',
                localVersion: null,
                upstreamVersion,
                reason: `local unreadable: ${errMsg(err)}`,
                userCaptures: this.captureCountFor(system, null, catalog),
            };
        }
        const localVersion = bundleVersion(local);
        const userCaptures = this.captureCountFor(system, local, catalog);
        if (localVersion !== upstreamVersion) {
            return { system, status: 'stale', localVersion, upstreamVersion, reason: 'version', userCaptures };
        }
        if (contentHash(local) !== contentHash(upstream)) {
            return { system, status: 'stale', localVersion, upstreamVersion, reason: 'content', userCaptures };
        }
        return { system, status: 'current', localVersion, upstreamVersion, reason: 'up-to-date', userCaptures };
    }
    // ----- APPLY (fail-closed, atomic per system) ----------------------------
    // Installs/refreshes the requested systems (default: every stale or not-installed
    // one). Each system is independent: a failure on one leaves its local copy
    // unchanged and does not abort the others. DESIGN.md is stamped once at the end
    // with whatever is installed after the run.
    apply(opts = {}) {
        const catalog = this.scanCaptures();
        const onlyStale = opts.onlyStale ?? true;
        const stampDesignMd = opts.stampDesignMd ?? true;
        let targets;
        if (opts.systems && opts.systems.length) {
            targets = opts.systems;
        }
        else if (onlyStale) {
            // Include 'error' systems (e.g. a broken upstream) so they surface as a failed
            // apply and a nonzero exit, rather than being silently dropped from the run.
            targets = this.check()
                .filter((c) => c.status === 'stale' || c.status === 'not-installed' || c.status === 'error')
                .map((c) => c.system);
        }
        else {
            targets = [...exports.REFERENCE_SYSTEMS];
        }
        const results = targets.map((system) => this.applySystem(system, catalog));
        // Stamp DESIGN.md only if at least one system was actually written (or already
        // installed) - a run that failed everything must not rewrite the doc.
        const anyWritten = results.some((r) => r.status === 'installed' || r.status === 'refreshed');
        const designMd = stampDesignMd && anyWritten
            ? this.updateDesignMd()
            : {
                updated: false,
                path: this.designMdPath,
                reason: stampDesignMd ? 'no-write-this-run' : 'disabled',
                failed: false,
            };
        return { results, designMd };
    }
    applySystem(system, catalog) {
        const localPath = this.localPath(system);
        const localExisted = fs.existsSync(localPath);
        // 1. Read upstream (the "fetch"). Failure here = upstream error, local untouched.
        let upstream;
        try {
            upstream = this.readBundle(this.upstreamPath(system));
        }
        catch (err) {
            return this.failure(system, 'upstream', err, localExisted ? this.safeVersion(localPath) : null);
        }
        // 2. Read the existing local copy (if any) to carry its captures forward. If a
        //    present local copy cannot be parsed, REFUSE to overwrite it: it may hold
        //    captures not in the catalog, and a blind replace would silently lose them.
        //    Fail closed - leave the file byte-unchanged and report an io error.
        let existingLocal = null;
        if (localExisted) {
            try {
                existingLocal = this.readBundle(localPath);
            }
            catch (err) {
                return this.failure(system, 'io', new Error(`local copy unreadable; refusing to overwrite (would risk losing captures): ${errMsg(err)}`), null);
            }
        }
        const previousVersion = existingLocal ? bundleVersion(existingLocal) : null;
        // 3. Build the merged bundle in memory (union-preserving captures).
        const { merged, mergedCount } = mergeBundle(system, upstream, existingLocal, catalog);
        // 4. Validate BEFORE writing. Invalid merge = validation error, local untouched.
        if (!validateBundle(merged, system)) {
            return this.failure(system, 'validation', new Error('merged bundle failed structural validation'), previousVersion);
        }
        // 5. Short-circuit: if local already byte-matches what we would write, do nothing.
        const serialized = JSON.stringify(merged, null, 2) + '\n';
        if (localExisted && existingLocal && fileMatches(localPath, serialized)) {
            return {
                system,
                status: 'unchanged',
                previousVersion,
                newVersion: bundleVersion(merged),
                mergedUserCaptures: mergedCount,
                bytesWritten: 0,
            };
        }
        // 6. Atomic write (temp + rename). Failure = io error, local untouched.
        try {
            this.ensureLocalDir();
            atomicWrite(localPath, serialized);
        }
        catch (err) {
            return this.failure(system, 'io', err, previousVersion);
        }
        return {
            system,
            status: localExisted ? 'refreshed' : 'installed',
            previousVersion,
            newVersion: bundleVersion(merged),
            mergedUserCaptures: mergedCount,
            bytesWritten: Buffer.byteLength(serialized),
        };
    }
    failure(system, errorClass, err, previousVersion) {
        return {
            system,
            status: 'failed',
            previousVersion,
            newVersion: previousVersion,
            mergedUserCaptures: 0,
            bytesWritten: 0,
            error: errMsg(err),
            errorClass,
        };
    }
    // ----- DESIGN.md stamp (idempotent, comment-bracketed) --------------------
    // Records the versions of the currently-installed local bundles in a managed block
    // bracketed by HTML comment markers. It uses a bold label + table rather than a
    // `##` heading so it does not add a section to a Google-spec DESIGN.md body. Only
    // runs when DESIGN.md already exists; never creates it.
    updateDesignMd() {
        const p = this.designMdPath;
        if (!fs.existsSync(p)) {
            return { updated: false, path: p, reason: 'no-design-md', failed: false };
        }
        const installed = this.installedVersions();
        if (!installed.length) {
            return { updated: false, path: p, reason: 'no-installed-systems', failed: false };
        }
        const rows = installed.map((e) => `| ${e.system} | ${e.version} | ${today()} |`).join('\n');
        const block = [
            START_MARKER,
            '**Reference bundles** (managed by sidecoach-refs - do not edit by hand)',
            '',
            '| System | Version | Installed |',
            '| --- | --- | --- |',
            rows,
            END_MARKER,
        ].join('\n');
        let content;
        try {
            content = fs.readFileSync(p, 'utf-8');
        }
        catch (err) {
            return { updated: false, path: p, reason: `read failed: ${errMsg(err)}`, failed: true };
        }
        let next;
        const start = content.indexOf(START_MARKER);
        const end = content.indexOf(END_MARKER);
        if (start !== -1 && end !== -1 && end > start) {
            next = content.slice(0, start) + block + content.slice(end + END_MARKER.length);
        }
        else {
            const sep = content.endsWith('\n') ? '\n' : '\n\n';
            next = content + sep + block + '\n';
        }
        if (next === content) {
            return { updated: false, path: p, reason: 'unchanged', failed: false };
        }
        try {
            atomicWrite(p, next);
        }
        catch (err) {
            return { updated: false, path: p, reason: `write failed: ${errMsg(err)}`, failed: true };
        }
        return { updated: true, path: p, reason: 'written', failed: false };
    }
    installedVersions() {
        const out = [];
        for (const system of exports.REFERENCE_SYSTEMS) {
            const lp = this.localPath(system);
            if (!fs.existsSync(lp))
                continue;
            try {
                out.push({ system, version: bundleVersion(this.readBundle(lp)) });
            }
            catch {
                // Skip a corrupt local copy from the stamp.
            }
        }
        return out;
    }
    // ----- Captures (the real /curate catalog) --------------------------------
    // Scans ~/.claude/design-references/<slug>/ref.md and parses the YAML frontmatter
    // into CapturedReference records keyed by slug. Soft-fails per entry so one
    // malformed ref.md never sinks the scan. Mirrors reference-data.ts parsing.
    scanCaptures() {
        const out = {};
        if (!fs.existsSync(this.capturesDir))
            return out;
        let folders;
        try {
            folders = fs.readdirSync(this.capturesDir);
        }
        catch {
            return out;
        }
        for (const folder of folders) {
            if (folder.startsWith('.') || folder.startsWith('_'))
                continue; // skip _vocab, dotdirs
            const refPath = path.join(this.capturesDir, folder, 'ref.md');
            let content;
            try {
                if (!fs.statSync(path.join(this.capturesDir, folder)).isDirectory())
                    continue;
                if (!fs.existsSync(refPath))
                    continue;
                content = fs.readFileSync(refPath, 'utf-8');
            }
            catch {
                continue;
            }
            const parsed = parseCaptureRef(folder, content);
            if (parsed)
                out[folder] = parsed;
        }
        return out;
    }
    // Count of captures an apply would preserve for a system: existing local captures
    // unioned with catalog captures (design-references only). Mirrors mergeBundle.
    captureCountFor(system, local, catalog) {
        const keys = new Set();
        if (local && local.userCaptured && typeof local.userCaptured === 'object') {
            for (const k of Object.keys(local.userCaptured))
                keys.add(k);
        }
        if (system === 'design-references') {
            for (const k of Object.keys(catalog))
                keys.add(k);
        }
        return keys.size;
    }
    // ----- path + io helpers --------------------------------------------------
    upstreamPath(system) {
        return path.join(this.upstreamDir, `${system}.json`);
    }
    localPath(system) {
        return path.join(this.localDir, `${system}.json`);
    }
    readBundle(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    safeVersion(filePath) {
        try {
            return bundleVersion(this.readBundle(filePath));
        }
        catch {
            return null;
        }
    }
    ensureLocalDir() {
        fs.mkdirSync(this.localDir, { recursive: true });
    }
}
exports.ReferenceUpdateService = ReferenceUpdateService;
// ----- pure helpers ---------------------------------------------------------
function bundleVersion(bundle) {
    return ((bundle && bundle.metadata && bundle.metadata.version) ||
        (bundle && bundle.versions && bundle.versions.current) ||
        '0.0.0');
}
// Stable stringify (sorted keys) so the content hash is deterministic regardless of
// key order. Excludes the local-only `userCaptured` map so a captured local copy is
// not reported as content-drifted from a capture-free upstream.
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return '[' + value.map(stableStringify).join(',') + ']';
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}
function contentHash(bundle) {
    const { userCaptured, ...rest } = bundle && typeof bundle === 'object' ? bundle : {};
    void userCaptured;
    return crypto.createHash('sha256').update(stableStringify(rest)).digest('hex');
}
// Union-preserving merge: fresh upstream content + (existing local captures UNION
// curate-catalog captures). Catalog wins on slug conflict (it is the fresher source
// of truth for a capture). A user capture present in either source always survives.
function mergeBundle(system, upstream, existingLocal, catalog) {
    const merged = deepClone(upstream);
    const captured = {};
    if (existingLocal && existingLocal.userCaptured && typeof existingLocal.userCaptured === 'object') {
        Object.assign(captured, existingLocal.userCaptured);
    }
    if (system === 'design-references') {
        for (const [slug, rec] of Object.entries(catalog)) {
            captured[slug] = rec;
        }
    }
    const count = Object.keys(captured).length;
    if (count > 0) {
        merged.userCaptured = captured;
    }
    return { merged, mergedCount: count };
}
function validateBundle(data, system) {
    if (!data || typeof data !== 'object')
        return false;
    if (!data.metadata || !data.metadata.name || !data.metadata.version)
        return false;
    const req = REQUIRED_KEYS[system];
    if (!req)
        return false;
    return req.every((key) => key in data && data[key] != null);
}
// Parse a curate ref.md into a CapturedReference. Frontmatter is `key: value` with
// `patterns`/`feel` as `[a, b, c]` lists and quoted strings for title/source/url.
function parseCaptureRef(slug, content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match)
        return null;
    const [, frontmatter, body] = match;
    const meta = {};
    for (const line of frontmatter.split('\n')) {
        if (!line.trim() || !line.includes(':'))
            continue;
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (key === 'patterns' || key === 'feel') {
            meta[key] = value
                .replace(/[[\]]/g, '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
        else {
            meta[key] = value.replace(/^"(.*)"$/, '$1');
        }
    }
    return {
        id: slug,
        title: meta.title || 'Untitled',
        category: meta.category || 'reference',
        patterns: meta.patterns || [],
        feel: meta.feel || [],
        source: meta.source || '',
        url: meta.url || '',
        saved: meta.saved || '',
        description: (body || '').trim(),
    };
}
// Atomic write: temp file in the same directory + rename. rename(2) is atomic on
// POSIX within a filesystem, so a reader never observes a half-written bundle and a
// crash mid-write leaves the previous file intact.
function atomicWrite(finalPath, data) {
    const dir = path.dirname(finalPath);
    const tmp = path.join(dir, `.${path.basename(finalPath)}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
    try {
        fs.writeFileSync(tmp, data);
        fs.renameSync(tmp, finalPath);
    }
    catch (err) {
        try {
            if (fs.existsSync(tmp))
                fs.unlinkSync(tmp);
        }
        catch {
            // best-effort cleanup
        }
        throw err;
    }
}
function fileMatches(filePath, content) {
    try {
        return fs.readFileSync(filePath, 'utf-8') === content;
    }
    catch {
        return false;
    }
}
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
function errMsg(err) {
    return err instanceof Error ? err.message : String(err);
}
function today() {
    return new Date().toISOString().split('T')[0];
}
//# sourceMappingURL=reference-update-service.js.map