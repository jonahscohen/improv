import { chromium } from 'playwright';
import type { BrowserDomEvidence, BrowserEvidenceMeta } from './check-context';
export interface CollectedBrowserEvidence {
    browserEvidence: BrowserEvidenceMeta;
    computedStyle: Record<string, string>;
    dom: BrowserDomEvidence;
    contrast: {
        wcagAA: boolean;
        ratio: number;
    };
}
export type BrowserEvidenceCollection = {
    available: true;
    evidence: CollectedBrowserEvidence;
} | {
    available: false;
    reason: string;
};
export declare function renderUrlFromContext(raw: unknown): string | undefined;
export declare function isSubresourceAllowed(suppliedUrl: string, requestedUrl: string): boolean;
export declare function collectBrowserEvidence(renderUrl: string | undefined, signal?: AbortSignal, launcher?: () => Promise<Awaited<ReturnType<typeof chromium.launch>>>): Promise<BrowserEvidenceCollection>;
//# sourceMappingURL=browser-evidence-collector.d.ts.map