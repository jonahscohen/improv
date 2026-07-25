"use strict";
/**
 * Sidecoach pre-render authorship (Stage 2b) - author, render, THEN build (contract-then-verify).
 *
 * Before a full build proceeds, this step AUTHORS two artifacts from a brief and RENDERS them through the
 * shipping engine so the build starts on a verified contract instead of a hope:
 *   1. a design-system BOARD - the token set (colors + type scale) and a component inventory, as one
 *      self-contained HTML page, and
 *   2. a first-surface MOCK - the brief's opening screen as real HTML.
 * The bin renders BOTH headless via the existing Playwright engine and runs the SHIPPING audit
 * (runRenderedAudit) over each. The build PROCEEDS only when the mock audit returns a REAL verdict
 * (clean or warnings-only) - never on an inconclusive (a scan that did not run) and never on a blocked mock.
 *
 * WHAT THIS FILE IS NOT: it does not render, launch a browser, or touch the disk. It is the PURE half -
 * brief parsing, deterministic HTML construction, and the fail-closed gate decision - so every piece is
 * provable without a browser. The bin (bin/sidecoach-preauthor.js) owns the IO and the render; there is
 * exactly one detection engine in the product and it is the scanner's, reached here only through the audit
 * result the bin hands to decidePreauthorGate.
 *
 * DETERMINISM: buildBoardHtml / buildMockHtml are pure string builders over the brief - the same brief yields
 * byte-identical HTML, so the render and therefore the verdict are reproducible. No clock, no RNG.
 *
 * FAIL-CLOSED: decidePreauthorGate inherits audit-rendered's discipline - an artifact that did not render is
 * `inconclusive`, which HALTS (never a silent proceed). "renders both" is a requirement, so a non-render on
 * EITHER artifact halts; the MOCK is the blocker gate (the plan scopes the proceed decision to the mock).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREAUTHOR_EXIT = void 0;
exports.parseBrief = parseBrief;
exports.buildBoardHtml = buildBoardHtml;
exports.buildMockHtml = buildMockHtml;
exports.decidePreauthorGate = decidePreauthorGate;
const DEFAULT_COMPONENTS = ['button-primary', 'button-secondary', 'card', 'input', 'link'];
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function reqString(raw, label) {
    if (typeof raw !== 'string' || raw.trim() === '') {
        throw new Error(`brief.${label}: required non-empty string`);
    }
    return raw.trim();
}
function reqHex(raw, label) {
    const s = reqString(raw, label);
    if (!HEX_RE.test(s))
        throw new Error(`brief.${label}: expected an #rgb or #rrggbb hex color, got ${JSON.stringify(raw)}`);
    return s.toLowerCase();
}
// A font stack is interpolated into a CSS `font-family:` declaration, so it MUST be CSS-safe. HTML-escaping
// alone does NOT neutralize CSS: a value like `x; } * { color:#000; background:#fff } /*` would break out of
// the declaration and inject rules that override the palette - which could make a deliberately-broken mock
// PASS the contrast audit and defeat the fail-closed gate. This allowlist admits real stacks
// (Inter, system-ui, -apple-system, 'Segoe UI', "JetBrains Mono", sans-serif) and refuses any CSS-structural
// character (`;{}()<>/\:@` etc.). A rejected stack is a loud usage error, never a silently sanitized one.
const FONT_STACK_RE = /^[A-Za-z0-9 ,'"._-]+$/;
function reqFontStack(raw, label) {
    const s = reqString(raw, label);
    if (!FONT_STACK_RE.test(s)) {
        throw new Error(`brief.${label}: a font stack may contain only letters, digits, spaces, commas, quotes, dots, hyphens and underscores (got ${JSON.stringify(raw)}) - refusing to interpolate a CSS-unsafe value`);
    }
    return s;
}
function parseSurface(raw) {
    if (!isPlainObject(raw))
        throw new Error('brief.surface: expected an object');
    const sectionsRaw = raw.sections;
    if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) {
        throw new Error('brief.surface.sections: expected a non-empty array of { heading, body }');
    }
    const sections = sectionsRaw.map((s, i) => {
        if (!isPlainObject(s))
            throw new Error(`brief.surface.sections[${i}]: expected an object`);
        return { heading: reqString(s.heading, `surface.sections[${i}].heading`), body: reqString(s.body, `surface.sections[${i}].body`) };
    });
    return {
        kind: reqString(raw.kind, 'surface.kind'),
        headline: reqString(raw.headline, 'surface.headline'),
        subhead: reqString(raw.subhead, 'surface.subhead'),
        sections,
        primaryCta: reqString(raw.primaryCta, 'surface.primaryCta'),
    };
}
function parsePalette(raw) {
    if (!isPlainObject(raw))
        throw new Error('brief.palette: expected an object with six hex roles');
    return {
        ink: reqHex(raw.ink, 'palette.ink'),
        canvas: reqHex(raw.canvas, 'palette.canvas'),
        muted: reqHex(raw.muted, 'palette.muted'),
        primary: reqHex(raw.primary, 'palette.primary'),
        onPrimary: reqHex(raw.onPrimary, 'palette.onPrimary'),
        border: reqHex(raw.border, 'palette.border'),
    };
}
function parseType(raw) {
    if (!isPlainObject(raw))
        throw new Error('brief.type: expected an object with display + body font stacks');
    return { display: reqFontStack(raw.display, 'type.display'), body: reqFontStack(raw.body, 'type.body') };
}
/**
 * Validate and normalize a raw brief object (parsed from the --brief fixture JSON). Throws a precise Error on
 * any malformed field so the bin can exit with a usage code and a named reason - never author a partial mock.
 */
function parseBrief(raw) {
    if (!isPlainObject(raw))
        throw new Error('brief input: expected a JSON object');
    let components = DEFAULT_COMPONENTS.slice();
    if (raw.components !== undefined) {
        if (!Array.isArray(raw.components) || !raw.components.every((c) => typeof c === 'string' && c.trim())) {
            throw new Error('brief.components: expected an array of non-empty strings');
        }
        components = raw.components.map((c) => c.trim());
    }
    return {
        name: reqString(raw.name, 'name'),
        description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
        surface: parseSurface(raw.surface),
        palette: parsePalette(raw.palette),
        type: parseType(raw.type),
        components,
    };
}
// ---------------------------------------------------------------------------
// HTML construction (pure, deterministic; well-formed so a clean brief renders non-blocking)
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * The shared page shell. A hidden `@media (prefers-reduced-motion)` reset, an explicit line-height on every
 * text element, sequential headings, and no images keep a well-authored brief free of objective blockers -
 * so the ONLY thing that can block a rendered artifact here is a genuinely bad palette (contrast), which is
 * exactly the "deliberately-broken mock" signal.
 */
function pageShell(title, brief, body) {
    const p = brief.palette;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { margin: 0; padding: 40px; background: ${p.canvas}; color: ${p.ink};
         font-family: ${esc(brief.type.body)}; font-size: 16px; line-height: 1.6; }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-family: ${esc(brief.type.display)}; font-size: 40px; line-height: 1.15; margin: 0 0 12px;
       letter-spacing: -0.01em; }
  h2 { font-family: ${esc(brief.type.display)}; font-size: 26px; line-height: 1.25; margin: 32px 0 8px;
       letter-spacing: -0.005em; }
  h3 { font-family: ${esc(brief.type.body)}; font-size: 18px; line-height: 1.3; margin: 20px 0 6px; }
  p { font-size: 16px; line-height: 1.6; margin: 0 0 12px; }
  .muted { color: ${p.muted}; }
  .cta { display: inline-block; background: ${p.primary}; color: ${p.onPrimary};
         font-size: 16px; line-height: 1.5; padding: 12px 20px; border-radius: 8px;
         border: 1px solid ${p.primary}; text-decoration: none; }
  .surface { border: 1px solid ${p.border}; border-radius: 12px; padding: 24px; margin: 16px 0; }
  .swatches { display: flex; flex-wrap: wrap; gap: 16px; margin: 8px 0 4px; }
  .swatch { width: 120px; }
  .chip { height: 56px; border-radius: 8px; border: 1px solid ${p.border}; }
  .swatch-label { font-size: 13px; line-height: 1.5; margin: 6px 0 0; }
  .scale-row { margin: 0 0 10px; }
  .type-note { font-size: 13px; line-height: 1.5; }
  .inv { font-size: 16px; line-height: 1.6; margin: 0 0 8px; }
  .field { display: block; width: 100%; min-height: 44px; font-size: 16px; line-height: 1.5;
           padding: 10px 12px; border: 1px solid ${p.border}; border-radius: 8px; }
  @media (prefers-reduced-motion: reduce) { * { animation: none; transition: none; } }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}
/** A labeled color swatch (a chip with NO text over it, plus a hex label in ink) for the board tokens. */
function swatch(role, hex) {
    return `<div class="swatch"><div class="chip" style="background:${hex}"></div><p class="swatch-label">${esc(role)}<br>${esc(hex)}</p></div>`;
}
/**
 * The design-system board: token swatches, a type scale, and the component inventory. One h1, then h2
 * sections in order (Tokens -> Type scale -> Components) so the heading outline never skips a level.
 */
function buildBoardHtml(brief) {
    const p = brief.palette;
    const roles = [
        ['ink', p.ink], ['canvas', p.canvas], ['muted', p.muted],
        ['primary', p.primary], ['on-primary', p.onPrimary], ['border', p.border],
    ];
    const scale = [
        ['Display 40', brief.type.display, 40],
        ['Headline 26', brief.type.display, 26],
        ['Body 16', brief.type.body, 16],
        ['Label 13', brief.type.body, 13],
    ];
    const inventory = brief.components.map((c) => `<p class="inv">${esc(c)}</p>`).join('\n');
    const body = `<h1>${esc(brief.name)} design system</h1>
<p class="muted">Board for the ${esc(brief.surface.kind)} surface. Tokens, type scale, and component inventory, rendered and audited before the build proceeds.</p>

<h2>Tokens</h2>
<div class="swatches">
${roles.map(([r, h]) => swatch(r, h)).join('\n')}
</div>

<h2>Type scale</h2>
${scale.map(([label, font, size]) => `<p class="scale-row" style="font-family:${esc(font)};font-size:${size}px;line-height:1.3">${esc(label)}: the quick brown fox jumps over the lazy dog.</p>`).join('\n')}
<p class="type-note muted">Display and headings use the display stack; body and labels use the body stack.</p>

<h2>Components</h2>
<div class="surface">
<a class="cta" href="#">${esc(brief.surface.primaryCta)}</a>
<h3>Card sample</h3>
<p>A bordered container that groups one idea. Reference tokens by role, never a raw hex value.</p>
<label for="board-input">Input sample</label>
<input class="field" id="board-input" type="text" value="Editable value">
</div>
<div>
${inventory}
</div>`;
    return pageShell(`${brief.name} design system`, brief, body);
}
/**
 * The first-surface mock: the brief's opening screen as real HTML. h1 headline, a supporting subhead, the
 * authored h2 sections in order, and the primary CTA - all painted with the brief palette, so a bad-contrast
 * palette produces exactly the blocking finding the gate must catch.
 */
function buildMockHtml(brief) {
    const s = brief.surface;
    const sections = s.sections
        .map((sec) => `<section class="surface">\n<h2>${esc(sec.heading)}</h2>\n<p>${esc(sec.body)}</p>\n</section>`)
        .join('\n');
    const body = `<h1>${esc(s.headline)}</h1>
<p class="muted">${esc(s.subhead)}</p>
${sections}
<p><a class="cta" href="#">${esc(s.primaryCta)}</a></p>`;
    return pageShell(s.headline, brief, body);
}
exports.PREAUTHOR_EXIT = {
    /** proceed: the mock rendered with a real verdict and no blockers. */
    PROCEED: 0,
    /** halt: the mock has blocking findings. */
    BLOCKED: 1,
    /** usage / IO / load error - the step never started. */
    USAGE: 2,
    /** halt: an artifact did not render (inconclusive). Never a proceed. */
    INCONCLUSIVE: 3,
};
/**
 * Decide whether the build proceeds, from the mock and board audit verdicts.
 *
 * Faithful to the plan: the MOCK is the proceed gate, and "renders both" is a hard requirement.
 *   - Either artifact `inconclusive` (did not render) -> HALT (exit 3). A scan that did not run is not a pass;
 *     this is audit-rendered's fail-closed discipline carried into the pre-render step.
 *   - Mock `blocked` (blocking findings) -> HALT (exit 1).
 *   - Mock `clean` or `warnings-only` -> PROCEED (exit 0). Board findings are surfaced by the bin for the
 *     author; the plan scopes the blocker gate to the mock.
 *
 * A well-formed mock can NEVER be inconclusive here - both lenses render an authored, self-contained page - so
 * the inconclusive branch only fires on a real render failure (no browser, navigation error), which correctly
 * halts rather than fabricating a clean.
 */
function decidePreauthorGate(mock, board) {
    if (mock.verdict === 'inconclusive') {
        return { decision: 'halt', exit: exports.PREAUTHOR_EXIT.INCONCLUSIVE, reason: 'the mock did not render - a scan that did not run cannot certify the surface (fail-closed, never a silent proceed)' };
    }
    if (board.verdict === 'inconclusive') {
        return { decision: 'halt', exit: exports.PREAUTHOR_EXIT.INCONCLUSIVE, reason: 'the design board did not render - both artifacts must render before the build proceeds' };
    }
    if (mock.verdict === 'blocked') {
        return { decision: 'halt', exit: exports.PREAUTHOR_EXIT.BLOCKED, reason: `the mock has ${mock.severityCounts.blocking} blocking finding(s) - clear them before the build proceeds` };
    }
    // Proceed on an EXPLICIT allow-set only. 'clean' and 'warnings-only' are the sole certified-pass verdicts;
    // anything else (an unrecognized or malformed verdict) is not a pass and halts fail-closed, so the gate can
    // never fail OPEN on a value the verdict vocabulary did not anticipate.
    if (mock.verdict === 'clean' || mock.verdict === 'warnings-only') {
        return {
            decision: 'proceed',
            exit: exports.PREAUTHOR_EXIT.PROCEED,
            reason: mock.verdict === 'warnings-only'
                ? 'the mock rendered with warnings only (no blockers) - the build may proceed'
                : 'the mock rendered clean - the build may proceed',
        };
    }
    return { decision: 'halt', exit: exports.PREAUTHOR_EXIT.INCONCLUSIVE, reason: `the mock returned an unrecognized verdict ${JSON.stringify(mock.verdict)} - refusing to proceed (fail-closed)` };
}
//# sourceMappingURL=pre-authorship.js.map