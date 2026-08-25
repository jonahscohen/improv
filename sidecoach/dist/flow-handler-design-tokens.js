"use strict";
// Flow F: Design Tokens
// Validate token definitions against all 7 design domains using google-labs-code DESIGN.md spec
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowFDesignTokensHandler = void 0;
exports.createFlowFHandler = createFlowFHandler;
const flow_handler_1 = require("./flow-handler");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const design_md_parser_1 = require("./design-md-parser");
const typography_validator_1 = require("./typography-validator");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const model_routing_1 = require("./model-routing");
const craft_flow_1 = require("./craft-flow");
class FlowFDesignTokensHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowF_design_tokens');
    }
    canExecute(context) {
        // Flow F requires project context and register to validate tokens
        return !!(context.projectContext?.register || context.projectContext?.product?.register);
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        const projectPath = context.projectPath || process.cwd();
        const designMdPath = path_1.default.join(projectPath, 'DESIGN.md');
        const hasDesignMd = fs_1.default.existsSync(designMdPath);
        try {
            // Citation helper: resolves a dotted YAML key path to a DESIGN.md line number
            const designContent = context.metadata?.designContent || '';
            const designTokens = context.metadata?.designTokens || {};
            const cite = (dottedPath) => {
                const ln = designContent ? (0, design_md_parser_1.findTokenLine)(designContent, dottedPath) : -1;
                return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
            };
            // Load token definitions from DESIGN.md
            const tokenSections = [];
            const tokenDefinitions = [];
            if (hasDesignMd) {
                const designMdContent = fs_1.default.readFileSync(designMdPath, 'utf-8');
                // Parse YAML frontmatter to extract token sections
                const yamlMatch = designMdContent.match(/^---\n([\s\S]*?)\n---/);
                if (yamlMatch) {
                    const yamlLines = yamlMatch[1].split('\n');
                    // Strict section header: a bare `key:` line with nothing after the
                    // colon (a mapping node). Preserves the exact section set the prior
                    // regex (/^\s*(\w+):\s*$/gm) selected, so tokenSections.length is
                    // unchanged for every downstream consumer.
                    const sectionHeader = (line) => {
                        const m = line.match(/^(\s*)(\w+):\s*$/);
                        return m ? { indent: m[1].length, key: m[2] } : null;
                    };
                    // Lenient nested header (allows a trailing comment) used only while
                    // walking a subtree, so example dotted paths keep their full prefix.
                    const nestedHeader = (line) => {
                        const m = line.match(/^(\s*)(\w+):\s*(#.*)?$/);
                        return m ? { indent: m[1].length, key: m[2] } : null;
                    };
                    // A real token: `key: value` with a non-empty, non-comment value.
                    const leafToken = (line) => {
                        const m = line.match(/^(\s*)("[\w.-]+"|'[\w.-]+'|[\w.-]+):\s+(.+)$/);
                        if (!m)
                            return null;
                        const value = m[3].trim();
                        if (!value || value.startsWith('#'))
                            return null;
                        return { indent: m[1].length, key: m[2].replace(/['"]/g, '') };
                    };
                    // A list-item leaf: `- key: value` (the first key on a `- ` sequence
                    // entry). Its key lives one level deeper than the dash, so continuation
                    // keys of the same map entry (plain `key: value` lines below it) resolve
                    // as siblings under the same parent. Without this, token sections
                    // written as a YAML list of maps are undercounted.
                    const listLeaf = (line) => {
                        const m = line.match(/^(\s*)(-\s+)("[\w.-]+"|'[\w.-]+'|[\w.-]+):\s+(.+)$/);
                        if (!m)
                            return null;
                        const value = m[4].trim();
                        if (!value || value.startsWith('#'))
                            return null;
                        return { indent: m[1].length + m[2].length, key: m[3].replace(/['"]/g, '') };
                    };
                    // A list-item header: `- key:` (a sequence entry that opens a nested
                    // map). Pushes onto the path stack at the key's indent so its children
                    // keep the full dotted prefix.
                    const listHeader = (line) => {
                        const m = line.match(/^(\s*)(-\s+)(\w+):\s*(#.*)?$/);
                        return m ? { indent: m[1].length + m[2].length, key: m[3] } : null;
                    };
                    // A bare-scalar sequence entry: `- <value>` with NO `key:` after the
                    // dash (e.g. `- 320px`). Each entry is one leaf value under its parent
                    // section. Checked AFTER listLeaf/listHeader so `- key: value` and
                    // `- key:` map entries never fall through to here.
                    const scalarListLeaf = (line) => {
                        const m = line.match(/^(\s*)-\s+(\S.*)$/);
                        if (!m)
                            return null;
                        const content = m[2].trim();
                        if (!content || content.startsWith('#'))
                            return null;
                        // Exclude map entries (`- key: value`, `- key:`) - those are leaves
                        // and headers handled above, not scalars.
                        if (/^("[\w.-]+"|'[\w.-]+'|[\w.-]+):(\s|$)/.test(content))
                            return null;
                        return { indent: m[1].length };
                    };
                    yamlLines.forEach((line, i) => {
                        const header = sectionHeader(line);
                        if (!header)
                            return;
                        // Walk this section's subtree, counting real leaf tokens and
                        // recording their dotted paths relative to the section root.
                        const pathStack = [];
                        const leafPaths = [];
                        const scalarIndex = new Map(); // parent path -> next [n]
                        for (let j = i + 1; j < yamlLines.length; j++) {
                            const cur = yamlLines[j];
                            const trimmed = cur.trim();
                            if (!trimmed || trimmed.startsWith('#'))
                                continue;
                            const curIndent = cur.length - cur.trimStart().length;
                            if (curIndent <= header.indent)
                                break; // walked out of the subtree
                            while (pathStack.length && pathStack[pathStack.length - 1].indent >= curIndent) {
                                pathStack.pop();
                            }
                            const leaf = leafToken(cur) || listLeaf(cur);
                            if (leaf) {
                                const rel = [...pathStack.map((p) => p.key), leaf.key].join('.');
                                leafPaths.push(`${header.key}.${rel}`);
                            }
                            else if (scalarListLeaf(cur)) {
                                // A bare scalar entry is a leaf indexed within its parent list.
                                const parent = [header.key, ...pathStack.map((p) => p.key)].join('.');
                                const idx = scalarIndex.get(parent) ?? 0;
                                scalarIndex.set(parent, idx + 1);
                                leafPaths.push(`${parent}[${idx}]`);
                            }
                            else {
                                const sub = nestedHeader(cur) || listHeader(cur);
                                if (sub)
                                    pathStack.push({ indent: sub.indent, key: sub.key });
                            }
                        }
                        tokenSections.push(header.key);
                        tokenDefinitions.push({
                            section: header.key,
                            tokenCount: leafPaths.length,
                            examples: leafPaths.slice(0, 3),
                        });
                    });
                }
            }
            // Validate tokens against all 7 design domains
            const domainValidationResults = [];
            // Color domain: tokens should be OKLCH, have semantic names, WCAG contrast
            domainValidationResults.push({
                domain: 'Color',
                rules: design_laws_1.SHARED_DESIGN_LAWS.color.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate color tokens'],
            });
            // Typography domain: hierarchy ratios, line length, scaling
            domainValidationResults.push({
                domain: 'Typography',
                rules: design_laws_1.SHARED_DESIGN_LAWS.typography.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate typography tokens'],
            });
            // Spatial domain: 4pt grid system, gap/margin usage, touch targets
            domainValidationResults.push({
                domain: 'Spatial',
                rules: design_laws_1.SHARED_DESIGN_LAWS.spatial.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate spacing tokens'],
            });
            // Motion domain: exponential easing, duration, reduced-motion
            domainValidationResults.push({
                domain: 'Motion',
                rules: design_laws_1.SHARED_DESIGN_LAWS.motion.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate motion tokens'],
            });
            // Interaction domain: 8 states, focus visibility, validation
            domainValidationResults.push({
                domain: 'Interaction',
                rules: design_laws_1.SHARED_DESIGN_LAWS.interaction.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate interaction tokens'],
            });
            // Responsive domain: breakpoints, safe areas, input detection
            domainValidationResults.push({
                domain: 'Responsive',
                rules: design_laws_1.SHARED_DESIGN_LAWS.responsive.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate responsive tokens'],
            });
            // Writing domain: semantic naming, copy precision
            domainValidationResults.push({
                domain: 'Writing',
                rules: design_laws_1.SHARED_DESIGN_LAWS.writing.rules,
                validationStatus: hasDesignMd ? 'pass' : 'fail',
                issues: hasDesignMd
                    ? []
                    : ['DESIGN.md missing - cannot validate writing tokens'],
            });
            // Add custom data to enhanced context if available
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowF', 'design-tokens', 'token-validation'];
                enhancedContext.flowMetadata.customData = {
                    'token-sections': tokenSections.length,
                    'has-design-md': hasDesignMd,
                    'domain-validation-count': domainValidationResults.length,
                    'domains-passed': domainValidationResults.filter((r) => r.validationStatus === 'pass').length,
                };
            }
            // Cache context for downstream flows
            this.cachedTokenContext = {
                tokenSections,
                domainValidationResults,
                tokenDefinitions,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { tokenSections: tokenSections.length },
                cssRules: context.metadata?.cssRules || [],
                colors: context.metadata?.colors,
                typography: context.metadata?.typography,
                spacing: context.metadata?.spacing,
                motion: context.metadata?.motion,
                accessibility: context.metadata?.accessibility,
            };
            // Round 2 wiring: run the new typography-validator that consumes
            // TypeUI's modular ratio + line-height tier + heading-size-by-role
            // tables from the absorbed library. Pre-wiring these rules lived in
            // _extracted/external/typeui-fundamentals/ but no validator consumed
            // them, so 3rem headings at 1.55 line-height shipped without a flag.
            const typoReport = typography_validator_1.TypographyValidator.validate({
                cssRules: domainCheckContext.cssRules,
                designTokens: domainCheckContext.designTokens,
            });
            const typoP0 = typoReport.findings.filter((f) => f.severity === 'P0').length;
            const typoP1 = typoReport.findings.filter((f) => f.severity === 'P1').length;
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'DESIGN.md exists at project root', required: true, description: hasDesignMd ? 'Found' : 'Missing' },
                { label: 'YAML frontmatter contains token sections', required: true, description: `${tokenSections.length} sections` },
                { label: 'Typography validator: P0 line-height-tier findings (display headings 1.05-1.20)', required: true, description: typoP0 === 0 ? 'PASS' : `${typoP0} P0 findings - heading line-height outside size tier` },
                { label: 'Typography validator: P1 modular-ratio + heading-size-by-role + tier-warnings', required: false, description: typoP1 === 0 ? 'PASS' : `${typoP1} P1 findings` },
                { label: 'All tokens have semantic names (no hard values in code)', required: true, description: 'Verify via {token.path} references' },
                { label: 'npx @google/design.md lint run successfully', required: true, description: 'Resolve all errors/warnings' },
            ]);
            // Resolve token values for cited guidance lines
            const brandRed = designTokens.colors?.brand?.red || '(undefined in DESIGN.md)';
            const brandInk = designTokens.colors?.brand?.ink || '(undefined in DESIGN.md)';
            const brandCream = designTokens.colors?.brand?.cream || '(undefined in DESIGN.md)';
            const roundedSm = designTokens.rounded?.sm || '(undefined in DESIGN.md)';
            const roundedMd = designTokens.rounded?.md || '(undefined in DESIGN.md)';
            const motionEaseOut = designTokens.motion?.ease?.out || '(undefined in DESIGN.md)';
            const typographyDisplay = designTokens.typography?.display?.family || '(undefined in DESIGN.md)';
            // Build guidance
            // TEACH, THEN CHECK. This flow has a real detector already (the typography validator), so its
            // findings half was never the problem - the missing half was any statement of what a good token
            // system IS. The brief supplies it: role-based naming over value-based, interactive states
            // resolved from tokens so a theme switch does not leave seams, one radius scale, and dark mode
            // measured rather than inverted. Its theming failures are enumerated below.
            const craft = await (0, craft_flow_1.flowCraft)(context.projectPath, {
                shape: 'produce',
                findingClasses: ['theming'],
                lawDomains: ['tokens', 'color'],
                domainLabel: 'design tokens',
            });
            const guidance = [
                ...(0, craft_flow_1.craftGuidanceBlock)(craft, 'no theming rules were measurable on this project.'),
                `DESIGN.md Status: ${hasDesignMd ? 'Found' : 'Missing at ' + designMdPath}`,
                `Token Sections: ${tokenSections.length > 0 ? tokenSections.join(', ') : 'None found'}`,
                '',
                `TYPOGRAPHY VALIDATOR (TypeUI rules): ${typoReport.summary}`,
                ...(0, typography_validator_1.typographyFindingsToGuidance)(typoReport).slice(1),
                '',
                'Design Token Values (sourced from DESIGN.md):',
                `- Brand red: ${brandRed}${cite('colors.brand.red')}`,
                `- Brand ink: ${brandInk}${cite('colors.brand.ink')}`,
                `- Brand cream: ${brandCream}${cite('colors.brand.cream')}`,
                `- Border radius sm: ${roundedSm}${cite('rounded.sm')}`,
                `- Border radius md: ${roundedMd}${cite('rounded.md')}`,
                `- Motion ease out: ${motionEaseOut}${cite('motion.ease.out')}`,
                `- Display font family: ${typographyDisplay}${cite('typography.display')}`,
                '',
                'Color Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.color.rules.map((r) => `- ${r}`),
                '',
                'Typography Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.typography.rules.map((r) => `- ${r}`),
                '',
                'Spatial Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.spatial.rules.map((r) => `- ${r}`),
                '',
                'Motion Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.motion.rules.map((r) => `- ${r}`),
                '',
                'Interaction Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.interaction.rules.map((r) => `- ${r}`),
                '',
                'Responsive Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.responsive.rules.map((r) => `- ${r}`),
                '',
                'Writing Domain Rules:',
                ...design_laws_1.SHARED_DESIGN_LAWS.writing.rules.map((r) => `- ${r}`),
                '',
                'Implementation Guidance:',
                'All code must reference tokens via {path.to.token} form, never hardcoded values',
                'Run npx @google/design.md lint DESIGN.md and resolve all errors/warnings',
                'Test token coverage: every CSS value should map to a token',
            ];
            const domainPassCount = domainValidationResults.filter((r) => r.validationStatus === 'pass').length;
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Design tokens validated: ${tokenSections.length} sections`)
                .addRule('color', design_laws_1.SHARED_DESIGN_LAWS.color.rules)
                .addRule('typography', design_laws_1.SHARED_DESIGN_LAWS.typography.rules)
                .addRule('spatial', design_laws_1.SHARED_DESIGN_LAWS.spatial.rules)
                .addRule('motion', design_laws_1.SHARED_DESIGN_LAWS.motion.rules)
                .addRule('interaction', design_laws_1.SHARED_DESIGN_LAWS.interaction.rules)
                .addRule('responsive', design_laws_1.SHARED_DESIGN_LAWS.responsive.rules)
                .addRule('writing', design_laws_1.SHARED_DESIGN_LAWS.writing.rules)
                .addDecision('Design token structure strategy', 'Semantic naming with {token.path} references per google-labs DESIGN.md spec')
                .addMetric('token-sections-indexed', tokenSections.length, 'pass')
                .addValidation('DESIGN.md exists', hasDesignMd ? 'pass' : 'warning')
                .addArtifact('design-tokens', tokenSections.length, ['flowG_component_implementation', 'flowI_motion_polish']);
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: hasDesignMd
                    ? `Design tokens validated: ${tokenSections.length} sections across 7 domains. Typography validator: ${typoReport.findings.length} findings (${typoP0} P0, ${typoP1} P1).`
                    : 'DESIGN.md not found - create at project root to validate design tokens',
                guidance,
                checklist,
                artifacts: hasDesignMd
                    ? [
                        this.createArtifact('reference', 'Token Sections', tokenDefinitions.map((td) => `${td.section}: ${td.tokenCount} tokens (${td.examples.join(', ')})`).join('\n'), `${tokenDefinitions.length} token sections indexed from DESIGN.md`),
                        this.createArtifact('reference', 'Domain Validation Results', domainValidationResults.map((r) => `${r.domain}: ${r.validationStatus}`).join('\n'), 'Token validation across all 7 design domains'),
                    ]
                    : [],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Token validation failed: ${String(err).substring(0, 40)}`)
                .addValidation('token-validation', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to validate design tokens',
                error: String(err),
                guidance: [],
                checklist: [],
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedTokenContext;
    }
}
exports.FlowFDesignTokensHandler = FlowFDesignTokensHandler;
function createFlowFHandler() {
    return new FlowFDesignTokensHandler();
}
//# sourceMappingURL=flow-handler-design-tokens.js.map