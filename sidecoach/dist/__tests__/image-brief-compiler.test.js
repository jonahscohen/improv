"use strict";
// sidecoach/src/__tests__/image-brief-compiler.test.ts
//
// Contract for the CONCEPT AND COMPOSITION layer: the staging catalog, the prompt compiler, and the flowG asset
// production lens that carries them into a real build flow.
//
// The claim under test is not "it produces a prompt". It is:
//
//   1. The staging catalog's palette-free and type-free separation is MECHANICALLY enforced, not merely documented.
//   2. A brief supplying almost nothing compiles to a prompt carrying the structure, the real project palette, the
//      negative constraints, and the text policy, and the compiler REPORTS which dimensions it had to supply.
//   3. The verification contract is DERIVED FROM THE SAME RESOLUTION as the prompt, so the region the prompt is
//      told to keep quiet is the region the contrast check measures. This is the property the whole design turns
//      on and it is asserted by equality, not by inspection.
//   4. Nothing is invented. No DESIGN.md text colour means no contracted contrast and an explicit gap report,
//      never a plausible hex.
//   5. The wiring carries every contract flag to the bin, and carries NO spend signal unless the operator set one.
//   6. Through the flow, only a verified asset is offered; failed and unverified are named and withheld.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const image_composition_catalog_1 = require("../image-composition-catalog");
const image_brief_compiler_1 = require("../image-brief-compiler");
const image_asset_production_1 = require("../image-asset-production");
const design_md_parser_1 = require("../design-md-parser");
const direction_deck_1 = require("../direction-deck");
const flow_handler_component_implementation_1 = require("../flow-handler-component-implementation");
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-image-compiler-'));
const DESIGN_MD = `---
colors:
  brand:
    primary: "#1b3a5c"
    accent: "#c9622f"
  surface:
    base: "#f7f4ee"
  text:
    primary: "#14181c"
rounded:
  md: "6px"
---
# Overview
`;
function tokens() {
    return (0, design_md_parser_1.parseDesignMd)(DESIGN_MD);
}
// ---------------------------------------------------------------------------
// 1. The catalog's separation of concerns is enforced, not requested
// ---------------------------------------------------------------------------
function testCatalog() {
    const { errors, warnings } = (0, image_composition_catalog_1.validateImageCompositionCatalog)();
    assert(errors.length === 0, `the shipped catalog must validate clean, got: ${errors.join(' | ')}`);
    assert(warnings.length === 0, `the shipped catalog must have no coverage warnings, got: ${warnings.join(' | ')}`);
    assert(image_composition_catalog_1.IMAGE_COMPOSITION_CATALOG.length >= 12, 'the catalog must carry at least 12 stagings');
    for (const surface of image_composition_catalog_1.IMAGE_SURFACES) {
        assert(image_composition_catalog_1.IMAGE_COMPOSITION_CATALOG.some((c) => c.surface === surface), `a staging must serve ${surface}`);
    }
    for (const role of image_composition_catalog_1.IMAGE_ROLES) {
        assert(image_composition_catalog_1.IMAGE_COMPOSITION_CATALOG.some((c) => c.roles.includes(role)), `a staging must be able to hold a ${role}`);
    }
    // The load-bearing negative case. A staging that names a colour or a typeface has stopped being a staging, and
    // the validator has to say so or the separation is only a comment.
    const base = (0, image_composition_catalog_1.compositionById)('quiet-left-third');
    const withColour = {
        ...base,
        id: 'leaky-colour',
        label: 'Leaky colour',
        grammar: [base.grammar[0], 'Focal: the subject mass sits against a warm cream ground, centred two thirds across', base.grammar[2], base.grammar[3]],
    };
    const colourErrors = (0, image_composition_catalog_1.validateImageComposition)(withColour);
    assert(colourErrors.some((e) => /palette term/.test(e)), `a staging naming a colour must be rejected, got: ${colourErrors.join(' | ')}`);
    const withType = {
        ...base,
        id: 'leaky-type',
        label: 'Leaky type',
        grammar: [base.grammar[0], 'Focal: a large serif display mass sits in the right two thirds of the frame', base.grammar[2], base.grammar[3]],
    };
    assert((0, image_composition_catalog_1.validateImageComposition)(withType).some((e) => /type term/.test(e)), 'a staging naming a typeface must be rejected');
    // An ink zone must be big enough to measure contrast in; a sliver is not a measurement.
    const slivered = { ...base, id: 'sliver', label: 'Sliver', inkZone: [0, 0, 0.01, 0.01] };
    assert((0, image_composition_catalog_1.validateImageComposition)(slivered).some((e) => /too small to measure contrast/.test(e)), 'a degenerate ink zone must be rejected');
    const outside = { ...base, id: 'outside', label: 'Outside', inkZone: [0.8, 0.8, 0.5, 0.5] };
    assert((0, image_composition_catalog_1.validateImageComposition)(outside).some((e) => /outside the frame/.test(e)), 'an ink zone running off the frame must be rejected');
    // Pixel conversion clamps rather than producing a region that starts outside the bytes.
    const px = (0, image_composition_catalog_1.inkZoneToPixels)([0.5, 0.5, 0.5, 0.5], 1024, 512);
    assert(px !== null && px.x + px.w <= 1024 && px.y + px.h <= 512, 'a converted ink zone must stay inside the image');
    assert((0, image_composition_catalog_1.inkZoneToPixels)([0, 0, 0.0001, 0.0001], 10, 10) === null, 'an unmeasurable region must be null rather than degenerate');
}
// ---------------------------------------------------------------------------
// 2. A weak brief compiles to a strong prompt, and the compiler says what it supplied
// ---------------------------------------------------------------------------
function testWeakBrief() {
    assert(!(0, image_brief_compiler_1.briefWantsRaster)('a settings toggle with a disabled state'), 'a brief naming no raster wants no raster');
    assert((0, image_brief_compiler_1.compileImageBrief)({ text: 'a settings toggle' }) === null, 'a brief naming no raster compiles to nothing at all');
    assert((0, image_brief_compiler_1.briefWantsRaster)('hero image'), 'a two-word brief naming an image wants a raster');
    const c = (0, image_brief_compiler_1.compileImageBrief)({ text: 'hero image' }, { register: 'product', productName: 'Ledgerline', designTokens: tokens(), antiReferences: ['the usual purple gradient look'] });
    assert(c !== null, 'a two-word raster brief must compile');
    // The prompt carries every dimension the brief did not.
    const names = c.sections.map((s) => s.name);
    for (const required of ['STRUCTURE', 'FOCAL', 'DEPTH', 'WORLD', 'PALETTE', 'TEXT', 'ADAPTATION', 'DO NOT', 'OUTPUT']) {
        assert(names.includes(required), `the compiled prompt must carry a ${required} section, got ${names.join(', ')}`);
    }
    assert(names[0] === 'STRUCTURE', 'STRUCTURE leads, because a generator weights the front of a prompt hardest');
    const palette = c.sections.find((s) => s.name === 'PALETTE').body;
    for (const hex of ['#1b3a5c', '#c9622f', '#14181c']) {
        assert(palette.includes(hex), `the palette section must carry the real DESIGN.md value ${hex}`);
    }
    const bans = c.sections.find((s) => s.name === 'DO NOT').body;
    for (const ban of image_brief_compiler_1.MEDIUM_BANS)
        assert(bans.includes(ban), `the medium bans must all be present, missing: ${ban}`);
    assert(bans.split(';').length >= 6, 'a compiled prompt carries at least six negative constraints');
    assert(bans.includes('the usual purple gradient look'), 'a PRODUCT.md anti-reference travels into the negative constraints');
    // The brief supplied almost nothing and the report says so honestly, naming what filled the gap.
    assert(c.briefStrength.score <= 20, `a two-word brief should score low, got ${c.briefStrength.score}`);
    assert(c.briefStrength.supplied.length >= 6, 'the compiler must name every dimension it supplied');
    assert(c.briefStrength.supplied.some((s) => s.startsWith('staging:')), 'the supplied list names the staging it chose');
    assert(c.briefStrength.supplied.some((s) => s.startsWith('world:')), 'the supplied list names the world it chose');
    // Determinism: the same brief is the same request, which is what makes the cache work.
    const again = (0, image_brief_compiler_1.compileImageBrief)({ text: 'hero image' }, { register: 'product', productName: 'Ledgerline', designTokens: tokens(), antiReferences: ['the usual purple gradient look'] });
    assert(again.prompt === c.prompt, 'compilation is deterministic');
    assert(again.digest === c.digest, 'the digest is deterministic, so the output filename is stable');
    // The text policy permits exactly one string and forbids the instruction from being typeset. Both clauses were
    // added after a live render put the prompt's own sentences and its hex codes into the artwork as body copy.
    const text = c.sections.find((s) => s.name === 'TEXT').body;
    assert(text.includes('"Ledgerline"'), 'the one permitted string is the real product name');
    assert(/not any hex colour code/.test(text), 'the text policy forbids hex codes appearing as lettering');
    assert(/not its sentences/.test(text), 'the text policy forbids the instruction being typeset as copy');
    // With no product name, nothing legible is permitted and the ban set says so coherently.
    const anon = (0, image_brief_compiler_1.compileImageBrief)({ text: 'hero image' }, { designTokens: tokens() });
    assert(/No legible lettering anywhere/.test(anon.sections.find((s) => s.name === 'TEXT').body), 'with no product name nothing is legible');
    assert(!anon.sections.find((s) => s.name === 'DO NOT').body.includes('one permitted string'), 'with no permitted string the bans must not reference a permission that was never granted');
}
// ---------------------------------------------------------------------------
// 3. The contract is derived from the same resolution as the prompt
// ---------------------------------------------------------------------------
function testContractDerivation() {
    const c = (0, image_brief_compiler_1.compileImageBrief)({ text: 'a full-bleed hero backdrop' }, { designTokens: tokens(), register: 'product' });
    const staging = c.composition;
    const dims = /^(\d+)x(\d+)$/.exec(c.contract.size);
    const expected = (0, image_composition_catalog_1.inkZoneToPixels)(staging.inkZone, Number(dims[1]), Number(dims[2]));
    assert(c.contract.inkRegion !== undefined, 'a backdrop over real tokens must carry a contracted ink region');
    assert(JSON.stringify(c.contract.inkRegion) === JSON.stringify(expected), `THE central property: the contracted region must BE the staging's ink zone in pixels. got ${JSON.stringify(c.contract.inkRegion)} want ${JSON.stringify(expected)}`);
    assert(c.contract.ink === '#14181c', 'the ink is the real DESIGN.md text colour');
    assert(c.contract.inkSource === 'colors.text.primary', 'the contract cites which token the ink came from, so the number is auditable');
    assert(c.contract.minContrast === 4.5, 'the contrast floor is AA for body text');
    // The prompt states the same numbers it will be measured against.
    const textSection = c.sections.find((s) => s.name === 'TEXT').body;
    assert(textSection.includes(`${c.contract.inkRegion.w} by ${c.contract.inkRegion.h} pixels`), 'the prompt must state the region it is told to keep quiet, in the same pixels the check will read');
    // NOTHING IS INVENTED. No text colour in the project means no contracted contrast and an explicit gap.
    const noInk = (0, image_brief_compiler_1.compileImageBrief)({ text: 'a full-bleed hero backdrop' }, {});
    assert(noInk.contract.ink === undefined, 'with no DESIGN.md text colour the contract must carry NO ink rather than a plausible one');
    assert(noInk.contract.minContrast === undefined, 'an uncontracted contrast check has no floor');
    assert(noInk.briefStrength.missing.some((m) => /names no text colour/.test(m)), 'the missing report must name the gap and what it costs');
    // An object role composites over the page, so alpha is required without being asked for.
    const obj = (0, image_brief_compiler_1.compileImageBrief)({ text: 'a transparent cutout of the product' }, {});
    assert(obj.role === 'object' && obj.contract.alpha === 'require', 'an object role contracts required transparency');
}
// ---------------------------------------------------------------------------
// 4. Resolution rules: role precedence, the excluded default world, provider-aware size
// ---------------------------------------------------------------------------
function testResolution() {
    // texture outranks backdrop: "a tiling texture for the dashboard background" must keep its tiling obligation.
    assert((0, image_brief_compiler_1.detectRole)('a tiling texture for the dashboard background').role === 'texture', 'texture outranks backdrop when both words appear');
    assert((0, image_brief_compiler_1.detectRole)('a full-bleed background behind the headline').role === 'backdrop', 'backdrop still resolves when no texture word is present');
    // The deck's outside-ranking property is inherited: an unspecified world is never the default instinct, and
    // never a motion-axis entry, because motion describes behaviour rather than a still frame.
    for (const text of ['hero image', 'a plate', 'a texture', 'a thumbnail', 'an og image', 'a portrait']) {
        const { concept } = (0, image_brief_compiler_1.resolveConcept)({ text }, {});
        assert(concept.id !== direction_deck_1.MODEL_DEFAULT_ID, `an unspecified world must never resolve to ${direction_deck_1.MODEL_DEFAULT_ID} (got it for "${text}")`);
        assert(concept.axis !== 'motion', `an unspecified world must never be motion-axis (got ${concept.id} for "${text}")`);
    }
    // A stated approach is honoured on word overlap, not only on substring containment.
    const matched = (0, image_brief_compiler_1.resolveConcept)({ text: 'hero image' }, { approach: 'restrained editorial' });
    assert(matched.concept.id === 'editorial-print', `"restrained editorial" must match editorial-print, got ${matched.concept.id}`);
    assert(/shared word/.test(matched.basis), 'the basis must record how the match was made');
    // Size is resolved against the provider that will be called. Measured cost of getting this wrong: an HTTP 400.
    assert(image_brief_compiler_1.OPENAI_SIZES.includes((0, image_brief_compiler_1.sizeForAspect)('16:9', { allowed: image_brief_compiler_1.OPENAI_SIZES })), 'the OpenAI policy only yields OpenAI geometries');
    assert((0, image_brief_compiler_1.sizeForAspect)('16:9', { maxEdge: 1024 }) === '1024x576', `a 1024 max-edge 16:9 must be 1024x576, got ${(0, image_brief_compiler_1.sizeForAspect)('16:9', { maxEdge: 1024 })}`);
    assert((0, image_brief_compiler_1.sizeForAspect)('1:1', { maxEdge: 1024 }) === '1024x1024', 'a square staging at 1024 max edge is 1024x1024');
    assert(JSON.stringify((0, image_asset_production_1.sizePolicyFor)('openai')) === JSON.stringify({ allowed: image_brief_compiler_1.OPENAI_SIZES }), 'openai gets its three geometries');
    assert((0, image_asset_production_1.sizePolicyFor)('nanobanana').maxEdge === 1024, 'nanobanana is held to a 1024 max edge, its cheapest and only universally supported tier');
    assert(JSON.stringify((0, image_asset_production_1.sizePolicyFor)('auto').allowed) === JSON.stringify(['1024x1024']), 'auto must use the intersection every provider in the chain can serve');
    // Calibration bans are suppressed when the project committed a palette, because the committed palette wins.
    const committed = (0, image_brief_compiler_1.compileImageBrief)({ text: 'hero image' }, { designTokens: tokens() });
    const free = (0, image_brief_compiler_1.compileImageBrief)({ text: 'hero image' }, {});
    for (const ban of image_brief_compiler_1.CALIBRATION_BANS) {
        assert(!committed.sections.find((s) => s.name === 'DO NOT').body.includes(ban), `a committed palette must suppress the calibration ban: ${ban}`);
        assert(free.sections.find((s) => s.name === 'DO NOT').body.includes(ban), `with no committed palette the calibration ban must fire: ${ban}`);
    }
}
// ---------------------------------------------------------------------------
// 5. The prose-DESIGN.md harvest reads real values out of a non-spec document
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 5b. The five Codex review findings, each with the scenario it named
// ---------------------------------------------------------------------------
function testReviewFindings() {
    // FINDING 3 (medium): role detection fired on incidental CSS words, so ordinary component work generated a plate.
    // These are the exact phrases from the review plus the neighbouring cases in the same class.
    for (const notARaster of [
        'craft a settings toggle with a background color transition on hover',
        'a card with a background gradient and a border radius',
        'fix the image-rendering property on the avatar',
        'apply our naming patterns to the new component',
        'move the sync to a background worker',
        'set object-fit on the thumbnail element',
    ]) {
        assert((0, image_brief_compiler_1.detectRole)(notARaster) === null, `"${notARaster}" names no raster asset, but role detection returned ${JSON.stringify((0, image_brief_compiler_1.detectRole)(notARaster))}`);
        assert((0, image_brief_compiler_1.compileImageBrief)({ text: notARaster }) === null, `"${notARaster}" must compile to nothing`);
    }
    // The false-friend guard must not suppress a REAL request that also mentions a CSS sense.
    const both = (0, image_brief_compiler_1.detectRole)('a hero backdrop plus a background color transition on the nav');
    assert(both !== null && both.role === 'backdrop', 'a real asset request survives a CSS mention in the same sentence');
    // Word boundaries: a longer word containing a keyword is not a keyword.
    assert((0, image_brief_compiler_1.detectRole)('improve the imagery guidelines') === null, '"imagery" must not match the keyword "image"');
    assert((0, image_brief_compiler_1.detectRole)('a plate for the launch page') !== null, 'a genuine keyword still matches');
    // FINDING 2 (high): a dash-separated prose colour line must be harvested. Colon-only matching lost it and the
    // contrast check then ran uncontracted.
    const dashed = (0, image_asset_production_1.harvestPaletteFromProse)('- **Body text** - #2C2C2C - primary typography\n- **Teal** - #1B4D4D - blocks');
    assert(dashed !== null, 'a dash-separated prose colour line must be harvested');
    assert((0, image_brief_compiler_1.flattenPalette)(dashed, 10).length === 2, 'both dash-separated colours are harvested');
    const dashedInk = (0, image_brief_compiler_1.resolveInk)(dashed);
    assert(dashedInk !== null && dashedInk.hex === '#2c2c2c', `the dash-separated body-text colour must resolve as ink, got ${JSON.stringify(dashedInk)}`);
    // FINDING 4 (medium): a null outcome is NOT complete when the brief wanted a raster.
    const nullWanted = (0, image_asset_production_1.assetProductionChecklistItem)(null, true);
    assert(nullWanted.completed === false, 'a raster request whose asset step never ran must NOT read as complete');
    assert(nullWanted.required === true, 'a raster request whose asset step never ran is a required, open row');
    assert(/DID NOT RUN/.test(nullWanted.description), 'the row says plainly that the step did not run');
    const nullNotWanted = (0, image_asset_production_1.assetProductionChecklistItem)(null, false);
    assert(nullNotWanted.completed === true && nullNotWanted.required === false, 'no raster wanted and no step run is complete');
}
// ---------------------------------------------------------------------------
// 5c. FINDING 1 (critical): tokens the flow already holds must beat a file read
// ---------------------------------------------------------------------------
function testTokenPrecedence() {
    const empty = fs.mkdtempSync(path.join(TMP, 'no-design-'));
    // No DESIGN.md on disk at all, but the flow context carries parsed tokens. The contrast check MUST still be
    // contracted; dropping it here is the silent-check-loss the review rated critical.
    const withParsed = (0, image_asset_production_1.resolveDesignTokens)({
        utterance: 'a hero backdrop',
        projectPath: empty,
        projectContext: { design: { parsedTokens: tokens() } },
    });
    assert(withParsed !== null, 'parsed tokens on the context must be used when no file is on disk');
    assert((0, image_brief_compiler_1.resolveInk)(withParsed).hex === '#14181c', 'the ink comes from the context tokens');
    // The other shape flow G already threads around: a bare token object on metadata.
    const withMeta = (0, image_asset_production_1.resolveDesignTokens)({
        utterance: 'a hero backdrop',
        projectPath: empty,
        metadata: { designTokens: { colors: { text: { primary: '#101418' } } } },
    });
    assert(withMeta !== null && (0, image_brief_compiler_1.resolveInk)(withMeta).hex === '#101418', 'metadata tokens are used when nothing better exists');
    // A token source with no colours is not a source: it must fall through rather than shadow the file.
    const projectWithFile = fs.mkdtempSync(path.join(TMP, 'with-design-'));
    fs.writeFileSync(path.join(projectWithFile, 'DESIGN.md'), DESIGN_MD);
    const fellThrough = (0, image_asset_production_1.resolveDesignTokens)({
        utterance: 'a hero backdrop',
        projectPath: projectWithFile,
        projectContext: { design: { parsedTokens: { colors: {} } } },
        metadata: { designTokens: { colors: {} } },
    });
    assert(fellThrough !== null, 'an empty token object must not shadow a real file');
    assert((0, image_brief_compiler_1.resolveInk)(fellThrough).hex === '#14181c', 'the file supplies the ink when the in-memory sources are empty');
    assert((0, image_asset_production_1.resolveDesignTokens)({ utterance: 'x', projectPath: empty }) === null, 'with no tokens anywhere the result is null, not an invention');
}
function testProseHarvest() {
    const prose = [
        '## Colors',
        '',
        '- **Red Ampersand**: `#E31C3D` - Logo, primary accent',
        '- **Dark Teal**: `#1B4D4D` - Large blocks, section backgrounds',
        '- **Dark Gray**: `#2C2C2C` - Body text, primary typography',
    ].join('\n');
    const harvested = (0, image_asset_production_1.harvestPaletteFromProse)(prose);
    assert(harvested !== null, 'a prose colour list must be harvested rather than discarded');
    const flat = (0, image_brief_compiler_1.flattenPalette)(harvested, 10);
    assert(flat.length === 3, `three labelled colours must yield three tokens, got ${flat.length}`);
    assert(flat.some((p) => p.hex === '#e31c3d'), 'the harvested values are the real hexes from the document');
    const ink = (0, image_brief_compiler_1.resolveInk)(harvested);
    assert(ink !== null && ink.hex === '#2c2c2c', `the body-text colour must be found as the ink, got ${JSON.stringify(ink)}`);
    assert((0, image_asset_production_1.harvestPaletteFromProse)('no colours here at all') === null, 'a document with no hex yields null rather than an empty palette');
}
// ---------------------------------------------------------------------------
// 6. The wiring carries the contract, and never manufactures consent
// ---------------------------------------------------------------------------
function testArgv() {
    const c = (0, image_brief_compiler_1.compileImageBrief)({ text: 'a full-bleed hero backdrop' }, { designTokens: tokens() });
    const offline = (0, image_asset_production_1.buildImageArgv)('/bin/img.js', c, '/out/a.png', '/cache', {});
    const at = (flag) => {
        const i = offline.indexOf(flag);
        return i === -1 ? undefined : offline[i + 1];
    };
    assert(at('--provider') === 'offline', 'the default provider is offline, so a flow cannot spend');
    assert(!offline.includes('--yes-spend'), 'no spend signal is ever manufactured by the wiring');
    assert(at('--ink') === c.contract.ink, 'the ink travels to the bin');
    const r = c.contract.inkRegion;
    assert(at('--ink-region') === `${r.x},${r.y},${r.w},${r.h}`, 'the ink REGION travels to the bin, which is the check that silently stops running if it is dropped');
    assert(at('--min-contrast') === '4.5', 'the contrast floor travels to the bin');
    assert(at('--expect-size') === c.contract.size, 'the geometry contract travels to the bin');
    assert(at('--expect-format') === 'png', 'the format contract travels to the bin');
    // A live provider WITH the operator's signal passes it through; a live provider WITHOUT it does not.
    const live = (0, image_asset_production_1.buildImageArgv)('/bin/img.js', c, '/out/a.png', '/cache', {
        SIDECOACH_IMAGE_PROVIDER: 'nanobanana',
        SIDECOACH_IMAGE_ALLOW_SPEND: '1',
        SIDECOACH_IMAGE_BUDGET_USD: '0.20',
    });
    assert(live.includes('--yes-spend'), "the operator's spend signal is passed through");
    assert(live[live.indexOf('--budget-usd') + 1] === '0.2', 'the budget cap is passed through');
    const liveNoConsent = (0, image_asset_production_1.buildImageArgv)('/bin/img.js', c, '/out/a.png', '/cache', { SIDECOACH_IMAGE_PROVIDER: 'nanobanana' });
    assert(!liveNoConsent.includes('--yes-spend'), 'a live provider with no operator signal gets no spend signal, and the bin refuses the call');
    // An object role's alpha requirement reaches the verifier.
    const obj = (0, image_brief_compiler_1.compileImageBrief)({ text: 'a transparent cutout of the product' }, {});
    assert((0, image_asset_production_1.buildImageArgv)('/bin/img.js', obj, '/o.png', '/c', {}).includes('--alpha'), 'a required-alpha contract travels to the bin');
}
// ---------------------------------------------------------------------------
// 7. Fail-closed offering, and the flow really produces an asset
// ---------------------------------------------------------------------------
function testOffering() {
    assert(!(0, image_asset_production_1.isOfferableAsset)(null), 'a lens that did not run offers nothing');
    for (const status of ['failed', 'unverified', 'needs-consent', 'no-key', 'budget', 'unavailable', 'not-needed']) {
        assert(!(0, image_asset_production_1.isOfferableAsset)({ status, path: '/tmp/x.png', detail: 'x' }), `a ${status} outcome is never offered, even with bytes on disk`);
    }
    assert((0, image_asset_production_1.isOfferableAsset)({ status: 'verified', path: '/tmp/x.png', detail: 'x' }), 'only a verified asset is offered');
    // Severity is provenance-aware and the MEASUREMENT never is. A synthetic placeholder that fails does not block;
    // a real render that fails does.
    const placeholder = (0, image_asset_production_1.assetProductionChecklistItem)({ status: 'failed', synthetic: true, detail: 'contrast 1.89:1' });
    assert(placeholder.required === false && placeholder.completed === false, 'a failing placeholder is reported but does not block');
    assert(/placeholder/.test(placeholder.description), 'the row explains why it does not block');
    const real = (0, image_asset_production_1.assetProductionChecklistItem)({ status: 'failed', synthetic: false, detail: 'contrast 1.89:1' });
    assert(real.required === true && real.completed === false, 'a failing real render is a hard blocker');
    const notNeeded = (0, image_asset_production_1.assetProductionChecklistItem)({ status: 'not-needed', detail: 'no raster named' });
    assert(notNeeded.required === false && notNeeded.completed === true, 'a component needing no raster is complete, not pending');
}
async function testFlow() {
    const project = path.join(TMP, 'proj');
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, 'DESIGN.md'), DESIGN_MD);
    const context = (utterance) => ({
        utterance,
        projectPath: project,
        projectContext: {
            projectPath: project,
            register: 'product',
            product: { register: 'product', name: 'Ledgerline' },
            design: { visual: { approach: 'swiss objective' } },
            loaded: { productMd: true, designMd: true },
            errors: [],
        },
        metadata: {},
    });
    const handler = new flow_handler_component_implementation_1.FlowGComponentImplementationHandler();
    // A brief naming no raster: the flow says so rather than producing a plate nobody asked for.
    const none = await handler.execute(context('a settings toggle with a disabled state'));
    const noneRow = (none.checklist || []).find((c) => c.id === 'asset-production');
    assert(noneRow !== undefined, 'the flow always carries the asset row, even when no asset was needed');
    assert(noneRow.completed === true && noneRow.required === false, 'no raster needed is complete and not required');
    assert((none.guidance || []).some((g) => /Asset production: NOT-NEEDED/.test(g)), 'the flow states that no raster was needed');
    assert(!(none.artifacts || []).some((a) => a.name.startsWith('Generated raster asset')), 'no asset means no asset artifact');
    // A brief naming a raster: the flow REALLY invokes the bin and REALLY writes bytes, at zero cost.
    const made = await handler.execute(context('craft a pricing hero with a full-bleed backdrop behind the headline'));
    const row = (made.checklist || []).find((c) => c.id === 'asset-production');
    assert(/Asset production:/.test((made.guidance || []).join('\n')), 'the flow reports the asset step');
    assert(/VERIFIED|FAILED|UNVERIFIED/.test((made.guidance || []).find((g) => g.startsWith('Asset production:'))), 'the flow reports a real verdict, never silence');
    const assetDir = path.join(project, '.sidecoach-cache', 'assets');
    assert(fs.existsSync(assetDir), 'the flow wrote into the project asset directory');
    const written = fs.readdirSync(assetDir).filter((f) => f.endsWith('.png'));
    assert(written.length >= 1, `the flow must produce real bytes through the bin, found ${written.length} file(s)`);
    assert(fs.statSync(path.join(assetDir, written[0])).size > 1000, 'the produced asset is a real image, not an empty file');
    // The compilation report travels into the guidance, so a reader sees what the layer supplied for them.
    const guidance = (made.guidance || []).join('\n');
    assert(/the concept and composition layer supplied the rest/.test(guidance), 'the flow reports which dimensions were supplied');
    assert(/contrast target: #14181c/.test(guidance), 'the flow reports the contrast contract it derived from DESIGN.md');
    // Whatever the verdict, the offering rule holds: an artifact exists only when the row completed.
    const hasArtifact = (made.artifacts || []).some((a) => a.name.startsWith('Generated raster asset'));
    assert(hasArtifact === (row.completed === true), 'an asset artifact is offered exactly when the asset verified');
}
async function main() {
    testCatalog();
    testWeakBrief();
    testContractDerivation();
    testResolution();
    testReviewFindings();
    testTokenPrecedence();
    testProseHarvest();
    testArgv();
    testOffering();
    await testFlow();
    console.log('image-brief-compiler: OK (5 Codex findings covered by regression, catalog separation enforced, weak brief compiles with real palette + bans + text policy, contract derived from the staging ink zone, nothing invented, provider-aware size, prose harvest, argv carries the contract and no consent, fail-closed offering, real asset through flowG)');
}
main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=image-brief-compiler.test.js.map