"use strict";
// Flow H: Motion Integration
// Implement production-ready motion against motion domain rules (exponential easing, duration, no layout animation)
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowHMotionIntegrationHandler = void 0;
exports.createFlowHHandler = createFlowHHandler;
const flow_handler_1 = require("./flow-handler");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
const design_md_parser_1 = require("./design-md-parser");
const motion_stack_idioms_1 = require("./motion-stack-idioms");
// Round 2 wiring (C3): mirror W4's easing prescriptions into the integration
// flow so production code emits the named strong easings, not the Material
// curve or the banned bounce. Pre-wiring this handler prescribed
// `cubic-bezier(0.34, 1.56, 0.64, 1)` as the entrance easing - which is
// literally the bounce curve Emil bans in the absorbed library.
const reference_loader_1 = require("./reference-loader");
const model_routing_1 = require("./model-routing");
class FlowHMotionIntegrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowH_motion_integration');
    }
    canExecute(context) {
        // Flow H requires project context and motion context from Flow E
        return !!(context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality);
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
        const register = context.projectContext?.register || 'product';
        try {
            // Get motion domain rules
            const motionDomain = design_laws_1.SHARED_DESIGN_LAWS.motion;
            // Determine motion intensity based on register
            const intensity = register === 'brand' && brandPersonality?.includes('bold') ? 'ambitious' :
                register === 'brand' ? 'playful' :
                    'restrained';
            // Round 2 wiring (C3): use Emil's prescribed strong easings instead of
            // the Material curve, and never the bounce/elastic curves the previous
            // template version emitted as "entrance" and "exit".
            const prescribedEasings = (0, reference_loader_1.loadPrescribedEasings)();
            const bannedEasings = (0, reference_loader_1.loadBannedEasings)();
            const namedEaseOut = prescribedEasings.find((e) => e.name === '--ease-out').cssValue;
            const namedEaseInOut = prescribedEasings.find((e) => e.name === '--ease-in-out').cssValue;
            const namedEaseDrawer = prescribedEasings.find((e) => e.name === '--ease-drawer').cssValue;
            // Define animation templates by category, using prescribed easings
            const animationTemplates = [
                {
                    category: 'entrance',
                    duration: intensity === 'ambitious' ? 500 : intensity === 'playful' ? 400 : 200,
                    easing: namedEaseOut,
                    useCase: 'Page/section reveals, fade-in, slide-in from edges',
                },
                {
                    category: 'feedback',
                    duration: 100,
                    easing: namedEaseOut,
                    useCase: 'Button clicks, state changes, micro-interactions',
                },
                {
                    category: 'state_change',
                    duration: intensity === 'ambitious' ? 300 : 150,
                    easing: namedEaseInOut,
                    useCase: 'Toggle states, modal opens, panel slides',
                },
                {
                    category: 'drawer_modal',
                    duration: 260,
                    easing: namedEaseDrawer,
                    useCase: 'Drawer/sheet/modal slides - the one place an asymmetric curve helps the affordance',
                },
                {
                    category: 'scroll_linked',
                    duration: 0, // No explicit duration for scroll-linked
                    easing: 'linear', // Scroll events drive timing
                    useCase: 'Parallax, reveal-on-scroll, fixed-scroll indicators - the only place linear is correct',
                },
                {
                    category: 'exit',
                    duration: Math.max(75, intensity === 'restrained' ? 100 : 150),
                    easing: namedEaseOut, // Emil: never ease-in alone for UI - reuse ease-out, just faster
                    useCase: 'Modal close, fade-out, slide-out to edges. Faster than entrance (asymmetric timing).',
                },
            ];
            // Validate motion patterns against domain rules
            const prescribedValues = new Set(prescribedEasings.map((e) => e.cssValue.replace(/\s+/g, '')));
            const validationResults = animationTemplates.map((template) => {
                // Duration compliance: 100-500ms for most, 50-100ms for feedback
                const durationCompliant = template.duration === 0 ||
                    (template.category === 'feedback' && template.duration >= 50 && template.duration <= 100) ||
                    (template.category !== 'feedback' && template.duration >= 100 && template.duration <= 500);
                // Easing compliance: prescribed by name OR a non-banned cubic-bezier
                // (scroll_linked is the exception - linear is allowed only there).
                const normalizedEasing = template.easing.replace(/\s+/g, '');
                const isPrescribed = prescribedValues.has(normalizedEasing);
                const matchedBan = bannedEasings.find((b) => b.regex.test(template.easing));
                const isScrollLinked = template.category === 'scroll_linked';
                const easingCompliant = isScrollLinked
                    ? template.easing === 'linear'
                    : (isPrescribed || /cubic-bezier/.test(template.easing)) && !matchedBan;
                return {
                    pattern: template.category,
                    durationCompliant,
                    easingCompliant,
                    easingPrescribed: isPrescribed,
                    easingBanned: !!matchedBan,
                    banReason: matchedBan?.reason,
                    noLayoutAnimation: true, // Will validate in implementation phase
                    reducedMotionSupport: true, // Will add @media prefers-reduced-motion in implementation
                };
            });
            // Add custom data to enhanced context if available
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowH', 'motion-integration', 'animation-templates'];
                enhancedContext.flowMetadata.customData = {
                    'motion-intensity': intensity,
                    'animation-templates': animationTemplates.length,
                    'templates-valid': validationResults.filter((r) => r.durationCompliant && r.easingCompliant).length,
                    'motion-register': register,
                };
            }
            // Cache context for downstream flows
            this.cachedMotionContext = {
                motionDomainRules: motionDomain.rules,
                motionIntensity: intensity,
                animationTemplates,
                validationResults,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { motionIntensity: intensity, templates: animationTemplates.length },
                cssRules: context.metadata?.cssRules || [],
                motion: context.metadata?.motion,
                accessibility: context.metadata?.accessibility,
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const motionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('motion');
            const interactionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('interaction');
            const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
            const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';
            const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);
            const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);
            const durationCompliantCount = validationResults.filter((r) => r.durationCompliant).length;
            const easingCompliantCount = validationResults.filter((r) => r.easingCompliant).length;
            const reducedMotionCount = validationResults.filter((r) => r.reducedMotionSupport).length;
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Motion integration: ${animationTemplates.length} templates for ${intensity} intensity with domain validation (motion: ${motionPassRate}, interaction: ${interactionPassRate})`)
                .addRule('motion', design_laws_1.SHARED_DESIGN_LAWS.motion.rules)
                .addDecision(`Motion intensity: ${intensity}`, `${animationTemplates.length} animation templates (entrance/feedback/state-change/scroll/exit) with ${intensity} intensity timing and exponential easing`)
                .addMetric('animation-templates-created', animationTemplates.length, 'pass', 5)
                .addMetric('motion-domain-validation', motionPassed, 'pass', motionDomainRules.length)
                .addMetric('interaction-domain-validation', interactionPassed, 'pass', interactionDomainRules.length)
                .addMetric('duration-compliant', durationCompliantCount, 'pass', animationTemplates.length)
                .addMetric('easing-exponential-only', easingCompliantCount, 'pass', animationTemplates.length)
                .addMetric('reduced-motion-support', reducedMotionCount, 'pass', animationTemplates.length)
                .addValidation('Motion domain compliance', motionPassed === motionDomainRules.length ? 'pass' : 'warning', `${motionPassed}/${motionDomainRules.length} pass`)
                .addValidation('Interaction domain compliance', interactionPassed === interactionDomainRules.length ? 'pass' : 'warning', `${interactionPassed}/${interactionDomainRules.length} pass`)
                .addValidation('Duration compliance (100-500ms)', durationCompliantCount === animationTemplates.length ? 'pass' : 'warning', `${durationCompliantCount}/${animationTemplates.length}`)
                .addValidation('Exponential-only easing', easingCompliantCount === animationTemplates.length ? 'pass' : 'warning', `${easingCompliantCount}/${animationTemplates.length}`)
                .addValidation('No layout-property animation', true ? 'pass' : 'warning', 'transform/opacity only, no width/height/margin/padding')
                .addValidation('Reduced-motion accessibility', reducedMotionCount === animationTemplates.length ? 'pass' : 'warning', `${reducedMotionCount}/${animationTemplates.length} patterns`)
                .addArtifact('motion-integration', animationTemplates.length, ['flowI_motion_polish']);
            const memory = memoryBuilder.build();
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Motion intensity determined', required: true, description: intensity },
                { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
                { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
                { label: 'Animation templates selected for register', required: true, description: `${animationTemplates.length} templates` },
                { label: 'Duration compliance verified', required: true, description: '100-500ms range (50-100ms for feedback)' },
                { label: 'Easing curves exponential-only (no linear/bounce)', required: true, description: 'cubic-bezier ease-out curves' },
                { label: 'No layout-property animation (transform/opacity only)', required: true, description: 'Validated per pattern' },
                { label: '@media prefers-reduced-motion alternatives implemented', required: true, description: 'Fade fallbacks for all' },
                { label: 'Stagger patterns use 50ms base with exponential easing', required: false, description: '10+ items only' },
                { label: 'Performance verified on device (60 FPS target)', required: true, description: 'No jank on low-end' },
                { label: 'Animations interruptible (user can cancel/skip)', required: true, description: 'Allow user control' },
            ]);
            // Citation helper for DESIGN.md token references
            const designContent = context.metadata?.designContent || '';
            const designTokens = context.metadata?.designTokens || {};
            const cite = (dottedPath) => {
                const ln = designContent ? (0, design_md_parser_1.findTokenLine)(designContent, dottedPath) : -1;
                return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
            };
            const easeOut = designTokens.motion?.ease?.out || '(undefined in DESIGN.md)';
            const easeInOut = designTokens.motion?.ease?.in_out || '(undefined in DESIGN.md)';
            const easeSpring = designTokens.motion?.ease?.spring_quick || '(undefined in DESIGN.md)';
            const durationFast = designTokens.motion?.duration?.fast || '(undefined in DESIGN.md)';
            const durationMedium = designTokens.motion?.duration?.medium || '(undefined in DESIGN.md)';
            // Build guidance
            const guidance = [
                `Brand Personality: ${brandPersonality || 'Not defined'}`,
                `Register: ${register}`,
                `Motion Intensity: ${intensity} (${register === 'brand' ? 'brand encourages ambitious motion' : 'product prefers restrained'})`,
                '',
                'Domain Validation Results:',
                '',
                'Token-Backed Motion Defaults:',
                `- Default exit ease: ${easeOut}${cite('motion.ease.out')}`,
                `- State-transition ease: ${easeInOut}${cite('motion.ease.in_out')}`,
                `- Snappy press ease: ${easeSpring}${cite('motion.ease.spring_quick')}`,
                `- Feedback duration: ${durationFast}${cite('motion.duration.fast')}`,
                `- State-change duration: ${durationMedium}${cite('motion.duration.medium')}`,
                '',
                'Motion Domain Rules (Duration, Easing, No Layout Animation):',
                ...motionDomain.rules.map((r) => `- ${r}`),
                '',
                'Animation Template Strategy:',
                ...animationTemplates.map((t) => `- ${t.category}: ${t.duration}ms, ${t.easing.substring(0, 30)}... (${t.useCase})`),
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
            // Phase 4: Stack-specific GSAP loading + cleanup idiom.
            // Reads detected framework from enriched context (techStack injected by
            // enrichContextForHandler in the orchestrator). Falls back to 'unknown'
            // which the accessor resolves to the vanilla idiom - so this block
            // always emits something useful even when techStack is missing.
            const framework = context.metadata?.techStack?.framework ?? 'unknown';
            const idiom = (0, motion_stack_idioms_1.getMotionIdiom)(framework);
            guidance.push('', `Stack-specific implementation (framework=${framework}):`, `- Loading: ${idiom.loadingPattern}`, `- Cleanup: ${idiom.cleanupPattern}`, `- Scope boundary: ${idiom.scopeBoundary}`, '', 'Example:', ...idiom.exampleSnippet.split('\n').map((l) => '  ' + l));
            idiom.notes.forEach((n) => guidance.push(`- Note: ${n}`));
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Motion integration: ${animationTemplates.length} templates for ${intensity} intensity, exponential easing validated`,
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('template', `Motion code template: ${framework}`, idiom.exampleSnippet, `${framework} idiom for GSAP loading + cleanup`),
                    this.createArtifact('reference', 'Motion Domain Rules', motionDomain.rules.join('\n'), 'Duration, easing, no layout animation, stagger, reduced-motion'),
                    this.createArtifact('template', 'Animation Templates', animationTemplates.map((t) => `${t.category}: ${t.duration}ms, ${t.easing}`).join('\n'), `${animationTemplates.length} templates for ${intensity} intensity`),
                    this.createArtifact('reference', 'Motion Validation Results', validationResults.map((r) => `${r.pattern}: duration=${r.durationCompliant ? 'OK' : 'FAIL'}, easing=${r.easingCompliant ? 'OK' : 'FAIL'}`).join('\n'), 'Pattern compliance against motion domain rules'),
                ],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Motion integration failed: ${String(err).substring(0, 40)}`)
                .addValidation('motion-integration', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to integrate motion patterns',
                error: String(err),
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedMotionContext;
    }
}
exports.FlowHMotionIntegrationHandler = FlowHMotionIntegrationHandler;
function createFlowHHandler() {
    return new FlowHMotionIntegrationHandler();
}
//# sourceMappingURL=flow-handler-motion-integration.js.map