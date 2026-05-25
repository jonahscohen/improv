"use strict";
/**
 * Reference Loader
 *
 * Loads the absorbed library content at `sidecoach/reference/_extracted/`
 * and `sidecoach/reference/*.md` into flow handler context at runtime.
 *
 * Before this module existed, the absorbed content lived on disk but no
 * flow handler read it - the SKILL_REF constant in verb-command-registry.ts
 * was a string template the orchestrator stringified into help text, nothing
 * more. This module is the wiring layer that makes the library a runtime
 * input, not just a documentation artifact.
 *
 * Path conventions:
 * - REFERENCE_ROOT: sidecoach/reference (resolved from this module's location)
 * - EXTRACTED_ROOT: sidecoach/reference/_extracted (the source-attributed layer)
 * - Canonical: sidecoach/reference/<domain>.md (e.g. responsive-foundation.md)
 *
 * Caching: per-process, file content cached after first read. Cache survives
 * the lifetime of a chain execution. Cache can be cleared via clearCache()
 * if a flow handler needs a fresh read (rare).
 *
 * Error policy: soft-fail. A missing file logs to stderr and returns null
 * or an empty array. Flow handlers are expected to degrade gracefully
 * rather than throw on missing reference content - the library is additive,
 * never load-bearing for chain execution.
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
exports.loadCanonical = loadCanonical;
exports.loadExtracted = loadExtracted;
exports.clearCache = clearCache;
exports.loadSlopWordList = loadSlopWordList;
exports.loadRhetoricalPatterns = loadRhetoricalPatterns;
exports.loadPrescribedEasings = loadPrescribedEasings;
exports.loadBannedEasings = loadBannedEasings;
exports.loadFontReflexReject = loadFontReflexReject;
exports.loadAbsoluteBans = loadAbsoluteBans;
exports.loadSaturatedAestheticLanes = loadSaturatedAestheticLanes;
exports.loadLineHeightTiers = loadLineHeightTiers;
exports.loadBreakpointTable = loadBreakpointTable;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MODULE_DIR = __dirname;
const REFERENCE_ROOT = path.resolve(MODULE_DIR, '..', 'reference');
const EXTRACTED_ROOT = path.join(REFERENCE_ROOT, '_extracted');
const cache = new Map();
/**
 * Read a reference file by absolute path under the reference root.
 * Returns null if the file does not exist or cannot be read.
 * Result is cached after first read.
 */
function readReferenceFile(absolutePath) {
    if (cache.has(absolutePath)) {
        return cache.get(absolutePath) ?? null;
    }
    try {
        const content = fs.readFileSync(absolutePath, 'utf-8');
        cache.set(absolutePath, content);
        return content;
    }
    catch (err) {
        process.stderr.write(`[reference-loader] missing reference file: ${absolutePath}\n`);
        cache.set(absolutePath, null);
        return null;
    }
}
/**
 * Load a canonical reference file by name (e.g. "responsive-foundation").
 * Looks under sidecoach/reference/<name>.md.
 */
function loadCanonical(name) {
    const filename = name.endsWith('.md') ? name : `${name}.md`;
    return readReferenceFile(path.join(REFERENCE_ROOT, filename));
}
/**
 * Load an extracted reference file by source + relative path.
 * Source values: 'legacy-design-skill', 'make-interfaces-feel-better',
 * 'external/emil-design-eng', 'external/typeui-fundamentals',
 * 'external/taste-skill', 'external/bencium-design',
 * 'external/refactoring-ui', 'local-skills/<skill-name>'.
 */
function loadExtracted(source, relativePath) {
    const rel = relativePath.endsWith('.md') ? relativePath : `${relativePath}.md`;
    return readReferenceFile(path.join(EXTRACTED_ROOT, source, rel));
}
/**
 * Clear the per-process cache. Call from a flow handler that needs to
 * pick up a file edit mid-chain (rare).
 */
function clearCache() {
    cache.clear();
}
/**
 * The slop word list from taste-skill: marketing-language defaults that
 * trip the AI-template-y reflex. Loaded from the absorbed content; falls
 * back to a hand-curated baseline if the file is missing.
 *
 * Returns an array of words/phrases that should be detected in generated
 * copy and flagged as P1 findings.
 */
let _slopWordsCache = null;
function loadSlopWordList() {
    if (_slopWordsCache)
        return _slopWordsCache;
    const baseline = [
        // Marketing filler verbs
        'Elevate', 'Seamless', 'Unleash', 'Empower', 'Revolutionize',
        'Next-Gen', 'Transform', 'Optimize', 'Streamline',
        // AI-template phrases
        'Delve', 'Tapestry', 'In the world of', 'In the realm of',
        'It is important to note', 'It goes without saying',
        'Ladies and gentlemen', 'Without further ado',
        // Slop product names
        'Acme', 'Nexus', 'SmartFlow', 'CloudSync', 'DataHub',
        'TechCore', 'InfoSphere', 'NextGen', 'ProSuite',
        // Generic error/copy patterns
        'Oops!', 'Whoops!', 'Sorry, something went wrong',
        'Please try again later', 'An error occurred',
    ];
    // Try to load any extension list from the absorbed content; for now,
    // the baseline IS the list. If `_extracted/external/taste-skill/SKILL.md`
    // surfaces additional words, they can be merged here.
    const tasteSkill = loadExtracted('external/taste-skill', 'SKILL');
    if (tasteSkill) {
        // Pull additional banned words quoted in the source. The taste-skill
        // file structure has "NO Filler Words: 'X', 'Y', 'Z'" style lines.
        const additions = [];
        const fillerMatch = tasteSkill.match(/NO Filler Words?:?\s*['"]([^'"]+)['"]([^.]+)/i);
        if (fillerMatch) {
            const inlineWords = fillerMatch[0].match(/['"]([A-Z][a-zA-Z]+)['"]/g);
            if (inlineWords) {
                for (const w of inlineWords) {
                    const cleaned = w.replace(/['"]/g, '');
                    if (cleaned && !baseline.includes(cleaned))
                        additions.push(cleaned);
                }
            }
        }
        _slopWordsCache = [...baseline, ...additions];
        return _slopWordsCache;
    }
    _slopWordsCache = baseline;
    return _slopWordsCache;
}
function loadRhetoricalPatterns() {
    return [
        {
            name: 'triplet-negation',
            regex: /Not\s+(?:a|an|for)\s+\w+[.,;][\s\S]{0,400}?Not\s+(?:a|an|for)\s+\w+[.,;][\s\S]{0,400}?Not\s+(?:a|an|for)\s+\w+/i,
            why: 'Templated "Not X / Not Y / Not Z" triplet - a category-reflex copy structure that reads as AI-generated boilerplate. The lazy gap (up to 400 chars per clause) catches the pattern even when body content separates the three headings.',
        },
        {
            name: 'negation-as-positioning',
            regex: /\b(?:Memory|Design|Speed|Quality|Power|Beauty)\s+in\s+\w+\.\s+Not\s+a\s+\w+,\s+a\s+\w+/i,
            why: '"X in Y. Not a feature, a discipline." template - landing-page slop architecture.',
        },
        {
            name: 'imperative-pair',
            regex: /\bStop\s+\w+ing[^.]*\.\s+(?:Start|Show)\s+\w+(?:ing)?[^.]*\./i,
            why: '"Stop X-ing. Start Y-ing." or "Stop describing. Show it." - imperative-pair copy template.',
        },
        {
            name: 'world-of-opener',
            regex: /\bIn\s+(?:a|the)\s+world\s+(?:of|where)\b/i,
            why: '"In a world of/where..." opener - hallmark of generative AI marketing copy.',
        },
        {
            name: 'realm-of-opener',
            regex: /\bIn\s+the\s+realm\s+of\b/i,
            why: '"In the realm of..." opener - AI marketing copy pattern.',
        },
        {
            name: 'tapestry-prose',
            regex: /\b(?:rich|woven|intricate)\s+tapestry\s+of\b/i,
            why: '"Rich/woven/intricate tapestry of..." - one of the most-flagged AI prose tells.',
        },
        {
            name: 'goes-without-saying',
            regex: /\b(?:it goes without saying|needless to say|without further ado|ladies and gentlemen)\b/i,
            why: 'Empty-calorie opener phrases that AI overuses.',
        },
        {
            name: 'delve-into',
            regex: /\b(?:delve|delving)\s+(?:into|deeply)\b/i,
            why: '"Delve into..." is the single most-flagged AI prose verb.',
        },
    ];
}
function loadPrescribedEasings() {
    return [
        {
            name: '--ease-out',
            cssValue: 'cubic-bezier(0.23, 1, 0.32, 1)',
            use: 'Default ease-out for entrances and primary state changes. Stronger deceleration than Material out.',
        },
        {
            name: '--ease-in-out',
            cssValue: 'cubic-bezier(0.77, 0, 0.175, 1)',
            use: 'Bidirectional state changes - toggle, accordion open/close, theme switch.',
        },
        {
            name: '--ease-drawer',
            cssValue: 'cubic-bezier(0.32, 0.72, 0, 1)',
            use: 'Drawer / sheet / modal slide animations specifically. Faster initial pull, smoother settle.',
        },
    ];
}
/**
 * Easing curves that should NEVER appear in production CSS. Includes built-in
 * weak curves Emil bans plus bounce/elastic which the predecessor's design
 * laws ban for UI motion.
 */
function loadBannedEasings() {
    return [
        {
            regex: /\bease-in\b(?!\s*-?\s*out)/i,
            reason: 'ease-in (alone, not ease-in-out) is banned for UI motion - feels sluggish and unmotivated.',
        },
        {
            regex: /cubic-bezier\(\s*0\.34\s*,\s*1\.56\s*,\s*0\.64\s*,\s*1\s*\)/,
            reason: 'Bounce curve (`cubic-bezier(0.34, 1.56, 0.64, 1)`) - banned. Bounce is theatre, not feedback.',
        },
        {
            regex: /cubic-bezier\(\s*0\.68\s*,\s*-0?\.6\s*,\s*0\.32\s*,\s*1\.6\s*\)/,
            reason: 'Elastic curve (`cubic-bezier(0.68, -0.6, 0.32, 1.6)`) - banned. Elastic is novelty motion.',
        },
        {
            regex: /\bease-out-back\b/i,
            reason: 'ease-out-back contains overshoot - reads as cartoonish in UI motion.',
        },
    ];
}
/**
 * The font reflex-reject list. Typefaces that have become AI-generated
 * defaults and should be refused as primary type choices on greenfield work.
 * Sourced from the absorbed legacy-design-skill brand.md and fontshare-reference
 * skill integration.
 */
function loadFontReflexReject() {
    return [
        { name: 'Inter', reason: 'The single most-defaulted sans on AI-generated UI. Indistinguishable presence.' },
        { name: 'Fraunces', reason: 'The serif equivalent of Inter - reflex pick for editorial-looking pages.' },
        { name: 'Outfit', reason: 'Generic geometric sans, ubiquitous in template-marketplace output.' },
        { name: 'Instrument Serif', reason: 'Over-saturated tech-startup serif since 2024.' },
        { name: 'Newsreader', reason: 'Google Fonts editorial default, over-served by generative tools.' },
        { name: 'Plus Jakarta Sans', reason: 'Default "modern startup" sans - signals AI-template origin.' },
        { name: 'DM Sans', reason: 'Default geometric sans from the Vercel-aesthetic template family.' },
        { name: 'DM Serif Display', reason: 'Companion to DM Sans - same reflex-pick problem.' },
        { name: 'IBM Plex Sans', reason: 'Reflex pick for tech-credibility framing.' },
        { name: 'Space Grotesk', reason: 'Over-saturated technical-monospace-vibe sans.' },
        { name: 'Manrope', reason: 'Generic friendly sans - over-defaulted by AI generators.' },
        { name: 'Cabinet Grotesk', reason: 'Fontshare emerging default - over-served by generative tools.' },
        { name: 'General Sans', reason: 'Fontshare emerging default - same trajectory as Inter.' },
        { name: 'Satoshi', reason: 'Fontshare emerging default - too widespread to read as distinctive.' },
        { name: 'Switzer', reason: 'Fontshare emerging default - watch list.' },
        { name: 'Clash Display', reason: 'Fontshare emerging default for display - over-saturated 2024+.' },
    ];
}
function loadAbsoluteBans() {
    return [
        {
            name: 'side-stripe-borders',
            description: 'border-left or border-right greater than 1px as a colored accent on cards, list items, callouts, or alerts.',
            detectionHint: 'CSS rules matching /border-(?:left|right):\\s*([2-9]|[1-9][0-9]+)px/ with a colored value, applied to .card, .alert, .callout, .list-item, .install-block, or similar.',
            rewriteOptions: ['Full borders', 'Background tints', 'Leading numbers or icons', 'Nothing - remove the accent'],
        },
        {
            name: 'gradient-text',
            description: 'background-clip: text combined with a gradient background. Decorative, never meaningful.',
            detectionHint: 'CSS rules combining /background-clip:\\s*text/ with /linear-gradient|radial-gradient/.',
            rewriteOptions: ['Solid color', 'Emphasis via weight or size', 'Use the brand accent on one word with text-decoration-color instead'],
        },
        {
            name: 'glassmorphism-default',
            description: 'Blurs and glass cards used decoratively rather than purposefully.',
            detectionHint: 'CSS rules combining /backdrop-filter:\\s*blur/ with /background:\\s*(?:rgba|hsla)\\([^)]+(?:0\\.[0-3])/ - the low-alpha-plus-blur signature of glass cards.',
            rewriteOptions: ['Solid surface with shadow', 'Border', 'Reserve glass for one purposeful moment per page'],
        },
        {
            name: 'hero-metric-template',
            description: 'Big number + small label + supporting stats + gradient accent. SaaS cliché.',
            detectionHint: 'A grid of 3-4 stat blocks each containing a large number, small label, and optional gradient. Search for /font-size:\\s*(?:[5-9]|[1-9][0-9])rem/ on numeric content followed by smaller label text.',
            rewriteOptions: ['Replace with a chart, illustration, or single anchor metric', 'Customer logos with specific named outcomes', 'Editorial paragraph with embedded metrics'],
        },
        {
            name: 'identical-card-grids',
            description: 'Same-sized cards with icon + heading + text, repeated endlessly.',
            detectionHint: 'Grid templates with /repeat\\(\\s*(?:3|4|5|6)\\s*,\\s*1fr\\)/ containing children with identical structure (icon + h3 + p) and no visual differentiation.',
            rewriteOptions: ['Asymmetric grid with one anchor card and supporting cards', 'List-style layout', 'Editorial mosaic with varied card sizes'],
        },
        {
            name: 'modal-as-first-thought',
            description: 'Modals used where inline or progressive disclosure would work.',
            detectionHint: '<dialog> or [role="dialog"] for content that could appear inline. Form-confirmation modals especially.',
            rewriteOptions: ['Inline editing', 'Progressive disclosure with details/summary', 'Popover anchored to trigger', 'Toast for confirmation'],
        },
    ];
}
function loadSaturatedAestheticLanes() {
    return [
        {
            name: 'Editorial-typographic',
            description: 'Big serif headlines, generous whitespace, magazine-style layouts. Currently the dominant "we are not Vercel" aesthetic.',
            tells: ['Serif display fonts (Fraunces, Instrument Serif, Newsreader)', 'Cream or warm-paper canvas', 'Lead paragraphs in italic', 'No interface chrome - everything reads like a document'],
        },
        {
            name: 'Brutalist-utility',
            description: 'Default browser styles, monospace, hard borders, no animation. Over-served by AI as the "authentic" anti-design move.',
            tells: ['Courier or system-mono throughout', 'Explicit border boxes around everything', 'Underlined links in blue', 'Aggressive intentional ugliness'],
        },
        {
            name: 'Acid-maximalism',
            description: 'Heavy gradient + saturated color + complex motion. The opposite reflex when brutalist feels too restrained.',
            tells: ['Mesh gradient hero', 'Multiple bright saturated colors layered', 'Stagger animations on everything', 'Hover states that scale 1.1 with rotation'],
        },
        // Watch list - approaching saturation but not yet there
        {
            name: 'Spotify-card-stack',
            description: 'Tilted card stack, vinyl/album-cover aesthetic, music-app visual language applied to non-music products.',
            tells: ['Cards rotated -3 to -8 degrees', 'Dark background with bright album-style color blocks', 'Heavy use of artist/track metaphor in non-music product'],
        },
        {
            name: 'Linear-clean',
            description: 'Linear-app visual language: keyboard-shortcut-first, monochrome neutral, ultra-restrained motion. Now over-replicated by AI when prompted for "minimalist productivity tool."',
            tells: ['Black/zinc/slate palette only', 'Command-K palette as the hero feature', 'Tiny shortcuts hint badges everywhere', 'Hover states that only swap text-color'],
        },
        {
            name: 'Notion-clone-minimalism',
            description: 'Notion visual language applied broadly: white canvas, system fonts, emoji icons, indented hierarchy.',
            tells: ['Pure white background', 'Apple system font stack', 'Emoji as icon language', 'Block-based content with hover-to-reveal handle'],
        },
        {
            name: 'Vercel-marketing',
            description: 'Vercel.com aesthetic: gradient mesh background, monospace marketing copy, bold-italic display sans, sparse content.',
            tells: ['Gradient mesh hero', 'Geist or Inter sans-serif', 'Bold sentence-case headings on dark', 'Sparse 1-2 sentences per section'],
        },
    ];
}
function loadLineHeightTiers() {
    return [
        { context: 'body text', fontSizeRange: '14-18px', lineHeightRange: [1.4, 1.6], why: 'Comfortable reading rhythm for paragraphs.' },
        { context: 'lead paragraphs', fontSizeRange: '18-22px', lineHeightRange: [1.35, 1.5], why: 'Slightly tighter than body for emphasis.' },
        { context: 'section heading h2/h3', fontSizeRange: '24-36px', lineHeightRange: [1.15, 1.3], why: 'Tight enough to read as one thought, loose enough to breathe.' },
        { context: 'display heading h1', fontSizeRange: '36-72px', lineHeightRange: [1.05, 1.2], why: 'Very tight - large sizes need compression or the line gap reads as separation.' },
        { context: 'hero heading h1 fluid', fontSizeRange: '72px+', lineHeightRange: [1.0, 1.1], why: 'Near-flat baseline. Bigger than this needs tracking adjustments too.' },
        { context: 'UI labels and buttons', fontSizeRange: '12-16px', lineHeightRange: [1.0, 1.2], why: 'Single-line UI text - no rhythm needed, just fit the box.' },
        { context: 'captions and metadata', fontSizeRange: '11-13px', lineHeightRange: [1.3, 1.5], why: 'Small text needs more line-height for legibility, not less.' },
    ];
}
function loadBreakpointTable() {
    return [
        { name: 'XS', range: '0-479px', primaryPattern: 'Single column', navPattern: 'Hamburger or bottom-bar', tablePattern: 'Stacked cards' },
        { name: 'SM', range: '480-767px', primaryPattern: 'Single column with breathing room', navPattern: 'Bottom navigation', tablePattern: 'Stacked cards' },
        { name: 'MD', range: '768-1023px', primaryPattern: 'Two columns where content permits', navPattern: 'Sidebar (left) or full nav (top)', tablePattern: 'Horizontal scroll or condensed' },
        { name: 'LG', range: '1024-1439px', primaryPattern: 'Multi-column with full feature surface', navPattern: 'Full nav bar', tablePattern: 'Full table with sorting' },
        { name: 'XL', range: '1440px+', primaryPattern: 'Max-width container, no further expansion', navPattern: 'Full nav with actions', tablePattern: 'Full table with sticky headers' },
    ];
}
//# sourceMappingURL=reference-loader.js.map