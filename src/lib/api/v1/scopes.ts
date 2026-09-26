import {
  hasPermission,
  impliedPermission,
  PERMISSION_CATALOG,
  type Permission,
  type PermissionSubject,
} from '$lib/authorization/permissions';
import type { AccessPlacement } from '$lib/authorization/access-presentation';
import type { FlightScope } from '$lib/flight-scope';

/*
 * Scopes that are exactly a permission. Their description and placement come
 * from the permission catalog, and granting one requires holding it.
 */
const PERMISSION_SCOPES = [
  'flight.read.own',
  'flight.read.any',
  'flight.create.own',
  'flight.create.any',
  'flight.update.own',
  'flight.update.any',
  'flight.delete.own',
  'flight.delete.any',
  'flight.export.own',
  'flight.export.any',
  'flight.passengers.manage.own',
  'flight.passengers.manage.any',
  'users.directory.read',
  'roles.manage',
] as const satisfies readonly Permission[];

type CapabilityScope = {
  description: string;
  /** Permission the user must hold to grant it; null when none is needed. */
  requires: Permission | null;
  access: AccessPlacement;
};

/** Scopes with no permission of the same name. */
const CAPABILITY_SCOPES = {
  'profile.read': {
    description: 'Read the connected user profile',
    requires: null,
    access: { row: 'profile', action: 'read' },
  },
  'preferences.write': {
    description: 'Change the connected user preferences',
    requires: null,
    access: { row: 'preferences', action: 'write' },
  },
  'reference_data.read': {
    description: 'Read airport, airline, and aircraft data',
    requires: null,
    access: { row: 'reference_data', action: 'read' },
  },
  'custom_fields.read': {
    description: 'Read custom-field definitions',
    requires: null,
    access: { row: 'custom_fields', action: 'read' },
  },
  'stats.read': {
    description: 'Read flight statistics (also needs flight read access)',
    requires: 'flight.read.own',
    access: { row: 'stats', action: 'read' },
  },
  'tracks.read': {
    description: 'Read flight tracks (also needs flight read access)',
    requires: 'flight.read.own',
    access: { row: 'tracks', action: 'read' },
  },
  'tracks.write': {
    description:
      'Write and delete flight tracks (also needs flight update access)',
    requires: 'flight.update.own',
    access: { row: 'tracks', action: 'write' },
  },
  'visited_countries.read': {
    description: 'Read visited countries',
    requires: 'flight.read.own',
    access: { row: 'visited_countries', action: 'read' },
  },
  'visited_countries.write': {
    description: 'Change visited countries',
    requires: 'flight.read.own',
    access: { row: 'visited_countries', action: 'write' },
  },
  'shares.read': {
    description: 'Read public-share settings',
    requires: 'flight.share.own',
    access: { row: 'shares', action: 'read' },
  },
  'shares.write': {
    description: 'Create and change public shares',
    requires: 'flight.share.own',
    access: { row: 'shares', action: 'write' },
  },
} as const satisfies Record<string, CapabilityScope>;

export type ApiScope =
  (typeof PERMISSION_SCOPES)[number] | keyof typeof CAPABILITY_SCOPES;

type ScopeDefinition = CapabilityScope & { name: ApiScope };

const permissionDefinitions = new Map<
  string,
  (typeof PERMISSION_CATALOG)[number]
>(PERMISSION_CATALOG.map((permission) => [permission.key, permission]));

const SCOPE_DEFINITIONS: ReadonlyMap<ApiScope, ScopeDefinition> = new Map([
  ...PERMISSION_SCOPES.map((name): [ApiScope, ScopeDefinition] => {
    const permission = permissionDefinitions.get(name)!;
    return [
      name,
      {
        name,
        description: permission.description,
        requires: name,
        access: permission.access,
      },
    ];
  }),
  ...(Object.entries(CAPABILITY_SCOPES) as [ApiScope, CapabilityScope][]).map(
    ([name, definition]): [ApiScope, ScopeDefinition] => [
      name,
      { ...definition, name },
    ],
  ),
]);

export const API_SCOPES: readonly ApiScope[] = [...SCOPE_DEFINITIONS.keys()];

export const isApiScope = (value: string): value is ApiScope =>
  SCOPE_DEFINITIONS.has(value as ApiScope);

/** The known scopes in `values`, deduplicated. Unknown names are dropped. */
export const parseScopes = (values: readonly string[]): ApiScope[] => [
  ...new Set(values.filter(isApiScope)),
];

export const scopeDefinition = (scope: ApiScope) =>
  SCOPE_DEFINITIONS.get(scope)!;

export const isReadOnlyScope = (scope: ApiScope) =>
  scopeDefinition(scope).access.action === 'read';

export const MCP_DEFAULT_SCOPES = [
  'profile.read',
  'flight.read.own',
  'reference_data.read',
  'stats.read',
  'tracks.read',
  'visited_countries.read',
  'shares.read',
  'custom_fields.read',
] as const satisfies readonly ApiScope[];

export const authorizationAllowsScope = (
  authorization: PermissionSubject | null,
  scope: ApiScope,
) => {
  const permission = scopeDefinition(scope).requires;
  return permission === null || hasPermission(authorization, permission);
};

/** A credential scope covers itself and, for `.own`, is covered by `.any`. */
export const scopeSetCovers = (
  scopes: ReadonlySet<ApiScope>,
  scope: ApiScope,
) => {
  if (scopes.has(scope)) return true;
  const broader = impliedPermission(scope as Permission);
  return broader !== null && isApiScope(broader) && scopes.has(broader);
};

/**
 * The requested scopes when every one is known and grantable by `authorization`,
 * or null when any is not.
 */
export const grantableSubset = (
  authorization: PermissionSubject | null,
  requested: readonly string[],
): ApiScope[] | null => {
  const scopes = parseScopes(requested);
  if (scopes.length !== new Set(requested).size) return null;
  return scopes.every((scope) => authorizationAllowsScope(authorization, scope))
    ? scopes
    : null;
};

export type FlightScopeAction =
  'read' | 'create' | 'update' | 'delete' | 'export' | 'passengers.manage';
export type FlightScopeOwnership = 'own' | 'any';

/** `flight.<action>.<own|any>`; fails to compile if a combination is missing. */
export const flightScope = <
  const Action extends FlightScopeAction,
  const Ownership extends FlightScopeOwnership,
>(
  action: Action,
  ownership: Ownership,
): `flight.${Action}.${Ownership}` & ApiScope =>
  `flight.${action}.${ownership}` as `flight.${Action}.${Ownership}` & ApiScope;

type AssertAssignable<T extends ApiScope> = T;
type _AllFlightScopesExist =
  AssertAssignable<`flight.${FlightScopeAction}.${FlightScopeOwnership}`>;

/*
 * A flight-scope query is "own" only when it resolves to the caller's own
 * flights; `scope=user` with somebody else's id, or `scope=all`, needs `.any`.
 */
export const flightScopeOwnership = (
  scope: FlightScope,
  actorUserId: string,
): FlightScopeOwnership =>
  scope.scope === 'mine' ||
  (scope.scope === 'user' && scope.userId === actorUserId)
    ? 'own'
    : 'any';

export type GrantableScope = {
  name: ApiScope;
  description: string;
  readOnly: boolean;
};

export const grantableScopes = (
  authorization: PermissionSubject | null,
): GrantableScope[] =>
  API_SCOPES.filter((scope) =>
    authorizationAllowsScope(authorization, scope),
  ).map((scope) => ({
    name: scope,
    description: scopeDefinition(scope).description,
    readOnly: isReadOnlyScope(scope),
  }));
