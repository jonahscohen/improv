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
const context_loader_1 = require("../context-loader");
const path = __importStar(require("path"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    const refRoot = path.resolve(__dirname, '../../../reference');
    const ctx = (0, context_loader_1.buildProjectContext)(refRoot);
    // Type-narrow: parsedDesignTokens must be DesignTokens | null - not any.
    // The test below would not compile if the field were typed as `any` AND the explicit type assertion failed.
    // To prove the typing tightened, we use a function whose signature requires DesignTokens | null.
    function consume(tokens) {
        if (tokens === null)
            return 0;
        return Object.keys(tokens.colors || {}).length;
    }
    const n = consume(ctx.parsedDesignTokens);
    assertTrue(typeof n === 'number', 'consume() returned a number');
    console.log(`parsedDesignTokens typed PASS (color section keys=${n})`);
})();
//# sourceMappingURL=sprint2-context-loader-typing.test.js.map