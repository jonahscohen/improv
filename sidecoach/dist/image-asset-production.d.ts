/**
 * Sidecoach ASSET PRODUCTION LENS - the wiring that makes image generation part of doing design work.
 *
 * THE DEFECT THIS CLOSES. Sidecoach could generate a verified raster asset and no flow ever asked it to. The
 * generator was a sibling CLI: reachable by a human who already knew it existed, unreachable from the path a real
 * request travels. A capability that only the author can find is not a capability, and the measure of this file is
 * not that it works but that `/sidecoach craft <feature>` reaches it without being told to.
 *
 * WHAT A LENS IS HERE. The same shape as the token-drift lens in the audit flow: a flow calls it, it does one
 * bounded thing through a sibling bin, and it is FULLY CONTAINED. Any harness problem (no project path, missing
 * bin, spawn failure, timeout, unparseable output) returns a named outcome or null, and the flow carries on with
 * everything else it was doing. A build must never fail because an asset step could not run.
 *
 * THE FOUR PROPERTIES IT PRESERVES, each one a thing the wiring could have quietly dropped:
 *
 *   1. THE CONTRACT TRAVELS. The compiled brief carries the ink colour, the ink region, and the contrast floor,
 *      and every one of them is passed to the bin as a verification flag. This is the property most easily lost in
 *      wiring: generate through a flow, forget the contract, and the pixel checks silently stop running while the
 *      exit code still says zero. The whole point of the verifier is that it reads the region the prompt was told
 *      to protect, so the flags are assembled from the same compilation that wrote the prompt.
 *
 *   2. THREE-VALUED, FAIL-CLOSED. verified, failed, and unverified stay distinct, and only `verified` is offered
 *      downstream. A plate whose checks could not run is reported as unchecked, never rounded up.
 *
 *   3. IT CANNOT SPEND ON ITS OWN. The default provider is the offline deterministic renderer and the spend signal
 *      is never synthesised here. Going live is an operator decision expressed in the environment, and the bin
 *      remains the authority that enforces it: this lens passes through what the operator set and reports the
 *      bin's own refusal (exit 8) as its own named outcome rather than second-guessing the policy.
 *
 *   4. IT DOES NOT FIRE ON EVERYTHING. A brief that names no raster gets no asset and says so. A lens that
 *      produced a plate for every component would be noise, and noise is how a real capability gets muted.
 */
import type { FlowExecutionContext } from './flow-handler';
import { type CompiledImageBrief, type ImageBrief, type SizePolicy } from './image-brief-compiler';
import { type DesignTokens } from './design-md-parser';
/**
 * Every way this step can end, named. `unavailable` is the only catch-all and it always carries a detail line, so
 * no state is reported as a shrug.
 */
export type AssetOutcomeStatus = 'not-needed' | 'verified' | 'failed' | 'unverified' | 'needs-consent' | 'no-key' | 'budget' | 'unavailable';
export interface AssetProductionOutcome {
    status: AssetOutcomeStatus;
    /** Absolute path to the asset, present only when bytes were written. */
    path?: string;
    provider?: string;
    model?: string;
    /** Recorded cost in USD and how that figure was arrived at. Zero and `offline` on the default path. */
    costUsd?: number;
    costBasis?: string;
    /** The compilation, present whenever a raster was called for (so the caller can report what was asked). */
    compiled?: CompiledImageBrief;
    /** Per-check verdicts as the verifier reported them. */
    checks?: Array<{
        id: string;
        status: string;
        detail: string;
    }>;
    /**
     * Whether the bytes carry the offline synthetic marker. Read out of the PNG by the verifier, not taken from
     * what anyone claims, so it survives a rename and cannot be laundered. Drives gate severity below.
     */
    synthetic?: boolean;
    /**
     * The failure was the PROVIDER substituting format or geometry, not the asset being wrong.
     *
     * MEASURED, not theorised: a live Gemini call for a 1024x576 PNG returns a 1376x768 JPEG. It honours the aspect
     * ratio and picks its own pixel ladder, and it answers in JPEG whatever format was asked for. Both are real
     * contract violations and both are reported as failures, because they are. This flag exists so the diagnosis
     * names the cause instead of leaving an operator to conclude their prompt was bad, and so the consequence can be
     * stated plainly: this repository decodes PNG only, so a JPEG answer means the pixel checks, contrast included,
     * did not run at all. It NEVER softens the verdict.
     */
    providerSubstituted?: boolean;
    detail: string;
}
/** Only a verified asset may be handed to a build. Every other state is withheld. */
export declare function isOfferableAsset(outcome: AssetProductionOutcome | null): boolean;
/**
 * Harvest real hex values out of a PROSE DESIGN.md, the kind with no YAML frontmatter.
 *
 * WHY THIS IS NOT A SHORTCUT. Most real projects have a design document that a spec parser rejects: a markdown
 * body with lines like "- **Dark Teal**: `#1B4D4D` - section backgrounds". The palette is right there, authored by
 * a human, and refusing to read it because the file lacks frontmatter throws away real project truth and hands the
 * generator an adjective instead of a colour. This repo's own page directory is exactly that shape, which is how
 * the gap was found.
 *
 * THE HONESTY RULE IS UNCHANGED. Every value returned was read out of the project's file. The label and its
 * trailing description become the token path, so the compiled prompt and the verification contract can both cite
 * where the number came from and a reader can check it. Nothing is inferred and nothing is invented.
 *
 * Shaped as a DesignTokens so the compiler needs no second code path.
 */
export declare function harvestPaletteFromProse(markdown: string): DesignTokens | null;
/**
 * Load DESIGN.md tokens for the compiler: the Google-spec frontmatter first, the prose harvest as a fallback.
 *
 * Returns null only when there is no DESIGN.md, it cannot be read, or it contains no hex anywhere. A project with
 * no parseable colour gets a described palette and an honestly-uncontracted contrast check, which is a weaker
 * asset and an accurate report; it never gets an invented hex.
 */
/**
 * Prefer tokens the flow ALREADY HAS in memory over re-reading a file.
 *
 * Codex review 2026-07-29, finding 1, rated critical and correctly so. The lens read only
 * `<projectPath>/DESIGN.md`, while flow G already carries parsed tokens on its context and uses them for its own
 * guidance. When the real design file is page-local or non-standard at the root, the file read returns null, the
 * compiler drops the ink, and `buildImageArgv` omits `--ink/--ink-region/--min-contrast`. The overlay-contrast
 * check then SILENTLY STOPS RUNNING while the flow had the real text colour in memory the whole time. That is the
 * highest-severity class in this repository: not a wrong answer, a check that quietly does not happen.
 *
 * Order: parsed tokens on the context, then the raw `metadata.designTokens` shape flow G already passes around,
 * then the file. First source with a colour wins; a source with no colours is not a source.
 */
export declare function resolveDesignTokens(context: FlowExecutionContext): DesignTokens | null;
export declare function readDesignTokens(projectPath: string): DesignTokens | null;
export interface AssetProductionEnv {
    SIDECOACH_IMAGE_PROVIDER?: string;
    SIDECOACH_IMAGE_ALLOW_SPEND?: string;
    SIDECOACH_IMAGE_BUDGET_USD?: string;
    SIDECOACH_IMAGE_ASSUME_COST_USD?: string;
    SIDECOACH_IMAGE_MODEL?: string;
    [key: string]: string | undefined;
}
/**
 * What geometries the configured provider can actually serve.
 *
 * THE RULE: the size must be servable by EVERY provider this invocation might reach. Each branch below is that
 * rule applied, and the awkward one is `auto`, whose intersection really is a single square: OpenAI accepts only
 * three fixed geometries and the cheapest Gemini image model refuses anything that buckets above 1K, so 1024x1024
 * is the only size the whole chain can serve. Cost of getting this wrong, measured: an HTTP 400 that spends
 * nothing but produces nothing either, which a flow then reports as an unavailable asset.
 */
export declare function sizePolicyFor(provider: string): SizePolicy;
/**
 * Assemble the bin argv from a compilation.
 *
 * Exported and pure so the argv can be asserted directly in a test. That matters for two properties that are
 * otherwise only observable by spending money: that every contract flag the compilation produced is present, and
 * that no spend signal appears unless the operator put one in the environment.
 */
export declare function buildImageArgv(bin: string, compiled: CompiledImageBrief, out: string, cacheDir: string, env: AssetProductionEnv): string[];
export interface AssetProductionOptions {
    /** Where the asset is written, relative to the project. Default `.sidecoach-cache/assets`. */
    outDirRel?: string;
    /** Overrides for the brief, when a flow knows more than the utterance does. */
    brief?: Partial<ImageBrief>;
    env?: AssetProductionEnv;
}
/**
 * Compile the flow's brief and produce the asset through bin/sidecoach-image.js.
 *
 * Returns null ONLY when there is no project to write into, which is the one condition under which there is
 * nothing meaningful to report. Every other path returns a named outcome.
 */
export declare function runAssetProductionLens(context: FlowExecutionContext, options?: AssetProductionOptions): AssetProductionOutcome | null;
/**
 * The guidance lines a flow emits for the asset step, in EVERY state including the ones where nothing happened.
 *
 * Silence is the failure mode this replaces: a step that reports nothing when it did not run is indistinguishable
 * from a step that ran clean, and the reader cannot tell which they got.
 */
export declare function assetProductionGuidance(outcome: AssetProductionOutcome | null): string[];
/**
 * The checklist row for the asset step.
 *
 * SEVERITY IS PROVENANCE-AWARE, AND THE MEASUREMENT IS NOT. This is the one subtle rule here, so it is written
 * down rather than inferred:
 *
 *   - The contrast measurement always runs and is always reported verbatim, whatever produced the bytes.
 *   - A LIVE render that fails is REQUIRED and incomplete: a hard blocker. Those are the bytes that ship, and a
 *     hero whose headline is unreadable must stop the build.
 *   - A SYNTHETIC placeholder that fails is reported with the same number but does not block. Its colours are
 *     derived from a prompt hash, so its contrast is the stand-in's luck rather than a fact about the design, and
 *     blocking a build on it would block nothing real while training everyone to ignore this row. The guidance
 *     line names the placeholder and the next action.
 *
 * The distinction is drawn from the marker inside the PNG, not from what the caller claims, so it cannot be
 * gamed by renaming a file into the position of a real render.
 */
export declare function assetProductionChecklistItem(outcome: AssetProductionOutcome | null, 
/**
 * Whether the brief actually asked for a raster. Only consulted when the lens did not run at all.
 *
 * Codex review 2026-07-29, finding 4: a null outcome was rendered as completed, but null means the step never
 * ran. A raster request in a context with no project path therefore showed the asset row as DONE while nothing
 * had happened, which is precisely the false pass this row exists to prevent. Not-run is now only complete when
 * there was nothing to do.
 */
wantedRaster?: boolean): {
    id: string;
    label: string;
    required: boolean;
    description: string;
    completed: boolean;
};
/**
 * The MEMORY-VALIDATION status for the asset step, kept in LOCKSTEP with the checklist item so the two surfaces
 * can never disagree about severity.
 *
 * WHY THIS EXISTS, and it is the whole point. The build-report aggregator reads a flow's memory validations and
 * turns a `fail` into a BLOCKING finding and a `warning` into a warning; the checklist, by contrast, is not read
 * into findings at all. So the memory validation - not the checklist - is the surface where a severity decision
 * actually reaches the report a human sees. Computing that severity a SECOND time, ad hoc, is exactly how the
 * provenance rule got defeated: the checklist item correctly made a failed offline PLACEHOLDER non-blocking
 * (`required:false`), while a separate ternary marked the same outcome `fail`, so every `/sidecoach craft
 * <backdrop>` blocked the build on the deterministic stand-in a flow is FORCED to use because it cannot spend.
 * Deriving the validation status from the checklist item closes that gap structurally:
 *
 *   - completed            -> 'pass'    (verified, or not-needed: nothing is wrong)
 *   - required, not done   -> 'fail'    (a LIVE render that failed legibility, or a raster asked for and never
 *                                         produced: a real blocker that must stop the build)
 *   - not required, not done -> 'warning' (the offline placeholder whose contrast is prompt-hash luck, or an
 *                                         operational "could not run" status - no key, no spend consent, over
 *                                         budget, harness unavailable: named in the report, never build-blocking)
 */
export declare function assetProductionValidationStatus(item: {
    required: boolean;
    completed: boolean;
}): 'pass' | 'warning' | 'fail';
//# sourceMappingURL=image-asset-production.d.ts.map