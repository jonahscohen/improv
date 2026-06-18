"use strict";
// FROZEN(P1): superseded by lanes.generated.ts for engine use; retained ONLY as
// the MCP server's legacy mode feed (mcp-server/src/registries.ts imports the
// compiled ../../dist/modes). TODO(P4): delete this file AND dist/modes.js when
// the MCP `list-modes` -> `list-lanes` rename lands and ModeEntry is retired.
//
// DEPRECATED - Sidecoach modes (originally T-0011), RETIRED 2026-06-12.
//
// The one-word mode keywords (forge / kiln / bloom / canvas / trim / ralph) are
// gone. They were optimized for hook-detectability (distinctive single tokens),
// not for how a person actually talks - "kiln this release" is not a sentence
// anyone types - so Jonah cut the whole vocabulary in favor of NATURAL-LANGUAGE
// INTENT DETECTION (intent-detector.ts / lane-classifier.ts -> lanes.generated.ts,
// surfaced as the MCP tools classify_intent / list_lanes / sidecoach_lane). You
// describe what you want in plain English; sidecoach classifies the intent, asks
// one clarifying question if it is a close call, and runs the task to convergence.
//
// This file is retained ONLY as the legacy feed for the MCP server's soon-to-be-
// removed `list-modes` tool (mcp-server/src/registries.ts imports the compiled
// ../../dist/modes). Do NOT add modes, document them as a feature, or surface them
// to users. Delete this file AND dist/modes.js when the `list-modes` -> `list-lanes`
// rename lands and ModeEntry is retired.
//
// The structures below are frozen as-is for that legacy feed; the FlowId chains are
// the deduped union of each former mode's verb flowIds.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_LIST = exports.MODES = void 0;
exports.getMode = getMode;
exports.getModeChain = getModeChain;
exports.getModeVerbChain = getModeVerbChain;
// forge - build something new from raw materials.
// Name rationale: a forge is where raw metal becomes a shaped tool. The verb
// "craft" already exists for a single-flow build pass; forge bundles the
// entire shape -> craft -> polish arc into one keyword. Picked over "smith"
// (too archaic, collides with surnames), "buildout" (business jargon, not
// sticky), and "rampup" (process-coded, not material-coded).
const FORGE = {
    name: 'forge',
    description: 'Build something new from raw to working.',
    oneLineExplanation: 'Net-new build: shapes the design, crafts the implementation, then polishes the result.',
    verbChain: ['shape', 'craft', 'polish'],
    chain: [
        'flowA_brand_verify',
        'flowB_component_research',
        'flowE_motion_patterns',
        'flowF_design_tokens',
        'flowG_component_implementation',
        'flowH_motion_integration',
        'flowI_accessibility',
        'flowM_responsive_validation',
        'flowJ_tactical_polish',
    ],
};
// kiln - fire-harden a built thing for production.
// Name rationale: after a piece is forged, the kiln vitrifies it - turns
// "made" into "shippable." That maps exactly to the audit/critique/harden
// pass that sidecoach runs before release. Picked over "gauntlet" (too
// adversarial), "shipit" (jokey, not sticky), and "finalize" (generic
// process language). A kiln is also reversible-once: you only fire when
// you've already shaped the piece - the metaphor enforces ordering.
const KILN = {
    name: 'kiln',
    description: 'Fire-harden a built thing for production.',
    oneLineExplanation: 'Release readiness: audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.',
    verbChain: ['audit', 'critique', 'harden', 'adapt', 'polish'],
    chain: [
        'flowK_multi_lens_audit',
        'flowI_accessibility',
        'flowL_design_critique',
        'flowV_all_seven_qa',
        'flowM_responsive_validation',
        'flowJ_tactical_polish',
    ],
};
// bloom - add joy, color, motion, personality.
// Name rationale: a competent but lifeless design "blooms" when you add
// color, motion, and delight. The flower metaphor captures the directional
// shift - same plant, now showing. Picked over "spark" (too generic),
// "glowup" (memey, dated), "vivify" (too literary), and "zest" (food-coded,
// not visual-coded). Pairs naturally with kiln: forge -> bloom -> kiln is a
// readable narrative.
const BLOOM = {
    name: 'bloom',
    description: 'Add joy, color, motion, and personality.',
    oneLineExplanation: 'Personality pass: applies color, adds delightful micro-interactions, integrates motion, finishes with polish.',
    verbChain: ['colorize', 'delight', 'animate', 'polish'],
    chain: [
        'flowF_design_tokens',
        'flowH_motion_integration',
        'flowT_ambitious_motion',
        'flowJ_tactical_polish',
    ],
};
// canvas - live in-browser iteration on an existing surface.
// Name rationale: when the work is "look at it in the browser and keep
// tweaking until it feels right," the surface is the canvas. The mode
// chains live (rapid iteration) + colorize + polish + critique into the
// loop that visual designers run inside Chrome devtools. Picked over
// "studio" (too workspace-coded, not action-coded), "prowl" (too
// predator-coded), and "tinker" (implies small/aimless work, but this
// mode produces real refinement).
const CANVAS = {
    name: 'canvas',
    description: 'Live in-browser visual iteration.',
    oneLineExplanation: 'Loop the design inside the browser: live iteration, color refinement, polish, then a critique pass.',
    verbChain: ['live', 'colorize', 'polish', 'critique'],
    chain: [
        'flowN_rapid_iteration_refined',
        'flowF_design_tokens',
        'flowJ_tactical_polish',
        'flowM_responsive_validation',
        'flowL_design_critique',
        'flowK_multi_lens_audit',
    ],
};
// ralph - relentless cross-flow iteration to convergence (T-0020).
// Name rationale: a direct callback to oh-my-claudecode's "Ralph" mode, which
// is the recognizable industry term for "keep iterating until the validators
// stop complaining." Sidecoach earns its design vocabulary by going DEEPER
// (the chain runs polish/audit/critique design validators, not generic
// code-correctness checks), and reuses the keyword so anyone coming from OMC
// finds it where they expect. The mode is the user-facing trigger; the
// actual loop algorithm (cap, stall, convergence) lives in
// `sidecoach/src/convergence-loop.ts` per T-0020. Picked the OMC name verbatim
// because every alternative ("loop", "iterate", "converge") either collides
// with internal vocabulary or loses the connection to the established
// pattern.
const RALPH = {
    name: 'ralph',
    description: 'Relentless cross-flow iteration to convergence.',
    oneLineExplanation: 'Runs polish, audit, and critique in a loop until validators all pass or a hard cap fires (convergence, stall, or maxIterations).',
    verbChain: ['polish', 'audit', 'critique'],
    chain: [
        'flowJ_tactical_polish',
        'flowK_multi_lens_audit',
        'flowL_design_critique',
    ],
};
// trim - strip a busy or overstimulated UI back to essentials.
// Name rationale: "trim" is the bonsai/barber metaphor - you have something
// real but it's grown too loud. The chain pairs the two existing "tone"
// verbs (quieter, distill) with clarify (remove ambiguous labels) and a
// polish pass to settle the result. Picked over "prune" (garden-coded but
// implies discarding), "shave" (too informal), "declutter" (two words, not
// sticky), and "purify" (overloaded with non-design connotations).
const TRIM = {
    name: 'trim',
    description: 'Strip a busy UI back to essentials.',
    oneLineExplanation: 'Tone-down pass: quiets visual noise, distills to essentials, clarifies copy and labels, then polishes.',
    verbChain: ['quieter', 'distill', 'clarify', 'polish'],
    chain: [
        'flowJ_tactical_polish',
        'flowX_copywriting',
        'flowM_responsive_validation',
    ],
};
/**
 * MODES registry. Lookups are by lowercase mode name.
 *
 * Order matters for the tie-break rule: if a prompt fires multiple modes
 * (rare but possible), the hook picks the first in declaration order. We
 * order by frequency of expected use: forge first (most common shape of
 * work in a fresh build), then kiln (ship-ready), then bloom (delight),
 * canvas (live), trim (simplify).
 */
exports.MODES = {
    forge: FORGE,
    kiln: KILN,
    bloom: BLOOM,
    canvas: CANVAS,
    trim: TRIM,
    ralph: RALPH,
};
/** Convenience: ordered list of modes (matches MODES declaration order). */
exports.MODE_LIST = [FORGE, KILN, BLOOM, CANVAS, TRIM, RALPH];
/** Returns the mode for the given name (case-insensitive), or undefined. */
function getMode(name) {
    if (!name)
        return undefined;
    return exports.MODES[name.toLowerCase()];
}
/** Returns the FlowId chain for a mode name, or undefined if unknown. */
function getModeChain(name) {
    return getMode(name)?.chain;
}
/** Returns the verb chain for a mode name, or undefined if unknown. */
function getModeVerbChain(name) {
    return getMode(name)?.verbChain;
}
//# sourceMappingURL=modes.js.map