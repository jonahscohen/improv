"use strict";
// sidecoach/src/render-target.ts
//
// Is this target a URL, and what document URL should be rendered for it. Pure string logic,
// ZERO dependencies.
//
// WHY IT IS ITS OWN MODULE (2026-07-29): these two helpers used to live in audit-rendered.ts,
// whose import graph reaches playwright through rendered-live-scan. Every consumer that only
// wanted to CLASSIFY a target therefore paid for the browser driver. Measured on
// bin/sidecoach-detect.js: requiring audit-rendered cost 146ms of a 188ms static scan - 78% of
// the run spent loading a browser automation library the --no-render path never uses.
//
// audit-rendered re-exports both names, so every existing importer is unaffected.
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksLikeUrl = looksLikeUrl;
exports.normalizeRenderUrl = normalizeRenderUrl;
exports.renderUrlFromContext = renderUrlFromContext;
const URL_RE = /^(https?:\/\/\S+|localhost(:\d+)?(\/\S*)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?)$/i;
// A bare host.tld[:port][/path]. Only treated as a URL with a STRONG signal (explicit port,
// a path, or a recognized public TLD), and NEVER when the host itself is a source/asset file -
// so 'example.com' and 'example.com/path' work without mistaking 'Card.tsx' or 'styles.css'
// for a URL (Codex P2).
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;
const SOURCE_OR_ASSET_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|css|s[ca]ss|less|json|ya?ml|toml|md|markdown|html?|xml|vue|svelte|astro|py|go|rs|rb|java|kt|c|cc|cpp|h|hpp|sh|sql|txt|png|jpe?g|gif|svg|webp|avif|ico|pdf)$/i;
const COMMON_TLD_RE = /\.(com|org|net|io|dev|app|co|ai|xyz|sh|me|gg|info|biz|us|uk|ca|de|fr|jp|au|nl|so|tv|page|site|tech)$/i;
function looksLikeUrl(target) {
    if (!target)
        return false;
    const t = target.trim();
    if (URL_RE.test(t))
        return true;
    if (!BARE_DOMAIN_RE.test(t))
        return false;
    const host = t.split(/[/:]/)[0]; // strip any :port and /path
    if (SOURCE_OR_ASSET_EXT_RE.test(host))
        return false; // 'Card.tsx' / 'styles.css' are files, not URLs
    return /:\d+/.test(t) || t.includes('/') || COMMON_TLD_RE.test(host);
}
// An ALREADY-ABSOLUTE document URL keeps its scheme; a bare host/host:port gets http://.
// file: is included because a LOCAL .html target is rendered by navigating to its file URL
// (the `detect` CLI's local-file path) and the rendered scan's hermeticity policy already
// models a file: document explicitly (isSubresourceAllowed: a file: document may load
// same-protocol subresources only). Without file: here, `file:///x.html` was rewritten to
// `http://file:///x.html` and every local-file render failed with ERR_NAME_NOT_RESOLVED.
const ABSOLUTE_DOC_URL_RE = /^(https?|file):\/\//i;
function normalizeRenderUrl(target) {
    const t = target.trim();
    return ABSOLUTE_DOC_URL_RE.test(t) ? t : `http://${t}`;
}
/**
 * The document URL to render for a validation context, or undefined when there is none.
 *
 * Only http/https/file/data are accepted: anything else is not a document this engine renders,
 * and returning undefined is what makes the browser lenses report unavailable rather than
 * attempt a navigation they cannot complete.
 */
function renderUrlFromContext(raw) {
    const r = raw;
    const candidate = typeof r?.renderUrl === 'string' ? r.renderUrl : typeof r?.target === 'string' ? r.target : undefined;
    if (!candidate)
        return undefined;
    try {
        const u = new URL(candidate);
        return ['http:', 'https:', 'file:', 'data:'].includes(u.protocol) ? u.href : undefined;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=render-target.js.map