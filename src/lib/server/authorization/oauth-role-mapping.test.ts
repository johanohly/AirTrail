import { describe, expect, it } from 'vitest';

import {
  evaluateOAuthRoleMappings,
  readJsonPointer,
  oauthAssignmentRoleIds,
  selectOAuthMappedRole,
} from './oauth-role-mapping';
import {
  oauthRoleMappingSchema,
  type OAuthRoleMappingInput,
} from '$lib/zod/oauth-role-mapping';

const mapping = (
  overrides: Partial<OAuthRoleMappingInput> = {},
): OAuthRoleMappingInput => ({
  name: '',
  enabled: true,
  claimSource: 'userinfo',
  claimPath: '/groups',
  operator: 'contains',
  claimValue: 'airtrail-users',
  roleId: 'role-user',
  ...overrides,
});

describe('OAuth role mapping', () => {
  it('defaults legacy rules to enabled and unnamed', () => {
    expect(
      oauthRoleMappingSchema.parse({
        claimSource: 'userinfo',
        claimPath: '/groups',
        operator: 'contains',
        claimValue: 'airtrail-users',
        roleId: 'role-user',
      }),
    ).toMatchObject({ name: '', enabled: true });
  });

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

  it('skips disabled rules and reports the matching rule', () => {
    expect(
      evaluateOAuthRoleMappings({
        mappings: [
          mapping({ enabled: false, roleId: 'role-disabled' }),
          mapping({ roleId: 'role-active' }),
        ],
        userinfo: { groups: ['airtrail-users'] },
        idToken: {},
        defaultRoleId: 'role-default',
      }),
    ).toEqual({ kind: 'matched', roleId: 'role-active', ruleIndex: 1 });
  });

  it('reports the fallback role when no enabled rule matches', () => {
    expect(
      evaluateOAuthRoleMappings({
        mappings: [mapping({ enabled: false })],
        userinfo: { groups: ['airtrail-users'] },
        idToken: {},
        defaultRoleId: 'role-default',
      }),
    ).toEqual({ kind: 'fallback', roleId: 'role-default' });
  });

  it('does not match missing or null claims by string coercion', () => {
    for (const claimValue of ['undefined', 'null']) {
      const rule = mapping({
        claimPath: '/department',
        operator: 'equals',
        claimValue,
        roleId: 'role-privileged',
      });
      expect(selectOAuthMappedRole([rule], {}, {})).toBeUndefined();
      expect(
        selectOAuthMappedRole([rule], { department: null }, {}),
      ).toBeUndefined();
    }
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
