// Flow D: Design References
// Search visual inspiration and design patterns against color + spatial domain rules
// Applies color domain (OKLCH, contrast, semantics) + spatial domain (grid, spacing)
// Includes category-reflex AI slop detection
// Includes the CONCEPT SKETCH lens: a generated-and-verified reference plate for the brief (see below)

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';
import { DesignReferencesSystem } from './reference-systems';
import { DesignReferencesSystemImpl } from './design-references-reference';
import { SHARED_DESIGN_LAWS, CATEGORY_REFLEX } from './design-laws';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';
import { compileImageBrief } from './image-brief-compiler';

import { applyModelSelection } from './model-routing';
import { flowCraft, craftGuidanceBlock } from './craft-flow';
export interface DesignReferenceContext {
  referencesFound: number;
  colorDomainRules: string[];
  spatialDomainRules: string[];
  references: {
    title: string;
    category: string;
    hasColorPalette: boolean;
    hasSpacingPattern: boolean;
    slopDetectionResults: {
      categoryReflex: boolean;
      oversaturated: boolean;
      genericityScore: number;
    };
  }[];
}

// ---------------------------------------------------------------------------
// CONCEPT SKETCH LENS
//
// Flow D is where sidecoach does concept work: it gathers the visual references a build reacts to. Until now
// every one of those references had to already exist somewhere. This lens adds a generated one - a reference
// plate authored from the brief itself - and, critically, it will not offer that plate as a reference unless the
// bytes passed verification.
//
// FULLY CONTAINED, exactly like the token-drift lens in the audit flow: it returns null on ANY harness failure
// (no project path, bin missing, spawn failure, timeout, unparseable output) so flow D keeps working with the
// references it already found and never crashes on the sketch step.
//
// FAIL-CLOSED AND FOUR-VALUED, which is the property that matters: a sketch that FAILED its checks and a sketch
// whose checks COULD NOT RUN are reported as themselves, never rounded up to a usable reference. The guidance
// line the flow emits says which of the four happened.
//
// COSTS NOTHING BY DEFAULT: the lens runs the offline deterministic renderer. It never passes a spend signal, so
// it cannot spend money, and the bytes it produces carry the synthetic marker so a later step cannot mistake the
// plate for a real provider render. Reaching for a live provider is an explicit operator action through
// bin/sidecoach-image.js, never something a flow does on its own.
// ---------------------------------------------------------------------------

export interface ConceptSketchOutcome {
  status: 'verified' | 'failed' | 'unverified' | 'unavailable';
  /** Absolute path to the plate, present only when one was written. */
  path?: string;
  provider: string;
  model?: string;
  detail: string;
}

/**
 * Build the sketch prompt from the brief. Deterministic: the same register, approach and utterance always
 * produce the same prompt, so the same brief always produces the same plate (and the same cache key).
 */
export function buildSketchPrompt(register: string, approach: string, utterance: string): string {
  // Routed through the brief compiler rather than assembled here.
  //
  // WHAT THIS REPLACED, and why it mattered: three sentences naming a register, an approach, and the raw
  // utterance. That is a weak prompt built from a weak brief, which is the one thing this layer exists to stop.
  // The compiler supplies the staging, the frame, the focal, the depth, the negative constraints, and the text
  // policy, so the same brief now yields a structured specification. The plate role is forced because a flow D
  // reference plate is always a plate, whatever nouns the utterance happens to contain.
  const compiled = compileImageBrief(
    { text: utterance.trim().replace(/\s+/g, ' ').slice(0, 220) || 'the surface described in the brief', role: 'plate' },
    { register, approach, sizePolicy: { allowed: ['1024x1024'] } },
  );
  if (compiled) return compiled.prompt;
  // Unreachable while the plate role is forced (a forced role always compiles), and kept as a floor rather than a
  // throw so a reference search can never crash on its sketch step.
  const subject = utterance.trim().replace(/\s+/g, ' ').slice(0, 220) || 'the surface described in the brief';
  return [
    `A reference plate for a ${register} interface in a ${approach} visual direction.`,
    `Brief: ${subject}.`,
    'Flat even lighting, generous negative space, no text, no lettering, no logos, no user-interface chrome.',
  ].join(' ');
}

/**
 * Invoke bin/sidecoach-image.js in offline mode for the brief and map its exit code onto a four-valued outcome.
 * Exit codes are the contract: 0 verified, 1 a check failed, 3 a check could not run, anything else means no
 * plate was produced.
 */
export function runConceptSketchLens(context: FlowExecutionContext): ConceptSketchOutcome | null {
  const projectPath = context.projectPath;
  if (!projectPath) return null;
  try {
    if (!fs.statSync(projectPath).isDirectory()) return null;
  } catch {
    return null;
  }

  const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-image.js');
  if (!fs.existsSync(bin)) return null;

  const register = context.projectContext?.register || 'product';
  const approach = context.projectContext?.design?.visual?.approach || 'modern';
  const prompt = buildSketchPrompt(register, approach, context.utterance || '');
  const slug = createHash('sha256').update(prompt).digest('hex').slice(0, 12);
  const outDir = path.join(projectPath, '.sidecoach-cache', 'sketches');
  const out = path.join(outDir, `concept-${slug}.png`);

  let stdout = '';
  let code = 0;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    stdout = execFileSync(
      process.execPath,
      [
        bin,
        'generate',
        '--prompt',
        prompt,
        '--out',
        out,
        '--size',
        '1024x1024',
        '--provider',
        'offline',
        '--cache-dir',
        path.join(projectPath, '.sidecoach-cache', 'images'),
        '--quiet',
      ],
      { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    code = typeof e.status === 'number' ? e.status : -1;
    stdout = typeof e.stdout === 'string' ? e.stdout : '';
    if (code === -1) return null;
  }

  let parsed: { verdict?: string; provider?: string; model?: string; verification?: { checks?: Array<{ id: string; status: string; detail: string }> } } = {};
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // A nonzero exit with no JSON means the step never got far enough to produce a verdict.
    return code === 0 ? null : { status: 'unavailable', provider: 'offline', detail: `the sketch step exited ${code} without a verdict` };
  }

  const provider = parsed.provider || 'offline';
  const model = parsed.model;
  const failed = (parsed.verification?.checks || []).filter((c) => c.status === 'fail');
  const unver = (parsed.verification?.checks || []).filter((c) => c.status === 'unverified');

  if (code === 0 && parsed.verdict === 'verified') {
    return { status: 'verified', path: out, provider, model, detail: 'geometry, format and rendered content all checked against the bytes' };
  }
  if (parsed.verdict === 'failed') {
    return { status: 'failed', provider, model, detail: `the plate failed verification: ${failed.map((c) => `${c.id} (${c.detail})`).join('; ') || 'unspecified check'}` };
  }
  if (parsed.verdict === 'unverified') {
    return { status: 'unverified', provider, model, detail: `the plate could not be fully checked: ${unver.map((c) => c.id).join(', ') || 'unspecified check'}` };
  }
  return { status: 'unavailable', provider, detail: `the sketch step exited ${code} with verdict ${String(parsed.verdict)}` };
}

/**
 * Whether a sketch outcome may be handed downstream as a usable reference.
 *
 * VERIFIED and nothing else. A failed plate, an unverifiable plate, a step that produced nothing, and a lens
 * that never ran are all withheld. It is a separate exported predicate rather than an inline condition so the
 * rule is testable on all four states, including the two the flow cannot easily be driven into.
 */
export function isOfferableSketch(outcome: ConceptSketchOutcome | null): boolean {
  return outcome !== null && outcome.status === 'verified' && typeof outcome.path === 'string' && outcome.path.length > 0;
}

/** The guidance lines flow D emits for the sketch step, in every outcome including "it did not run". */
export function sketchGuidance(outcome: ConceptSketchOutcome | null): string[] {
  if (!outcome) {
    return [
      'Concept sketch: not run (no project path in this context).',
      'Run one explicitly with: node bin/sidecoach-image.js generate --prompt "<brief>" --out <file.png>',
    ];
  }
  switch (outcome.status) {
    case 'verified':
      return [
        `Concept sketch: VERIFIED and available at ${outcome.path}`,
        `Generated by ${outcome.provider}${outcome.model ? ` (${outcome.model})` : ''}; ${outcome.detail}.`,
        'This plate is a deterministic offline placeholder, marked as such in its own bytes. For a real asset, re-run bin/sidecoach-image.js with a live provider and an explicit spend signal.',
      ];
    case 'failed':
      return [
        'Concept sketch: FAILED verification and is NOT offered as a reference.',
        outcome.detail,
      ];
    case 'unverified':
      return [
        'Concept sketch: UNVERIFIED. A plate was produced but the checks could not run, so it is not offered as a reference.',
        outcome.detail,
      ];
    default:
      return [
        'Concept sketch: no plate was produced.',
        outcome.detail,
      ];
  }
}

export class FlowDReferenceSearchHandler extends BaseFlowHandler {
  private designReferencesRef: DesignReferencesSystem;
  private cachedReferenceContext?: DesignReferenceContext;

  constructor() {
    super('flowD_reference_inspiration');
    this.designReferencesRef = new DesignReferencesSystemImpl();
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow D requires project context with register (to get design approach)
    return !!(context.projectContext?.register);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    const register = context.projectContext?.register || 'product';
    const designApproach = context.projectContext?.design?.visual?.approach || 'modern';

    try {
      // Get color domain rules (OKLCH, contrast, semantics, saturation, dark mode)
      const colorDomain = SHARED_DESIGN_LAWS.color;
      const colorRules = colorDomain.rules.map((rule) => `- ${rule}`);

      // Get spatial domain rules (4pt grid, gap/margin, touch targets, white space)
      const spatialDomain = SHARED_DESIGN_LAWS.spatial;
      const spatialRules = spatialDomain.rules.map((rule) => `- ${rule}`);

      // Search for design references by approach
      const references = await this.designReferencesRef.searchReferences(
        designApproach,
        register,
        10
      );

      // Get category-reflex patterns for slop detection
      const categoryReflex = CATEGORY_REFLEX;

      // Analyze each reference for AI slop
      const referenceAnalysis = await Promise.all(
        references.map(async (ref) => {
          const reflexIssues = await this.designReferencesRef.getCategoryReflex(ref.category);
          const oversaturated =
            reflexIssues.includes('oversaturated') ||
            reflexIssues.length > 0;

          // Genericidad score: 0-1 where 0 is unique/specific, 1 is generic AI slop
          const isOversaturatedCategory = categoryReflex.oversaturated_families?.includes(ref.category) || false;
          const genericityScore = isOversaturatedCategory ? 0.8 : oversaturated ? 0.5 : 0.2;

          return {
            title: ref.title,
            category: ref.category,
            hasColorPalette: !!ref.colorPalette,
            hasSpacingPattern: !!ref.spacingPattern,
            slopDetectionResults: {
              categoryReflex: oversaturated,
              oversaturated: isOversaturatedCategory,
              genericityScore,
            },
          };
        })
      );

      // Filter high-genericity (AI slop) references
      const lowSlopReferences = referenceAnalysis.filter((r) => r.slopDetectionResults.genericityScore < 0.6);
      const oversaturatedCount = referenceAnalysis.filter((r) => r.slopDetectionResults.oversaturated).length;

      // Cache context for downstream flows
      this.cachedReferenceContext = {
        referencesFound: references.length,
        colorDomainRules: colorDomain.rules,
        spatialDomainRules: spatialDomain.rules,
        references: referenceAnalysis,
      };

      // Concept sketch lens: generate a reference plate from the brief and verify it before offering it.
      // Contained: null means the lens did not run, which flow D reports rather than hides.
      const sketch = runConceptSketchLens(context);

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Register defined', required: true, description: register },
        { label: 'Design approach specified', required: true, description: designApproach },
        { label: 'Color domain rules reviewed (OKLCH, contrast)', required: true, description: `${colorRules.length} rules loaded` },
        { label: 'Spatial domain rules reviewed (grid, spacing)', required: true, description: `${spatialRules.length} rules loaded` },
        { label: 'Design references found', required: false, description: `${references.length} references available` },
        { label: 'Category-reflex AI slop detection applied', required: false, description: `${referenceAnalysis.length - lowSlopReferences.length} high-slop filtered` },
        {
          label: 'Concept sketch generated AND verified',
          required: false,
          description: sketch ? `${sketch.status}: ${sketch.detail}` : 'not run (no project path in this context)',
        },
      ]);

      // Build guidance
      // TEACH, THEN CHECK. The colour and reference lines below list the domain LAWS as statements.
      // The brief adds what a law list cannot: what good looks like, the reason, and the concrete
      // values - the 8-10 grey ramp, saturation rising at both ends, flipping contrast rather than
      // darkening, grayscale before colour - each citing the file it came from so a reader can go
      // read the long form instead of taking the line on trust.
      const craft = await flowCraft(context.projectPath, {
        shape: 'produce',
        findingClasses: ['anti-pattern', 'theming'],
        lawDomains: ['research', 'color'],
        domainLabel: 'reference direction and colour',
      });

      const guidance = [
        ...craftGuidanceBlock(craft, 'no colour or anti-pattern rules were measurable on this project.'),
        `Register: ${register}`,
        `Design approach: ${designApproach}`,
        '',
        'Color Domain Rules (OKLCH Commitment):',
        ...colorRules,
        '',
        'Semantic Colors: ensure meaning is consistent across light/dark modes',
        'Contrast Validation: WCAG AA minimum 4.5:1 for text, 3:1 for UI',
        'Saturation & Vibrancy: appropriate for register (product vs brand)',
        '',
        'Spatial Domain Rules (4pt Grid System):',
        ...spatialRules,
        '',
        'Touch Targets: minimum 40x40px for interactive elements',
        'White Space: balance density with breathing room',
        'Container Queries: responsive without media queries',
        '',
        'Design References Analysis:',
        `- Total found: ${references.length}`,
        `- High quality (low AI slop): ${lowSlopReferences.length}`,
        `- Flagged as oversaturated: ${oversaturatedCount}`,
        '',
        'High-Quality References (genericityScore < 0.6):',
        ...lowSlopReferences.map((r) => `- ${r.title} (${r.category}${r.hasColorPalette ? ' + color' : ''}${r.hasSpacingPattern ? ' + spacing' : ''})`),
        '',
        'Concept Sketch (generated reference plate, verified before it is offered):',
        ...sketchGuidance(sketch),
        '',
        `Proceed to Flow E (Motion Patterns) for animation design validation.`,
      ];

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`Design references: ${references.length} patterns + AI slop detection`)
        .addRule('color', colorRules)
        .addRule('spatial', spatialRules)
        .addDecision(`Selected ${lowSlopReferences.length} high-quality references`, `Filtered oversaturated/AI-slop references (genericityScore < 0.6)`)
        .addMetric('references-analyzed', references.length, 'pass')
        .addMetric('high-quality-references', lowSlopReferences.length, 'pass', references.length)
        .addMetric('ai-slop-filtered', oversaturatedCount, 'pass')
        .addValidation('Category-reflex AI slop detection', oversaturatedCount === 0 ? 'pass' : 'warning', `${oversaturatedCount} oversaturated categories`)
        // Fail-closed: only a verified plate is a pass. A plate that failed or could not be checked is a fail,
        // and a lens that did not run is a warning - never a silent pass.
        .addValidation(
          'Concept sketch verification',
          !sketch ? 'warning' : sketch.status === 'verified' ? 'pass' : sketch.status === 'unavailable' ? 'warning' : 'fail',
          sketch ? `${sketch.status}: ${sketch.detail}` : 'sketch lens did not run (no project path)',
        )
        .addReference('design-references', lowSlopReferences.length, 'design inspiration patterns')
        .addArtifact('reference-patterns', lowSlopReferences.length, ['flowE_motion_patterns', 'flowG_component_implementation', 'flowN_design_refine']);

      const memory = memoryBuilder.build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Design references: ${references.length} patterns researched with color + spatial rules + category-reflex AI slop detection`,
        guidance,
        checklist,
        artifacts: [
          // Only a VERIFIED plate becomes an artifact. A failed or unverifiable one is named in the guidance and
          // the checklist but is never handed downstream as a usable reference.
          //
          // This sits OUTSIDE the lowSlopReferences guard on purpose: the plate is authored from the brief and
          // does not depend on how many external references cleared the slop filter. Nesting it inside that
          // guard silently dropped a verified plate whenever the filter returned nothing, which is exactly the
          // shape of defect this whole unit exists to prevent.
          ...(isOfferableSketch(sketch)
            ? [
                this.createArtifact(
                  'reference',
                  'Concept Sketch (verified)',
                  sketch!.path as string,
                  `Generated reference plate, verified against its own bytes: ${sketch!.detail}`,
                ),
              ]
            : []),
          ...(lowSlopReferences.length > 0
          ? [
              this.createArtifact(
                'reference',
                'Design References (Filtered)',
                lowSlopReferences.map((r) => `${r.title} (${r.category})`).join('\n'),
                `${lowSlopReferences.length} high-quality references matching color & spatial domain rules`
              ),
              this.createArtifact(
                'reference',
                'Color Domain Rules',
                colorRules.join('\n'),
                'OKLCH color space, contrast validation, semantic meaning, dark mode strategies'
              ),
              this.createArtifact(
                'reference',
                'Spatial Domain Rules',
                spatialRules.join('\n'),
                '4pt grid foundation, gap vs margin, touch targets, white space balance'
              ),
            ]
          : []),
        ],
        memory,
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Design reference search failed: ${String(err).substring(0, 40)}`)
        .addValidation('design-references-query', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to search design references',
        error: String(err),
        guidance: [],
        checklist: [],
        memory,
      };
    }
  }

  getCachedContext(): DesignReferenceContext | undefined {
    return this.cachedReferenceContext;
  }
}

export function createFlowDHandler(): FlowDReferenceSearchHandler {
  return new FlowDReferenceSearchHandler();
}
