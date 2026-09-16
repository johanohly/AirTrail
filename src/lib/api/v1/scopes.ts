import {
  hasPermission,
  isPermission,
  type Permission,
  type PermissionSubject,
} from '$lib/authorization/permissions';

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
  'flight.share.own',
  'users.directory.read',
  'users.create',
  'users.update',
  'users.delete',
  'users.roles.assign',
  'data.airports.manage',
  'data.airlines.manage',
  'data.aircraft.manage',
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
  'weather.read',
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
  'flight.share.own': 'Manage the user’s public flight shares',
  'users.directory.read': 'Read the user directory',
  'users.create': 'Create user accounts',
  'users.update': 'Update manageable user accounts',
  'users.delete': 'Delete manageable user accounts',
  'users.roles.assign': 'Assign manageable roles to users',
  'data.airports.manage': 'Manage airports',
  'data.airlines.manage': 'Manage airlines',
  'data.aircraft.manage': 'Manage aircraft',
  'custom_fields.manage': 'Manage custom-field definitions',
  'roles.manage': 'Manage access roles',
  'reference_data.read': 'Read airport, airline, and aircraft data',
  'stats.read': 'Read flight statistics',
  'tracks.read': 'Read flight tracks',
  'tracks.write': 'Write and delete flight tracks',
  'visited_countries.read': 'Read visited countries',
  'visited_countries.write': 'Change visited countries',
  'shares.read': 'Read public-share settings',
  'shares.write': 'Create and change public shares',
  'weather.read': 'Read weather for visible airports',
};

const scopeFallbackPermissions: Partial<Record<ApiScope, Permission>> = {
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
  if (isPermission(scope)) return hasPermission(authorization, scope);
  const permission = scopeFallbackPermissions[scope];
  return permission ? hasPermission(authorization, permission) : true;
};

export type GrantableScope = {
  name: ApiScope;
  description: string;
  readOnly: boolean;
};

const readonlyScopeSet: ReadonlySet<ApiScope> = new Set(OAUTH_READONLY_SCOPES);

export const grantableScopes = (
  authorization: PermissionSubject | null,
): GrantableScope[] =>
  API_SCOPES.filter((scope) =>
    authorizationAllowsScope(authorization, scope),
  ).map((scope) => ({
    name: scope,
    description: API_SCOPE_DESCRIPTIONS[scope],
    readOnly: readonlyScopeSet.has(scope),
  }));
