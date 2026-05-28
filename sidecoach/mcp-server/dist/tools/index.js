"use strict";
// Re-export every tool's definition + handler. The server's index.ts loops
// over this list to register each tool with the SDK.
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
exports.TOOL_NAMES = exports.TOOLS = void 0;
const listVerbs = __importStar(require("./list-verbs"));
const listModes = __importStar(require("./list-modes"));
const listFlows = __importStar(require("./list-flows"));
const resolveKeyword = __importStar(require("./resolve-keyword"));
const validatePolish = __importStar(require("./validate-polish-standard"));
const validateExtendedDomain = __importStar(require("./validate-extended-domain"));
const validateTaste = __importStar(require("./validate-taste"));
const getCostLedger = __importStar(require("./get-cost-ledger"));
const getCheatsheet = __importStar(require("./get-cheatsheet"));
const getFlowMetadata = __importStar(require("./get-flow-metadata"));
exports.TOOLS = [
    { definition: listVerbs.definition, handler: listVerbs.handler },
    { definition: listModes.definition, handler: listModes.handler },
    { definition: listFlows.definition, handler: listFlows.handler },
    { definition: resolveKeyword.definition, handler: resolveKeyword.handler },
    { definition: validatePolish.definition, handler: validatePolish.handler },
    { definition: validateExtendedDomain.definition, handler: validateExtendedDomain.handler },
    { definition: validateTaste.definition, handler: validateTaste.handler },
    { definition: getCostLedger.definition, handler: getCostLedger.handler },
    { definition: getCheatsheet.definition, handler: getCheatsheet.handler },
    { definition: getFlowMetadata.definition, handler: getFlowMetadata.handler },
];
exports.TOOL_NAMES = exports.TOOLS.map((t) => t.definition.name);
//# sourceMappingURL=index.js.map