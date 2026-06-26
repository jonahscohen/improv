import type { Register } from './project-context';
export interface ReferencePreflightArtifact {
    kind: 'component' | 'fonts' | 'design-references' | 'motion' | 'icon-source' | 'visual-effects' | 'tilt-lab';
    title: string;
    content: string;
    source: string;
}
export interface ReferencePreflightBundle {
    artifacts: ReferencePreflightArtifact[];
    warnings: string[];
}
export declare function gatherReferencePreflightArtifacts(opts: {
    projectPath: string;
    register?: Register;
    target?: string;
}): Promise<ReferencePreflightBundle>;
//# sourceMappingURL=reference-preflight-artifacts.d.ts.map