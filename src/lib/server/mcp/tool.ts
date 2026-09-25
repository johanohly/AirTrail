import type {
  McpServer,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  AnySchema,
  SchemaOutput,
  ShapeOutput,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

import { API_OPERATIONS, type McpOperationId } from '$lib/api/v1/operations';
import { requireOperation } from '$lib/server/api/v1/access';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { asApiOperationError } from '$lib/server/api/v1/response';

export const toolResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: (typeof value === 'object' && value !== null
    ? value
    : { value }) as Record<string, unknown>,
});

export const toolError = (message: string) => ({
  isError: true,
  content: [{ type: 'text' as const, text: message }],
});

type ToolInput<Args> = Args extends ZodRawShapeCompat
  ? ShapeOutput<Args>
  : SchemaOutput<Args>;

/*
 * Registers the MCP tool for a registry operation: its name and required
 * scopes come from API_OPERATIONS, the same entry the REST route uses. Only
 * errors written for callers are returned; anything else can leak schema
 * internals, so it is logged and replaced by `fallbackMessage`.
 */
export const operationTools =
  (server: McpServer, principal: ApiPrincipal) =>
  <Args extends ZodRawShapeCompat | AnySchema>(
    operation: McpOperationId,
    config: {
      description: string;
      inputSchema: Args;
      annotations?: ToolAnnotations;
    },
    fallbackMessage: string,
    run: (input: ToolInput<Args>) => unknown,
  ) => {
    const handler = async (input: ToolInput<Args>) => {
      try {
        requireOperation(principal, operation);
        return toolResult(await run(input));
      } catch (error) {
        const known = asApiOperationError(error);
        if (known) return toolError(known.message);
        console.error(`[mcp] ${fallbackMessage}`, error);
        return toolError(fallbackMessage);
      }
    };
    server.registerTool(
      API_OPERATIONS[operation].mcpTool,
      config,
      // ToolCallback<Args> is ToolInput<Args> spelled as a conditional type TS
      // cannot resolve for a generic Args.
      handler as unknown as ToolCallback<Args>,
    );
  };
