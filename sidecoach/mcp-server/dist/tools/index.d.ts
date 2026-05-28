import type { ToolDefinition, ToolHandler } from './types';
export interface RegisteredTool {
    definition: ToolDefinition<any>;
    handler: ToolHandler<any>;
}
export declare const TOOLS: RegisteredTool[];
export declare const TOOL_NAMES: string[];
//# sourceMappingURL=index.d.ts.map