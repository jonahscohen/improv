"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContextDir = resolveContextDir;
exports.loadContext = loadContext;
exports.detectRegister = detectRegister;
exports.buildProjectContext = buildProjectContext;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const design_md_parser_1 = require("./design-md-parser");
const project_context_1 = require("./project-context");
const PRODUCT_NAMES = ['PRODUCT.md', 'Product.md', 'product.md'];
const DESIGN_NAMES = ['DESIGN.md', 'Design.md', 'design.md'];
const FALLBACK_DIRS = ['.agents/context', 'docs'];
function firstExisting(dir, names) {
    for (const name of names) {
        const abs = path_1.default.join(dir, name);
        try {
            if (fs_1.default.existsSync(abs))
                return abs;
        }
        catch {
            // Ignore permission errors
        }
    }
    return null;
}
function safeRead(p) {
    try {
        return fs_1.default.readFileSync(p, 'utf-8');
    }
    catch {
        return null;
    }
}
function resolveContextDir(cwd = process.cwd()) {
    // 1. Explicit override via environment
    const envDir = process.env.SIDECOACH_CONTEXT_DIR;
    if (envDir && envDir.trim()) {
        const trimmed = envDir.trim();
        return path_1.default.isAbsolute(trimmed) ? trimmed : path_1.default.resolve(cwd, trimmed);
    }
    // 2. cwd wins if any canonical file is there
    if (firstExisting(cwd, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
        return cwd;
    }
    // 3. Auto-fallback subdirs
    for (const rel of FALLBACK_DIRS) {
        const candidate = path_1.default.resolve(cwd, rel);
        if (firstExisting(candidate, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
            return candidate;
        }
    }
    // 4. Default to cwd
    return cwd;
}
function loadContext(cwd = process.cwd()) {
    const migrated = false;
    const contextDir = resolveContextDir(cwd);
    // 1. Look for PRODUCT.md (case-insensitive)
    const productPath = firstExisting(contextDir, PRODUCT_NAMES);
    // 2. DESIGN.md (case-insensitive)
    const designPath = firstExisting(contextDir, DESIGN_NAMES);
    const product = productPath ? safeRead(productPath) : null;
    const design = designPath ? safeRead(designPath) : null;
    return {
        hasProduct: !!product,
        product,
        productPath: productPath ? path_1.default.relative(cwd, productPath) : null,
        hasDesign: !!design,
        design,
        designPath: designPath ? path_1.default.relative(cwd, designPath) : null,
        migrated,
        contextDir,
    };
}
function detectRegister(productContent) {
    if (!productContent)
        return null;
    const lower = productContent.toLowerCase();
    // Brand indicators: landing, campaign, marketing, portfolio, identity, brand
    const brandCues = ['landing', 'campaign', 'marketing', 'portfolio', 'identity', 'brand statement', 'brand positioning'];
    const hasBrandCue = brandCues.some(cue => lower.includes(cue));
    // Product indicators: dashboard, app, tool, admin, SaaS, internal, workflow
    const productCues = ['dashboard', ' app ', 'tool', 'admin', 'saas', 'internal', 'workflow', 'interface'];
    const hasProductCue = productCues.some(cue => lower.includes(cue));
    // If both or neither, default to product (conservative choice)
    if (hasBrandCue && !hasProductCue)
        return 'brand';
    if (hasProductCue && !hasBrandCue)
        return 'product';
    return 'product'; // Default fallback
}
function buildProjectContext(cwd = process.cwd()) {
    const loaded = loadContext(cwd);
    let register = detectRegister(loaded.product);
    let parsedDesignTokens = null;
    if (loaded.design && loaded.design.startsWith('---')) {
        try {
            parsedDesignTokens = (0, design_md_parser_1.parseDesignMd)(loaded.design);
        }
        catch (err) {
            // Parser failure: leave null, downstream gracefully handles
        }
    }
    const techStack = (0, project_context_1.detectTechStack)(cwd);
    // Sprint 12 T6: also delegate to the structured ContextLoader (project-context.ts)
    // so handlers see parsed `product` (with brandPersonality, antiReferences, ...)
    // and `design` (with colors, typography, ...) on the same object the orchestrator
    // threads through. Pre-T6 the two loaders produced different shapes and handlers
    // checking `product.brandPersonality` always saw undefined.
    let parsedProduct;
    let parsedDesign;
    try {
        const structured = new project_context_1.ContextLoader().load(loaded.contextDir);
        parsedProduct = structured.product;
        parsedDesign = structured.design;
        // Structured loader's section-header register detection (teach v2 ## Register
        // / **Brand**) is more accurate than the heuristic detectRegister - prefer it
        // when set.
        if (structured.register && structured.product?.register) {
            register = structured.register;
        }
    }
    catch (err) {
        // Soft-fail - leave parsedProduct/parsedDesign undefined; handlers will skip.
    }
    return {
        cwd,
        contextDir: loaded.contextDir,
        productContent: loaded.product,
        designContent: loaded.design,
        register,
        hasFullContext: loaded.hasProduct && loaded.hasDesign,
        parsedDesignTokens,
        techStack,
        product: parsedProduct,
        design: parsedDesign,
    };
}
// Export as CommonJS for CLI usage
if (require.main === module) {
    const result = loadContext(process.cwd());
    console.log(JSON.stringify(result, null, 2));
}
//# sourceMappingURL=context-loader.js.map