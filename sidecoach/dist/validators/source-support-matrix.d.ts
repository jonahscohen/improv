import type { EvidenceKind, SourceKindSupport } from '../product-rule-types';
export declare const SOURCE_KIND_BY_EXTENSION: Record<string, string>;
export declare const SUPPORTED_SOURCE_KINDS_BY_EVIDENCE: Record<EvidenceKind, SourceKindSupport[]>;
export declare function supportedKindsFor(...requirements: EvidenceKind[]): SourceKindSupport[];
export declare function sourceKindForPath(filePath: string): string | undefined;
export declare function isCollectableSourceKind(kind: string): boolean;
//# sourceMappingURL=source-support-matrix.d.ts.map