import type { ZodRawShape } from 'zod';
import type { Logger } from '../logger';
import type { RegistryBundle } from '../registries';
export interface ToolDependencies {
    logger: Logger;
    registries: RegistryBundle;
}
export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
    name: string;
    description: string;
    inputSchema: S;
    /** Per-tool timeout in ms. Overrides the global default. */
    timeoutMs: number;
}
export interface ToolHandlerResult {
    /** JSON-serializable payload. Wrapped into a text content block by index.ts. */
    data: unknown;
    /** Optional human-readable summary line. Surfaces as the first content block. */
    summary?: string;
}
export type ToolHandler<Input> = (input: Input, deps: ToolDependencies) => Promise<ToolHandlerResult>;
//# sourceMappingURL=types.d.ts.map