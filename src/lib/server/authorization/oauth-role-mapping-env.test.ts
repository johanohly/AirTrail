import { describe, expect, it } from 'vitest';

import { evaluateOAuthRoleMappings } from './oauth-role-mapping';
import { parseOAuthRoleMappingEnv } from './oauth-role-mapping-env';

const ROLES = [
  { id: 'role-administrator', name: 'Administrator' },
  { id: 'role-user', name: 'User' },
  { id: 'custom-1', name: 'Editor' },
];

const parse = (vars: { mode?: string; claim?: string; mappings?: string }) =>
  parseOAuthRoleMappingEnv(vars, ROLES);

describe('OAuth role mapping env', () => {
  it('is not configured when every variable is unset or blank', () => {
    expect(parse({})).toBeNull();
    expect(parse({ mode: ' ', claim: '', mappings: ' , ' })).toBeNull();
  });

  it('resolves roles by id or exact name in priority order', () => {
    expect(
      parse({
        mode: 'on_login',
        claim: 'groups',
        mappings: 'airtrail-admins=Administrator,editors=custom-1',
      }),
    ).toEqual({
      mode: 'on_login',
      mappings: [
        {
          name: '',
          enabled: true,
          claimSource: 'userinfo',
          claimPath: '/groups',
          operator: 'contains',
          claimValue: 'airtrail-admins',
          roleId: 'role-administrator',
        },
        expect.objectContaining({ claimValue: 'editors', roleId: 'custom-1' }),
      ],
    });
  });

  it('trims whitespace and skips empty entries', () => {
    const settings = parse({
      mode: ' on_create ',
      claim: ' /realm_access/roles ',
      mappings: ' admins = Administrator , , users=User, ',
    });
    expect(settings?.mode).toBe('on_create');
    expect(settings?.mappings).toMatchObject([
      { claimPath: '/realm_access/roles', claimValue: 'admins' },
      { claimValue: 'users', roleId: 'role-user' },
    ]);
  });

  it('keeps an equals sign inside the claim value', () => {
    expect(
      parse({ mode: 'on_login', claim: 'groups', mappings: 'cn=admins=User' })
        ?.mappings?.[0],
    ).toMatchObject({ claimValue: 'cn=admins', roleId: 'role-user' });
  });

  it('keeps the saved rules when only the off mode is set', () => {
    expect(parse({ mode: 'off' })).toEqual({ mode: 'off', mappings: null });
  });

  it('requires rules for an active mode', () => {
    expect(() => parse({ mode: 'on_login' })).toThrow(
      /required unless OAUTH_ROLE_MAPPING_MODE is off/,
    );
  });

  it('rejects an unknown or missing mode', () => {
    expect(() => parse({ mode: 'always' })).toThrow(/OAUTH_ROLE_MAPPING_MODE/);
    expect(() => parse({ mode: 'ON_LOGIN' })).toThrow(
      /OAUTH_ROLE_MAPPING_MODE/,
    );
    expect(() =>
      parse({ claim: 'groups', mappings: 'admins=Administrator' }),
    ).toThrow(/OAUTH_ROLE_MAPPING_MODE/);
  });

  it('rejects an unknown role and lists the available ones', () => {
    expect(() =>
      parse({ mode: 'on_login', claim: 'groups', mappings: 'admins=Admin' }),
    ).toThrow('unknown role "Admin". Available roles: Administrator, User');
    expect(() =>
      parse({ mode: 'on_login', claim: 'groups', mappings: 'x=administrator' }),
    ).toThrow(/unknown role/);
  });

  it.each(['admins', 'admins=', '=Administrator', ' = '])(
    'rejects the malformed entry "%s"',
    (mappings) => {
      expect(() =>
        parse({ mode: 'on_login', claim: 'groups', mappings }),
      ).toThrow(/must look like claimValue=Role/);
    },
  );

  it('requires the claim and the mappings together', () => {
    expect(() => parse({ mode: 'off', claim: 'groups' })).toThrow(
      /must be set together/,
    );
    expect(() =>
      parse({ mode: 'on_login', mappings: 'admins=Administrator' }),
    ).toThrow(/must be set together/);
  });

  it('matches both a groups array and a plain string claim', () => {
    const mappings = parse({
      mode: 'on_login',
      claim: 'groups',
      mappings: 'airtrail-admins=Administrator,airtrail-users=User',
    })!.mappings!;
    const roleFor = (groups: unknown) =>
      evaluateOAuthRoleMappings({
        mappings,
        userinfo: { groups },
        idToken: {},
        defaultRoleId: 'role-user',
      });

    expect(roleFor(['staff', 'airtrail-admins'])).toMatchObject({
      kind: 'matched',
      roleId: 'role-administrator',
    });
    expect(roleFor('airtrail-users')).toMatchObject({
      kind: 'matched',
      roleId: 'role-user',
      ruleIndex: 1,
    });
    expect(roleFor(['staff'])).toEqual({
      kind: 'fallback',
      roleId: 'role-user',
    });
  });
});
