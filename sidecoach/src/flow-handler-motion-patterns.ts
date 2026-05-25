// Flow E: Motion Patterns
// Research easing curves, timing, and stagger patterns against motion domain rules
// Applies motion domain (duration, easing, reduced-motion) with exponential-only constraint.
//
// As of the library-wiring pass, this flow imports the three prescribed
// named easings (Emil Kowalski's --ease-out / --ease-in-out / --ease-drawer)
// and the banned-easing list (built-in ease-in, bounce, elastic, back) from
// reference-loader. The prescribed list is the canonical surface; the loose
// pre-wiring check (`any cubic-bezier passes`) is replaced with strict
// prescribed-or-banned validation per pattern. The Material curve
// `cubic-bezier(0.4, 0, 0.2, 1)` is now an explicit non-recommendation
// (passes but is flagged as weaker than prescribed).

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';
import { MotionReference, MotionPattern } from './reference-systems';
import { MotionReferenceImpl } from './motion-reference';
import { SHARED_DESIGN_LAWS } from './design-laws';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';
import { loadPrescribedEasings, loadBannedEasings } from './reference-loader';

export interface MotionPatternContext {
  motionDomainRules: string[];
  easingCurves: {
    name: string;
    intensity: 'restrained' | 'playful' | 'ambitious';
    easing: string;
    duration: number;
    useCase: string;
  }[];
  reducedMotionStrategies: string[];
  validationResults: {
    patternName: string;
    hasReducedMotion: boolean;
    durationApropriate: boolean;
    easingExpOnential: boolean;
  }[];
}

export class FlowEMotionPatternsHandler extends BaseFlowHandler {
  private motionRef: MotionReference;
  private cachedMotionContext?: MotionPatternContext;

  constructor() {
    super('flowE_motion_patterns');
    this.motionRef = new MotionReferenceImpl();
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow E requires project context with brand personality (determines motion intensity)
    return !!(context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const enhancedContext = context as EnhancedFlowExecutionContext;
    const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
    const register = context.projectContext?.register || 'product';

    try {
      // Get motion domain rules (duration, easing, no layout-property animation, stagger, reduced-motion)
      const motionDomain = SHARED_DESIGN_LAWS.motion;
      const motionRules = motionDomain.rules.map((rule) => `- ${rule}`);

      // Determine motion intensity based on register and brand personality
      // Product = restrained, brand = playful/ambitious
      const intensity: 'restrained' | 'playful' | 'ambitious' =
        register === 'brand' && brandPersonality?.includes('bold') ? 'ambitious' :
        register === 'brand' ? 'playful' :
        'restrained';

      // Get easing curves for this intensity
      const easingPatterns = await this.motionRef.getEasingCurves(intensity);

      // Get full motion palette for register
      const motionPalette = await this.motionRef.getMotionPalette(register);

      // Add custom data to enhanced context if available
      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowE', 'motion-patterns', 'motion-domain'];
        enhancedContext.flowMetadata.customData = {
          'motion-intensity': intensity,
          'easing-curves': easingPatterns.length,
          'reduced-motion-strategies': 6,
          'motion-register': register,
          'brand-personality': brandPersonality || 'default',
        };
      }

      // Prepare easing curves response
      const easingCurves = easingPatterns.map((pattern) => ({
        name: pattern.name,
        intensity,
        easing: pattern.easing,
        duration: pattern.duration,
        useCase: pattern.useCase,
      }));

      // Load the prescribed named easings (Emil's three strong curves) and
      // banned-easing list from reference-loader. The prescribed list is the
      // canonical set; anything not in it but still a cubic-bezier passes as
      // "acceptable" but is flagged as weaker than the prescribed curves.
      const prescribedEasings = loadPrescribedEasings();
      const bannedEasings = loadBannedEasings();
      const prescribedValues = new Set(prescribedEasings.map((e) => e.cssValue.replace(/\s+/g, '')));

      // Validate motion patterns: each pattern's easing must be either one
      // of the prescribed named curves OR another exponential cubic-bezier,
      // and must not match any banned curve.
      const validationResults = [];
      for (const pattern of [...easingPatterns, ...motionPalette]) {
        const normalizedEasing = pattern.easing.replace(/\s+/g, '');
        const isPrescribed = prescribedValues.has(normalizedEasing);
        const matchedBan = bannedEasings.find((b) => b.regex.test(pattern.easing));
        const isCubicBezier = /cubic-bezier/.test(pattern.easing);
        const isExponential = isPrescribed || (isCubicBezier && !matchedBan);

        // Get reduced motion alternative
        const reducedMotion = await this.motionRef.getReducedMotionAlternative(pattern);

        validationResults.push({
          patternName: pattern.name,
          hasReducedMotion: reducedMotion.reducedMotionFallback !== 'none',
          durationApropriate: pattern.duration > 0 && pattern.duration < 1000,
          easingExpOnential: isExponential,
          easingPrescribed: isPrescribed,
          easingBanned: !!matchedBan,
          banReason: matchedBan?.reason,
        });
      }

      // Build reduced-motion strategies based on domain rules
      const reducedMotionStrategies = [
        'Entrance animations: fade-in at 100% opacity (no duration)',
        'Exit animations: fade-out to 0% opacity (no duration)',
        'State changes: instant, no transition',
        'Feedback: instant visual feedback, no easing',
        'Stagger: apply to children with 50ms base, not compound across parents',
        'Prefers-reduced-motion: apply @media (prefers-reduced-motion) throughout',
      ];

      // Cache context for downstream flows
      this.cachedMotionContext = {
        motionDomainRules: motionDomain.rules,
        easingCurves,
        reducedMotionStrategies,
        validationResults,
      };

      // Domain validation integration
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        componentTree: context.metadata?.componentTree || { motionPatterns: easingPatterns.length },
        cssRules: context.metadata?.cssRules || [],
        motion: context.metadata?.motion,
        accessibility: context.metadata?.accessibility,
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);
      const motionDomainRules = ExtendedDomainValidator.getRulesByDomain('motion');

      const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
      const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
        { label: 'Register specified', required: true, description: register },
        { label: 'Motion intensity determined', required: true, description: `${intensity} (for ${register} register)` },
        { label: 'Motion domain rules reviewed', required: true, description: `${motionRules.length} rules loaded` },
        { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
        { label: 'Easing curves validated (exponential only)', required: false, description: `${easingPatterns.length} patterns` },
        { label: 'Reduced-motion strategies defined', required: false, description: '6 strategies for accessibility' },
        { label: 'Motion patterns validated against rules', required: false, description: `${validationResults.length} patterns validated` },
      ]);

      // Build guidance
      const guidance = [
        `Brand personality: ${brandPersonality || 'Not defined'}`,
        `Register: ${register}`,
        `Motion intensity: ${intensity} (${register === 'brand' ? 'playful/ambitious for brand' : 'restrained for product'})`,
        '',
        'Motion Domain Rules (Duration, Easing, No Layout Animation):',
        ...motionRules,
        '',
        'Domain Validation Results:',
        '',
        'PRESCRIBED NAMED EASINGS (use these by name, do not improvise):',
        ...prescribedEasings.map((e) => `- ${e.name}: ${e.cssValue}`),
        ...prescribedEasings.map((e) => `  Use case: ${e.use}`),
        '',
        'BANNED EASINGS (will be flagged as findings if generated):',
        ...bannedEasings.map((b) => `- ${b.reason}`),
        '',
        'Exponential-Only Easing:',
        'Only cubic-bezier curves with exponential curves (out-quart, out-quint, etc.)',
        'NO linear, ease-in, step functions, or bounce/elastic',
        'Rationale: exponential curves feel natural (deceleration after force)',
        '',
        'FREQUENCY-FIRST DECISION (Emil Kowalski):',
        'Before specifying any animation, answer: "How many times per day will the user see this?"',
        '- 100+/day (cmd+k, dock, nav, primary CTA) -> NO animation. Ever. The optimal experience is instant.',
        '- 10-100/day (modals, panels, secondary nav) -> Subtle, fast (100-200ms).',
        '- <10/day (page transitions, onboarding, settings) -> Generous, expressive motion permitted.',
        '',
        'Layout Property Animation FORBIDDEN:',
        'Never animate width, height, top, left, margin, padding, font-size',
        'Instead: animate transform (translate, scale, rotate) or opacity',
        'Layout animation blocks paint, causes jank, terrible performance',
        '',
        'Recommended Easing Curves:',
        ...easingCurves.map((e) => `- ${e.name}: ${e.easing} (${e.duration}ms, ${e.useCase})`),
        '',
        'Stagger Patterns:',
        '- Base stagger: 50ms between items',
        '- For 10+ items: use cubic-bezier easing, not linear',
        '- Never compound stagger (parents + children both stagger)',
        '',
        'Reduced-Motion Strategies (prefers-reduced-motion):',
        ...reducedMotionStrategies,
        '',
        `${motionPalette.length} motion patterns available for ${register} register. Run Flow H to integrate motion into component interactions.`,
      ];

      const exponentialPassCount = validationResults.filter((r) => r.easingExpOnential).length;
      const reducedMotionPassCount = validationResults.filter((r) => r.hasReducedMotion).length;

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`Motion patterns: ${easingPatterns.length} easing curves with motion domain validation (${motionPassRate}) + ${reducedMotionStrategies.length} reduced-motion strategies`)
        .addRule('motion', motionRules)
        .addDecision(`Motion intensity: ${intensity}`, `${register === 'brand' ? 'Playful/ambitious' : 'Restrained'} motion for ${register} register with ${brandPersonality} personality`)
        .addMetric('easing-curves-researched', easingPatterns.length, 'pass')
        .addMetric('motion-domain-validation', motionPassed, 'pass', motionDomainRules.length)
        .addMetric('motion-patterns-validated', validationResults.length, 'pass')
        .addMetric('exponential-easing-pass', exponentialPassCount, 'pass', validationResults.length)
        .addMetric('reduced-motion-strategies', reducedMotionStrategies.length, 'pass', 6)
        .addValidation('Motion domain compliance', motionPassed === motionDomainRules.length ? 'pass' : 'warning', `${motionPassed}/${motionDomainRules.length} pass`)
        .addValidation('Exponential-only easing', exponentialPassCount === validationResults.length ? 'pass' : 'warning', `${exponentialPassCount}/${validationResults.length} pass`)
        .addValidation('Reduced-motion coverage', reducedMotionPassCount === validationResults.length ? 'pass' : 'warning', `${reducedMotionPassCount}/${validationResults.length} patterns`)
        .addReference('motion-reference', easingPatterns.length, 'easing curve patterns')
        .addArtifact('motion-curves', easingPatterns.length, ['flowH_motion_integration', 'flowI_motion_polish']);

      const memory = memoryBuilder.build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Motion patterns: ${easingPatterns.length} easing curves researched with motion domain rules + ${reducedMotionStrategies.length} reduced-motion strategies`,
        guidance,
        checklist,
        artifacts: easingPatterns.length > 0
          ? [
              this.createArtifact(
                'reference',
                'Easing Curves',
                easingCurves.map((e) => `${e.name}: ${e.easing} (${e.duration}ms)`).join('\n'),
                `${easingCurves.length} exponential easing curves for ${intensity} intensity`
              ),
              this.createArtifact(
                'reference',
                'Motion Domain Rules',
                motionRules.join('\n'),
                'Duration appropriateness, easing exponential-only, no layout-property animation, stagger patterns, reduced-motion'
              ),
              this.createArtifact(
                'reference',
                'Reduced-Motion Strategies',
                reducedMotionStrategies.join('\n'),
                '6 accessibility strategies for prefers-reduced-motion media query'
              ),
            ]
          : [],
        memory,
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Motion research failed: ${String(err).substring(0, 40)}`)
        .addValidation('motion-reference-query', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to research motion patterns',
        error: String(err),
        memory,
      };
    }
  }

  getCachedContext(): MotionPatternContext | undefined {
    return this.cachedMotionContext;
  }
}

export function createFlowEHandler(): FlowEMotionPatternsHandler {
  return new FlowEMotionPatternsHandler();
}
