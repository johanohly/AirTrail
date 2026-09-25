import {
  accessPresentation,
  type AccessAction,
  type AccessRow,
} from './access-presentation';

type Action<T> = AccessRow<T>['actions'][number];

export type AccessSelection<T, K extends string> = {
  /** The items in an action the actor may choose. */
  actionItems: (action: Action<T>) => T[];
  actionChecked: (selected: readonly K[], action: Action<T>) => boolean;
  actionIndeterminate: (selected: readonly K[], action: Action<T>) => boolean;
  actionInherited: (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => boolean;
  actionTitle: (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => string;
  rowAction: (row: AccessRow<T>, kind: AccessAction) => Action<T> | undefined;
  readLockedByWrite: (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => boolean;
  toggle: (selected: readonly K[], row: AccessRow<T>, action: Action<T>) => K[];
  withReadForWrite: (selected: readonly K[], rows: AccessRow<T>[]) => K[];
};

/*
 * The read/write selection semantics shared by the role editor and the scope
 * picker, including the rule that a held write implies its read. A role also
 * inherits narrower permissions from a broader one (`broader`); a scope is
 * exactly what was selected, so the scope picker leaves it out.
 */
export const createAccessSelection = <T, K extends string>(options: {
  key: (item: T) => K;
  describe: (item: T) => string;
  selectable?: (action: Action<T>) => T[];
  broader?: (key: K) => K | null;
}): AccessSelection<T, K> => {
  const broaderKey = (item: T) => options.broader?.(options.key(item)) ?? null;
  const isImplied = (selected: readonly K[], item: T) => {
    const broader = broaderKey(item);
    return broader !== null && selected.includes(broader);
  };
  const isEffective = (selected: readonly K[], item: T) =>
    selected.includes(options.key(item)) || isImplied(selected, item);

  const actionItems = (action: Action<T>) =>
    options.selectable ? options.selectable(action) : action.items;
  const actionChecked = (selected: readonly K[], action: Action<T>) => {
    const items = actionItems(action);
    return (
      items.length > 0 && items.every((item) => isEffective(selected, item))
    );
  };
  const actionIndeterminate = (selected: readonly K[], action: Action<T>) =>
    actionItems(action).some((item) => isEffective(selected, item)) &&
    !actionChecked(selected, action);
  const actionImplied = (selected: readonly K[], action: Action<T>) => {
    const items = actionItems(action);
    return items.length > 0 && items.every((item) => isImplied(selected, item));
  };
  const rowAction = (row: AccessRow<T>, kind: AccessAction) =>
    row.actions.find((action) => action.action === kind);
  const readLockedByWrite = (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => {
    if (action.action !== 'read') return false;
    const write = rowAction(row, 'write');
    return (
      write !== undefined &&
      actionItems(write).some((item) => isEffective(selected, item))
    );
  };
  const actionInherited = (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) =>
    actionImplied(selected, action) || readLockedByWrite(selected, row, action);
  const actionTitle = (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => {
    const details = action.items.map(options.describe).join(' · ');
    if (readLockedByWrite(selected, row, action))
      return `Included by Write access. ${details}`;
    if (!actionImplied(selected, action)) return details;
    const sources = new Set(
      actionItems(action).map(
        (item) => accessPresentation(broaderKey(item) ?? '').label,
      ),
    );
    return `Included by ${[...sources].join(', ')}. ${details}`;
  };

  const addReadForWrite = (result: Set<K>, row: AccessRow<T>) => {
    const read = rowAction(row, 'read');
    if (read)
      for (const item of actionItems(read)) result.add(options.key(item));
  };
  const withReadForWrite = (selected: readonly K[], rows: AccessRow<T>[]) => {
    const result = new Set(selected);
    for (const row of rows) {
      const write = rowAction(row, 'write');
      if (write?.items.some((item) => result.has(options.key(item))))
        addReadForWrite(result, row);
    }
    return [...result];
  };
  const toggle = (
    selected: readonly K[],
    row: AccessRow<T>,
    action: Action<T>,
  ) => {
    if (readLockedByWrite(selected, row, action)) return [...selected];
    const checked = actionChecked(selected, action);
    const result = new Set(selected);
    for (const item of actionItems(action)) {
      if (isImplied(selected, item)) continue;
      const key = options.key(item);
      if (checked) {
        result.delete(key);
        continue;
      }
      result.add(key);
      for (const candidate of selected) {
        if (options.broader?.(candidate) === key) result.delete(candidate);
      }
    }
    if (action.action === 'write' && !checked) addReadForWrite(result, row);
    return [...result];
  };

  return {
    actionItems,
    actionChecked,
    actionIndeterminate,
    actionInherited,
    actionTitle,
    rowAction,
    readLockedByWrite,
    toggle,
    withReadForWrite,
  };
};
