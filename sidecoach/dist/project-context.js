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
        // Look for YAML-style frontmatter or structured markdown sections
        // Very basic parsing - just extract key: value lines and section headings
        let currentSection = '';
        let inCode = false;
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                inCode = !inCode;
                continue;
            }
            if (inCode)
                continue;
            // Extract frontmatter (YAML between ---)
            if (line.trim().startsWith('---'))
                continue;
            // Extract section headers
            if (line.startsWith('#')) {
                currentSection = line.replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '_');
                result[currentSection] = [];
                continue;
            }
            // Extract key: value pairs
            if (line.includes(':')) {
                const [key, value] = line.split(':', 2).map((s) => s.trim());
                if (key && value && !line.startsWith('|')) {
                    // Avoid table syntax
                    result[key.toLowerCase().replace(/\s+/g, '_')] = value;
                    if (currentSection && Array.isArray(result[currentSection])) {
                        result[currentSection].push({ [key]: value });
                    }
                }
            }
        }
        return result;
    }
}
exports.ContextLoader = ContextLoader;
function createContextLoader() {
    return new ContextLoader();
}
//# sourceMappingURL=project-context.js.map