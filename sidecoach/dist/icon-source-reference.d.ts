export interface IconSource {
    inner: string;
    viewBox: string;
    stroke: string;
    strokeWidth: string;
}
export type IconLibraryId = 'heroicons' | 'lucide' | 'tabler' | 'bootstrap-icons' | 'phosphor' | 'material-symbols' | 'lucide-animated' | 'heroicons-animated';
export type IconTier = 'static' | 'animated';
export interface IconLibrarySignature {
    id: IconLibraryId;
    displayName: string;
    approxCount: number;
    tier: IconTier;
    strengths: string;
    repo: string;
    packageName?: string;
    classPattern: string;
    variants?: string;
}
export interface IconProvenanceMarkers {
    classPattern: string;
    dataAttribute: string;
    commentTemplate: string;
    example: string;
}
export interface IconLibraryRecommendation {
    library: IconLibraryId;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}
export interface RecommendOptions {
    designMdLibrary?: string;
    existingLibrary?: IconLibraryId;
    hasFramerMotion?: boolean;
    isReactProject?: boolean;
}
export interface IconSourceReference {
    getApprovedLibraries(): IconLibrarySignature[];
    getLibrary(id: IconLibraryId): IconLibrarySignature | undefined;
    getSelectionProtocol(): string[];
    getProvenanceMarkers(library: IconLibraryId): IconProvenanceMarkers;
    recommendLibrary(opts?: RecommendOptions): IconLibraryRecommendation;
    searchSemantics(intent: string): string[];
    getIconSource(library: IconLibraryId, name: string): IconSource | null;
}
export declare class IconSourceReferenceImpl implements IconSourceReference {
    getApprovedLibraries(): IconLibrarySignature[];
    getLibrary(id: IconLibraryId): IconLibrarySignature | undefined;
    getSelectionProtocol(): string[];
    getProvenanceMarkers(library: IconLibraryId): IconProvenanceMarkers;
    recommendLibrary(opts?: RecommendOptions): IconLibraryRecommendation;
    private static iconBundles;
    private loadBundle;
    getIconSource(library: IconLibraryId, name: string): IconSource | null;
    searchSemantics(intent: string): string[];
}
export declare function createIconSourceReference(): IconSourceReference;
export declare function buildIconSourceArtifactContent(ref: IconSourceReference): string;
//# sourceMappingURL=icon-source-reference.d.ts.map