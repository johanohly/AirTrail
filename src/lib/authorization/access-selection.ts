import type { AccessAction, AccessRow } from './access-presentation';

type Action<T> = AccessRow<T>['actions'][number];

export type AccessSelection<T> = {
  /** The items in an action the actor may choose. */
  actionItems: (action: Action<T>) => T[];
  actionChecked: (action: Action<T>) => boolean;
  actionIndeterminate: (action: Action<T>) => boolean;
  rowAction: (row: AccessRow<T>, kind: AccessAction) => Action<T> | undefined;
  rowWriteActive: (row: AccessRow<T>) => boolean;
  readLockedByWrite: (row: AccessRow<T>, action: Action<T>) => boolean;
};

/*
 * The read/write selection semantics shared by the role editor and the scope
 * picker: what a cell's checked and indeterminate states are, and the rule that
 * a held write implies its read. The two differ only in which items count as
 * effective -- a role inherits implied permissions, a scope is exactly what was
 * selected -- and in which items the actor may pick, so both are strategies.
 */
export const createAccessSelection = <T>(options: {
  isEffective: (item: T) => boolean;
  selectable?: (action: Action<T>) => T[];
}): AccessSelection<T> => {
  const actionItems = (action: Action<T>) =>
    options.selectable ? options.selectable(action) : action.items;
  const actionChecked = (action: Action<T>) => {
    const items = actionItems(action);
    return items.length > 0 && items.every(options.isEffective);
  };
  const actionIndeterminate = (action: Action<T>) =>
    actionItems(action).some(options.isEffective) && !actionChecked(action);
  const rowAction = (row: AccessRow<T>, kind: AccessAction) =>
    row.actions.find((action) => action.action === kind);
  const rowWriteActive = (row: AccessRow<T>) => {
    const write = rowAction(row, 'write');
    return write !== undefined && actionItems(write).some(options.isEffective);
  };
  const readLockedByWrite = (row: AccessRow<T>, action: Action<T>) =>
    action.action === 'read' && rowWriteActive(row);

  return {
    actionItems,
    actionChecked,
    actionIndeterminate,
    rowAction,
    rowWriteActive,
    readLockedByWrite,
  };
};
