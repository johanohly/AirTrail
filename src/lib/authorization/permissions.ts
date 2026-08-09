export const PERMISSIONS = [
  'flight.read.own',
  'flight.read.any',
  'flight.create.own',
  'flight.create.any',
  'flight.update.own',
  'flight.update.any',
  'flight.delete.own',
  'flight.delete.any',
  'flight.import.own',
  'flight.import.any',
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
  'data.aircraft.manage',
  'data.airlines.manage',
  'custom_fields.manage',
  'instance.oauth.manage',
  'instance.integrations.manage',
  'instance.map.manage',
  'instance.release.check',
  'roles.manage',
  'tools.sql.execute',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionGroup = {
  label: string;
  permissions: Array<{ key: Permission; label: string; description: string }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Flights',
    permissions: [
      {
        key: 'flight.read.own',
        label: 'View own flights',
        description: 'View flights where the user is a passenger.',
      },
      {
        key: 'flight.read.any',
        label: 'View all flights',
        description: "View every user's flights, tracks, and statistics.",
      },
      {
        key: 'flight.create.own',
        label: 'Add own flights',
        description: 'Create flights that include the user as a passenger.',
      },
      {
        key: 'flight.create.any',
        label: 'Add flights for anyone',
        description: 'Create flights without being a passenger.',
      },
      {
        key: 'flight.update.own',
        label: 'Edit own flights',
        description: 'Edit flights where the user is a passenger.',
      },
      {
        key: 'flight.update.any',
        label: 'Edit all flights',
        description: "Edit any user's flight.",
      },
      {
        key: 'flight.delete.own',
        label: 'Delete own flights',
        description: 'Delete flights where the user is a passenger.',
      },
      {
        key: 'flight.delete.any',
        label: 'Delete all flights',
        description: "Delete any user's flight.",
      },
      {
        key: 'flight.import.own',
        label: 'Import own flights',
        description: 'Import personal flight data.',
      },
      {
        key: 'flight.import.any',
        label: 'Restore all flights',
        description: 'Import data for any user.',
      },
      {
        key: 'flight.export.own',
        label: 'Export own flights',
        description: 'Export personal flight data.',
      },
      {
        key: 'flight.export.any',
        label: 'Export all flights',
        description: "Export any user's or all users' flight data.",
      },
      {
        key: 'flight.passengers.manage.own',
        label: 'Manage passengers on own flights',
        description:
          'Add, edit, or remove passengers on participating flights.',
      },
      {
        key: 'flight.passengers.manage.any',
        label: 'Manage passengers on all flights',
        description: 'Add, edit, or remove passengers on any flight.',
      },
    ],
  },
  {
    label: 'Users',
    permissions: [
      {
        key: 'users.directory.read',
        label: 'View user directory',
        description: 'See users in selectors and settings.',
      },
      {
        key: 'users.create',
        label: 'Create users',
        description: 'Create local user accounts.',
      },
      {
        key: 'users.update',
        label: 'Edit users',
        description: 'Edit users with fewer permissions.',
      },
      {
        key: 'users.delete',
        label: 'Delete users',
        description: 'Delete users with fewer permissions.',
      },
      {
        key: 'users.roles.assign',
        label: 'Assign roles',
        description: 'Assign roles that do not exceed the actor’s permissions.',
      },
    ],
  },
  {
    label: 'Data and configuration',
    permissions: [
      {
        key: 'data.airports.manage',
        label: 'Manage airports',
        description: 'Create, edit, delete, and synchronize airports.',
      },
      {
        key: 'data.aircraft.manage',
        label: 'Manage aircraft',
        description: 'Create, edit, delete, and synchronize aircraft.',
      },
      {
        key: 'data.airlines.manage',
        label: 'Manage airlines',
        description:
          'Create, edit, delete, and synchronize airlines and icons.',
      },
      {
        key: 'custom_fields.manage',
        label: 'Manage custom fields',
        description: 'Create and change custom-field definitions.',
      },
      {
        key: 'instance.oauth.manage',
        label: 'Manage OAuth',
        description: 'Configure OAuth and role mappings.',
      },
      {
        key: 'instance.integrations.manage',
        label: 'Manage integrations',
        description: 'Configure external data integrations.',
      },
      {
        key: 'instance.map.manage',
        label: 'Manage map settings',
        description: 'Configure instance-wide map styles.',
      },
      {
        key: 'instance.release.check',
        label: 'Check releases',
        description: 'Check for and display newer AirTrail releases.',
      },
    ],
  },
  {
    label: 'Security and tools',
    permissions: [
      {
        key: 'roles.manage',
        label: 'Manage roles',
        description:
          'Create and edit roles without granting unavailable permissions.',
      },
      {
        key: 'tools.sql.execute',
        label: 'Execute SQL',
        description: 'Run arbitrary SQL against the AirTrail database.',
      },
    ],
  },
];

export const USER_ROLE_PRESET: Permission[] = [
  'flight.read.own',
  'flight.create.own',
  'flight.update.own',
  'flight.delete.own',
  'flight.import.own',
  'flight.export.own',
  'flight.passengers.manage.own',
  'users.directory.read',
];

export const ADMINISTRATOR_ROLE_PRESET: Permission[] = [
  'flight.read.any',
  'flight.create.any',
  'flight.update.any',
  'flight.delete.any',
  'flight.import.any',
  'flight.export.any',
  'flight.passengers.manage.any',
  'users.directory.read',
  'users.create',
  'users.update',
  'users.delete',
  'users.roles.assign',
  'data.airports.manage',
  'data.aircraft.manage',
  'data.airlines.manage',
  'custom_fields.manage',
  'instance.oauth.manage',
  'instance.integrations.manage',
  'instance.map.manage',
  'instance.release.check',
];

const permissionSet = new Set<string>(PERMISSIONS);

export const isPermission = (value: string): value is Permission =>
  permissionSet.has(value);

export const impliedPermission = (permission: Permission): Permission | null =>
  permission.endsWith('.own')
    ? (`${permission.slice(0, -4)}.any` as Permission)
    : null;

export const hasClientPermission = (
  authorization: { isOwner: boolean; permissions: Permission[] } | null,
  permission: Permission,
) => {
  if (!authorization) return false;
  if (authorization.isOwner) return true;
  if (authorization.permissions.includes(permission)) return true;
  const implied = impliedPermission(permission);
  return implied ? authorization.permissions.includes(implied) : false;
};
