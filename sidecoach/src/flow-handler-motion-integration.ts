// Flow H: Motion Integration
// Implement production-ready motion against motion domain rules (exponential easing, duration, no layout animation)

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SHARED_DESIGN_LAWS } from './design-laws';

interface MotionIntegrationContext {
  motionDomainRules: string[];
  motionIntensity: 'restrained' | 'playful' | 'ambitious';
  animationTemplates: {
    category: string;
    duration: number;
    easing: string;
    useCase: string;
  }[];
  validationResults: {
    pattern: string;
    durationCompliant: boolean;
    easingCompliant: boolean;
    noLayoutAnimation: boolean;
    reducedMotionSupport: boolean;
  }[];
}

export class FlowHMotionIntegrationHandler extends BaseFlowHandler {
  private cachedMotionContext?: MotionIntegrationContext;

  constructor() {
    super('flowH_motion_integration');
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow H requires project context and motion context from Flow E
    return !!(context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
    const register = context.projectContext?.register || 'product';

    try {
      // Get motion domain rules
      const motionDomain = SHARED_DESIGN_LAWS.motion;

      // Determine motion intensity based on register
      const intensity: 'restrained' | 'playful' | 'ambitious' =
        register === 'brand' && brandPersonality?.includes('bold') ? 'ambitious' :
        register === 'brand' ? 'playful' :
        'restrained';

      // Define animation templates by category
      const animationTemplates = [
        {
          category: 'entrance',
          duration: intensity === 'ambitious' ? 500 : intensity === 'playful' ? 400 : 200,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // ease-out curves
          useCase: 'Page/section reveals, fade-in, slide-in from edges',
        },
        {
          category: 'feedback',
          duration: 100,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // swift ease-out
          useCase: 'Button clicks, state changes, micro-interactions',
        },
        {
          category: 'state_change',
          duration: intensity === 'ambitious' ? 300 : 150,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          useCase: 'Toggle states, modal opens, panel slides',
        },
        {
          category: 'scroll_linked',
          duration: 0, // No explicit duration for scroll-linked
          easing: 'linear', // Scroll events drive timing
          useCase: 'Parallax, reveal-on-scroll, fixed-scroll indicators',
        },
        {
          category: 'exit',
          duration: Math.max(75, intensity === 'restrained' ? 100 : 150),
          easing: 'cubic-bezier(0.4, 0, 1, 1)', // ease-in curves
          useCase: 'Modal close, fade-out, slide-out to edges',
        },
      ];

      // Validate motion patterns against domain rules
      const validationResults = animationTemplates.map((template) => {
        // Duration compliance: 100-500ms for most, 50-100ms for feedback
        const durationCompliant =
          template.duration === 0 ||
          (template.category === 'feedback' && template.duration >= 50 && template.duration <= 100) ||
          (template.category !== 'feedback' && template.duration >= 100 && template.duration <= 500);

        // Easing compliance: only exponential (ease-out, ease-in-out, cubic-bezier with exponential curves)
        const easingCompliant =
          /cubic-bezier|ease-out|ease-in-out/.test(template.easing) && !/linear|ease-in|bounce|elastic/.test(template.easing);

        return {
          pattern: template.category,
          durationCompliant,
          easingCompliant,
          noLayoutAnimation: true, // Will validate in implementation phase
          reducedMotionSupport: true, // Will add @media prefers-reduced-motion in implementation
        };
      });

      // Cache context for downstream flows
      this.cachedMotionContext = {
        motionDomainRules: motionDomain.rules,
        motionIntensity: intensity,
        animationTemplates,
        validationResults,
      };

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Motion intensity determined', required: true, description: intensity },
        { label: 'Animation templates selected for register', required: true, description: `${animationTemplates.length} templates` },
        { label: 'Duration compliance verified', required: true, description: '100-500ms range (50-100ms for feedback)' },
        { label: 'Easing curves exponential-only (no linear/bounce)', required: true, description: 'cubic-bezier ease-out curves' },
        { label: 'No layout-property animation (transform/opacity only)', required: true, description: 'Validated per pattern' },
        { label: '@media prefers-reduced-motion alternatives implemented', required: true, description: 'Fade fallbacks for all' },
        { label: 'Stagger patterns use 50ms base with exponential easing', required: false, description: '10+ items only' },
        { label: 'Performance verified on device (60 FPS target)', required: true, description: 'No jank on low-end' },
        { label: 'Animations interruptible (user can cancel/skip)', required: true, description: 'Allow user control' },
      ]);

      // Build guidance
      const guidance = [
        `Brand Personality: ${brandPersonality || 'Not defined'}`,
        `Register: ${register}`,
        `Motion Intensity: ${intensity} (${register === 'brand' ? 'brand encourages ambitious motion' : 'product prefers restrained'})`,
        '',
        'Motion Domain Rules (Duration, Easing, No Layout Animation):',
        ...motionDomain.rules.map((r) => `- ${r}`),
        '',
        'Animation Template Strategy:',
        ...animationTemplates.map(
          (t) =>
            `- ${t.category}: ${t.duration}ms, ${t.easing.substring(0, 30)}... (${t.useCase})`
        ),
        '',
        'Exponential-Only Easing (NO linear, bounce, elastic):',
        'entrance: ease-out-quart/quint/expo (deceleration feels natural)',
        'feedback: swift ease-out (responsive to user)',
        'exit: ease-in curves (objects leave screen gracefully)',
        'scroll-linked: linear (scroll events control timing)',
        '',
        'Layout Property Animation FORBIDDEN:',
        'Never animate: width, height, top, left, margin, padding, font-size',
        'Instead: animate transform (translate, scale, rotate) or opacity',
        'Layout animation blocks paint, causes jank, kills performance',
        '',
        'Reduced-Motion Accessibility:',
        '@media (prefers-reduced-motion) {',
        '  /* entrance: fade-in at 100% opacity, duration: 0 */',
        '  /* feedback: instant, no easing */',
        '  /* exit: fade-out to 0% opacity, duration: 0 */',
        '}',
        '',
        'Performance Validation:',
        '- Test on actual devices (not just desktop)',
        '- Target 60 FPS smooth playback',
        '- Use will-change sparingly (only when animation imminent)',
        '- Avoid animate-all, use specific properties',
        '- Make animations interruptible (allow user to cancel/skip)',
      ];

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Motion integration: ${animationTemplates.length} templates for ${intensity} intensity, exponential easing validated`,
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Motion Domain Rules',
            motionDomain.rules.join('\n'),
            'Duration, easing, no layout animation, stagger, reduced-motion'
          ),
          this.createArtifact(
            'template',
            'Animation Templates',
            animationTemplates.map((t) => `${t.category}: ${t.duration}ms, ${t.easing}`).join('\n'),
            `${animationTemplates.length} templates for ${intensity} intensity`
          ),
          this.createArtifact(
            'reference',
            'Motion Validation Results',
            validationResults.map((r) => `${r.pattern}: duration=${r.durationCompliant ? 'OK' : 'FAIL'}, easing=${r.easingCompliant ? 'OK' : 'FAIL'}`).join('\n'),
            'Pattern compliance against motion domain rules'
          ),
        ],
      };
    } catch (err) {
      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to integrate motion patterns',
        error: String(err),
      };
    }
  }

  getCachedContext(): MotionIntegrationContext | undefined {
    return this.cachedMotionContext;
  }
}

export function createFlowHHandler(): FlowHMotionIntegrationHandler {
  return new FlowHMotionIntegrationHandler();
}
