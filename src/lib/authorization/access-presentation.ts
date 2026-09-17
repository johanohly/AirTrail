import { OAUTH_READONLY_SCOPES } from '$lib/api/v1/scopes';

export type AccessPresentation = {
  group: string;
  label: string;
  action: AccessAction;
  /*
   * True when nothing in the table below matched and the raw key is being shown
   * as its own label. Nothing renders this differently -- it exists so
   * `api-contract.test.ts` can assert that no shipped scope or permission ever
   * reaches the fallback, which is the guarantee a string-prefix chain cannot
   * give on its own.
   */
  fallback?: true;
};

export const ACCESS_CATEGORY_ORDER = [
  'Profile',
  'Flights',
  'Reference data',
  'Personal data',
  'Administration',
] as const;

export type AccessCategory = (typeof ACCESS_CATEGORY_ORDER)[number];

export const accessCategory = (name: string): AccessCategory => {
  if (
    name.startsWith('flight.') ||
    name.startsWith('tracks.') ||
    name === 'stats.read' ||
    name === 'weather.read'
  )
    return 'Flights';
  if (name.startsWith('data.') || name === 'reference_data.read')
    return 'Reference data';
  if (name.startsWith('visited_countries.') || name.startsWith('shares.'))
    return 'Personal data';
  if (
    name.startsWith('users.') ||
    name.startsWith('roles.') ||
    name.startsWith('custom_fields.')
  )
    return 'Administration';
  return 'Profile';
};

export type AccessAction = 'read' | 'write';

export type AccessRow<T> = {
  key: string;
  label: string;
  actions: Array<{ action: AccessAction; items: T[] }>;
};

const access = (
  group: string,
  label: string,
  action: AccessAction,
): AccessPresentation => ({ group, label, action });

export const accessPresentation = (name: string): AccessPresentation => {
  const flight =
    /^flight\.(read|create|update|delete|import|export|passengers\.manage|share)\.(own|any)$/.exec(
      name,
    );
  if (flight) {
    const operation = flight[1] ?? '';
    const ownership = flight[2] ?? '';
    return access(
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
    return access(resource, label, paired[2] === 'read' ? 'read' : 'write');
  }

  if (name === 'profile.read') return access('profile', 'Profile', 'read');
  if (name === 'preferences.write')
    return access('preferences', 'Preferences', 'write');
  if (name === 'reference_data.read')
    return access('reference_data', 'Reference data', 'read');
  if (name === 'stats.read')
    return access('stats', 'Flight statistics', 'read');
  if (name === 'weather.read') return access('weather', 'Weather', 'read');
  if (name === 'users.directory.read') return access('users', 'Users', 'read');
  if (name.startsWith('users.')) return access('users', 'Users', 'write');
  if (name.startsWith('data.airports.'))
    return access('airports', 'Airports', 'write');
  if (name.startsWith('data.airlines.'))
    return access('airlines', 'Airlines', 'write');
  if (name.startsWith('data.aircraft.'))
    return access('aircraft', 'Aircraft', 'write');
  if (name === 'custom_fields.read')
    return access('custom_fields', 'Custom fields', 'read');
  if (name === 'custom_fields.manage')
    return access('custom_fields', 'Custom fields', 'write');
  if (name === 'roles.manage') return access('roles', 'Roles', 'write');
  if (name === 'instance.oauth.manage')
    return access('oauth', 'OAuth', 'write');
  if (name === 'instance.integrations.manage')
    return access('integrations', 'Integrations', 'write');
  if (name === 'instance.map.manage')
    return access('map', 'Map settings', 'write');
  if (name === 'instance.release.check')
    return access('releases', 'Release updates', 'read');
  if (name === 'tools.sql.execute')
    return access('sql', 'SQL console', 'write');
  return { ...access(name, name, 'write'), fallback: true };
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
