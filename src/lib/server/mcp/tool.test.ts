import { describe, expect, it } from 'vitest';

import { toolResult } from './tool';

describe('toolResult', () => {
  it('passes plain objects through as structuredContent', () => {
    const value = { id: 1, name: 'ATL' };
    expect(toolResult(value).structuredContent).toEqual(value);
  });

  it('wraps arrays, since MCP structuredContent must be an object', () => {
    const value = [{ id: 1 }, { id: 2 }];
    const result = toolResult(value);
    expect(result.structuredContent).toEqual({ value });
    expect(result.content[0]?.text).toBe(JSON.stringify(value));
  });

  it('wraps primitives and null', () => {
    expect(toolResult(42).structuredContent).toEqual({ value: 42 });
    expect(toolResult(null).structuredContent).toEqual({ value: null });
  });
});
