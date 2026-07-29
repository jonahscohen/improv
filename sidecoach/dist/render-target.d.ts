export declare function looksLikeUrl(target: string | undefined | null): boolean;
export declare function normalizeRenderUrl(target: string): string;
/**
 * The document URL to render for a validation context, or undefined when there is none.
 *
 * Only http/https/file/data are accepted: anything else is not a document this engine renders,
 * and returning undefined is what makes the browser lenses report unavailable rather than
 * attempt a navigation they cannot complete.
 */
export declare function renderUrlFromContext(raw: unknown): string | undefined;
//# sourceMappingURL=render-target.d.ts.map