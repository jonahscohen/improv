/**
 * Sidecoach pre-render authorship (Stage 2b) - author, render, THEN build (contract-then-verify).
 *
 * Before a full build proceeds, this step AUTHORS two artifacts from a brief and RENDERS them through the
 * shipping engine so the build starts on a verified contract instead of a hope:
 *   1. a design-system BOARD - the token set (colors + type scale) and a component inventory, as one
 *      self-contained HTML page, and
 *   2. a first-surface MOCK - the brief's opening screen as real HTML.
 * The bin renders BOTH headless via the existing Playwright engine and runs the SHIPPING audit
 * (runRenderedAudit) over each. The build PROCEEDS only when the mock audit returns a REAL verdict
 * (clean or warnings-only) - never on an inconclusive (a scan that did not run) and never on a blocked mock.
 *
 * WHAT THIS FILE IS NOT: it does not render, launch a browser, or touch the disk. It is the PURE half -
 * brief parsing, deterministic HTML construction, and the fail-closed gate decision - so every piece is
 * provable without a browser. The bin (bin/sidecoach-preauthor.js) owns the IO and the render; there is
 * exactly one detection engine in the product and it is the scanner's, reached here only through the audit
 * result the bin hands to decidePreauthorGate.
 *
 * DETERMINISM: buildBoardHtml / buildMockHtml are pure string builders over the brief - the same brief yields
 * byte-identical HTML, so the render and therefore the verdict are reproducible. No clock, no RNG.
 *
 * FAIL-CLOSED: decidePreauthorGate inherits audit-rendered's discipline - an artifact that did not render is
 * `inconclusive`, which HALTS (never a silent proceed). "renders both" is a requirement, so a non-render on
 * EITHER artifact halts; the MOCK is the blocker gate (the plan scopes the proceed decision to the mock).
 */
import type { RenderedAuditVerdict } from './audit-rendered';
/** One authored section of the first-surface mock: an h2 heading plus a concrete body paragraph. */
export interface BriefSection {
    heading: string;
    body: string;
}
/** The first surface to author + verify: its opening screen, in concrete (buzzword-free) copy. */
export interface BriefSurface {
    /** The kind of surface, for the board caption (e.g. "settings", "landing", "dashboard"). */
    kind: string;
    /** The h1 of the mock. */
    headline: string;
    /** The supporting paragraph under the h1. */
    subhead: string;
    /** One or more h2 sections. At least one is required (a single-heading surface is still a surface). */
    sections: BriefSection[];
    /** The primary call-to-action label. */
    primaryCta: string;
}
/**
 * The six palette roles the board documents and the mock actually paints with. Every value is an #rgb or
 * #rrggbb hex. These are applied for REAL in the mock (text on background), so a brief whose ink fails
 * contrast produces a mock the shipping scanner marks blocked - the "deliberately-broken mock" path.
 */
export interface BriefPalette {
    /** Primary text color. */
    ink: string;
    /** Page background. */
    canvas: string;
    /** Secondary / supporting text. */
    muted: string;
    /** Accent + primary-button background. */
    primary: string;
    /** Text on the primary accent. */
    onPrimary: string;
    /** Hairline / border color. */
    border: string;
}
/** The two font stacks the board and mock use. Include a committed typeface first to satisfy the taste read. */
export interface BriefType {
    display: string;
    body: string;
}
export interface Brief {
    name: string;
    description?: string;
    surface: BriefSurface;
    palette: BriefPalette;
    type: BriefType;
    /** Component inventory names for the board. Defaults to a sensible base set when omitted. */
    components: string[];
}
/**
 * Validate and normalize a raw brief object (parsed from the --brief fixture JSON). Throws a precise Error on
 * any malformed field so the bin can exit with a usage code and a named reason - never author a partial mock.
 */
export declare function parseBrief(raw: unknown): Brief;
/**
 * The design-system board: token swatches, a type scale, and the component inventory. One h1, then h2
 * sections in order (Tokens -> Type scale -> Components) so the heading outline never skips a level.
 */
export declare function buildBoardHtml(brief: Brief): string;
/**
 * The first-surface mock: the brief's opening screen as real HTML. h1 headline, a supporting subhead, the
 * authored h2 sections in order, and the primary CTA - all painted with the brief palette, so a bad-contrast
 * palette produces exactly the blocking finding the gate must catch.
 */
export declare function buildMockHtml(brief: Brief): string;
/** The subset of a runRenderedAudit result the gate reads. Kept structural so the gate stays browser-free. */
export interface ArtifactAuditLike {
    verdict: RenderedAuditVerdict;
    severityCounts: {
        blocking: number;
        warning: number;
        info: number;
    };
}
export declare const PREAUTHOR_EXIT: {
    /** proceed: the mock rendered with a real verdict and no blockers. */
    readonly PROCEED: 0;
    /** halt: the mock has blocking findings. */
    readonly BLOCKED: 1;
    /** usage / IO / load error - the step never started. */
    readonly USAGE: 2;
    /** halt: an artifact did not render (inconclusive). Never a proceed. */
    readonly INCONCLUSIVE: 3;
};
export interface PreauthorGate {
    decision: 'proceed' | 'halt';
    /** One of PREAUTHOR_EXIT. */
    exit: number;
    reason: string;
}
/**
 * Decide whether the build proceeds, from the mock and board audit verdicts.
 *
 * Faithful to the plan: the MOCK is the proceed gate, and "renders both" is a hard requirement.
 *   - Either artifact `inconclusive` (did not render) -> HALT (exit 3). A scan that did not run is not a pass;
 *     this is audit-rendered's fail-closed discipline carried into the pre-render step.
 *   - Mock `blocked` (blocking findings) -> HALT (exit 1).
 *   - Mock `clean` or `warnings-only` -> PROCEED (exit 0). Board findings are surfaced by the bin for the
 *     author; the plan scopes the blocker gate to the mock.
 *
 * A well-formed mock can NEVER be inconclusive here - both lenses render an authored, self-contained page - so
 * the inconclusive branch only fires on a real render failure (no browser, navigation error), which correctly
 * halts rather than fabricating a clean.
 */
export declare function decidePreauthorGate(mock: ArtifactAuditLike, board: ArtifactAuditLike): PreauthorGate;
//# sourceMappingURL=pre-authorship.d.ts.map