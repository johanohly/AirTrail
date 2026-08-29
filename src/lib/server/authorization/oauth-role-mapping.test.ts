import { describe, expect, it } from 'vitest';

import {
  readJsonPointer,
  oauthAssignmentRoleIds,
  selectOAuthMappedRole,
} from './oauth-role-mapping';
import type { OAuthRoleMappingInput } from '$lib/zod/oauth-role-mapping';

const mapping = (
  overrides: Partial<OAuthRoleMappingInput> = {},
): OAuthRoleMappingInput => ({
  claimSource: 'userinfo',
  claimPath: '/groups',
  operator: 'contains',
  claimValue: 'airtrail-users',
  roleId: 'role-user',
  ...overrides,
});

describe('OAuth role mapping', () => {
  it('reads RFC 6901 escaped paths', () => {
    expect(
      readJsonPointer({ 'a/b': { '~name': 'value' } }, '/a~1b/~0name'),
    ).toBe('value');
  });

  it('uses the first matching rule', () => {
    expect(
      selectOAuthMappedRole(
        [mapping(), mapping({ roleId: 'role-second' })],
        { groups: ['airtrail-users'] },
        {},
      ),
    ).toBe('role-user');
  });

  it('supports ID-token claims and case-sensitive matching', () => {
    const rule = mapping({
      claimSource: 'id_token',
      claimPath: '/department',
      operator: 'equals',
      claimValue: 'Operations',
      roleId: 'role-ops',
    });
    expect(
      selectOAuthMappedRole([rule], {}, { department: 'Operations' }),
    ).toBe('role-ops');
    expect(
      selectOAuthMappedRole([rule], {}, { department: 'operations' }),
    ).toBeUndefined();
  });

  it('validates the fallback role with every explicit mapping role', () => {
    expect(
      oauthAssignmentRoleIds('role-default', [
        mapping({ roleId: 'role-ops' }),
        mapping({ roleId: 'role-default' }),
      ]),
    ).toEqual(['role-default', 'role-ops']);
  });
});
