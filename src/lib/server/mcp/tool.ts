import { ApiOperationError } from '$lib/server/api/v1/errors';

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

/*
 * Wraps a tool body so every tool maps errors the same way. Only
 * ApiOperationError messages are safe to return -- they are written for callers.
 * Anything else is a bug or a driver error whose text leaks schema internals
 * (constraint names, index names, column names), so it is logged and replaced.
 *
 * This replaces twenty-four hand-written try/catch blocks, half of which were
 * bare `catch {}` that turned genuine failures into a friendly string.
 */
export const mcpTool =
  <Input, Output>(
    fallbackMessage: string,
    run: (input: Input) => Promise<Output> | Output,
  ) =>
  async (input: Input) => {
    try {
      return toolResult(await run(input));
    } catch (error) {
      if (error instanceof ApiOperationError) return toolError(error.message);
      console.error(`[mcp] ${fallbackMessage}`, error);
      return toolError(fallbackMessage);
    }
  };
