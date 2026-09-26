import { describe, expect, it } from 'vitest';

import {
  parseFlightScopeSearchParams,
  resolveFlightScope,
} from './flight-scope';

describe('flight scope', () => {
  it('requires a user for user scope', () => {
    expect(
      parseFlightScopeSearchParams(new URLSearchParams({ scope: 'user' })),
    ).toEqual({ success: false, reason: 'missing_user' });
  });

  it('rejects unknown scopes', () => {
    expect(
      parseFlightScopeSearchParams(new URLSearchParams({ scope: 'team' })),
    ).toEqual({ success: false, reason: 'invalid_scope' });
  });

  it('resolves mine without changing explicit scopes', () => {
    expect(resolveFlightScope({ scope: 'mine' }, 'actor')).toEqual({
      scope: 'user',
      userId: 'actor',
    });
    expect(resolveFlightScope({ scope: 'all' }, 'actor')).toEqual({
      scope: 'all',
    });
  });
});
