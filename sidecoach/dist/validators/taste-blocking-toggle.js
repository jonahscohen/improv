"use strict";
// sidecoach/src/validators/taste-blocking-toggle.ts
//
// Phase 3c: the GLOBAL, user-controlled MASTER TOGGLE for live taste blocking. Modeled byte-for-byte
// on the voice toggle (~/.claude/.voice-enabled): a single flag file the USER flips at any time, read
// per sidecoach invocation.
//
//   FLAG PRESENT  -> blocking is ON  -> a certified enforced mined rule BLOCKS (major severity).
//   FLAG ABSENT   -> blocking is OFF -> the SAME certified rule is ADVISORY (it warns, never blocks).
//
// DEFAULT = OFF = ADVISORY. This is the user's constraint: their normal work implements an APPROVED
// designer Figma that is the source of truth, and a machine-learned rule must NEVER block a faithful
// implementation of an approved design. With the toggle off by default they are never surprised by a
// block; they flip it ON only for greenfield / exploratory work where they want enforcement.
//
// The toggle is flipped by claude/hooks/taste-blocking-toggle.sh (UserPromptSubmit, on "taste blocking
// on/off/toggle/status") and its state is announced by claude/hooks/taste-blocking-status.sh
// (SessionStart) - exactly the voice-toggle / voice-mandate pair.
//
// SECURITY (Codex HIGH #1): TASTE_BLOCKING_FLAG_FILE is a TEST SEAM, honored ONLY when
// SIDECOACH_ENFORCE_TEST_ROOT is also set. In PRODUCTION the ONLY flag is
// ~/.claude/.taste-blocking-enabled, which ONLY the user's typed "taste blocking on" (the toggle hook)
// writes. Without this gate an agent could set TASTE_BLOCKING_FLAG_FILE=/tmp/on (after touching that
// file) and enable blocking for that invocation WITHOUT the user ever flipping the toggle. The hooks
// read the flag under the identical gate, so test and production stay consistent. (An agent directly
// writing the REAL ~/.claude flag is the accepted same-uid residual; the ENV bypass is closed here.)
//
// CAVEAT A (accepted, documented, NOT code-closable - Codex): SIDECOACH_ENFORCE_TEST_ROOT is a
// PRODUCTION-FORBIDDEN env var. The whole test-seam gating (here, in the enforce CLI, and in the
// precision harness) assumes it is NOT set in a real run. A determined agent that sets it ITSELF in
// production re-opens every seam - but that is the SAME accepted same-uid limit (an agent controlling
// its own environment is the same as an agent acting as the user), and it is NOT fenceable: an env var
// is agent-settable, and the tests legitimately set it, so a fence would break the tests. It is left
// documented, never set in production, surfaced to the user - not defended in code.
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
exports.tasteBlockingFlagPath = tasteBlockingFlagPath;
exports.tasteBlockingEnabled = tasteBlockingEnabled;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/** The flag path. TASTE_BLOCKING_FLAG_FILE is honored ONLY under a test root; else the fixed home path. */
function tasteBlockingFlagPath() {
    if (process.env.SIDECOACH_ENFORCE_TEST_ROOT && process.env.TASTE_BLOCKING_FLAG_FILE) {
        return process.env.TASTE_BLOCKING_FLAG_FILE;
    }
    return path.join(os.homedir(), '.claude', '.taste-blocking-enabled');
}
/** True iff live taste blocking is ON (the flag file exists). Default (no flag) is OFF = advisory. */
function tasteBlockingEnabled() {
    try {
        return fs.existsSync(tasteBlockingFlagPath());
    }
    catch (_e) {
        return false;
    }
}
//# sourceMappingURL=taste-blocking-toggle.js.map