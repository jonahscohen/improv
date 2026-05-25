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
exports.validateTaste = validateTaste;
exports.formatViolations = formatViolations;
exports.toValidationResult = toValidationResult;
const fs = __importStar(require("fs"));
const ICON_LIBRARY_CLASS_PATTERN = /\b(?:lucide|heroicon|tabler|bi|ph|ms)[-_]\w+/i;
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
function checkFabricatedSvg(html) {
    const violations = [];
    const svgRe = /<svg\b[\s\S]*?<\/svg>/gi;
    for (const m of html.matchAll(svgRe)) {
        const svgBlock = m[0];
        const paths = [
            ...svgBlock.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']+)["']/gi),
        ];
        if (paths.length === 0)
            continue;
        const hasClassMarker = ICON_LIBRARY_CLASS_PATTERN.test(svgBlock);
        const hasDataAttr = /data-icon-source\s*=/i.test(svgBlock);
        const hasSourceComment = /<!--\s*source:\s*[\w./\\-]+\s*-->/i.test(svgBlock);
        if (hasClassMarker || hasDataAttr || hasSourceComment)
            continue;
        const maxPathLen = paths.reduce((max, p) => Math.max(max, p[1].length), 0);
        if (paths.length >= 2 || maxPathLen > 50) {
            violations.push({
                ruleId: 'taste/fabricated-svg',
                severity: 'error',
                category: 'icon-sourcing',
                message: `Inline <svg> has ${paths.length} path(s) (max d="" length ${maxPathLen}) with no library marker. Copy verbatim from Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, or Material Symbols. Annotate with class="lucide-...", data-icon-source="...", or a <!-- source: ... --> comment so provenance is verifiable.`,
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
            message: `:hover uses transform: translateY(...) for a hover-lift. The make-interfaces-feel-better tactical layer specifies scale-on-press (transform: scale(0.96) on :active), not translateY motion on hover. Selector: "${block.selector}"`,
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
function checkHexInHoverWithCssVars(allCss) {
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
function checkBorderRadiusInconsistency(allCss) {
    const violations = [];
    const radiusMatches = [...allCss.matchAll(/border-radius\s*:\s*([^;}]+)/g)];
    const values = new Set();
    for (const m of radiusMatches) {
        const v = m[1].trim();
        if (v.startsWith('var('))
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
    violations.push(...checkFabricatedSvg(htmlContent));
    violations.push(...checkTranslateYInHover(allCss));
    violations.push(...checkLargeInlineStyle(htmlContent));
    violations.push(...checkHeroRadialGradient(allCss));
    violations.push(...checkHexInHoverWithCssVars(allCss));
    violations.push(...checkBorderRadiusInconsistency(allCss));
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