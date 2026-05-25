"use strict";
// Project Context System
// Loads and caches PRODUCT.md and DESIGN.md for use by all flows
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
exports.ContextLoader = void 0;
exports.createContextLoader = createContextLoader;
exports.detectStackFromFilesystem = detectStackFromFilesystem;
exports.detectTechStack = detectTechStack;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ContextLoader {
    constructor() {
        this.cache = new Map();
    }
    load(projectPath) {
        // Return cached context if available
        if (this.cache.has(projectPath)) {
            return this.cache.get(projectPath);
        }
        const context = {
            projectPath,
            register: 'product', // default
            product: {},
            design: {},
            loaded: {
                productMd: false,
                designMd: false,
            },
            errors: [],
        };
        // Load PRODUCT.md (required)
        const productPath = path.join(projectPath, 'PRODUCT.md');
        if (fs.existsSync(productPath)) {
            try {
                const productContent = fs.readFileSync(productPath, 'utf-8');
                context.product = this.parseMarkdownFrontmatter(productContent);
                context.loaded.productMd = true;
            }
            catch (err) {
                context.errors.push(`Failed to load PRODUCT.md: ${err}`);
            }
        }
        else {
            context.errors.push('PRODUCT.md not found at project root');
        }
        // Load DESIGN.md (optional but recommended)
        const designPath = path.join(projectPath, 'DESIGN.md');
        if (fs.existsSync(designPath)) {
            try {
                const designContent = fs.readFileSync(designPath, 'utf-8');
                context.design = this.parseMarkdownFrontmatter(designContent);
                context.loaded.designMd = true;
            }
            catch (err) {
                context.errors.push(`Failed to load DESIGN.md: ${err}`);
            }
        }
        // Detect register: priority order
        // 1. Explicit field in PRODUCT.md
        if (context.product.register) {
            context.register = context.product.register;
        }
        // 2. Infer from "Users" field (customers/users = brand, internal/team = product)
        else if (context.product.users) {
            const usersLower = String(context.product.users).toLowerCase();
            if (usersLower.includes('customer') || usersLower.includes('public')) {
                context.register = 'brand';
            }
            else if (usersLower.includes('internal') || usersLower.includes('team')) {
                context.register = 'product';
            }
        }
        // 3. Infer from purpose (marketing/campaigns/landing = brand, app/dashboard/tool = product)
        else if (context.product.purpose) {
            const purposeLower = String(context.product.purpose).toLowerCase();
            if (purposeLower.includes('marketing') || purposeLower.includes('campaign') || purposeLower.includes('landing')) {
                context.register = 'brand';
            }
            else if (purposeLower.includes('app') || purposeLower.includes('dashboard') || purposeLower.includes('tool')) {
                context.register = 'product';
            }
        }
        // 4. Default to product
        else {
            context.register = 'product';
        }
        // Cache and return
        this.cache.set(projectPath, context);
        return context;
    }
    clear() {
        this.cache.clear();
    }
    parseMarkdownFrontmatter(content) {
        const lines = content.split('\n');
        const result = {};
        // Existing pass: collect section headers + key:value pairs
        let currentSection = '';
        let inCode = false;
        const sectionBodies = {};
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                inCode = !inCode;
                continue;
            }
            if (inCode)
                continue;
            if (line.trim().startsWith('---'))
                continue;
            if (line.startsWith('#')) {
                currentSection = line.replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '_');
                result[currentSection] = [];
                sectionBodies[currentSection] = [];
                continue;
            }
            if (currentSection) {
                sectionBodies[currentSection].push(line);
            }
            if (line.includes(':')) {
                const [key, value] = line.split(':', 2).map((s) => s.trim());
                if (key && value && !line.startsWith('|')) {
                    result[key.toLowerCase().replace(/\s+/g, '_')] = value;
                    if (currentSection && Array.isArray(result[currentSection])) {
                        result[currentSection].push({ [key]: value });
                    }
                }
            }
        }
        // Sprint 9 Bug 1: teach v2 section-header recognition
        // The ## Register section body contains **Brand** or **Product** as a bold marker.
        const registerBody = (sectionBodies['register'] || []).join('\n');
        if (/\*\*Brand\*\*/i.test(registerBody)) {
            result.register = 'brand';
        }
        else if (/\*\*Product\*\*/i.test(registerBody)) {
            result.register = 'product';
        }
        // ## Primary Users section body -> users field
        if (sectionBodies['primary_users']) {
            const usersText = sectionBodies['primary_users']
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (usersText && !result.users) {
                result.users = usersText;
            }
        }
        // ## Brand Personality section body -> brandPersonality field
        if (sectionBodies['brand_personality']) {
            const personalityText = sectionBodies['brand_personality']
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (personalityText && !result.brandPersonality) {
                result.brandPersonality = personalityText;
            }
        }
        // ## Anti-References section body -> antireferences array (bullets)
        if (sectionBodies['anti-references']) {
            const bullets = sectionBodies['anti-references']
                .filter((l) => l.trim().startsWith('- '))
                .map((l) => l.trim().replace(/^- /, ''));
            if (bullets.length > 0) {
                result.antiReferences = bullets;
            }
        }
        // ## Strategic Principles section body -> strategicprinciples array (bullets)
        if (sectionBodies['strategic_principles']) {
            const bullets = sectionBodies['strategic_principles']
                .filter((l) => l.trim().startsWith('- '))
                .map((l) => l.trim().replace(/^- /, ''));
            if (bullets.length > 0) {
                result.strategicPrinciples = bullets;
            }
        }
        return result;
    }
}
exports.ContextLoader = ContextLoader;
function createContextLoader() {
    return new ContextLoader();
}
/**
 * Detect CMS / Angular projects by sniffing the project root for marker files.
 * Runs BEFORE the package.json sniff inside detectTechStack so CMS markers
 * win over a package.json that may also be present (e.g. a WordPress project
 * with @wordpress/scripts for Gutenberg block work).
 *
 * Returns null if no CMS / Angular marker is found - the caller should then
 * fall through to the existing package.json detection.
 */
function detectStackFromFilesystem(projectPath) {
    // 1. Angular: angular.json at root
    if (fs.existsSync(path.join(projectPath, 'angular.json'))) {
        return 'angular';
    }
    // 2. WordPress: wp-config.php OR style.css with `Theme Name:` theme header
    if (fs.existsSync(path.join(projectPath, 'wp-config.php'))) {
        return 'wordpress';
    }
    const stylePath = path.join(projectPath, 'style.css');
    if (fs.existsSync(stylePath)) {
        try {
            const header = fs.readFileSync(stylePath, 'utf8').split('\n').slice(0, 50).join('\n');
            if (/^\s*Theme Name:\s*\S/m.test(header)) {
                return 'wordpress';
            }
        }
        catch {
            // unreadable style.css - ignore and continue
        }
    }
    // 3. Drupal: composer.json with drupal/* requirement OR any top-level *.info.yml
    const composerPath = path.join(projectPath, 'composer.json');
    if (fs.existsSync(composerPath)) {
        try {
            const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
            const allReqs = { ...(composer.require || {}), ...(composer['require-dev'] || {}) };
            if (Object.keys(allReqs).some((k) => k.startsWith('drupal/'))) {
                return 'drupal';
            }
        }
        catch {
            // malformed composer.json - ignore and continue
        }
    }
    try {
        const entries = fs.readdirSync(projectPath);
        if (entries.some((e) => e.endsWith('.info.yml'))) {
            return 'drupal';
        }
    }
    catch {
        // unreadable dir - ignore
    }
    // 4. HubSpot: theme.json with HubSpot fields OR hubl_modules/ OR hs-config* file
    const themePath = path.join(projectPath, 'theme.json');
    if (fs.existsSync(themePath)) {
        try {
            const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
            // Tightened: only `cms === 'hubspot'` is unambiguous. `template_types` and
            // `label` over-match on non-HubSpot theme.json files (Next.js, WordPress
            // block themes, etc.). The hubl_modules/ and hs-config* markers below
            // catch HubSpot projects that don't set `cms` explicitly.
            if (theme.cms === 'hubspot') {
                return 'hubspot';
            }
        }
        catch {
            // malformed theme.json - ignore and continue
        }
    }
    if (fs.existsSync(path.join(projectPath, 'hubl_modules'))) {
        return 'hubspot';
    }
    try {
        const entries = fs.readdirSync(projectPath);
        if (entries.some((e) => /^hs-config/.test(e))) {
            return 'hubspot';
        }
    }
    catch {
        // unreadable dir - already handled above
    }
    return null;
}
function detectTechStack(projectPath) {
    // CMS / Angular detection first - these markers take priority over package.json
    // because CMS projects often have a package.json for build tooling (e.g. WordPress
    // with @wordpress/scripts for Gutenberg) but the actual runtime framework is the CMS.
    const fsFramework = detectStackFromFilesystem(projectPath);
    const pkgPath = path.join(projectPath, 'package.json');
    let pkg = {};
    let pkgExists = true;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }
    catch {
        pkgExists = false;
    }
    // If no package.json AND no CMS marker, fall back to vanilla.
    if (!pkgExists && !fsFramework) {
        return { framework: 'vanilla', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' };
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    // Resolve framework: CMS detection wins; otherwise package.json sniff.
    let framework;
    if (fsFramework) {
        framework = fsFramework;
    }
    else if (deps['next'])
        framework = 'next';
    else if (deps['@remix-run/react'] || deps['remix'])
        framework = 'remix';
    else if (deps['astro'])
        framework = 'astro';
    else if (deps['svelte'])
        framework = 'svelte';
    else if (deps['vue'])
        framework = 'vue';
    else if (deps['react'])
        framework = 'react';
    else
        framework = 'vanilla';
    let animationLib = null;
    if (deps['gsap'])
        animationLib = 'gsap';
    else if (deps['framer-motion'])
        animationLib = 'framer-motion';
    else if (deps['motion'])
        animationLib = 'motion';
    else if (deps['lenis'] || deps['@studio-freight/lenis'])
        animationLib = 'lenis';
    else if (deps['animejs'])
        animationLib = 'anime';
    const hasTypescript = !!deps['typescript'] || fs.existsSync(path.join(projectPath, 'tsconfig.json'));
    let packageManager = 'unknown';
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')))
        packageManager = 'pnpm';
    else if (fs.existsSync(path.join(projectPath, 'yarn.lock')))
        packageManager = 'yarn';
    else if (fs.existsSync(path.join(projectPath, 'bun.lockb')))
        packageManager = 'bun';
    else if (fs.existsSync(path.join(projectPath, 'package-lock.json')))
        packageManager = 'npm';
    return { framework, hasAnimationLib: animationLib !== null, animationLib, hasTypescript, packageManager };
}
//# sourceMappingURL=project-context.js.map