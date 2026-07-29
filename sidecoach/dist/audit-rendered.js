"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIRECTORY_ENTRY_DOCUMENTS = exports.normalizeRenderUrl = exports.looksLikeUrl = void 0;
exports.resolveAuditTarget = resolveAuditTarget;
exports.runRenderedAudit = runRenderedAudit;
// audit-rendered.ts
//
// The `/sidecoach audit <url>` READ PATH. When the audit verb targets a live URL,
// render it and run the SAME proven detection engine the eval measures against the
// oracle (scanRenderedLive: objective a11y + subjective taste lenses), then report
// HONEST findings and an HONEST verdict.
//
// WHY THIS EXISTS: the audit command previously routed to flowK_multi_lens_audit,
// a guidance + static-source-file flow that NEVER rendered the URL and was gated
// behind the entire build pipeline (flowJ -> flowI -> ... -> flowA). So a standalone
// `/sidecoach audit <url>` bailed on prerequisites, never rendered, and reported a
// FALSE "clean / 0 findings". This module is the command-surface counterpart to the
// lane-runner's live validator path - it connects the proven rendered engine to the
// audit command. A diagnosis of an existing URL is the read path; it has no build
// prerequisite (see the "diagnosis IS an audit" rule in CLAUDE.md).
//
// FAIL-CLOSED: scanRenderedLive returns {available:false} on a launch/navigation
// failure. When NEITHER lens rendered, the audit DID NOT RUN -> verdict
// 'inconclusive', NEVER 'clean'. A 'clean' verdict REQUIRES that at least one lens
// actually scanned the page.
const rendered_live_scan_1 = require("./validators/rendered-live-scan");
const project_context_1 = require("./project-context");
const product_rule_registry_1 = require("./product-rule-registry");
// An http(s) URL, localhost[:port][/path], or an ipv4[:port][/path]. Deliberately
// conservative - a non-URL target (a file path, a component name) is left to the flow chain.
// looksLikeUrl / normalizeRenderUrl moved to ./render-target (a zero-dependency module) so a
// caller that only needs to CLASSIFY a target does not pull this file's playwright-bearing
// import graph. Re-exported here because this was their public home and several modules plus
// bin/ import them from it.
var render_target_1 = require("./render-target");
Object.defineProperty(exports, "looksLikeUrl", { enumerable: true, get: function () { return render_target_1.looksLikeUrl; } });
Object.defineProperty(exports, "normalizeRenderUrl", { enumerable: true, get: function () { return render_target_1.normalizeRenderUrl; } });
const render_target_2 = require("./render-target");
// ---------------------------------------------------------------------------
// Audit target resolution: URL *or* local file/directory -> a render URL.
//
// WHY: `/sidecoach audit <path>` is the invocation SKILL.md and CLAUDE.md both
// document, and it was the one shape that never rendered. A non-URL target fell
// through to the guidance-only flow chain, which emitted a confident grade about
// a page it had never looked at - byte-identical output for a 0-byte file and a
// page carrying a skipped heading, 6px text, 1.03:1 contrast and a broken image
// (measured 2026-07-28).
//
// This resolver does NOT introduce a second renderer. It only decides which URL
// to hand to `runRenderedAudit`, and a local document resolves to its `file://`
// URL - exactly the path `bin/sidecoach-detect.js` already drives, and the reason
// `file:` is in ABSOLUTE_DOC_URL_RE above.
//
// FAIL-LOUD: a target that cannot be rendered resolves to `renderable: false`
// with a reason. It is NEVER silently downgraded to a guidance flow that grades
// a page nobody scanned - an honest error beats a confident fiction.
// ---------------------------------------------------------------------------
/** Documents a browser can navigate to and this engine can scan. */
const RENDERABLE_DOC_EXT_RE = /\.(html?|xhtml)$/i;
/** Entry documents probed, in order, when the target is a directory. */
exports.DIRECTORY_ENTRY_DOCUMENTS = ['index.html', 'index.htm'];
/**
 * Resolve an audit target to the URL that should be rendered.
 * Pure except for the `fs` probes, which are injectable for tests.
 */
function resolveAuditTarget(target, opts = {}) {
    const raw = (target ?? '').trim();
    const cwd = opts.cwd ?? process.cwd();
    // Required so the resolver stays unit-testable without touching the disk.
    const statSync = opts.statSync ?? ((p) => nodeFs().statSync(p));
    const toFileUrl = opts.pathToFileUrl ?? ((p) => nodeUrl().pathToFileURL(p).href);
    // An explicit file:// target is a render URL, but it must clear exactly the same gate as a
    // plain path. Codex review (2026-07-28, High): returning it verbatim let `file:///tmp/Button.tsx`,
    // `file:///tmp/not-html.txt`, raw-space URLs and encoded traversal-like URLs all resolve
    // renderable - so the fail-loud guarantee held for path syntax and not for URL syntax, which is
    // the same class of hole as the original defect. Parse it, convert to a path, and fall through
    // to the identical stat + extension checks; the renderUrl is re-emitted canonically.
    let raw2 = raw;
    if (/^file:\/\//i.test(raw)) {
        try {
            raw2 = nodeUrl().fileURLToPath(new URL(raw));
        }
        catch {
            return {
                renderable: false,
                kind: 'missing',
                target: raw,
                reason: `"${raw}" is not a valid file URL.`,
                remedy: 'Pass a plain path, or a well-formed file:// URL (file:///absolute/path/page.html).',
            };
        }
    }
    else if ((0, render_target_2.looksLikeUrl)(raw)) {
        return { renderable: true, kind: 'url', renderUrl: (0, render_target_2.normalizeRenderUrl)(raw) };
    }
    const abs = nodePath().resolve(cwd, raw2);
    let stat;
    try {
        stat = statSync(abs);
    }
    catch {
        return {
            renderable: false,
            kind: 'missing',
            target: raw,
            reason: `"${raw}" is neither a URL nor an existing path (looked for ${abs}).`,
            remedy: 'Pass a URL (http://localhost:3000/page), a local .html file, or a directory containing index.html.',
        };
    }
    if (stat.isDirectory()) {
        for (const entry of exports.DIRECTORY_ENTRY_DOCUMENTS) {
            const candidate = nodePath().join(abs, entry);
            try {
                if (statSync(candidate).isFile()) {
                    return { renderable: true, kind: 'directory', renderUrl: toFileUrl(candidate), resolvedPath: candidate };
                }
            }
            catch {
                // probe the next candidate
            }
        }
        return {
            renderable: false,
            kind: 'no-entry-document',
            target: raw,
            reason: `"${raw}" is a directory with no entry document (looked for ${exports.DIRECTORY_ENTRY_DOCUMENTS.join(', ')} in ${abs}).`,
            remedy: 'Point at the .html file directly, or at the dev-server URL that serves this directory.',
        };
    }
    // Not a directory and not a regular file (socket, fifo, device): there is no document here.
    if (!stat.isFile() || !RENDERABLE_DOC_EXT_RE.test(abs)) {
        return {
            renderable: false,
            kind: 'unsupported-file',
            target: raw,
            reason: `"${raw}" is not a renderable document - this engine scans a rendered page, and a source file is not one.`,
            remedy: 'Render the component first and audit the URL that serves it, or point at the built .html.',
        };
    }
    // Canonical re-emit: pathToFileURL percent-encodes spaces and other characters correctly, so a
    // hand-written file URL cannot smuggle a malformed or ambiguous URL through to the browser.
    return { renderable: true, kind: 'file', renderUrl: toFileUrl(abs), resolvedPath: abs };
}
// Lazily required so this module stays importable in any bundling context that
// only wants looksLikeUrl / normalizeRenderUrl.
function nodeFs() { return require('fs'); }
function nodePath() { return require('path'); }
function nodeUrl() { return require('url'); }
/**
 * Render `target` and run both detection lenses. Pure except for the injected scan
 * (defaults to the real live scanner); deterministic to test via the `scan` seam.
 */
async function runRenderedAudit(target, deps = {}) {
    const renderUrl = (0, render_target_2.normalizeRenderUrl)(target);
    const scan = deps.scan ?? rendered_live_scan_1.scanRenderedLive;
    const brandFamilies = deps.committedFamilies ?? (0, project_context_1.loadCommittedFontFamilies)(deps.projectPath ?? process.cwd());
    const collection = await scan(renderUrl, undefined, brandFamilies.length ? { typeface: { brandFamilies } } : undefined);
    const findings = [];
    const unavailableReasons = [];
    const obj = collection.objective;
    if (obj.available) {
        for (const f of obj.findings) {
            // Resolve blocking|warning through the registry (Stage 3c single source). The registry's canonical
            // severity for every objective rule agrees with the scanner's own error/warning tag - broken-image,
            // skipped-heading, low-contrast and gray-on-color are blocking; justified-text is a warning - so this is
            // behaviour-preserving. The inline error/warning map is the fallback for a finding the registry has not
            // (yet) registered, so an unregistered rule can never be silently dropped or downgraded.
            const res = (0, product_rule_registry_1.resolveRenderedRule)(f.rule);
            findings.push({
                rule: f.rule,
                lens: 'objective',
                severity: res ? (res.blocking ? 'blocking' : 'warning') : (f.severity === 'error' ? 'blocking' : 'warning'),
                selector: f.selector,
                detail: f.detail,
            });
        }
    }
    else {
        unavailableReasons.push(`objective lens unavailable: ${obj.reason}`);
    }
    const subj = collection.subjective;
    if (subj.available) {
        for (const f of subj.findings) {
            // Resolve through the registry (Stage 3c single source). Every subjective/taste rule is non-blocking
            // (minor) - tiny-text, nested-cards, marketing-buzzword, default-typeface - so this resolves to 'warning',
            // identical to the prior inline rule; 'warning' stays the fallback for an unregistered taste finding.
            const res = (0, product_rule_registry_1.resolveRenderedRule)(f.rule);
            findings.push({ rule: f.rule, lens: 'subjective', severity: res ? (res.blocking ? 'blocking' : 'warning') : 'warning', selector: f.selector, detail: f.detail });
        }
    }
    else {
        unavailableReasons.push(`subjective lens unavailable: ${subj.reason}`);
    }
    const blocking = findings.filter((f) => f.severity === 'blocking').length;
    const warning = findings.filter((f) => f.severity === 'warning').length;
    const severityCounts = { blocking, warning, info: 0 };
    // Honest verdict. 'clean' is the STRONGEST claim and requires the MOST evidence:
    // BOTH lenses actually scanned AND found nothing. A partial scan (one lens failed)
    // with zero findings is NOT clean - the lens that did not run may have had blockers
    // (Codex P1). And no lens at all is 'inconclusive', never 'clean'.
    const rendered = obj.available || subj.available;
    const bothLensesRan = obj.available && subj.available;
    let verdict;
    if (!rendered)
        verdict = 'inconclusive'; // no lens ran
    else if (blocking > 0)
        verdict = 'blocked';
    else if (warning > 0)
        verdict = 'warnings-only';
    else if (!bothLensesRan)
        verdict = 'inconclusive'; // partial scan, 0 findings -> cannot certify clean
    else
        verdict = 'clean'; // both lenses ran, zero findings -> truly clean
    const lenses = {
        objective: {
            available: obj.available,
            findings: findings.filter((f) => f.lens === 'objective').length,
            reason: obj.available ? undefined : obj.reason,
        },
        subjective: {
            available: subj.available,
            findings: findings.filter((f) => f.lens === 'subjective').length,
            reason: subj.available ? undefined : subj.reason,
        },
    };
    return { renderUrl, rendered, verdict, findings, severityCounts, unavailableReasons, lenses };
}
//# sourceMappingURL=audit-rendered.js.map