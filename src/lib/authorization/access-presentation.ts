import { OAUTH_READONLY_SCOPES } from '$lib/api/v1/scopes';

export const ACCESS_CATEGORY_ORDER = [
  'Profile',
  'Flights',
  'Reference data',
  'Personal data',
  'Administration',
] as const;

export type AccessCategory = (typeof ACCESS_CATEGORY_ORDER)[number];

export type AccessAction = 'read' | 'write';

export type AccessPresentation = {
  category: AccessCategory;
  group: string;
  label: string;
  action: AccessAction;
};

export type AccessRow<T> = {
  key: string;
  label: string;
  actions: Array<{ action: AccessAction; items: T[] }>;
};

const access = (
  category: AccessCategory,
  group: string,
  label: string,
  action: AccessAction,
): AccessPresentation => ({ category, group, label, action });

/*
 * The single classifier over scope and permission names: it decides the
 * top-level category, the row group, the label and the read/write axis at once.
 * Splitting the category out into its own prefix chain meant two tables had to
 * agree on every new key.
 */
export const accessPresentation = (name: string): AccessPresentation => {
  const flight =
    /^flight\.(read|create|update|delete|import|export|passengers\.manage|share)\.(own|any)$/.exec(
      name,
    );
  if (flight) {
    const operation = flight[1] ?? '';
    const ownership = flight[2] ?? '';
    return access(
      'Flights',
      `flight.${ownership}`,
      ownership === 'own' ? 'Your flights' : 'All flights',
      operation === 'read' || operation === 'export' ? 'read' : 'write',
    );
  }

  const paired = /^(tracks|visited_countries|shares)\.(read|write)$/.exec(name);
  if (paired) {
    const resource = paired[1] ?? '';
    const label =
      resource === 'tracks'
        ? 'Flight tracks'
        : resource === 'visited_countries'
          ? 'Visited countries'
          : 'Public shares';
    return access(
      resource === 'tracks' ? 'Flights' : 'Personal data',
      resource,
      label,
      paired[2] === 'read' ? 'read' : 'write',
    );
  }

  if (name === 'profile.read')
    return access('Profile', 'profile', 'Profile', 'read');
  if (name === 'preferences.write')
    return access('Profile', 'preferences', 'Preferences', 'write');
  if (name === 'reference_data.read')
    return access('Reference data', 'reference_data', 'Reference data', 'read');
  if (name === 'stats.read')
    return access('Flights', 'stats', 'Flight statistics', 'read');
  if (name === 'weather.read')
    return access('Flights', 'weather', 'Weather', 'read');
  if (name === 'users.directory.read')
    return access('Administration', 'users', 'Users', 'read');
  if (name.startsWith('users.'))
    return access('Administration', 'users', 'Users', 'write');
  if (name.startsWith('data.airports.'))
    return access('Reference data', 'airports', 'Airports', 'write');
  if (name.startsWith('data.airlines.'))
    return access('Reference data', 'airlines', 'Airlines', 'write');
  if (name.startsWith('data.aircraft.'))
    return access('Reference data', 'aircraft', 'Aircraft', 'write');
  if (name === 'custom_fields.read')
    return access('Administration', 'custom_fields', 'Custom fields', 'read');
  if (name === 'custom_fields.manage')
    return access('Administration', 'custom_fields', 'Custom fields', 'write');
  if (name === 'roles.manage')
    return access('Administration', 'roles', 'Roles', 'write');
  if (name === 'instance.oauth.manage')
    return access('Profile', 'oauth', 'OAuth', 'write');
  if (name === 'instance.integrations.manage')
    return access('Profile', 'integrations', 'Integrations', 'write');
  if (name === 'instance.map.manage')
    return access('Profile', 'map', 'Map settings', 'write');
  if (name === 'instance.release.check')
    return access('Profile', 'releases', 'Release updates', 'read');
  if (name === 'tools.sql.execute')
    return access('Profile', 'sql', 'SQL console', 'write');
  return access('Profile', name, name, 'write');
};

export const groupAccessItems = <T>(
  items: readonly T[],
  getName: (item: T) => string,
): AccessRow<T>[] => {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const presentation = accessPresentation(getName(item));
    const group = groups.get(presentation.group);
    if (group) group.items.push(item);
    else
      groups.set(presentation.group, {
        label: presentation.label,
        items: [item],
      });
  }

  return [...groups].map(([key, group]) => ({
    key,
    label: group.label,
    actions: (['read', 'write'] as const)
      .map((action) => ({
        action,
        items: group.items.filter(
          (item) => accessPresentation(getName(item)).action === action,
        ),
      }))
      .filter(({ items }) => items.length > 0),
  }));
};

const readonlyAccessScopes: ReadonlySet<string> = new Set(
  OAUTH_READONLY_SCOPES,
);

export const accessSummary = (scopes: readonly string[]) => {
  if (scopes.length === 0) return 'No access';
  const rows = groupAccessItems(scopes, (scope) => scope);
  const labels = rows.map((row) => {
    const actions = row.actions.map((action) => action.action);
    const suffix =
      actions.length === 1 ? (actions[0] === 'read' ? 'read' : 'write') : null;
    return suffix ? `${row.label} (${suffix})` : row.label;
  });
  const readOnly = scopes.every((scope) => readonlyAccessScopes.has(scope));
  const prefix = readOnly ? 'Read only' : 'Read and write';
  return `${prefix} · ${labels.join(', ')}`;
};
