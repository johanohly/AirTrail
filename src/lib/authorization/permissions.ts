const PERMISSION_GROUPS_DEFINITION = [
  { key: 'flights', label: 'Flights' },
  { key: 'users', label: 'Users' },
  { key: 'configuration', label: 'Data and configuration' },
  { key: 'security', label: 'Security and tools' },
] as const;

type PermissionGroupKey = (typeof PERMISSION_GROUPS_DEFINITION)[number]['key'];
type RolePreset = 'user' | 'administrator';

type PermissionDefinition = {
  key: string;
  group: PermissionGroupKey;
  label: string;
  description: string;
  presets?: readonly RolePreset[];
};

export const PERMISSION_CATALOG = [
  {
    key: 'flight.read.own',
    group: 'flights',
    label: 'View own flights',
    description: 'View flights where the user is a passenger.',
    presets: ['user'],
  },
  {
    key: 'flight.read.any',
    group: 'flights',
    label: 'View all flights',
    description: "View every user's flights, tracks, and statistics.",
    presets: ['administrator'],
  },
  {
    key: 'flight.create.own',
    group: 'flights',
    label: 'Add own flights',
    description: 'Create flights that include the user as a passenger.',
    presets: ['user'],
  },
  {
    key: 'flight.create.any',
    group: 'flights',
    label: 'Add flights for anyone',
    description: 'Create flights without being a passenger.',
    presets: ['administrator'],
  },
  {
    key: 'flight.update.own',
    group: 'flights',
    label: 'Edit own flights',
    description: 'Edit flights where the user is a passenger.',
    presets: ['user'],
  },
  {
    key: 'flight.update.any',
    group: 'flights',
    label: 'Edit all flights',
    description: "Edit any user's flight.",
    presets: ['administrator'],
  },
  {
    key: 'flight.delete.own',
    group: 'flights',
    label: 'Delete own flights',
    description: 'Delete flights where the user is a passenger.',
    presets: ['user'],
  },
  {
    key: 'flight.delete.any',
    group: 'flights',
    label: 'Delete all flights',
    description: "Delete any user's flight.",
    presets: ['administrator'],
  },
  {
    key: 'flight.import.own',
    group: 'flights',
    label: 'Import own flights',
    description: 'Import personal flight data.',
    presets: ['user'],
  },
  {
    key: 'flight.import.any',
    group: 'flights',
    label: 'Restore all flights',
    description: 'Import data for any user.',
    presets: ['administrator'],
  },
  {
    key: 'flight.export.own',
    group: 'flights',
    label: 'Export own flights',
    description: 'Export personal flight data.',
    presets: ['user'],
  },
  {
    key: 'flight.export.any',
    group: 'flights',
    label: 'Export all flights',
    description: "Export any user's or all users' flight data.",
    presets: ['administrator'],
  },
  {
    key: 'flight.passengers.manage.own',
    group: 'flights',
    label: 'Manage passengers on own flights',
    description: 'Add, edit, or remove passengers on participating flights.',
    presets: ['user'],
  },
  {
    key: 'flight.passengers.manage.any',
    group: 'flights',
    label: 'Manage passengers on all flights',
    description: 'Add, edit, or remove passengers on any flight.',
    presets: ['administrator'],
  },
  {
    key: 'flight.share.own',
    group: 'flights',
    label: 'Share own flights',
    description: 'Publish personal flight data through public share links.',
    presets: ['user', 'administrator'],
  },
  {
    key: 'users.directory.read',
    group: 'users',
    label: 'View user directory',
    description: 'See users in selectors and settings.',
    presets: ['user', 'administrator'],
  },
  {
    key: 'users.create',
    group: 'users',
    label: 'Create users',
    description: 'Create local user accounts.',
    presets: ['administrator'],
  },
  {
    key: 'users.update',
    group: 'users',
    label: 'Edit users',
    description: 'Edit users with fewer permissions.',
    presets: ['administrator'],
  },
  {
    key: 'users.delete',
    group: 'users',
    label: 'Delete users',
    description: 'Delete users with fewer permissions.',
    presets: ['administrator'],
  },
  {
    key: 'users.roles.assign',
    group: 'users',
    label: 'Assign roles',
    description: 'Assign roles that do not exceed the actor’s permissions.',
    presets: ['administrator'],
  },
  {
    key: 'data.airports.manage',
    group: 'configuration',
    label: 'Manage airports',
    description: 'Create, edit, delete, and synchronize airports.',
    presets: ['administrator'],
  },
  {
    key: 'data.aircraft.manage',
    group: 'configuration',
    label: 'Manage aircraft',
    description: 'Create, edit, delete, and synchronize aircraft.',
    presets: ['administrator'],
  },
  {
    key: 'data.airlines.manage',
    group: 'configuration',
    label: 'Manage airlines',
    description: 'Create, edit, delete, and synchronize airlines and icons.',
    presets: ['administrator'],
  },
  {
    key: 'custom_fields.manage',
    group: 'configuration',
    label: 'Manage custom fields',
    description: 'Create and change custom-field definitions.',
    presets: ['administrator'],
  },
  {
    key: 'instance.oauth.manage',
    group: 'configuration',
    label: 'Manage OAuth',
    description: 'Configure OAuth and role mappings.',
    presets: ['administrator'],
  },
  {
    key: 'instance.integrations.manage',
    group: 'configuration',
    label: 'Manage integrations',
    description: 'Configure external data integrations.',
    presets: ['administrator'],
  },
  {
    key: 'instance.map.manage',
    group: 'configuration',
    label: 'Manage map settings',
    description: 'Configure instance-wide map styles.',
    presets: ['administrator'],
  },
  {
    key: 'instance.release.check',
    group: 'configuration',
    label: 'Check releases',
    description: 'Check for and display newer AirTrail releases.',
    presets: ['administrator'],
  },
  {
    key: 'roles.manage',
    group: 'security',
    label: 'Manage roles',
    description:
      'Create and edit roles without granting unavailable permissions.',
    presets: [],
  },
  {
    key: 'tools.sql.execute',
    group: 'security',
    label: 'Execute SQL',
    description: 'Run arbitrary SQL against the AirTrail database.',
    presets: [],
  },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSION_CATALOG)[number]['key'];

export const PERMISSIONS: Permission[] = PERMISSION_CATALOG.map(
  ({ key }) => key,
);

export type PermissionGroup = {
  label: string;
  permissions: Array<{ key: Permission; label: string; description: string }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] =
  PERMISSION_GROUPS_DEFINITION.map((group) => ({
    label: group.label,
    permissions: PERMISSION_CATALOG.filter(
      (permission) => permission.group === group.key,
    ).map(({ key, label, description }) => ({ key, label, description })),
  }));

const permissionsForPreset = (preset: RolePreset): Permission[] =>
  PERMISSION_CATALOG.filter((permission) =>
    permission.presets?.some((candidate) => candidate === preset),
  ).map(({ key }) => key);

export const USER_ROLE_PRESET = permissionsForPreset('user');
export const ADMINISTRATOR_ROLE_PRESET = permissionsForPreset('administrator');

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

type PermissionSubject = {
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
