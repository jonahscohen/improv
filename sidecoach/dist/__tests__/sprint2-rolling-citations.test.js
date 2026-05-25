"use strict";
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
const flow_handler_typography_excellence_1 = require("../flow-handler-typography-excellence");
const flow_handler_component_implementation_1 = require("../flow-handler-component-implementation");
const flow_handler_motion_integration_1 = require("../flow-handler-motion-integration");
const design_md_parser_1 = require("../design-md-parser");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const designPath = path.resolve(__dirname, '../../../reference/DESIGN.md');
    const designContent = fs.readFileSync(designPath, 'utf8');
    const designTokens = (0, design_md_parser_1.parseDesignMd)(designContent);
    const baseCtx = {
        utterance: 'check tokens',
        projectContext: { register: 'brand', product: {}, design: {} },
        metadata: { designContent, designTokens },
    };
    const citationRegex = /Source: DESIGN\.md L\d+/;
    const tHandler = new flow_handler_typography_excellence_1.FlowSTypographyExcellenceHandler();
    const tResult = await tHandler.execute(baseCtx);
    const tCitations = (tResult.guidance || []).filter((l) => citationRegex.test(l));
    assertTrue(tCitations.length >= 3, `typography handler: at least 3 citations (got ${tCitations.length})`);
    const gHandler = new flow_handler_component_implementation_1.FlowGComponentImplementationHandler();
    const gResult = await gHandler.execute(baseCtx);
    const gCitations = (gResult.guidance || []).filter((l) => citationRegex.test(l));
    assertTrue(gCitations.length >= 3, `component-implementation handler: at least 3 citations (got ${gCitations.length})`);
    const hHandler = new flow_handler_motion_integration_1.FlowHMotionIntegrationHandler();
    const hResult = await hHandler.execute(baseCtx);
    const hCitations = (hResult.guidance || []).filter((l) => citationRegex.test(l));
    assertTrue(hCitations.length >= 3, `motion-integration handler: at least 3 citations (got ${hCitations.length})`);
    console.log(`rolling citations PASS: typography=${tCitations.length}, component=${gCitations.length}, motion=${hCitations.length}`);
})();
//# sourceMappingURL=sprint2-rolling-citations.test.js.map