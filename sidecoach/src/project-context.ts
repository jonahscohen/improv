// Project Context System
// Loads and caches PRODUCT.md and DESIGN.md for use by all flows

import * as fs from 'fs';
import * as path from 'path';
import { DesignTokens } from './design-md-parser';

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
  parsedTokens?: DesignTokens;
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
  techStack?: TechStack;
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

export interface TechStack {
  framework:
    | 'react'
    | 'next'
    | 'vue'
    | 'svelte'
    | 'astro'
    | 'remix'
    | 'angular'
    | 'wordpress'
    | 'drupal'
    | 'hubspot'
    | 'vanilla'
    | 'unknown';
  hasAnimationLib: boolean;
  animationLib?: 'gsap' | 'framer-motion' | 'motion' | 'lenis' | 'anime' | null;
  hasTypescript: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
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
export function detectStackFromFilesystem(
  projectPath: string
): 'angular' | 'wordpress' | 'drupal' | 'hubspot' | null {
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
    } catch {
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
    } catch {
      // malformed composer.json - ignore and continue
    }
  }
  try {
    const entries = fs.readdirSync(projectPath);
    if (entries.some((e) => e.endsWith('.info.yml'))) {
      return 'drupal';
    }
  } catch {
    // unreadable dir - ignore
  }

  // 4. HubSpot: theme.json with HubSpot fields OR hubl_modules/ OR hs-config* file
  const themePath = path.join(projectPath, 'theme.json');
  if (fs.existsSync(themePath)) {
    try {
      const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      if (
        theme.cms === 'hubspot' ||
        Array.isArray(theme.template_types) ||
        theme.label !== undefined
      ) {
        return 'hubspot';
      }
    } catch {
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
  } catch {
    // unreadable dir - already handled above
  }

  return null;
}

export function detectTechStack(projectPath: string): TechStack {
  // CMS / Angular detection first - these markers take priority over package.json
  // because CMS projects often have a package.json for build tooling (e.g. WordPress
  // with @wordpress/scripts for Gutenberg) but the actual runtime framework is the CMS.
  const fsFramework = detectStackFromFilesystem(projectPath);

  const pkgPath = path.join(projectPath, 'package.json');
  let pkg: any = {};
  let pkgExists = true;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    pkgExists = false;
  }

  // If no package.json AND no CMS marker, fall back to vanilla.
  if (!pkgExists && !fsFramework) {
    return { framework: 'vanilla', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' };
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Resolve framework: CMS detection wins; otherwise package.json sniff.
  let framework: TechStack['framework'];
  if (fsFramework) {
    framework = fsFramework;
  } else if (deps['next']) framework = 'next';
  else if (deps['@remix-run/react'] || deps['remix']) framework = 'remix';
  else if (deps['astro']) framework = 'astro';
  else if (deps['svelte']) framework = 'svelte';
  else if (deps['vue']) framework = 'vue';
  else if (deps['react']) framework = 'react';
  else framework = 'vanilla';
  let animationLib: TechStack['animationLib'] = null;
  if (deps['gsap']) animationLib = 'gsap';
  else if (deps['framer-motion']) animationLib = 'framer-motion';
  else if (deps['motion']) animationLib = 'motion';
  else if (deps['lenis'] || deps['@studio-freight/lenis']) animationLib = 'lenis';
  else if (deps['animejs']) animationLib = 'anime';
  const hasTypescript = !!deps['typescript'] || fs.existsSync(path.join(projectPath, 'tsconfig.json'));
  let packageManager: TechStack['packageManager'] = 'unknown';
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) packageManager = 'yarn';
  else if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) packageManager = 'bun';
  else if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) packageManager = 'npm';
  return { framework, hasAnimationLib: animationLib !== null, animationLib, hasTypescript, packageManager };
}
