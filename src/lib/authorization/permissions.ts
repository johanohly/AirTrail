import type { AccessPlacement } from './access-presentation';

const PERMISSION_GROUPS_DEFINITION = [
  { key: 'flights', label: 'Flights' },
  { key: 'users', label: 'Users' },
  { key: 'configuration', label: 'Data and configuration' },
  { key: 'security', label: 'Security and tools' },
] as const;

type PermissionGroupKey = (typeof PERMISSION_GROUPS_DEFINITION)[number]['key'];

type PermissionDefinition = {
  key: string;
  group: PermissionGroupKey;
  access: AccessPlacement;
  description: string;
};

export const PERMISSION_CATALOG = [
  {
    key: 'flight.read.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'read' },
    description: 'View flights where the user is a passenger.',
  },
  {
    key: 'flight.read.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'read' },
    description: "View every user's flights, tracks, and statistics.",
  },
  {
    key: 'flight.create.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Create flights that include the user as a passenger.',
  },
  {
    key: 'flight.create.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'write' },
    description: 'Create flights without being a passenger.',
  },
  {
    key: 'flight.update.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Edit flights where the user is a passenger.',
  },
  {
    key: 'flight.update.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'write' },
    description: "Edit any user's flight.",
  },
  {
    key: 'flight.delete.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Delete flights where the user is a passenger.',
  },
  {
    key: 'flight.delete.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'write' },
    description: "Delete any user's flight.",
  },
  {
    key: 'flight.import.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Import personal flight data.',
  },
  {
    key: 'flight.import.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'write' },
    description: 'Import data for any user.',
  },
  {
    key: 'flight.export.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'read' },
    description: 'Export personal flight data.',
  },
  {
    key: 'flight.export.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'read' },
    description: "Export any user's or all users' flight data.",
  },
  {
    key: 'flight.passengers.manage.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Add, edit, or remove passengers on participating flights.',
  },
  {
    key: 'flight.passengers.manage.any',
    group: 'flights',
    access: { row: 'flight.any', action: 'write' },
    description: 'Add, edit, or remove passengers on any flight.',
  },
  {
    key: 'flight.share.own',
    group: 'flights',
    access: { row: 'flight.own', action: 'write' },
    description: 'Publish personal flight data through public share links.',
  },
  {
    key: 'users.directory.read',
    group: 'users',
    access: { row: 'users', action: 'read' },
    description: 'See users in selectors and settings.',
  },
  {
    key: 'users.create',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Create local user accounts.',
  },
  {
    key: 'users.update',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Edit users with fewer permissions.',
  },
  {
    key: 'users.delete',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Delete users with fewer permissions.',
  },
  {
    key: 'users.roles.assign',
    group: 'users',
    access: { row: 'users', action: 'write' },
    description: 'Assign roles that do not exceed the actor’s permissions.',
  },
  {
    key: 'data.airports.manage',
    group: 'configuration',
    access: { row: 'airports', action: 'write' },
    description: 'Create, edit, delete, and synchronize airports.',
  },
  {
    key: 'data.aircraft.manage',
    group: 'configuration',
    access: { row: 'aircraft', action: 'write' },
    description: 'Create, edit, delete, and synchronize aircraft.',
  },
  {
    key: 'data.airlines.manage',
    group: 'configuration',
    access: { row: 'airlines', action: 'write' },
    description: 'Create, edit, delete, and synchronize airlines and icons.',
  },
  {
    key: 'custom_fields.manage',
    group: 'configuration',
    access: { row: 'custom_fields', action: 'write' },
    description: 'Create and change custom-field definitions.',
  },
  {
    key: 'instance.oauth.manage',
    group: 'configuration',
    access: { row: 'instance', action: 'write' },
    description: 'Configure OAuth and role mappings.',
  },
  {
    key: 'instance.integrations.manage',
    group: 'configuration',
    access: { row: 'instance', action: 'write' },
    description: 'Configure external data integrations.',
  },
  {
    key: 'instance.map.manage',
    group: 'configuration',
    access: { row: 'instance', action: 'write' },
    description: 'Configure instance-wide map styles.',
  },
  {
    key: 'instance.release.check',
    group: 'configuration',
    access: { row: 'instance', action: 'read' },
    description: 'Check for and display newer AirTrail releases.',
  },
  {
    key: 'roles.manage',
    group: 'security',
    access: { row: 'roles', action: 'write' },
    description:
      'Create and edit roles without granting unavailable permissions.',
  },
  {
    key: 'tools.sql.execute',
    group: 'security',
    access: { row: 'sql', action: 'write' },
    description: 'Run arbitrary SQL against the AirTrail database.',
  },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSION_CATALOG)[number]['key'];

export const PERMISSIONS: Permission[] = PERMISSION_CATALOG.map(
  ({ key }) => key,
);

export type PermissionGroup = {
  label: string;
  permissions: Array<{ key: Permission; description: string }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] =
  PERMISSION_GROUPS_DEFINITION.map((group) => ({
    label: group.label,
    permissions: PERMISSION_CATALOG.filter(
      (permission) => permission.group === group.key,
    ).map(({ key, description }) => ({ key, description })),
  }));

const IMPLIED_PERMISSIONS: Partial<Record<Permission, Permission>> = {
  'flight.read.own': 'flight.read.any',
  'flight.create.own': 'flight.create.any',
  'flight.update.own': 'flight.update.any',
  'flight.delete.own': 'flight.delete.any',
  'flight.import.own': 'flight.import.any',
  'flight.export.own': 'flight.export.any',
  'flight.passengers.manage.own': 'flight.passengers.manage.any',
};

const permissionSet: ReadonlySet<string> = new Set(PERMISSIONS);

export const isPermission = (value: string): value is Permission =>
  permissionSet.has(value);

export const impliedPermission = (permission: Permission): Permission | null =>
  IMPLIED_PERMISSIONS[permission] ?? null;

/** Remove narrower grants that are already covered by a broader grant. */
export const normalizePermissions = (
  permissions: Iterable<Permission>,
): Permission[] => {
  const normalized = new Set(permissions);
  for (const permission of PERMISSIONS) {
    const broader = impliedPermission(permission);
    if (broader && normalized.has(broader)) normalized.delete(permission);
  }
  return [...normalized];
};

export type PermissionSubject = {
  readonly isOwner: boolean;
  readonly permissions: Iterable<Permission>;
};

const asPermissionSet = (permissions: Iterable<Permission>) =>
  permissions instanceof Set ? permissions : new Set(permissions);

const setHasPermission = (
  permissions: ReadonlySet<Permission>,
  permission: Permission,
) => {
  if (permissions.has(permission)) return true;
  const implied = impliedPermission(permission);
  return implied ? permissions.has(implied) : false;
};

export const hasPermission = (
  authorization: PermissionSubject | null,
  permission: Permission,
) => {
  if (!authorization) return false;
  if (authorization.isOwner) return true;
  return setHasPermission(
    asPermissionSet(authorization.permissions),
    permission,
  );
};

export const canCreateUserAccount = (authorization: PermissionSubject | null) =>
  hasPermission(authorization, 'users.create') &&
  hasPermission(authorization, 'users.roles.assign');

export const canRestoreAllFlights = (authorization: PermissionSubject | null) =>
  hasPermission(authorization, 'flight.import.any') &&
  hasPermission(authorization, 'users.directory.read');

export const canDeduplicateOwnFlights = (
  authorization: PermissionSubject | null,
) =>
  hasPermission(authorization, 'flight.read.own') &&
  hasPermission(authorization, 'flight.delete.own');

export const canSetDefaultRole = (authorization: PermissionSubject | null) =>
  hasPermission(authorization, 'roles.manage') &&
  hasPermission(authorization, 'users.roles.assign') &&
  hasPermission(authorization, 'instance.oauth.manage');

export const effectivePermissions = (permissions: Iterable<Permission>) => {
  const permissionSet = asPermissionSet(permissions);
  return new Set(
    PERMISSIONS.filter((permission) =>
      setHasPermission(permissionSet, permission),
    ),
  );
};

export const permissionsStrictlyInclude = (
  actorPermissions: Iterable<Permission>,
  targetPermissions: Iterable<Permission>,
) => {
  const actor = effectivePermissions(actorPermissions);
  const target = effectivePermissions(targetPermissions);
  return (
    actor.size > target.size &&
    [...target].every((permission) => actor.has(permission))
  );
};

export const hasClientPermission = hasPermission;
