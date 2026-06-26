// sidecoach/src/validators/source-support-matrix.ts
//
// ONE source-support matrix shared by registry authoring/generation
// (product-rule-registry.ts + validator-generation.ts) AND project collection
// (project-collector.ts). It maps extensions to source kinds and evidence
// requirements to support levels. No second extension or support list is allowed
// anywhere; both the registry and the collector resolve through this module so a
// generated support record can never drift from what the collector can inspect.
import type { EvidenceKind, SourceKindSupport } from '../product-rule-types';

// Extension -> source kind. The ONLY place file extensions map to source kinds.
export const SOURCE_KIND_BY_EXTENSION: Record<string, string> = {
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

// Evidence requirement -> the supported source-kind block. The ONLY support list.
// Browser-only evidence (computed-style / dom / contrast) lists the browser kind
// at level 'full' plus the static kinds at level 'none' (a placeholder declaring
// "owned but no static source can satisfy this") so the generator's static-
// satisfiability derivation stays well-defined.
export const SUPPORTED_SOURCE_KINDS_BY_EVIDENCE: Record<EvidenceKind, SourceKindSupport[]> = {
  'css-rule': [
    { kind: 'css', level: 'full' },
    { kind: 'scss', level: 'full' },
    { kind: 'less', level: 'full' },
    { kind: 'tsx', level: 'partial' },
    { kind: 'html', level: 'partial' },
  ],
  'markup': [
    { kind: 'html', level: 'full' },
    { kind: 'tsx', level: 'partial' },
    { kind: 'jsx', level: 'partial' },
    { kind: 'vue', level: 'partial' },
    { kind: 'svelte', level: 'partial' },
  ],
  'computed-style': [
    { kind: 'computed-style', level: 'full' },
    { kind: 'tsx', level: 'none' },
    { kind: 'html', level: 'none' },
  ],
  'dom': [
    { kind: 'dom', level: 'full' },
    { kind: 'tsx', level: 'none' },
    { kind: 'html', level: 'none' },
  ],
  'contrast': [
    { kind: 'contrast', level: 'full' },
    { kind: 'tsx', level: 'none' },
    { kind: 'html', level: 'none' },
  ],
  // rendered-scan: satisfied ONLY by a live rendered scan of a renderUrl (scanRenderedLive),
  // never by a static file - same browser-only shape as dom/contrast (the rendered kind at
  // 'full' plus static kinds at 'none' so static-satisfiability derivation stays well-defined).
  'rendered-scan': [
    { kind: 'rendered-scan', level: 'full' },
    { kind: 'tsx', level: 'none' },
    { kind: 'html', level: 'none' },
  ],
};

// The supported source-kind block for a rule's evidence requirements. Every rule
// in the partial-static slice declares exactly one requirement, so this returns
// that block verbatim. Multi-requirement rules merge (strongest level per kind).
export function supportedKindsFor(...requirements: EvidenceKind[]): SourceKindSupport[] {
  if (requirements.length === 1) return SUPPORTED_SOURCE_KINDS_BY_EVIDENCE[requirements[0]].map((s) => ({ ...s }));
  const rank = { full: 3, partial: 2, none: 1 } as const;
  const best = new Map<string, SourceKindSupport>();
  for (const e of requirements) {
    for (const s of SUPPORTED_SOURCE_KINDS_BY_EVIDENCE[e]) {
      const cur = best.get(s.kind);
      if (!cur || rank[s.level] > rank[cur.level]) best.set(s.kind, { ...s });
    }
  }
  return [...best.values()];
}

// Collector helpers: resolve a path to its source kind, and decide whether a kind
// can actually be read for static evidence (browser-only kinds never appear from
// the filesystem, so the matrix's static kinds are exactly the collectable set).
const COLLECTABLE_KINDS = new Set(Object.values(SOURCE_KIND_BY_EXTENSION));

export function sourceKindForPath(filePath: string): string | undefined {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return undefined;
  const ext = lower.slice(dot);
  return SOURCE_KIND_BY_EXTENSION[ext];
}

export function isCollectableSourceKind(kind: string): boolean {
  return COLLECTABLE_KINDS.has(kind);
}
