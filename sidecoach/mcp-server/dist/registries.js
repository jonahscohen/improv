"use strict";
// One-shot loader for the registries the MCP server presents.
//
// Per DESIGN.md section 6, registries load ONCE at startup. We never re-read
// them per request - that would open a TOCTOU race during deploys, and
// sidecoach development is local enough that "restart to refresh" is a fair
// cost. Each load failure logs a warning and produces a `null` slot; the
// affected tool returns DOWNSTREAM_UNAVAILABLE per call, but the server
// stays alive and other tools keep working.
//
// All paths are relative to the dotfiles repo root via the resolved package
// directory. The resolution walks up from the built dist/ location, which is
// stable across `npm run build` and direct ts-node execution.
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
exports.resolveRepoRoot = resolveRepoRoot;
exports.resolveVerbsJsonPath = resolveVerbsJsonPath;
exports.resolveModesJsonPath = resolveModesJsonPath;
exports.resolveLanesJsonPath = resolveLanesJsonPath;
exports.resolveIntentJsonPath = resolveIntentJsonPath;
exports.resolveCheatsheetPath = resolveCheatsheetPath;
exports.loadVerbRegistry = loadVerbRegistry;
exports.loadModeRegistry = loadModeRegistry;
exports.loadLaneRegistry = loadLaneRegistry;
exports.loadIntentRegistry = loadIntentRegistry;
exports.loadFlowRegistry = loadFlowRegistry;
exports.getFlowById = getFlowById;
exports.loadModesViaTs = loadModesViaTs;
exports.getModeByName = getModeByName;
exports.loadCheatsheet = loadCheatsheet;
exports.loadAllRegistries = loadAllRegistries;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Imports use the parent's compiled dist/ rather than its source files.
// This decouples mcp-server's build from the parent's build state and keeps
// the mcp-server's tsconfig rootDir clean. Prerequisite: parent must be
// built (`cd sidecoach && npm run build`) before mcp-server builds.
const flows_1 = require("../../dist/flows");
const modes_1 = require("../../dist/modes");
const model_routing_1 = require("../../dist/model-routing");
const keyword_resolver_1 = require("./keyword-resolver");
// ---------------------------------------------------------------------------
// Resolved registry paths
// ---------------------------------------------------------------------------
/**
 * Resolve the dotfiles repo root from this file's location. The MCP server
 * sits two levels below the repo root regardless of whether we are running
 * compiled (dist/) or ts-node (src/).
 */
function resolveRepoRoot() {
    // __dirname is .../sidecoach/mcp-server/{src,dist}. Walk up to dotfiles root.
    return path.resolve(__dirname, '..', '..', '..');
}
function resolveVerbsJsonPath() {
    return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-verbs.json');
}
function resolveModesJsonPath() {
    return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-modes.json');
}
function resolveLanesJsonPath() {
    return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-lanes.json');
}
function resolveIntentJsonPath() {
    return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-intent.json');
}
function resolveCheatsheetPath() {
    return path.join(resolveRepoRoot(), 'claude', 'skills', 'sidecoach', 'CHEATSHEET.md');
}
function loadVerbRegistry(logger) {
    const filePath = resolveVerbsJsonPath();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.verbs)) {
            logger.warn('verbs registry shape unexpected', { path: filePath });
            return null;
        }
        const verbs = parsed.verbs
            .filter((v) => typeof v === 'object' && v !== null)
            .map((v) => ({
            verb: String(v.verb ?? ''),
            pattern: String(v.pattern ?? v.verb ?? ''),
            phase: String(v.phase ?? ''),
            description: String(v.description ?? ''),
            oneLineExplanation: String(v.oneLineExplanation ?? v.description ?? ''),
        }))
            .filter((v) => v.verb.length > 0);
        return { verbs, meta: parsed._meta };
    }
    catch (err) {
        logger.warn('failed to load verbs registry', {
            path: filePath,
            err: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
function loadModeRegistry(logger) {
    const filePath = resolveModesJsonPath();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.modes)) {
            logger.warn('modes registry shape unexpected', { path: filePath });
            return null;
        }
        const modes = parsed.modes
            .filter((m) => typeof m === 'object' && m !== null)
            .map((m) => ({
            mode: String(m.mode ?? ''),
            pattern: String(m.pattern ?? m.mode ?? ''),
            description: String(m.description ?? ''),
            oneLineExplanation: String(m.oneLineExplanation ?? m.description ?? ''),
            chain: Array.isArray(m.chain) ? m.chain.map((c) => String(c)) : [],
        }))
            .filter((m) => m.mode.length > 0);
        return { modes, meta: parsed._meta };
    }
    catch (err) {
        logger.warn('failed to load modes registry', {
            path: filePath,
            err: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
function loadLaneRegistry(logger) {
    const filePath = resolveLanesJsonPath();
    try {
        const registry = (0, keyword_resolver_1.loadRegistry)(filePath);
        return { registry, sourcePath: filePath };
    }
    catch (err) {
        logger.warn('failed to load lane registry (lane tier disabled, no fallback)', {
            path: filePath,
            err: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
// ---------------------------------------------------------------------------
// Advisory-intent registry (P4d) - sidecoach-intent.json. Used ONLY to compute
// nudge eligibility and to surface the advisory nudge text. The MCP never reads
// or mutates the cooldown state file referenced inside it (cooldown -> NUDGE/
// SILENT delivery is the Python hook's job). A missing/invalid file yields null:
// eligibility computes to false and no nudge text is attached.
// ---------------------------------------------------------------------------
function loadIntentRegistry(logger) {
    const filePath = resolveIntentJsonPath();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            logger.warn('intent registry shape unexpected', { path: filePath });
            return null;
        }
        return parsed;
    }
    catch (err) {
        logger.warn('failed to load intent registry (advisory nudge disabled)', {
            path: filePath,
            err: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
/**
 * Derive a flow's tier from its position in the registry. The flows.ts file
 * orders entries by tier with comment markers; we approximate by scanning
 * the array for tier boundaries. Best-effort - returns null if unknown.
 */
function tierForFlowId(flowId) {
    // Letter-coded flows: A-E = tier 1, F-I = tier 2, J-N = tier 3, O-Q = tier 4,
    // R-T = tier 5, U/V special, W-X = tier 6. Number-coded = legacy (treat as 0).
    const letter = flowId.match(/^flow([A-Z])_/);
    if (letter) {
        const code = letter[1].charCodeAt(0);
        if (code >= 65 && code <= 69)
            return 1; // A-E
        if (code >= 70 && code <= 73)
            return 2; // F-I
        if (code >= 74 && code <= 78)
            return 3; // J-N
        if (code >= 79 && code <= 81)
            return 4; // O-Q
        if (code >= 82 && code <= 84)
            return 5; // R-T
        if (code === 85 || code === 86)
            return 0; // U-V (special)
        if (code >= 87 && code <= 88)
            return 6; // W-X
    }
    if (/^flow\d+_/.test(flowId))
        return 0; // legacy
    return null;
}
function loadFlowRegistry(logger) {
    try {
        const summaries = flows_1.flows.map((f) => {
            const modelConfig = model_routing_1.FLOW_MODELS[f.id];
            return {
                id: f.id,
                name: f.name,
                description: f.description,
                tier: tierForFlowId(f.id),
                modelConfig: modelConfig
                    ? {
                        minTier: modelConfig.minTier,
                        preferredTier: modelConfig.preferredTier,
                        rationale: modelConfig.rationale,
                    }
                    : undefined,
            };
        });
        return summaries;
    }
    catch (err) {
        logger.warn('failed to derive flow registry', {
            err: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}
function getFlowById(flowId) {
    const f = (0, flows_1.getFlow)(flowId);
    if (!f)
        return null;
    const modelConfig = model_routing_1.FLOW_MODELS[f.id];
    return {
        id: f.id,
        name: f.name,
        description: f.description,
        triggers: f.triggers,
        tier: tierForFlowId(f.id),
        modelConfig: modelConfig
            ? {
                minTier: modelConfig.minTier,
                preferredTier: modelConfig.preferredTier,
                rationale: modelConfig.rationale,
            }
            : undefined,
    };
}
// ---------------------------------------------------------------------------
// Modes via the TS module (fallback when modes.json is missing)
// ---------------------------------------------------------------------------
function loadModesViaTs() {
    return modes_1.MODE_LIST.map((m) => ({
        mode: m.name,
        pattern: m.name,
        description: m.description,
        oneLineExplanation: m.oneLineExplanation,
        chain: m.verbChain,
    }));
}
function getModeByName(name) {
    const m = (0, modes_1.getMode)(name);
    if (!m)
        return null;
    return {
        mode: m.name,
        pattern: m.name,
        description: m.description,
        oneLineExplanation: m.oneLineExplanation,
        chain: m.verbChain,
    };
}
function loadCheatsheet(logger) {
    const filePath = resolveCheatsheetPath();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return { raw, sourcePath: filePath };
    }
    catch (err) {
        logger.warn('failed to load cheatsheet', {
            path: filePath,
            err: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
function loadAllRegistries(logger) {
    const verbs = loadVerbRegistry(logger);
    const modesFromJson = loadModeRegistry(logger);
    const flows = loadFlowRegistry(logger);
    const cheatsheet = loadCheatsheet(logger);
    const lanes = loadLaneRegistry(logger);
    const intent = loadIntentRegistry(logger);
    // Fall back to the TS modes module if the JSON file is missing - we still
    // have the TS-side source of truth available in-process.
    const modes = modesFromJson ?? {
        modes: loadModesViaTs(),
        meta: { _source: 'modes.ts fallback (modes.json unavailable)' },
    };
    logger.info('registries loaded', {
        verbCount: verbs?.verbs.length ?? 0,
        modeCount: modes.modes.length,
        flowCount: flows.length,
        cheatsheetLoaded: cheatsheet !== null,
        laneCount: lanes?.registry.lanes.length ?? 0,
        intentLoaded: intent !== null,
    });
    return { verbs, modes, flows, cheatsheet, lanes, intent };
}
//# sourceMappingURL=registries.js.map