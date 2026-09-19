import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  API_SCOPES,
  API_SCOPE_DESCRIPTIONS,
  MCP_DEFAULT_SCOPES,
  OAUTH_READONLY_SCOPES,
  UNIMPLEMENTED_SCOPES,
  authorizationAllowsScope,
  flightScope,
  flightScopeOwnership,
  grantableScopes,
  isApiScope,
  isGrantableScope,
  type ApiScope,
} from '$lib/api/v1/scopes';
import { flightInputSchema } from '$lib/api/v1/schemas';
import { pkceChallenge } from '$lib/server/oauth/server';
import { effectiveApiPermissions } from '$lib/server/api/v1/access';
import { principalHasScope, type ApiPrincipal } from './principal';
import { encodeCursor } from './flight-read';
import { parsePage } from './query';
import {
  accessPresentation,
  accessSummary,
} from '$lib/authorization/access-presentation';
import {
  PERMISSIONS,
  PERMISSION_CATALOG,
} from '$lib/authorization/permissions';

const V1_ROUTES = join(process.cwd(), 'src/routes/api/v1');

const routeFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === '+server.ts' ? [full] : [];
  });

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
  });

/*
 * Every scope the implementation actually checks, read back out of the source.
 * Literal scope names are picked up directly; `flightScope` /
 * `requireFlightScope` calls build their name from an action, and
 * `flight.<action>.${ownership}` template literals and `passengersManageScope`
 * spell an ownership, so all the variants each can produce are added. The test
 * file itself is excluded so its own assertions cannot be mistaken for code.
 */
const implementedScopes = (): Set<string> => {
  const source = [
    ...routeFiles(join(process.cwd(), 'src/routes/api/v1')),
    ...sourceFiles(join(process.cwd(), 'src/lib/server/api/v1')),
    ...sourceFiles(join(process.cwd(), 'src/lib/server/mcp')),
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  const found = new Set<string>();
  const addOwnershipVariants = (action: string) => {
    found.add(`flight.${action}.own`);
    found.add(`flight.${action}.any`);
  };

  for (const match of source.matchAll(/'([a-z][a-z_.]*)'/g))
    if (isApiScope(match[1]!)) found.add(match[1]!);
  for (const match of source.matchAll(
    /\b(?:flightScope|requireFlightScope)\(\s*[^)]*?'(\w+)'/g,
  ))
    addOwnershipVariants(match[1]!);
  for (const match of source.matchAll(/flight\.(\w+)\.\$\{/g))
    addOwnershipVariants(match[1]!);
  if (source.includes('passengersManageScope(')) {
    found.add('flight.passengers.manage.own');
    found.add('flight.passengers.manage.any');
  }
  return found;
};

const principal = (scopes: ApiScope[]): ApiPrincipal =>
  ({
    user: { id: 'u1' },
    authorization: {
      userId: 'u1',
      isOwner: true,
      roleId: null,
      roleName: null,
      roleAssignmentSource: 'local',
      permissions: new Set(),
    },
    credential: { kind: 'apiKey', keyId: 1, scopes: new Set(scopes) },
  }) as unknown as ApiPrincipal;

describe('route scope enforcement', () => {
  /*
   * The load-bearing test. Every /api/v1 handler must be built with `apiRoute`,
   * which takes its scope as a required argument -- so a route cannot ship
   * without a scope check unless someone deliberately bypasses the adapter.
   * A GET handler that skipped it is exactly what shipped before.
   */
  const files = routeFiles(V1_ROUTES);

  it('finds the v1 routes', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)('%s declares its scope via apiRoute', (file) => {
    const source = readFileSync(file, 'utf8');
    // The discovery document is deliberately public.
    if (source.includes('createApiDiscovery')) return;
    // The OpenAPI document is deliberately public.
    if (source.includes('openapi.yaml?raw')) return;

    expect(source).toContain('apiRoute(');
    expect(source).not.toContain('authenticateApiPrincipal');
    for (const handler of source.matchAll(
      /export const (GET|POST|PUT|DELETE|PATCH)\s*=\s*(\w+)/g,
    )) {
      expect(handler[2]).toBe('apiRoute');
    }
  });
});

describe('scope catalog', () => {
  it('rejects unknown scopes', () => {
    expect(isApiScope('flight.read.own')).toBe(true);
    expect(isApiScope('admin')).toBe(false);
  });

  it('describes and classifies every scope', () => {
    for (const scope of API_SCOPES) {
      expect(API_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
    }
  });

  /*
   * authorizationAllowsScope used to return true for any scope that was neither
   * a permission nor in a partial fallback table, so a newly added scope
   * silently required no permission at all. The map is total now; this pins it.
   */
  it('never allows an unknown scope by default', () => {
    const nobody = { isOwner: false, permissions: [] as never[] };
    const allowed = API_SCOPES.filter((scope) =>
      authorizationAllowsScope(nobody, scope),
    );
    expect(allowed.sort()).toEqual(
      [
        'custom_fields.read',
        'preferences.write',
        'profile.read',
        'reference_data.read',
      ].sort(),
    );
  });

  it('only offers scopes something implements', () => {
    for (const scope of UNIMPLEMENTED_SCOPES) {
      expect(isGrantableScope(scope)).toBe(false);
    }
    const offered = grantableScopes({ isOwner: true, permissions: [] });
    for (const scope of offered) {
      expect(UNIMPLEMENTED_SCOPES).not.toContain(scope.name);
    }
  });

  /*
   * The load-bearing half: the unimplemented list is now derived from what the
   * routes and services actually check. A scope offered but never checked (the
   * way `flight.share.own` was) is counted as implemented, so it must be listed
   * here; a listed scope that gets implemented must be removed. Drift either
   * way fails.
   */
  it('lists exactly the catalog scopes nothing implements', () => {
    const implemented = implementedScopes();
    for (const scope of implemented) expect(API_SCOPES).toContain(scope);
    const expected = API_SCOPES.filter((scope) => !implemented.has(scope));
    expect([...UNIMPLEMENTED_SCOPES].sort()).toEqual([...expected].sort());
  });

  it('keeps the read-only and MCP default sets grantable', () => {
    for (const scope of [...OAUTH_READONLY_SCOPES, ...MCP_DEFAULT_SCOPES]) {
      expect(isGrantableScope(scope)).toBe(true);
    }
  });
});

describe('principalHasScope', () => {
  it('treats .any as satisfying .own but not the reverse', () => {
    expect(
      principalHasScope(principal(['flight.read.any']), 'flight.read.own'),
    ).toBe(true);
    expect(
      principalHasScope(principal(['flight.read.own']), 'flight.read.any'),
    ).toBe(false);
  });

  it('does not broaden across resources', () => {
    expect(
      principalHasScope(principal(['flight.read.any']), 'flight.delete.own'),
    ).toBe(false);
    expect(principalHasScope(principal([]), 'profile.read')).toBe(false);
  });
});

describe('flight scope resolution', () => {
  it('builds the scope name for each action and ownership', () => {
    expect(flightScope('read', 'own')).toBe('flight.read.own');
    expect(flightScope('export', 'any')).toBe('flight.export.any');
  });

  /*
   * The list, export and stats endpoints each computed this independently and
   * disagreed: the export treated scope=mine as own, the others did not.
   */
  it("counts only the caller's own flights as own", () => {
    expect(flightScopeOwnership({ scope: 'mine' }, 'u1')).toBe('own');
    expect(flightScopeOwnership({ scope: 'user', userId: 'u1' }, 'u1')).toBe(
      'own',
    );
    expect(flightScopeOwnership({ scope: 'user', userId: 'u2' }, 'u1')).toBe(
      'any',
    );
    expect(flightScopeOwnership({ scope: 'all' }, 'u1')).toBe('any');
  });
});

describe('pagination', () => {
  it('round-trips a cursor', () => {
    const cursor = encodeCursor({ date: '2026-01-01', id: 42 });
    expect(parsePage('10', cursor)).toEqual({
      limit: 10,
      cursor: { date: '2026-01-01', id: 42 },
    });
  });

  it('rejects untrusted cursors', () => {
    for (const bad of ['not-base64!!', btoa('null'), btoa('{}'), btoa('[]')]) {
      expect(() => parsePage('10', bad)).toThrow();
    }
  });

  it('bounds the limit', () => {
    expect(parsePage(null, null)).toEqual({ limit: 50, cursor: null });
    expect(parsePage('1', null)).toEqual({ limit: 1, cursor: null });
    expect(parsePage('100', null)).toEqual({ limit: 100, cursor: null });
    for (const bad of ['0', '101', 'abc'])
      expect(() => parsePage(bad, null)).toThrow();
  });
});

describe('access presentation', () => {
  /*
   * accessPresentation falls back to rendering the raw key as its own group and
   * label, defaulted to write. Nothing shipped may hit that path, or the consent
   * screen shows a user `custom_fields.read` and calls it a write permission.
   * A fallback is recognisable because its group is the raw key.
   */
  it('has a real label for every scope and permission', () => {
    const keys = [
      ...API_SCOPES,
      ...PERMISSION_CATALOG.map((permission) => permission.key),
    ];
    const unlabelled = keys.filter(
      (key) => accessPresentation(key).group === key,
    );
    expect(unlabelled).toEqual([]);
  });

  it('summarises read-only and read-write grants differently', () => {
    expect(accessSummary([])).toBe('No access');
    expect(accessSummary(['flight.read.own'])).toMatch(/^Read only/);
    expect(accessSummary(['flight.delete.own'])).toMatch(/^Read and write/);
  });
});

describe('input validation', () => {
  it('requires exactly one passenger identity', () => {
    const base = {
      date: '2026-01-01',
      fromId: 1,
      toId: 2,
      passengers: [{ userId: 'user-1', guestName: null }],
    };
    expect(flightInputSchema.safeParse(base).success).toBe(true);
    expect(
      flightInputSchema.safeParse({
        ...base,
        passengers: [{ userId: null, guestName: null }],
      }).success,
    ).toBe(false);
    expect(
      flightInputSchema.safeParse({
        ...base,
        passengers: [{ userId: 'u', guestName: 'g' }],
      }).success,
    ).toBe(false);
  });
});

describe('oauth', () => {
  it('generates RFC 7636 S256 challenges', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('effective permissions', () => {
  it('reports every permission for owners and implied grants for roles', () => {
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'owner',
          isOwner: true,
          roleId: null,
          roleName: null,
          roleAssignmentSource: 'local',
          permissions: new Set(),
        },
      }),
    ).toEqual(PERMISSIONS);
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'admin',
          isOwner: false,
          roleId: 'role-admin',
          roleName: 'Admin',
          roleAssignmentSource: 'local',
          permissions: new Set(['flight.read.any']),
        },
      }),
    ).toEqual(expect.arrayContaining(['flight.read.any', 'flight.read.own']));
  });
});
