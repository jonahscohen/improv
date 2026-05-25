"use strict";
// Flow A: Brand Verification
// Entry point flow that loads PRODUCT.md + DESIGN.md, detects register, caches design laws
Object.defineProperty(exports, "__esModule", { value: true });
exports.flowAInstance = exports.FlowABrandVerifyHandler = void 0;
exports.getFlowAInstance = getFlowAInstance;
exports.createFlowAHandler = createFlowAHandler;
const flow_handler_1 = require("./flow-handler");
const project_context_1 = require("./project-context");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
function nonEmptyStringOrNull(v) {
    if (typeof v === 'string' && v.trim().length > 0)
        return v;
    return null;
}
class FlowABrandVerifyHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowA_brand_verify');
        this.contextLoader = new project_context_1.ContextLoader();
    }
    canExecute(context) {
        // Flow A always can execute - it's the foundation
        return true;
    }
    async execute(context) {
        const projectPath = context.projectPath || process.cwd();
        const enhancedContext = context;
        try {
            // Step 0: Load project context
            const projectContext = this.contextLoader.load(projectPath);
            if (!projectContext.loaded.productMd) {
                const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                    .setStatus('error')
                    .setSummary('PRODUCT.md not found - cannot verify brand register')
                    .addGate('product-md-exists', true, false, 'PRODUCT.md required at project root')
                    .build();
                return {
                    flowId: this.flowId,
                    flowName: this.getFlowName(),
                    status: 'error',
                    message: 'PRODUCT.md not found at project root',
                    error: 'PRODUCT.md is required to determine brand register and design laws',
                    guidance: [
                        'Create PRODUCT.md at project root with:',
                        '- register: "brand" or "product"',
                        '- users: Target audience description',
                        '- purpose: What this design does',
                        '- brandPersonality: Tone/voice description',
                        '- antiReferences: What NOT to look like',
                        '- strategicPrinciples: Core design principles',
                    ],
                    memory,
                };
            }
            // Step 1: Detect register
            const registerDetected = projectContext.register;
            // Step 2: Cache design laws for this register
            const designLawsCached = this.cacheDesignLawsForRegister(registerDetected);
            // Add custom data to enhanced context if available
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowA', 'brand-verification', 'foundation'];
                enhancedContext.flowMetadata.customData = {
                    register: registerDetected,
                    'design-domains-cached': designLawsCached.length,
                    'design-laws': designLawsCached,
                };
            }
            // Step 3: Pre-flight checks
            const preflightIssues = this.runPreflight(projectContext);
            // Step 4: Extract metadata
            const productMetadata = projectContext.product;
            const designMetadata = projectContext.design;
            // Update context with preflight results
            if (enhancedContext?.flowMetadata?.customData) {
                enhancedContext.flowMetadata.customData['preflight-issues'] = preflightIssues.length;
            }
            // Cache for downstream flows
            this.cachedBrandContext = {
                projectContext,
                registerDetected,
                designLawsCached,
                productMetadata,
                designMetadata,
            };
            // Build result
            const checklist = this.createChecklist([
                { label: `Register detected: ${registerDetected}`, required: true },
                { label: 'PRODUCT.md loaded', required: true, description: projectContext.loaded.productMd ? 'Loaded successfully' : 'Missing' },
                { label: 'DESIGN.md loaded', required: false, description: projectContext.loaded.designMd ? 'Loaded successfully' : 'Not required but recommended' },
                { label: `Design laws cached: ${designLawsCached.length} domains`, required: true },
                { label: 'Pre-flight checks passed', required: true, description: preflightIssues.length === 0 ? 'All checks passed' : `${preflightIssues.length} issues found` },
            ]);
            const guidance = [
                `Register: ${registerDetected === 'brand' ? 'Design IS the product (marketing, landing, campaigns)' : 'Design SERVES the product (app UI, dashboard, tool)'}`,
                `Design laws loaded for ${registerDetected} register:`,
                ...designLawsCached.map((law) => `  - ${law}`),
                '',
                'Brand metadata:',
                `  Users: ${productMetadata.users || 'Not specified'}`,
                `  Purpose: ${productMetadata.purpose || 'Not specified'}`,
                `  Personality: ${nonEmptyStringOrNull(productMetadata.brandPersonality) || nonEmptyStringOrNull(productMetadata.brand_personality) || 'Not specified'}`,
                '',
                ...(preflightIssues.length > 0 ? ['Pre-flight warnings:'] : []),
                ...preflightIssues,
                '',
                'Next flows:',
                '  - Flow B: Component Research (if designing components)',
                '  - Flow C: Font Research (if refining typography)',
                '  - Flow D: Design References (if gathering inspiration)',
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Brand register ${registerDetected} verified. ${designLawsCached.length} design domains cached.`)
                .addDecision(`Selected ${registerDetected} register`, `${registerDetected === 'brand' ? 'Design IS the product' : 'Design SERVES the product'}`)
                .addMetric('design-domains-cached', designLawsCached.length, 'pass', 7)
                .addValidation('PRODUCT.md exists', 'pass')
                .addValidation('Pre-flight checks', preflightIssues.length === 0 ? 'pass' : 'warning')
                .addGate('product-md-exists', true, true)
                .addGate('design-laws-cached', true, true)
                .addGate('brand-verified', true, true);
            // Add rules for each design domain
            for (const [domainKey, domain] of Object.entries(design_laws_1.SHARED_DESIGN_LAWS)) {
                memoryBuilder.addRule(domainKey, [`${domain.rules.length} rules`]);
            }
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Brand register detected: ${registerDetected}. Design laws cached. Ready for downstream flows.`,
                guidance,
                checklist,
                artifacts: preflightIssues.length > 0 ? [] : [],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Exception: ${String(err).substring(0, 50)}`)
                .addValidation('project-context-load', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to load project context',
                error: String(err),
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedBrandContext;
    }
    cacheDesignLawsForRegister(register) {
        const laws = [];
        // Add shared domain laws for all registers
        for (const [domainKey, domain] of Object.entries(design_laws_1.SHARED_DESIGN_LAWS)) {
            laws.push(`${domain.domain} (${domain.rules.length} rules)`);
        }
        // Add register-specific context (null-safe: register may be undefined when called
        // from the orchestrator's prerequisite-chain path before context enrichment).
        const registerLaws = design_laws_1.REGISTER_SPECIFIC_LAWS[register];
        if (registerLaws) {
            laws.push(`Register-specific: ${registerLaws.description}`);
        }
        else {
            laws.push('Register-specific: (register not yet detected - run PRODUCT.md detection first)');
        }
        return laws;
    }
    runPreflight(projectContext) {
        const issues = [];
        // Check for DESIGN.md
        if (!projectContext.loaded.designMd) {
            issues.push('⚠️  DESIGN.md not found - run /sidecoach document or create manually for full design system support');
        }
        // Check for anti-references in PRODUCT.md
        if (!projectContext.product.anti_references && !projectContext.product.antiReferences) {
            issues.push('⚠️  Anti-references not defined in PRODUCT.md - add what designs to avoid for better category-reflex detection');
        }
        // Check for strategic principles
        if (!projectContext.product.strategic_principles && !projectContext.product.strategicPrinciples) {
            issues.push('⚠️  Strategic principles not defined - these guide design law application');
        }
        // Check for brand personality
        if (!nonEmptyStringOrNull(projectContext.product.brandPersonality) && !nonEmptyStringOrNull(projectContext.product.brand_personality)) {
            issues.push('⚠️  Brand personality not defined - tone/voice affects typography and color choices');
        }
        // Check for clear users definition
        if (!projectContext.product.users) {
            issues.push('⚠️  Users not defined clearly - this affects register detection accuracy');
        }
        return issues;
    }
}
exports.FlowABrandVerifyHandler = FlowABrandVerifyHandler;
// Export singleton instance for use by orchestrator
exports.flowAInstance = null;
function getFlowAInstance() {
    if (!exports.flowAInstance) {
        exports.flowAInstance = new FlowABrandVerifyHandler();
    }
    return exports.flowAInstance;
}
function createFlowAHandler() {
    return new FlowABrandVerifyHandler();
}
//# sourceMappingURL=flow-handler-brand-verify.js.map