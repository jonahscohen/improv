// Project Context System
// Loads and caches PRODUCT.md and DESIGN.md for use by all flows

import * as fs from 'fs';
import * as path from 'path';

export type Register = 'brand' | 'product';

export interface ProductMetadata {
  register?: Register;
  users?: string;
  purpose?: string;
  brandPersonality?: string;
  antiReferences?: string[];
  strategicPrinciples?: string[];
  // Additional fields from PRODUCT.md
  [key: string]: any;
}

export interface DesignMetadata {
  colors?: Record<string, any>;
  typography?: Record<string, any>;
  spacing?: Record<string, any>;
  elevation?: Record<string, any>;
  components?: Record<string, any>;
  breakpoints?: Record<string, number>;
  // Additional fields from DESIGN.md
  [key: string]: any;
}

export interface ProjectContext {
  projectPath: string;
  register: Register;
  product: ProductMetadata;
  design: DesignMetadata;
  loaded: {
    productMd: boolean;
    designMd: boolean;
  };
  errors: string[];
}

export class ContextLoader {
  private cache: Map<string, ProjectContext> = new Map();

  load(projectPath: string): ProjectContext {
    // Return cached context if available
    if (this.cache.has(projectPath)) {
      return this.cache.get(projectPath)!;
    }

    const context: ProjectContext = {
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
      } catch (err) {
        context.errors.push(`Failed to load PRODUCT.md: ${err}`);
      }
    } else {
      context.errors.push('PRODUCT.md not found at project root');
    }

    // Load DESIGN.md (optional but recommended)
    const designPath = path.join(projectPath, 'DESIGN.md');
    if (fs.existsSync(designPath)) {
      try {
        const designContent = fs.readFileSync(designPath, 'utf-8');
        context.design = this.parseMarkdownFrontmatter(designContent);
        context.loaded.designMd = true;
      } catch (err) {
        context.errors.push(`Failed to load DESIGN.md: ${err}`);
      }
    }

    // Detect register: priority order
    // 1. Explicit field in PRODUCT.md
    if (context.product.register) {
      context.register = context.product.register as Register;
    }
    // 2. Infer from "Users" field (customers/users = brand, internal/team = product)
    else if (context.product.users) {
      const usersLower = String(context.product.users).toLowerCase();
      if (usersLower.includes('customer') || usersLower.includes('public')) {
        context.register = 'brand';
      } else if (usersLower.includes('internal') || usersLower.includes('team')) {
        context.register = 'product';
      }
    }
    // 3. Infer from purpose (marketing/campaigns/landing = brand, app/dashboard/tool = product)
    else if (context.product.purpose) {
      const purposeLower = String(context.product.purpose).toLowerCase();
      if (purposeLower.includes('marketing') || purposeLower.includes('campaign') || purposeLower.includes('landing')) {
        context.register = 'brand';
      } else if (purposeLower.includes('app') || purposeLower.includes('dashboard') || purposeLower.includes('tool')) {
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

  clear(): void {
    this.cache.clear();
  }

  private parseMarkdownFrontmatter(content: string): Record<string, any> {
    const lines = content.split('\n');
    const result: Record<string, any> = {};

    // Look for YAML-style frontmatter or structured markdown sections
    // Very basic parsing - just extract key: value lines and section headings
    let currentSection = '';
    let inCode = false;

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCode = !inCode;
        continue;
      }

      if (inCode) continue;

      // Extract frontmatter (YAML between ---)
      if (line.trim().startsWith('---')) continue;

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

export function createContextLoader(): ContextLoader {
  return new ContextLoader();
}
