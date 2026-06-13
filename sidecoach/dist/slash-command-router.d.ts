import { FlowId } from './types';
export interface CommandMatch {
    isCommand: boolean;
    command?: string;
    flowIds: FlowId[];
    target?: string;
    reason: string;
}
export declare function parseSlashCommand(utterance: string): CommandMatch;
export interface CommandInfo {
    description: string;
    flows: string[];
    phase: 'Research' | 'Implement' | 'Review' | 'Special';
}
export interface CommandsByPhase {
    [phase: string]: {
        commands: Array<{
            command: string;
            description: string;
            flowCount: number;
        }>;
    };
}
export declare function getAvailableCommands(): Record<string, CommandInfo>;
/**
 * Sprint 8 T8: returns CommandInfo for all 22 verb commands from the
 * registry, so the list-handler can show both phase commands and verbs in a
 * single grouped output.
 */
export declare function getVerbCommandInfo(): Record<string, CommandInfo>;
export declare function getCommandsByPhase(): CommandsByPhase;
export interface PhraseResolution {
    kind: 'ROUTE' | 'CLASSIFY' | 'OUT_OF_SCOPE' | 'UNKNOWN';
    command?: string;
    lane?: string;
    suggestion?: string;
    redirect?: string;
}
export declare function resolveSidecoachPhrase(phrase: string, lanesPath: string): PhraseResolution;
export interface SidecoachInputResolution {
    source: 'command' | 'phrase' | 'not-addressed';
    command?: CommandMatch;
    phrase?: PhraseResolution;
}
export declare function resolveSidecoachInput(utterance: string, lanesPath: string): SidecoachInputResolution;
//# sourceMappingURL=slash-command-router.d.ts.map