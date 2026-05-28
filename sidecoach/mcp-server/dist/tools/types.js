"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map