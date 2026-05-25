import fs from 'fs';
import path from 'path';
import { parseDesignMd, DesignTokens } from './design-md-parser';
import { detectTechStack, ContextLoader as StructuredContextLoader, ProductMetadata, DesignMetadata } from './project-context';

export interface ContextLoadResult {
  hasProduct: boolean;
  product: string | null;
  productPath: string | null;
  hasDesign: boolean;
  design: string | null;
  designPath: string | null;
  migrated: boolean;
  contextDir: string;
}

export interface ProjectContext {
  cwd: string;
  contextDir: string;
  productContent: string | null;
  designContent: string | null;
  register: 'brand' | 'product' | null;
  hasFullContext: boolean;
  parsedDesignTokens: DesignTokens | null;
  techStack?: { framework: string; hasAnimationLib: boolean; animationLib?: string | null; hasTypescript: boolean; packageManager: string };
  // Sprint 12 T6: parsed product/design from project-context.ts so handlers
  // (flowB, flowE, etc.) can read product.brandPersonality and design.colors
  // directly off the projectContext that the orchestrator threads through.
  product?: ProductMetadata;
  design?: DesignMetadata;
}

const PRODUCT_NAMES = ['PRODUCT.md', 'Product.md', 'product.md'];
const DESIGN_NAMES = ['DESIGN.md', 'Design.md', 'design.md'];
const FALLBACK_DIRS = ['.agents/context', 'docs'];

function firstExisting(dir: string, names: string[]): string | null {
  for (const name of names) {
    const abs = path.join(dir, name);
    try {
      if (fs.existsSync(abs)) return abs;
    } catch {
      // Ignore permission errors
    }
  }
  return null;
}

function safeRead(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

export function resolveContextDir(cwd: string = process.cwd()): string {
  // 1. Explicit override via environment
  const envDir = process.env.SIDECOACH_CONTEXT_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  }

  // 2. cwd wins if any canonical file is there
  if (firstExisting(cwd, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
    return cwd;
  }

  // 3. Auto-fallback subdirs
  for (const rel of FALLBACK_DIRS) {
    const candidate = path.resolve(cwd, rel);
    if (firstExisting(candidate, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
      return candidate;
    }
  }

  // 4. Default to cwd
  return cwd;
}

export function loadContext(cwd: string = process.cwd()): ContextLoadResult {
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
    productPath: productPath ? path.relative(cwd, productPath) : null,
    hasDesign: !!design,
    design,
    designPath: designPath ? path.relative(cwd, designPath) : null,
    migrated,
    contextDir,
  };
}

export function detectRegister(productContent: string | null): 'brand' | 'product' | null {
  if (!productContent) return null;

  const lower = productContent.toLowerCase();

  // Brand indicators: landing, campaign, marketing, portfolio, identity, brand
  const brandCues = ['landing', 'campaign', 'marketing', 'portfolio', 'identity', 'brand statement', 'brand positioning'];
  const hasBrandCue = brandCues.some(cue => lower.includes(cue));

  // Product indicators: dashboard, app, tool, admin, SaaS, internal, workflow
  const productCues = ['dashboard', ' app ', 'tool', 'admin', 'saas', 'internal', 'workflow', 'interface'];
  const hasProductCue = productCues.some(cue => lower.includes(cue));

  // If both or neither, default to product (conservative choice)
  if (hasBrandCue && !hasProductCue) return 'brand';
  if (hasProductCue && !hasBrandCue) return 'product';

  return 'product'; // Default fallback
}

export function buildProjectContext(cwd: string = process.cwd()): ProjectContext {
  const loaded = loadContext(cwd);
  let register = detectRegister(loaded.product);

  let parsedDesignTokens: DesignTokens | null = null;
  if (loaded.design && loaded.design.startsWith('---')) {
    try {
      parsedDesignTokens = parseDesignMd(loaded.design);
    } catch (err) {
      // Parser failure: leave null, downstream gracefully handles
    }
  }
  const techStack = detectTechStack(cwd);

  // Sprint 12 T6: also delegate to the structured ContextLoader (project-context.ts)
  // so handlers see parsed `product` (with brandPersonality, antiReferences, ...)
  // and `design` (with colors, typography, ...) on the same object the orchestrator
  // threads through. Pre-T6 the two loaders produced different shapes and handlers
  // checking `product.brandPersonality` always saw undefined.
  let parsedProduct: ProductMetadata | undefined;
  let parsedDesign: DesignMetadata | undefined;
  try {
    const structured = new StructuredContextLoader().load(loaded.contextDir);
    parsedProduct = structured.product;
    parsedDesign = structured.design;
    // Structured loader's section-header register detection (teach v2 ## Register
    // / **Brand**) is more accurate than the heuristic detectRegister - prefer it
    // when set.
    if (structured.register && structured.product?.register) {
      register = structured.register;
    }
  } catch (err) {
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
