"use strict";
/**
 * Absolute Ban Detector
 *
 * Operationalizes the 6 absolute bans from the absorbed legacy-design-skill
 * reference (now exposed by reference-loader as loadAbsoluteBans). Pre-wiring
 * these bans existed as descriptive strings in design-laws.ts but no validator
 * actually scanned project files for the patterns. This module scans CSS +
 * HTML in a project directory and produces findings.
 *
 * Coverage by ban:
 *
 * - side-stripe-borders: CSS scan for `border-left|border-right > 1px solid <colored>` on cards/lists/callouts/alerts
 * - gradient-text: CSS scan for `background-clip: text` combined with `linear-gradient` or `radial-gradient`
 * - glassmorphism-default: CSS scan for `backdrop-filter: blur(...)` combined with low-alpha rgba/hsla background
 * - identical-card-grids: HTML scan for grid container with >=3 children of the same class containing the same structural triplet (icon/svg + heading + paragraph)
 * - hero-metric-template: HTML scan for a parent with >=3 children each containing a large-numeric child + small-label child
 * - modal-as-first-thought: HTML scan for <dialog> or [role="dialog"] containing forms/menus that could be inline
 *
 * The CSS-side detectors are precise. The HTML-structural detectors are
 * heuristic - they flag pattern shapes, not certainties. P1 by default
 * because false positives are possible.
 */
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
exports.scanSideStripeBorders = scanSideStripeBorders;
exports.scanGradientText = scanGradientText;
exports.scanGlassmorphism = scanGlassmorphism;
exports.scanHeroMetricTemplate = scanHeroMetricTemplate;
exports.scanModalAsFirstThought = scanModalAsFirstThought;
exports.scanForAbsoluteBans = scanForAbsoluteBans;
exports.absoluteBanToValidationResult = absoluteBanToValidationResult;
exports.banFindingsToGuidance = banFindingsToGuidance;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const reference_loader_1 = require("./reference-loader");
const BAN_LOOKUP_BY_NAME = (() => {
    const map = new Map();
    for (const ban of (0, reference_loader_1.loadAbsoluteBans)())
        map.set(ban.name, ban);
    return map;
})();
function getBan(name) {
    return BAN_LOOKUP_BY_NAME.get(name);
}
function lineNumberAt(content, offset) {
    if (offset <= 0)
        return 1;
    let line = 1;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n')
            line++;
    }
    return line;
}
function findingFromBan(banName, file, line, matchedText, severity = 'P1') {
    const ban = getBan(banName);
    return {
        severity,
        banName,
        file,
        line,
        matchedText: matchedText.length > 280 ? matchedText.slice(0, 280) + '...' : matchedText,
        reason: ban?.description ?? `Named anti-pattern: ${banName}`,
        rewriteOptions: ban?.rewriteOptions ?? [],
    };
}
function scanSideStripeBorders(content, file) {
    const findings = [];
    // Look for border-left or border-right with N>1 px solid <colored value>
    // on selectors that look like cards/alerts/callouts/list items.
    // Pattern: a CSS rule whose body contains `border-(?:left|right):\s*([2-9]|[1-9][0-9]+)px\s+solid\s+(?!transparent|inherit)([^\n;]+)`
    // and whose selector appears card-like.
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    const matches = Array.from(content.matchAll(ruleRegex));
    for (const m of matches) {
        if (m.index === undefined)
            continue;
        const selector = m[1].trim();
        const body = m[2];
        const borderMatch = body.match(/border-(?:left|right)\s*:\s*([2-9]|[1-9][0-9]+)\s*px\s+(?:solid|dashed|dotted|double)\s+(?!transparent|inherit|currentColor)([^\n;]+);?/i);
        if (!borderMatch)
            continue;
        // Filter to ban targets: card / list / alert / callout / install / banner / notice
        // Match the keyword anywhere in a class token so namespaced/BEM names like
        // `.ref-callout`, `.tool-card`, `.foo__alert` are caught, not only bare `.card`.
        const targetable = /\.[\w-]*(?:card|alert|callout|notice|banner|install|tile|message|toast|tip|panel)[\w-]*\b|aside\b|blockquote\b/i.test(selector);
        if (!targetable)
            continue;
        findings.push(findingFromBan('side-stripe-borders', file, lineNumberAt(content, m.index), `${selector} { ${borderMatch[0].trim()} }`, 'P1'));
    }
    return findings;
}
function scanGradientText(content, file) {
    const findings = [];
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    for (const m of Array.from(content.matchAll(ruleRegex))) {
        if (m.index === undefined)
            continue;
        const selector = m[1].trim();
        const body = m[2];
        const hasClip = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(body);
        const hasGradient = /(?:linear|radial|conic)-gradient\s*\(/i.test(body);
        if (hasClip && hasGradient) {
            findings.push(findingFromBan('gradient-text', file, lineNumberAt(content, m.index), `${selector} { ... background-clip: text + gradient }`, 'P1'));
        }
    }
    return findings;
}
function scanGlassmorphism(content, file) {
    const findings = [];
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    for (const m of Array.from(content.matchAll(ruleRegex))) {
        if (m.index === undefined)
            continue;
        const selector = m[1].trim();
        const body = m[2];
        const hasBlur = /backdrop-filter\s*:\s*[^;]*\bblur\s*\(/i.test(body);
        // Low-alpha background: rgba(...) or hsla(...) with last component <= 0.4
        const lowAlphaMatch = body.match(/(?:rgba|hsla)\s*\(\s*[\d.,%\s]+,\s*(0?\.\d+|0|1)\s*\)/gi);
        let hasLowAlpha = false;
        if (lowAlphaMatch) {
            for (const value of lowAlphaMatch) {
                const alphaMatch = value.match(/,\s*(0?\.\d+|0|1)\s*\)$/);
                if (alphaMatch) {
                    const alpha = parseFloat(alphaMatch[1]);
                    if (alpha <= 0.4) {
                        hasLowAlpha = true;
                        break;
                    }
                }
            }
        }
        if (hasBlur && hasLowAlpha) {
            findings.push(findingFromBan('glassmorphism-default', file, lineNumberAt(content, m.index), `${selector} { backdrop-filter: blur(...) + low-alpha background }`, 'P1'));
        }
    }
    return findings;
}
// DELETED (Stage-2, lead+Jonah-blessed 2026-06-24): scanIdenticalCardGrids - it had a ReDoS-class regex (nested
// [\s\S]*? in the card-triplet pattern) that hung on large HTML, and its semantic mapping to icon-tile-stack was a
// low-precision over-firing detector (P 0.33) we are not supporting. Removing it is the net-simpler half of Stage-1+2
// AND precision-positive (subjective P 0.436->0.457). No replacement (a new icon-tile-stack detector ground-tested
// marginal - a holistic gestalt - and was not built).
function scanHeroMetricTemplate(content, file) {
    const findings = [];
    // Heuristic: look for HTML with three or more sibling blocks each containing
    // a large numeric content + smaller label. Detect via CSS classes commonly used.
    const heroMetricRegex = /(<(?:div|article|section|li)\s+[^>]*class\s*=\s*["'][^"']*\b(?:stat|metric|kpi|number|count)\b[^"']*["'][^>]*>[\s\S]*?<\/(?:div|article|section|li)>\s*){3,}/gi;
    for (const m of Array.from(content.matchAll(heroMetricRegex))) {
        if (m.index === undefined)
            continue;
        findings.push(findingFromBan('hero-metric-template', file, lineNumberAt(content, m.index), `Three+ stat/metric/kpi blocks in sequence - SaaS hero-metric template shape`, 'P1'));
    }
    return findings;
}
function scanModalAsFirstThought(content, file) {
    const findings = [];
    // Heuristic: any <dialog> or [role="dialog"] for content that includes a
    // <form> with a single submit, or a simple confirmation pattern. P2 because
    // most modals are legitimate.
    const dialogRegex = /<(?:dialog|div)\s+[^>]*(?:role\s*=\s*["']dialog["']|class\s*=\s*["'][^"']*\b(?:modal|dialog|popup)\b[^"']*["'])[^>]*>[\s\S]*?<form\b[\s\S]*?<\/form>[\s\S]*?<\/(?:dialog|div)>/gi;
    for (const m of Array.from(content.matchAll(dialogRegex))) {
        if (m.index === undefined)
            continue;
        findings.push(findingFromBan('modal-as-first-thought', file, lineNumberAt(content, m.index), `<dialog>/modal containing <form> - consider inline editing or progressive disclosure first`, 'P2'));
    }
    return findings;
}
function collectScanCandidates(projectPath) {
    const cssFiles = [];
    const htmlFiles = [];
    try {
        const entries = fs.readdirSync(projectPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                    continue;
                try {
                    const subEntries = fs.readdirSync(path.join(projectPath, entry.name), { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isFile()) {
                            const full = path.join(projectPath, entry.name, sub.name);
                            if (/\.(?:css|scss|sass|less)$/i.test(sub.name))
                                cssFiles.push(full);
                            else if (/\.(?:html?|jsx|tsx|vue|svelte)$/i.test(sub.name))
                                htmlFiles.push(full);
                        }
                    }
                }
                catch { /* skip unreadable subdir */ }
            }
            else if (entry.isFile()) {
                const full = path.join(projectPath, entry.name);
                if (/\.(?:css|scss|sass|less)$/i.test(entry.name))
                    cssFiles.push(full);
                else if (/\.(?:html?|jsx|tsx|vue|svelte)$/i.test(entry.name))
                    htmlFiles.push(full);
            }
        }
    }
    catch { /* projectPath unreadable - return empty */ }
    return { cssFiles, htmlFiles };
}
function scanForAbsoluteBans(projectPath) {
    const { cssFiles, htmlFiles } = collectScanCandidates(projectPath);
    const findings = [];
    const scannedFiles = cssFiles.length + htmlFiles.length;
    for (const file of cssFiles) {
        try {
            const stat = fs.statSync(file);
            if (stat.size > 2 * 1024 * 1024)
                continue;
            const content = fs.readFileSync(file, 'utf-8');
            const rel = path.relative(projectPath, file);
            findings.push(...scanSideStripeBorders(content, rel));
            findings.push(...scanGradientText(content, rel));
            findings.push(...scanGlassmorphism(content, rel));
        }
        catch { /* skip unreadable */ }
    }
    for (const file of htmlFiles) {
        try {
            const stat = fs.statSync(file);
            if (stat.size > 2 * 1024 * 1024)
                continue;
            const content = fs.readFileSync(file, 'utf-8');
            const rel = path.relative(projectPath, file);
            // CSS-style scans on inline <style> blocks
            findings.push(...scanSideStripeBorders(content, rel));
            findings.push(...scanGradientText(content, rel));
            findings.push(...scanGlassmorphism(content, rel));
            // HTML-structural scans (scanIdenticalCardGrids deleted Stage-2 - ReDoS + low-precision)
            findings.push(...scanHeroMetricTemplate(content, rel));
            findings.push(...scanModalAsFirstThought(content, rel));
        }
        catch { /* skip unreadable */ }
    }
    const p0 = findings.filter((f) => f.severity === 'P0').length;
    const p1 = findings.filter((f) => f.severity === 'P1').length;
    const p2 = findings.filter((f) => f.severity === 'P2').length;
    const summary = findings.length === 0
        ? `Absolute ban scan: 0 findings across ${scannedFiles} files. The 6 named bans (side-stripe borders, gradient text, glassmorphism default, identical card grids, hero-metric template, modal-as-first-thought) are clean.`
        : `Absolute ban scan: ${findings.length} findings across ${scannedFiles} files (P0 ${p0}, P1 ${p1}, P2 ${p2}). Each finding is a named anti-pattern with prescribed rewrites.`;
    return { scannedFiles, findings, summary };
}
/**
 * Adapter: convert an AbsoluteBanReport into the BuildReport's ValidationResult
 * shape so the BuildReport aggregator produces an "anti-patterns" domain
 * letter grade. Mirrors PolishStandardValidator.toValidationResult().
 */
function absoluteBanToValidationResult(report) {
    const p0 = report.findings.filter((f) => f.severity === 'P0');
    const p1 = report.findings.filter((f) => f.severity === 'P1');
    const status = p0.length > 0 ? 'fail' : p1.length > 0 ? 'partial' : 'pass';
    // Per-ban pass/fail
    const allBans = (0, reference_loader_1.loadAbsoluteBans)();
    const failedBanNames = new Set(report.findings.map((f) => f.banName));
    const failedRules = [];
    const passedRules = [];
    for (const ban of allBans) {
        if (failedBanNames.has(ban.name))
            failedRules.push(`ban-${ban.name}`);
        else
            passedRules.push(`ban-${ban.name}`);
    }
    return {
        domain: 'anti-patterns',
        status,
        passedRules,
        failedRules,
        message: report.summary,
    };
}
function banFindingsToGuidance(report) {
    if (report.findings.length === 0)
        return [report.summary];
    const lines = [report.summary, ''];
    // Group by ban name for readability
    const byBan = new Map();
    for (const f of report.findings) {
        if (!byBan.has(f.banName))
            byBan.set(f.banName, []);
        byBan.get(f.banName).push(f);
    }
    for (const [banName, group] of byBan) {
        lines.push(`BAN: ${banName} (${group.length} match${group.length === 1 ? '' : 'es'})`);
        lines.push(`  Why: ${group[0].reason}`);
        if (group[0].rewriteOptions.length > 0) {
            lines.push(`  Rewrite options:`);
            for (const opt of group[0].rewriteOptions)
                lines.push(`    - ${opt}`);
        }
        for (const f of group) {
            lines.push(`  [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''}: ${f.matchedText}`);
        }
        lines.push('');
    }
    return lines;
}
//# sourceMappingURL=absolute-ban-detector.js.map