// sidecoach/src/validators/check-context.ts
//
// Per-target evidence types, the verdict subtype + helpers, stampResult, and the
// concrete applicability probes for every not_applicable rule. Imports
// product-rule-types ONLY (no fs); the collector and orchestrator live elsewhere.
import type {
  ProductRuleDefinition, ProductRuleResult, RuleStatus, EvidenceKind, NormalizedErrorCategory,
} from '../product-rule-types';

// Per-file collected evidence. evidenceKindsPresent lists the SOURCE kinds available
// for this file (e.g. ['css'] or ['tsx']) - it is what isCoverageSatisfied matches
// against the coverage record's evidenceAlternativesByRequirement.
export interface CollectedFile {
  path: string;
  sourceKind: string;            // 'css' | 'scss' | 'less' | 'html' | 'tsx' | 'jsx' | 'vue' | 'svelte'
  cssText: string;               // CSS-family text in this file (incl. inline <style> for markup files)
  markup: string;                // markup text in this file ('' for pure CSS files)
  evidenceKindsPresent: string[];
}

export type CollectionOutcome = 'inspected' | 'policy_skipped' | 'unreadable' | 'oversized' | 'unsupported';
export interface DiscoveredFile {
  path: string;
  sourceKind: string;
  outcome: CollectionOutcome;
  reason?: string;
}

export interface BrowserDomEvidence {
  minHitArea: {
    checked: number;
    failing: number;
    smallestWidth: number;
    smallestHeight: number;
  };
}

export interface BrowserEvidenceMeta {
  available: true;
  kinds: EvidenceKind[];
  renderUrl: string;
}

// The per-target evidence a checkProduct inspects. Browser-collected fields are
// OPTIONAL and absent in P4a-2; a rule that needs them returns inconclusive.
export interface ProductCheckContext {
  cssText: string;               // joined CSS-family text across inspected files
  markup: string;                // joined markup across inspected files
  files: CollectedFile[];
  discoveredFiles?: DiscoveredFile[];
  computedStyle?: Record<string, string>;
  contrast?: { wcagAA: boolean; ratio: number };
  designTokens?: Record<string, unknown>;
  tasteOptions?: { tailwindDetected?: boolean; componentsJson?: boolean };
  renderUrl?: string;
  browserEvidence?: BrowserEvidenceMeta;
  dom?: BrowserDomEvidence;
}

// A check returns ONLY the verdict; metadata is stamped from the definition so a
// check body never duplicates (and cannot drift from) the rule's severity/class/key.
export interface RuleVerdict {
  status: RuleStatus;
  message: string;
  evidenceLocations?: string[];
  remediation?: string;
  normalizedErrorCategory?: NormalizedErrorCategory;
  evidenceKind?: EvidenceKind;
}

export const pass = (message: string, evidenceLocations: string[] = []): RuleVerdict => ({ status: 'pass', message, evidenceLocations });
export const fail = (message: string, evidenceLocations: string[] = [], remediation?: string): RuleVerdict => ({ status: 'fail', message, evidenceLocations, remediation });
export const notApplicable = (message: string): RuleVerdict => ({ status: 'not_applicable', message });
export const inconclusive = (message: string, category: NormalizedErrorCategory = 'unreadable_input'): RuleVerdict => ({ status: 'inconclusive', message, normalizedErrorCategory: category });

// True only when at least one CSS-family file was collected with non-empty text.
export const hasCss = (ctx: ProductCheckContext): boolean => !!ctx && typeof ctx.cssText === 'string' && ctx.cssText.trim().length > 0;
export const hasMarkup = (ctx: ProductCheckContext): boolean => !!ctx && typeof ctx.markup === 'string' && ctx.markup.trim().length > 0;

export const hasTrustedBrowserEvidence = (ctx: ProductCheckContext, kind: EvidenceKind): boolean =>
  ctx.browserEvidence?.available === true && ctx.browserEvidence.kinds.includes(kind);

export const browserNumber = (ctx: ProductCheckContext, key: string): number | undefined => {
  const raw = ctx.computedStyle?.[key];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

export function stampResult(def: ProductRuleDefinition, v: RuleVerdict): ProductRuleResult {
  return {
    ruleId: def.ruleId,
    canonicalRuleKey: def.canonicalRuleKey,
    status: v.status,
    normalizedErrorCategory: v.normalizedErrorCategory,
    severity: def.severity,
    findingClass: def.findingClass,
    evidenceKind: v.evidenceKind ?? def.evidenceRequirements[0],
    evidenceLocations: v.evidenceLocations ?? [],
    message: v.message,
    remediation: v.remediation,
  };
}

// ============================ applicability probes ============================
// Each probe returns true | false | 'unknown'. 'unknown' -> inconclusive (the
// evidence channel is insufficient to even decide applicability); false ->
// not_applicable (evidence is sufficient AND conclusively shows no target); true
// -> run the faithful feature check. A feature ABSENCE is never read as N/A: only
// a conclusive absence of the rule's TARGET is.
export type Applicability = true | false | 'unknown';

const textOf = (ctx: ProductCheckContext): string => `${ctx.cssText || ''}\n${ctx.markup || ''}`;
const INTERACTIVE_RE = /:hover|:active|:focus|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem|switch|checkbox)\b|\b(?:btn|button|link|nav|menu|tabs?|toggle|input|select|textarea|chip|switch|control|interactive)\b/i;
const ICON_RE = /\bicon\b|<svg\b|lucide|heroicon|tabler|\bphosphor\b|material-symbols/i;
const IMAGE_RE = /img\s*\{|\.image\b|<img\b/i;
const HEADING_RE = /<h[1-6]\b|(?:^|[\s,}])h[1-6]\s*[,{:]|\.(?:title|heading|headline|hero-title|display|headline)\b/i;
const MOTION_RE = /transition\s*:|@keyframes\b|animation\s*:|animation-delay|framer-motion|<AnimatePresence|\bmotion\./i;
const ROOT_TARGET_RE = /(?:^|[\s,}])(?:\*|:root|html|body)\s*[,{]/i;
const SHADOW_TARGET_RE = /box-shadow\s*:|--shadow|\.(?:card|panel|dialog|modal|popover|surface|elevated|sheet|menu|dropdown|tooltip|tile)\b/i;
// A real optical-alignment target is an icon-text control / badge / labelled control -
// NOT plain `padding:` (that is the FEATURE the check then evaluates; treating it as the
// target made ordinary layout padding a false pass, Codex P2#3).
const OPTICAL_TARGET_RE = /\bbadge\b|\bicon\b|\bchip\b|\bbtn\b|\bbutton\b|\blabel\b|icon-text|\bpill\b|\btag\b/i;
const FOCUSABLE_RE = /:focus|:hover|:active|<button\b|<a\b|<input\b|<select\b|<textarea\b|role\s*=\s*["']?(?:button|link|tab|menuitem)\b|\b(?:btn|button|link|input|nav|tabs?|focusable|interactive|control)\b/i;

const presence = (ctx: ProductCheckContext, target: RegExp, scope: 'css' | 'markup' | 'both'): Applicability => {
  const haveCss = hasCss(ctx);
  const haveMarkup = hasMarkup(ctx);
  if (scope === 'css' && !haveCss) return 'unknown';
  if (scope === 'markup' && !haveMarkup) return 'unknown';
  if (scope === 'both' && !haveCss && !haveMarkup) return 'unknown';
  const subject = scope === 'css' ? (ctx.cssText || '') : scope === 'markup' ? (ctx.markup || '') : textOf(ctx);
  return target.test(subject);
};

export const interactiveTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, INTERACTIVE_RE, 'both');
export const iconTargetApplicability = (ctx: ProductCheckContext): Applicability => {
  const base = presence(ctx, ICON_RE, 'both');
  if (base === true) return true;
  if (base === 'unknown') return 'unknown';
  return presence(ctx, INTERACTIVE_RE, 'both'); // an interactive control can bear an icon swap
};
export const imageTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, IMAGE_RE, 'both');
export const transitionTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, /transition\s*:/i, 'css');
export const tabularTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i, 'css');
export const headingTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, HEADING_RE, 'both');
export const motionTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, MOTION_RE, 'both');
export const rootStyleApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, ROOT_TARGET_RE, 'css');
export const framerApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, /framer-motion|<AnimatePresence/i, 'markup');
export const willChangeApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, /will-change\s*:/i, 'css');
export const shadowTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, SHADOW_TARGET_RE, 'css');
export const opticalTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, OPTICAL_TARGET_RE, 'css');
export const focusableTargetApplicability = (ctx: ProductCheckContext): Applicability => presence(ctx, FOCUSABLE_RE, 'both');

// canonicalRuleKey -> the probe gating that rule. Browser-only rules (computed-
// style/dom/contrast) are NOT listed: they bypass the N/A wrapper and return
// their honest inconclusive directly.
const PROBES: Record<string, (ctx: ProductCheckContext) => Applicability> = {
  'polish/scale-on-press': interactiveTargetApplicability,
  'polish/state-completeness': interactiveTargetApplicability,
  'polish/icon-swap-compound': iconTargetApplicability,
  'polish/image-outline-neutral': imageTargetApplicability,
  'polish/no-transition-all': transitionTargetApplicability,
  'polish/tabular-nums': tabularTargetApplicability,
  'polish/text-wrap-balance': headingTargetApplicability,
  'polish/staggered-enter': motionTargetApplicability,
  'polish/subtle-exit': motionTargetApplicability,
  'polish/reduced-motion-respect': motionTargetApplicability,
  'polish/font-smoothing': rootStyleApplicability,
  'polish/animatepresence-initial': framerApplicability,
  'polish/sparse-will-change': willChangeApplicability,
  'polish/shadows-over-borders': shadowTargetApplicability,
  'polish/shadow-hierarchy': shadowTargetApplicability,
  'polish/optical-alignment': opticalTargetApplicability,
};

// Wrap a faithful raw feature check with its applicability probe. unknown ->
// inconclusive, false -> not_applicable, true -> the raw check runs.
export function withRuleApplicability(
  canonicalRuleKey: string,
  rawCheck: (ctx: ProductCheckContext) => RuleVerdict,
): (ctx: ProductCheckContext) => RuleVerdict {
  const probe = PROBES[canonicalRuleKey];
  return (ctx: ProductCheckContext): RuleVerdict => {
    if (!probe) return rawCheck(ctx);
    const a = probe(ctx);
    if (a === 'unknown') return inconclusive(`cannot establish applicability for ${canonicalRuleKey} from collected evidence`, 'unreadable_input');
    if (a === false) return notApplicable(`no applicable target for ${canonicalRuleKey} in collected evidence`);
    return rawCheck(ctx);
  };
}
