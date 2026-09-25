import {
  isApiScope,
  isReadOnlyScope,
  scopeDefinition,
} from '$lib/api/v1/scopes';
import { PERMISSION_CATALOG } from './permissions';

export const ACCESS_CATEGORY_ORDER = [
  'Profile',
  'Flights',
  'Reference data',
  'Personal data',
  'Administration',
] as const;

export type AccessCategory = (typeof ACCESS_CATEGORY_ORDER)[number];

export type AccessAction = 'read' | 'write';

/** The matrix rows scopes and permissions are placed in. */
const ACCESS_ROWS = {
  profile: { category: 'Profile', label: 'Profile' },
  preferences: { category: 'Profile', label: 'Preferences' },
  'flight.own': { category: 'Flights', label: 'Your flights' },
  'flight.any': { category: 'Flights', label: 'All flights' },
  tracks: { category: 'Flights', label: 'Flight tracks' },
  stats: { category: 'Flights', label: 'Flight statistics' },
  reference_data: { category: 'Reference data', label: 'Reference data' },
  airports: { category: 'Reference data', label: 'Airports' },
  airlines: { category: 'Reference data', label: 'Airlines' },
  aircraft: { category: 'Reference data', label: 'Aircraft' },
  visited_countries: { category: 'Personal data', label: 'Visited countries' },
  shares: { category: 'Personal data', label: 'Public shares' },
  users: { category: 'Administration', label: 'Users' },
  roles: { category: 'Administration', label: 'Roles' },
  custom_fields: { category: 'Administration', label: 'Custom fields' },
  instance: { category: 'Administration', label: 'Instance settings' },
  sql: { category: 'Administration', label: 'SQL console' },
} as const satisfies Record<
  string,
  { category: AccessCategory; label: string }
>;

export type AccessRowKey = keyof typeof ACCESS_ROWS;

/** Where a scope or permission sits in the access matrix. */
export type AccessPlacement = { row: AccessRowKey; action: AccessAction };

export type AccessPresentation = {
  category: AccessCategory;
  group: AccessRowKey;
  label: string;
  action: AccessAction;
};

export type AccessRow<T> = {
  key: string;
  label: string;
  actions: Array<{ action: AccessAction; items: T[] }>;
};

const permissionPlacements = new Map<string, AccessPlacement>(
  PERMISSION_CATALOG.map((permission) => [permission.key, permission.access]),
);

const placement = (name: string): AccessPlacement | null =>
  isApiScope(name)
    ? scopeDefinition(name).access
    : (permissionPlacements.get(name) ?? null);

export const isAccessName = (name: string) => placement(name) !== null;

export const accessPresentation = (name: string): AccessPresentation => {
  const found = placement(name);
  if (!found) throw new Error(`Unknown scope or permission: ${name}`);
  const row = ACCESS_ROWS[found.row];
  return {
    category: row.category,
    group: found.row,
    label: row.label,
    action: found.action,
  };
};

/** Groups items by matrix row. Names that are no longer known are skipped. */
export const groupAccessItems = <T>(
  items: readonly T[],
  getName: (item: T) => string,
): AccessRow<T>[] => {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const name = getName(item);
    if (!isAccessName(name)) continue;
    const presentation = accessPresentation(name);
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

export const accessSummary = (scopes: readonly string[]) => {
  const known = scopes.filter(isApiScope);
  if (known.length === 0) return 'No access';
  const labels = groupAccessItems(known, (scope) => scope).map((row) => {
    const actions = row.actions.map((action) => action.action);
    return actions.length === 1 ? `${row.label} (${actions[0]})` : row.label;
  });
  const prefix = known.every(isReadOnlyScope) ? 'Read only' : 'Read and write';
  return `${prefix} · ${labels.join(', ')}`;
};
