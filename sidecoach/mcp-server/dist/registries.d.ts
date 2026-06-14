import type { Logger } from './logger';
/**
 * Resolve the dotfiles repo root from this file's location. The MCP server
 * sits two levels below the repo root regardless of whether we are running
 * compiled (dist/) or ts-node (src/).
 */
export declare function resolveRepoRoot(): string;
export declare function resolveVerbsJsonPath(): string;
export declare function resolveModesJsonPath(): string;
export declare function resolveLanesJsonPath(): string;
export declare function resolveIntentJsonPath(): string;
export declare function resolveCheatsheetPath(): string;
export interface VerbEntry {
    verb: string;
    pattern: string;
    phase: string;
    description: string;
    oneLineExplanation: string;
}
export interface VerbRegistry {
    verbs: VerbEntry[];
    meta?: Record<string, unknown>;
}
export declare function loadVerbRegistry(logger: Logger): VerbRegistry | null;
export interface ModeEntry {
    mode: string;
    pattern: string;
    description: string;
    oneLineExplanation: string;
    chain: string[];
}
export interface ModeRegistry {
    modes: ModeEntry[];
    meta?: Record<string, unknown>;
}
export declare function loadModeRegistry(logger: Logger): ModeRegistry | null;
export interface LaneRegistryBundle {
    registry: any;
    sourcePath: string;
}
export declare function loadLaneRegistry(logger: Logger): LaneRegistryBundle | null;
export declare function loadIntentRegistry(logger: Logger): any | null;
export interface FlowSummary {
    id: string;
    name: string;
    description: string;
    tier: number | null;
    modelConfig?: {
        minTier: string;
        preferredTier: string;
        rationale: string;
    };
}
export declare function loadFlowRegistry(logger: Logger): FlowSummary[];
export declare function getFlowById(flowId: string): {
    id: string;
    name: string;
    description: string;
    triggers: any;
    modelConfig?: {
        minTier: string;
        preferredTier: string;
        rationale: string;
    };
    tier: number | null;
} | null;
export declare function loadModesViaTs(): ModeEntry[];
export declare function getModeByName(name: string): ModeEntry | null;
export interface CheatsheetContent {
    raw: string;
    sourcePath: string;
}
export declare function loadCheatsheet(logger: Logger): CheatsheetContent | null;
export interface RegistryBundle {
    verbs: VerbRegistry | null;
    modes: ModeRegistry | null;
    flows: FlowSummary[];
    cheatsheet: CheatsheetContent | null;
    lanes: LaneRegistryBundle | null;
    intent: any | null;
}
export declare function loadAllRegistries(logger: Logger): RegistryBundle;
//# sourceMappingURL=registries.d.ts.map