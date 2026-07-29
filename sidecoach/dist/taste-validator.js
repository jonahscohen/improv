#!/usr/bin/env node
"use strict";
// Taste validator: catches the structural taste failures that produce AI-slop UI
// even when 159 syntactic rules pass. Designed to be invoked at the orchestrator
// completion gate for flows that produce HTML (craft, clone-match, layout, polish).
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
exports.detectTailwindContext = detectTailwindContext;
exports.extractInlineStyles = extractInlineStyles;
exports.checkHexInHoverWithCssVars = checkHexInHoverWithCssVars;
exports.checkBorderRadiusInconsistency = checkBorderRadiusInconsistency;
exports.validateTaste = validateTaste;
exports.formatViolations = formatViolations;
exports.toValidationResult = toValidationResult;
const fs = __importStar(require("fs"));
const ICON_LIBRARY_CLASS_PATTERN = /\b(?:lucide|heroicon|tabler|bi|ph|ms)[-_]\w+/i;
// T-0032: Tailwind/shadcn context detection. Gates the token-utility carve-outs
// in checkHexInHoverWithCssVars and checkBorderRadiusInconsistency so the strict
// behavior is unchanged for non-Tailwind input.
//
// Directive/channel markers that only appear in a Tailwind or shadcn setup:
// @tailwind / @apply directives, a tailwind.config reference, or the shadcn
// hsl(var(--token)) channel convention.
const TAILWIND_DIRECTIVE_PATTERN = /@tailwind\b|@apply\b|tailwind\.config|(?:hsl|rgb|oklch)\(\s*var\(\s*--/i;
// Tailwind utility classes backed by theme tokens, including responsive/state
// variant prefixes (hover:, focus:, md:, dark: ...) and the /<opacity> modifier:
//   - a color/spacing utility carrying a /<opacity> modifier (bg-primary/90)
//   - a shadcn semantic-token utility (bg-primary, text-muted-foreground, border-input)
//   - the radius scale (rounded, rounded-sm ... rounded-2xl, rounded-full)
const TAILWIND_UTILITY_PATTERN = new RegExp([
    '(?:bg|text|border|ring|fill|stroke|from|via|to|outline)-[a-z][\\w-]*\\/\\d{1,3}',
    '(?:bg|text|border|ring|fill|stroke|outline)-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|input|ring|border)(?:-foreground)?\\b',
    'rounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|none))?\\b',
].join('|'), 'i');
function detectTailwindContext(html, css, opts) {
    // T-0032
    if (opts?.componentsJson)
        return true;
    if (TAILWIND_DIRECTIVE_PATTERN.test(css) || TAILWIND_DIRECTIVE_PATTERN.test(html)) {
        return true;
    }
    const classAttrRe = /\bclass(?:Name)?\s*=\s*["']([^"']+)["']/gi;
    for (const m of html.matchAll(classAttrRe)) {
        if (TAILWIND_UTILITY_PATTERN.test(m[1]))
            return true;
    }
    return false;
}
// T-0032: a declaration block is token-driven when it pulls a value from a CSS
// custom-property channel (var(--x), hsl(var(--x)), calc(var(--x) ...)) or, in
// Tailwind context, from an @apply/token utility (bg-primary/90, etc.).
function blockReferencesToken(body, tailwind) {
    // T-0032
    if (/var\(\s*--[\w-]+/.test(body))
        return true;
    if (tailwind && TAILWIND_UTILITY_PATTERN.test(body))
        return true;
    return false;
}
function lineNumberOf(text, index) {
    if (index < 0)
        return -1;
    return text.slice(0, index).split('\n').length;
}
function extractInlineStyles(html) {
    const blocks = [];
    const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    for (const m of html.matchAll(re)) {
        const tagEnd = m[0].indexOf('>');
        blocks.push({
            content: m[1],
            start: m.index ?? 0,
            contentStart: (m.index ?? 0) + tagEnd + 1,
        });
    }
    return blocks;
}
function* iterateCssBlocks(css) {
    let i = 0;
    while (i < css.length) {
        const openIdx = css.indexOf('{', i);
        if (openIdx === -1)
            break;
        let selStart = i;
        for (let j = openIdx - 1; j >= i; j--) {
            const c = css[j];
            if (c === '}' || c === ';') {
                selStart = j + 1;
                break;
            }
        }
        let depth = 1;
        let closeIdx = -1;
        for (let j = openIdx + 1; j < css.length; j++) {
            if (css[j] === '{')
                depth++;
            else if (css[j] === '}') {
                depth--;
                if (depth === 0) {
                    closeIdx = j;
                    break;
                }
            }
        }
        if (closeIdx === -1)
            break;
        const selector = css.slice(selStart, openIdx).trim();
        const body = css.slice(openIdx + 1, closeIdx);
        yield { selector, body };
        // Recurse so @media and CSS-nesting wrappers do not hide inner rules from checks
        if (body.includes('{')) {
            yield* iterateCssBlocks(body);
        }
        i = closeIdx + 1;
    }
}
// Drawing primitives an icon can be assembled from instead of <path>. The 2026-07-28 sweep found
// the detector was blind to these: a hamburger built from three <line> elements scored zero paths
// and was skipped entirely by a check whose whole job is catching fabricated icons.
const SVG_PRIMITIVE_PATTERN = /<(?:line|rect|circle|polyline|polygon|ellipse)\b/gi;
// Markers of illustration, brand art or motion rather than UI chrome. Any of these means the block
// is NOT judged as an icon by the primitive branch, whatever else it looks like.
const SVG_NON_ICON_CONTENT_PATTERN = /<(?:text|image|animate|animateTransform|animateMotion|defs|linearGradient|radialGradient|pattern|filter|mask|use)\b/i;
// An icon is drawn on a small square grid (Lucide/Heroicons/Tabler all ship 24; 16/20/32/48 are the
// other common ones) and takes its color from the surrounding text. Charts, diagrams, wordmarks and
// brand marks fail one or both: they carry a data-space or non-square viewBox and literal colors.
// This pair is the discrimination that the by-hand sweep actually used, and it is deliberately
// conjunctive - see PRIMITIVE_SCOPE_LIMITS in the test for what that consciously leaves out.
const ICON_GRID_MAX = 48;
function hasIconGrid(svgBlock) {
    const openTag = /<svg\b[^>]*>/i.exec(svgBlock)?.[0] ?? '';
    // Comma separators and exponent notation are both legal in a viewBox; excluding them from the
    // capture silently dropped `viewBox="0,0,24,24"` through to the width/height fallback.
    const viewBox = /\bviewBox\s*=\s*["']\s*([-+\d.,\seE]+?)\s*["']/i.exec(openTag);
    if (viewBox) {
        const parts = viewBox[1].split(/[\s,]+/).map(Number);
        if (parts.length !== 4 || parts.some(n => !Number.isFinite(n)))
            return false;
        const [, , w, h] = parts;
        return w === h && w > 0 && w <= ICON_GRID_MAX;
    }
    // No viewBox: fall back to a square pixel size. This is the shape the fabricated hamburger in
    // sidecoach/reference/responsive-foundation.md used (width="24" height="24", no viewBox).
    const w = /\bwidth\s*=\s*["'](\d+)(?:px)?["']/i.exec(openTag);
    const h = /\bheight\s*=\s*["'](\d+)(?:px)?["']/i.exec(openTag);
    if (!w || !h)
        return false;
    const wn = Number(w[1]);
    const hn = Number(h[1]);
    return wn === hn && wn > 0 && wn <= ICON_GRID_MAX;
}
// DECORATIVE CHROME, the semantic signal - not a visual one.
//
// Two VISUAL discriminators were tried and measured against a fixed set of adversarial cases, and
// both failed. Grid + currentColor scored P=0.500 (it fires on any micro data visual). Adding the
// "stroke-icon idiom" - stroke="currentColor" plus an explicit stroke-linecap/linejoin - scored
// WORSE overall at P=0.750 R=0.600, because rounded caps are simply how anyone draws a 24px
// sparkline. Style cannot separate an icon from a chart; both are small monochrome line art.
//
// What separates them is what they MEAN. An icon is decorative chrome: the information is carried
// by adjacent text, and the correct markup says so with aria-hidden="true". A chart, sparkline,
// logo or wordmark carries information, so it is exposed to assistive tech via role="img" and a
// label - never hidden. That is a semantic declaration by the author, not a guess about pixels,
// and it is exactly the class the icon-provenance rule governs.
//
// Measured P=1.000 against every counterexample raised in review. The accepted cost: an icon that
// carries no aria-hidden is out of scope. Stated, asserted as a "scope limit" test, and preferred
// over a permissive rule that flags real data visuals.
// Read the ROOT <svg> tag only. Scanning the whole block let a descendant's aria-hidden vouch for
// the element as a whole, which is a real false positive: an accessible mini chart legitimately
// hides its own gridlines or ornament layers inside an otherwise labelled SVG.
//   <svg role="img" aria-label="Revenue rose from 42 to 57" ...><g aria-hidden="true">...</g>...
// The element's OWN declaration is what counts. Root-scoping alone is sufficient: an explicit
// role="img"/aria-label rejection was drafted alongside it and then removed as DEAD CODE, because
// it can only change the outcome on a root that is simultaneously aria-hidden="true" AND labelled,
// which is contradictory markup. A guard that no input can exercise cannot be mutation-tested and
// buys nothing but false confidence.
function isDecorativeChrome(svgBlock) {
    const openTag = /<svg\b[^>]*>/i.exec(svgBlock)?.[0] ?? '';
    return /\baria-hidden\s*=\s*["']true["']/i.test(openTag);
}
function isIconShaped(svgBlock) {
    if (SVG_NON_ICON_CONTENT_PATTERN.test(svgBlock))
        return false;
    if (!/currentColor/i.test(svgBlock))
        return false;
    if (!isDecorativeChrome(svgBlock))
        return false;
    return hasIconGrid(svgBlock);
}
// Number of subpaths in a d="" value, i.e. moveto commands. A hand-drawn icon compressed into ONE
// compound path ("M3 6h18M3 12h18M3 18h18") is structurally three strokes and escapes a threshold
// that only counts <path> ELEMENTS.
function subpathCount(d) {
    return (d.match(/[Mm]/g) ?? []).length;
}
function checkFabricatedSvg(html) {
    const violations = [];
    const svgRe = /<svg\b[\s\S]*?<\/svg>/gi;
    for (const m of html.matchAll(svgRe)) {
        const svgBlock = m[0];
        const paths = [
            ...svgBlock.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']+)["']/gi),
        ];
        const primitiveCount = (svgBlock.match(SVG_PRIMITIVE_PATTERN) ?? []).length;
        if (paths.length === 0 && primitiveCount === 0)
            continue;
        const hasClassMarker = ICON_LIBRARY_CLASS_PATTERN.test(svgBlock);
        const hasDataAttr = /data-icon-source\s*=/i.test(svgBlock);
        const hasSourceComment = /<!--\s*source:\s*[\w./\\-]+\s*-->/i.test(svgBlock);
        if (hasClassMarker || hasDataAttr || hasSourceComment)
            continue;
        const maxPathLen = paths.reduce((max, p) => Math.max(max, p[1].length), 0);
        // Branch 1: the original path-count / path-length triggers, UNCHANGED. Everything the rule
        // caught before it caught primitives, it still catches, on exactly the same terms.
        let trigger = null;
        if (paths.length >= 2 || maxPathLen > 50) {
            trigger = `${paths.length} path(s) (max d="" length ${maxPathLen})`;
        }
        else if (isIconShaped(svgBlock)) {
            // Branch 2: icon-shaped blocks the count-based trigger cannot see. Gated behind the
            // conjunctive icon test so charts, diagrams, logos and decorative shapes stay silent.
            const subpaths = paths.reduce((sum, p) => sum + subpathCount(p[1]), 0);
            const drawingCount = paths.length + primitiveCount;
            if (drawingCount >= 2) {
                trigger = `${primitiveCount} drawing primitive(s) and ${paths.length} path(s) on a square icon grid`;
            }
            else if (subpaths >= 2) {
                trigger = `1 compound path with ${subpaths} subpaths on a square icon grid`;
            }
        }
        if (trigger) {
            violations.push({
                ruleId: 'taste/fabricated-svg',
                severity: 'error',
                category: 'icon-sourcing',
                message: `Inline <svg> has ${trigger} with no library marker. Copy verbatim from Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, or Material Symbols. Annotate with class="lucide-...", data-icon-source="...", or a <!-- source: ... --> comment so provenance is verifiable.`,
                excerpt: svgBlock.slice(0, 200) + (svgBlock.length > 200 ? '...' : ''),
                lineNumbers: [lineNumberOf(html, m.index ?? 0)],
            });
        }
    }
    return violations;
}
function checkTranslateYInHover(allCss) {
    const violations = [];
    for (const block of iterateCssBlocks(allCss)) {
        if (!/:hover\b/.test(block.selector))
            continue;
        if (!/transform\s*:[^;]*translateY\s*\(/.test(block.body))
            continue;
        violations.push({
            ruleId: 'taste/translatey-in-hover',
            severity: 'error',
            category: 'motion',
            message: `:hover uses transform: translateY(...) for a hover-lift. The tactical-polish layer specifies scale-on-press (transform: scale(0.96) on :active), not translateY motion on hover. Selector: "${block.selector}"`,
            excerpt: block.body.trim().slice(0, 160),
        });
    }
    return violations;
}
function checkLargeInlineStyle(html) {
    const violations = [];
    const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
    if (!headMatch || headMatch.index === undefined)
        return violations;
    const headStart = headMatch.index + headMatch[0].indexOf(headMatch[1]);
    const headHtml = headMatch[1];
    for (const sb of extractInlineStyles(headHtml)) {
        const lineCount = sb.content.split('\n').length;
        if (lineCount > 50) {
            violations.push({
                ruleId: 'taste/large-inline-style',
                severity: 'error',
                category: 'separation-of-concerns',
                message: `Inline <style> block in <head> is ${lineCount} lines. Move the rules to the external stylesheet; large inline blocks duplicate the design system and drift from the shared file.`,
                lineNumbers: [lineNumberOf(html, headStart + sb.start)],
            });
        }
    }
    return violations;
}
function checkHeroRadialGradient(allCss) {
    const violations = [];
    const heroSelectorRe = /(^|\s|,)(\.hero|\.banner|\[class\*=["']hero["']\]|\[id\*=["']hero["']\])(\b|[:.])/i;
    for (const block of iterateCssBlocks(allCss)) {
        if (!heroSelectorRe.test(block.selector))
            continue;
        if (!/radial-gradient\s*\(/.test(block.body))
            continue;
        violations.push({
            ruleId: 'taste/hero-radial-blob',
            severity: 'error',
            category: 'ai-slop',
            message: `radial-gradient inside a hero/banner selector ("${block.selector}") is the canonical AI-slop hero background. Replace with an editorial image, real product screenshot, or typography-first hero.`,
            excerpt: block.body.trim().slice(0, 160),
        });
    }
    return violations;
}
function checkHexInHoverWithCssVars(allCss, tailwind) {
    const violations = [];
    const fileHasCssVars = /--[\w-]+\s*:/.test(allCss) || /var\(\s*--[\w-]+/.test(allCss);
    if (!fileHasCssVars)
        return violations;
    for (const block of iterateCssBlocks(allCss)) {
        if (!/(:hover|:active)\b/.test(block.selector))
            continue;
        const hexMatches = [...block.body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)];
        if (hexMatches.length === 0)
            continue;
        // T-0032: in Tailwind/shadcn context, a token-driven interactive state
        // (hsl(var(--token)), var(--token), or an @apply/token utility such as
        // bg-primary/90) is token-compliant, so incidental hex in the same block is
        // tolerated. Strict behavior is unchanged outside Tailwind context.
        if (tailwind && blockReferencesToken(block.body, tailwind))
            continue;
        const hexValues = hexMatches.map((h) => h[0]).join(', ');
        violations.push({
            ruleId: 'taste/hex-in-interactive-state',
            severity: 'error',
            category: 'design-tokens',
            message: `:hover/:active state uses hardcoded hex (${hexValues}) while the file defines CSS custom properties. Derive the interactive state from a token (e.g. var(--c-brand-red-hover)) so theming and dark mode propagate. Selector: "${block.selector}"`,
            excerpt: block.body.trim().slice(0, 160),
        });
    }
    return violations;
}
function checkObserverRace(html, allCss) {
    const violations = [];
    const scripts = [];
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        scripts.push(m[1]);
    }
    const allJs = scripts.join('\n');
    const usesObserver = /\bnew\s+IntersectionObserver\b/.test(allJs);
    if (!usesObserver)
        return violations;
    const observedClasses = new Set();
    for (const m of allJs.matchAll(/querySelectorAll\(\s*['"`]\.([\w-]+)['"`]\s*\)/g)) {
        observedClasses.add(m[1]);
    }
    for (const m of allJs.matchAll(/getElementsByClassName\(\s*['"`]([\w-]+)['"`]\s*\)/g)) {
        observedClasses.add(m[1]);
    }
    if (observedClasses.size === 0)
        return violations;
    const offending = [];
    for (const cls of observedClasses) {
        const re = new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*opacity\\s*:\\s*0\\b`, 'i');
        if (re.test(allCss))
            offending.push('.' + cls);
    }
    if (offending.length === 0)
        return violations;
    violations.push({
        ruleId: 'taste/observer-race',
        severity: 'error',
        category: 'render-correctness',
        message: `IntersectionObserver-driven reveal targets element(s) (${offending.join(', ')}) that start at opacity: 0. On slow paint or font-load, the observer callback can fire after the screenshot or user-visible paint, leaving elements stuck invisible. Use a CSS-only animation (e.g. @keyframes with animation-delay stagger) or set initial opacity:1 and have JS opt INTO the hidden state right before the observer fires.`,
    });
    return violations;
}
function checkBorderRadiusInconsistency(allCss, tailwind) {
    const violations = [];
    const radiusMatches = [...allCss.matchAll(/border-radius\s*:\s*([^;}]+)/g)];
    const values = new Set();
    for (const m of radiusMatches) {
        const v = m[1].trim();
        if (v.startsWith('var('))
            continue;
        // T-0032: in Tailwind/shadcn context, radius values derived from a token
        // (e.g. shadcn's calc(var(--radius) - 2px) rounded-* scale, or clamp/min/max
        // wrapping a CSS var) are not hand-picked literals. The rounded utilities
        // (rounded-md, rounded-lg, ...) all derive from --radius. Only relaxed in
        // Tailwind context; non-Tailwind literals still flag.
        if (tailwind && /var\(\s*--[\w-]+/.test(v))
            continue;
        values.add(v);
    }
    if (values.size > 2) {
        violations.push({
            ruleId: 'taste/border-radius-inconsistency',
            severity: 'error',
            category: 'design-system-consistency',
            message: `${values.size} distinct border-radius literals found (${[...values].join(', ')}). Use 1-2 named tokens from a radius scale; concentric radii (outer = inner + padding) should derive from those tokens, not be hand-picked per component.`,
        });
    }
    return violations;
}
function validateTaste(htmlContent, cssContent, _opts) {
    const violations = [];
    const inlineBlocks = extractInlineStyles(htmlContent);
    const inlineCss = inlineBlocks.map((b) => b.content).join('\n');
    const allCss = (cssContent || '') + '\n' + inlineCss;
    // T-0032: detect Tailwind/shadcn context once, gate the token-utility carve-outs.
    const tailwind = detectTailwindContext(htmlContent, allCss, _opts);
    violations.push(...checkFabricatedSvg(htmlContent));
    violations.push(...checkTranslateYInHover(allCss));
    violations.push(...checkLargeInlineStyle(htmlContent));
    violations.push(...checkHeroRadialGradient(allCss));
    violations.push(...checkHexInHoverWithCssVars(allCss, tailwind));
    violations.push(...checkBorderRadiusInconsistency(allCss, tailwind));
    violations.push(...checkObserverRace(htmlContent, allCss));
    return violations;
}
function formatViolations(violations, filePath) {
    if (violations.length === 0) {
        return `taste-validator: 0 violations in ${filePath}`;
    }
    const lines = [];
    lines.push(`taste-validator: ${violations.length} violation(s) in ${filePath}`);
    lines.push('');
    for (const v of violations) {
        lines.push(`[${v.severity}] ${v.ruleId} (${v.category})`);
        if (v.lineNumbers && v.lineNumbers.length) {
            lines.push(`  line(s): ${v.lineNumbers.join(', ')}`);
        }
        lines.push(`  ${v.message}`);
        if (v.excerpt) {
            lines.push(`  excerpt: ${v.excerpt.replace(/\s+/g, ' ').trim()}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function toValidationResult(violations) {
    const status = violations.length > 0 ? 'fail' : 'pass';
    return {
        domain: 'taste',
        status,
        passedRules: [],
        failedRules: violations.map(v => `${v.severity}:${v.ruleId}`),
        message: violations.length === 0
            ? 'No taste violations'
            : violations.map(v => `[${v.ruleId}] ${v.message}`).join('; '),
        // Taste violations come from scanning the user's real HTML/CSS, so they are findings about
        // the artifact and must survive the self-check suppression (Codex review 2026-07-28, item 7).
        measures: 'artifact',
    };
}
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: taste-validator <html-file> [css-file]');
        process.exit(2);
    }
    const htmlPath = args[0];
    const cssPath = args[1];
    const html = fs.readFileSync(htmlPath, 'utf8');
    const css = cssPath ? fs.readFileSync(cssPath, 'utf8') : undefined;
    const violations = validateTaste(html, css);
    console.log(formatViolations(violations, htmlPath));
    process.exit(violations.length === 0 ? 0 : 1);
}
//# sourceMappingURL=taste-validator.js.map