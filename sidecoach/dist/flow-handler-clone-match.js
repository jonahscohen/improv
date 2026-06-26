"use strict";
// Flow O: Clone Match
// Pixel-perfect comparison vs design, side-by-side verification
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowOCloneMatchHandler = void 0;
exports.createFlowOHandler = createFlowOHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const icon_source_reference_1 = require("./icon-source-reference");
class FlowOCloneMatchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowO_clone_match_special');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        try {
            const checklist = this.createChecklist([
                { label: 'Design screenshot at same viewport size', required: true },
                { label: 'Implementation screenshot at same viewport size', required: true },
                { label: 'Side-by-side comparison setup', required: true },
                { label: 'Typography match (font, size, weight, line-height, letter-spacing)', required: true },
                { label: 'Color match (hex match or token reference)', required: true },
                { label: 'Spacing match (padding, margins, gap - measure with tools)', required: true },
                { label: 'Border radius match (concentric radius pattern)', required: true },
                { label: 'Shadow match (blur, offset, color, opacity)', required: true },
                { label: 'Element positioning (alignment, overlap, float)', required: true },
                { label: 'Interactive states match (hover, active, focus, disabled)', required: false },
            ]);
            const guidance = [
                'Clone Match verifies pixel-perfect alignment between design and implementation.',
                '',
                'SETUP:',
                '- Design screenshot at exact viewport (e.g., 1024px)',
                '- Implementation screenshot at same viewport',
                '- Open both in split-screen or overlay tool',
                '',
                'TYPOGRAPHY:',
                '- Font family (exact typeface)',
                '- Font size (rem or px)',
                '- Font weight (100-900 or named)',
                '- Line height (relative or px)',
                '- Letter spacing (if visible)',
                '',
                'COLORS:',
                '- Hex match or verified token',
                '- Include opacity if present',
                '- Check against design DESIGN.md tokens',
                '',
                'SPACING:',
                '- Padding (measure from edge to content)',
                '- Margins (measure between elements)',
                '- Gap (in flexbox/grid containers)',
                '- Line spacing in text blocks',
                '',
                'SHAPES:',
                '- Border radius (check concentric pattern)',
                '- Borders (width, color, style)',
                '- Shadows (blur, x-offset, y-offset, color, opacity)',
                '',
                'LAYOUT:',
                '- Element positioning and alignment',
                '- Text baseline alignment',
                '- Icon centering (optical vs geometric)',
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Clone match: pixel-perfect comparison - typography, colors, spacing, shapes, layout verified')
                .addRule('typography', ['font family', 'size', 'weight', 'line-height', 'letter-spacing'])
                .addRule('spacing', ['padding measured', 'margins measured', 'gap verified'])
                .addRule('shapes', ['border radius', 'border style', 'shadow blur', 'shadow offset', 'shadow color', 'shadow opacity'])
                .addRule('layout', ['element positioning', 'alignment', 'baseline', 'optical centering'])
                .addDecision('Clone strategy', 'Side-by-side viewport-matched comparison with pixel-level verification')
                .addArtifact('clone', 5);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Clone Match workflow initialized - pixel-perfect comparison',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'icon-source', (0, icon_source_reference_1.buildIconSourceArtifactContent)((0, icon_source_reference_1.createIconSourceReference)()), '8 approved icon libraries with selection protocol and provenance markers (taste/fabricated-svg gate enforcement)'),
                    this.createArtifact('reference', 'Clone Verification Checklist', 'Typography (5) → Colors (1) → Spacing (4) → Shapes (3) → Layout (4) = 17-point verification', 'Pixel-perfect alignment checklist'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Clone match failed: ${String(err).substring(0, 40)}`)
                .addValidation('clone-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize clone match',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowOCloneMatchHandler = FlowOCloneMatchHandler;
function createFlowOHandler() {
    return new FlowOCloneMatchHandler();
}
//# sourceMappingURL=flow-handler-clone-match.js.map