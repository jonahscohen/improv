// Shared types for tool handlers.
//
// Each tool exports two things:
//   - definition: name + description + input shape (registered with the SDK)
//   - handler   : pure async function that takes validated input + deps and
//                 returns the raw payload (NOT the MCP CallToolResult wrapper).
//
// The uniform error guard in index.ts wraps the handler in:
//   - input validation (Zod)
//   - timeout race
//   - try/catch -> ToolError on throw
//   - CallToolResult shaping (content blocks + isError)
//
// Keeping handlers pure makes them trivially unit-testable without spinning
// up the SDK or stdio transport.

import type { ZodRawShape } from 'zod';

import type { Logger } from '../logger';
import type { RegistryBundle } from '../registries';

export interface ToolDependencies {
  logger: Logger;
  registries: RegistryBundle;
  /** Per-call response-deadline signal. Fires on tool timeout or server shutdown. */
  signal: AbortSignal;
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

export type ToolHandler<Input> = (
  input: Input,
  deps: ToolDependencies,
) => Promise<ToolHandlerResult>;
