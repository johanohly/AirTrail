import {
  hasPermission,
  type Permission,
  type PermissionSubject,
} from '$lib/authorization/permissions';
import type { FlightScope } from '$lib/flight-scope';

export const API_SCOPES = [
  'profile.read',
  'preferences.write',
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
  'users.create',
  'users.update',
  'users.delete',
  'users.roles.assign',
  'data.airports.manage',
  'data.airlines.manage',
  'data.aircraft.manage',
  'custom_fields.read',
  'custom_fields.manage',
  'roles.manage',
  'reference_data.read',
  'stats.read',
  'tracks.read',
  'tracks.write',
  'visited_countries.read',
  'visited_countries.write',
  'shares.read',
  'shares.write',
  'weather.read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

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

export const OAUTH_READONLY_SCOPES = [
  'profile.read',
  'flight.read.own',
  'flight.read.any',
  'flight.export.own',
  'flight.export.any',
  'users.directory.read',
  'reference_data.read',
  'stats.read',
  'tracks.read',
  'visited_countries.read',
  'shares.read',
  'custom_fields.read',
] as const satisfies readonly ApiScope[];

const apiScopeSet: ReadonlySet<string> = new Set(API_SCOPES);

export const isApiScope = (value: string): value is ApiScope =>
  apiScopeSet.has(value);

export const API_SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'profile.read': 'Read the connected user profile',
  'preferences.write': 'Change the connected user preferences',
  'flight.read.own': 'Read flights where the user is a passenger',
  'flight.read.any': "Read any user's flights",
  'flight.create.own': 'Create flights that include the user',
  'flight.create.any': 'Create flights for any users',
  'flight.update.own': 'Update flights where the user is a passenger',
  'flight.update.any': "Update any user's flights",
  'flight.delete.own': 'Delete flights where the user is a passenger',
  'flight.delete.any': "Delete any user's flights",
  'flight.export.own': 'Export flights where the user is a passenger',
  'flight.export.any': "Export any user's flights",
  'flight.passengers.manage.own': 'Manage passengers on own flights',
  'flight.passengers.manage.any': 'Manage passengers on any flight',
  'users.directory.read': 'Read the user directory',
  'users.create': 'Create user accounts',
  'users.update': 'Update manageable user accounts',
  'users.delete': 'Delete manageable user accounts',
  'users.roles.assign': 'Assign manageable roles to users',
  'data.airports.manage': 'Manage airports',
  'data.airlines.manage': 'Manage airlines',
  'data.aircraft.manage': 'Manage aircraft',
  'custom_fields.read': 'Read custom-field definitions',
  'custom_fields.manage': 'Manage custom-field definitions',
  'roles.manage': 'Manage access roles',
  'reference_data.read': 'Read airport, airline, and aircraft data',
  'stats.read': 'Read flight statistics (also needs flight read access)',
  'tracks.read': 'Read flight tracks (also needs flight read access)',
  'tracks.write':
    'Write and delete flight tracks (also needs flight update access)',
  'visited_countries.read': 'Read visited countries',
  'visited_countries.write': 'Change visited countries',
  'shares.read': 'Read public-share settings',
  'shares.write': 'Create and change public shares',
  'weather.read': 'Read weather for visible airports',
};

/*
 * Every scope maps to the permission a user must hold before they can grant it,
 * or to `null` when holding the credential is sufficient on its own. This is a
 * total `Record`, not a `Partial`: adding a scope without classifying it here is
 * a compile error rather than a silent grant.
 */
const scopePermissions: Record<ApiScope, Permission | null> = {
  'profile.read': null,
  'preferences.write': null,
  'reference_data.read': null,
  'flight.read.own': 'flight.read.own',
  'flight.read.any': 'flight.read.any',
  'flight.create.own': 'flight.create.own',
  'flight.create.any': 'flight.create.any',
  'flight.update.own': 'flight.update.own',
  'flight.update.any': 'flight.update.any',
  'flight.delete.own': 'flight.delete.own',
  'flight.delete.any': 'flight.delete.any',
  'flight.export.own': 'flight.export.own',
  'flight.export.any': 'flight.export.any',
  'flight.passengers.manage.own': 'flight.passengers.manage.own',
  'flight.passengers.manage.any': 'flight.passengers.manage.any',
  'users.directory.read': 'users.directory.read',
  'users.create': 'users.create',
  'users.update': 'users.update',
  'users.delete': 'users.delete',
  'users.roles.assign': 'users.roles.assign',
  'data.airports.manage': 'data.airports.manage',
  'data.airlines.manage': 'data.airlines.manage',
  'data.aircraft.manage': 'data.aircraft.manage',
  'custom_fields.read': null,
  'custom_fields.manage': 'custom_fields.manage',
  'roles.manage': 'roles.manage',
  'stats.read': 'flight.read.own',
  'tracks.read': 'flight.read.own',
  'tracks.write': 'flight.update.own',
  'visited_countries.read': 'flight.read.own',
  'visited_countries.write': 'flight.read.own',
  'shares.read': 'flight.share.own',
  'shares.write': 'flight.share.own',
  'weather.read': 'flight.read.own',
};

export const authorizationAllowsScope = (
  authorization: PermissionSubject | null,
  scope: ApiScope,
) => {
  const permission = scopePermissions[scope];
  return permission === null ? true : hasPermission(authorization, permission);
};

/*
 * Scopes that exist in the catalog and the OpenAPI document but that no route or
 * MCP tool consumes yet. They are never offered at consent or at API-key
 * creation, so nobody is asked to approve a capability that does nothing.
 * `api-contract.test.ts` derives the scopes the implementation actually checks
 * from the source and asserts this list is exactly the complement, so a scope
 * that is offered but unused (or listed but implemented) fails the build.
 */
export const UNIMPLEMENTED_SCOPES = [
  'users.create',
  'users.update',
  'users.delete',
  'users.roles.assign',
  'data.airports.manage',
  'data.airlines.manage',
  'data.aircraft.manage',
  'custom_fields.manage',
  'weather.read',
] as const satisfies readonly ApiScope[];

const unimplementedScopeSet: ReadonlySet<ApiScope> = new Set(
  UNIMPLEMENTED_SCOPES,
);

export const isGrantableScope = (scope: ApiScope) =>
  !unimplementedScopeSet.has(scope);

export type FlightScopeAction =
  'read' | 'create' | 'update' | 'delete' | 'export';
export type FlightScopeOwnership = 'own' | 'any';

/*
 * Builds `flight.<action>.<own|any>` instead of spelling the ternary out at each
 * call site. The assertion below fails to compile if any combination stops
 * existing in API_SCOPES.
 */
export const flightScope = <
  const Action extends FlightScopeAction,
  const Ownership extends FlightScopeOwnership,
>(
  action: Action,
  ownership: Ownership,
): `flight.${Action}.${Ownership}` => `flight.${action}.${ownership}`;

/*
 * The passenger-management scope for an ownership. Kept beside `flightScope`
 * (which covers read/create/update/delete/export) so a caller checks
 * `plan.passengersChanged` against a single spelling rather than re-listing the
 * own/any variants.
 */
export const passengersManageScope = (ownership: FlightScopeOwnership) =>
  ownership === 'own'
    ? ('flight.passengers.manage.own' as const)
    : ('flight.passengers.manage.any' as const);

/*
 * A flight-scope query is "own" only when it resolves to the caller's own
 * flights; `scope=user` with somebody else's id, or `scope=all`, needs `.any`.
 * Shared by v0 and v1 so the two surfaces cannot drift on what counts as own.
 */
export const flightScopeOwnership = (
  scope: FlightScope,
  actorUserId: string,
): FlightScopeOwnership =>
  scope.scope === 'mine' ||
  (scope.scope === 'user' && scope.userId === actorUserId)
    ? 'own'
    : 'any';

type AssertAssignable<T extends ApiScope> = T;
type _AllFlightScopesExist =
  AssertAssignable<`flight.${FlightScopeAction}.${FlightScopeOwnership}`>;

export type GrantableScope = {
  name: ApiScope;
  description: string;
  readOnly: boolean;
};

const readonlyScopeSet: ReadonlySet<ApiScope> = new Set(OAUTH_READONLY_SCOPES);

export const grantableScopes = (
  authorization: PermissionSubject | null,
): GrantableScope[] =>
  API_SCOPES.filter(
    (scope) =>
      isGrantableScope(scope) && authorizationAllowsScope(authorization, scope),
  ).map((scope) => ({
    name: scope,
    description: API_SCOPE_DESCRIPTIONS[scope],
    readOnly: readonlyScopeSet.has(scope),
  }));
