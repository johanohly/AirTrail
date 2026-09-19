<script lang="ts">
  import { ChevronRight, Info, Search } from '@o7/icon/lucide';

  import AccessMatrix from '$lib/components/access/AccessMatrix.svelte';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';
  import type { ApiScope, GrantableScope } from '$lib/api/v1/scopes';
  import {
    accessCategory,
    groupAccessItems,
    ACCESS_CATEGORY_ORDER,
    type AccessCategory,
    type AccessRow,
  } from '$lib/authorization/access-presentation';
  import { createAccessSelection } from '$lib/authorization/access-selection';

  type Template = 'readonly' | 'full' | 'custom';
  type ScopeRow = AccessRow<GrantableScope>;
  type ScopeAction = ScopeRow['actions'][number];

  let {
    scopes,
    selected = $bindable(),
    permissionsHelp = 'These permissions limit what the credential can do. They are also limited by your current role.',
  }: {
    scopes: GrantableScope[];
    selected: ApiScope[];
    permissionsHelp?: string;
  } = $props();

  let search = $state('');
  let expanded = $state<Partial<Record<AccessCategory, boolean>>>({});

  const normalizedSearch = $derived(search.trim().toLowerCase());
  const selectedSet = $derived(new Set(selected));
  const availableNames = $derived(scopes.map((scope) => scope.name));
  const readonlyNames = $derived(
    scopes.filter((scope) => scope.readOnly).map((scope) => scope.name),
  );
  const sameScopes = (
    left: readonly ApiScope[],
    right: readonly ApiScope[],
  ) => {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((scope) => rightSet.has(scope));
  };
  const activeTemplate = $derived<Template>(
    sameScopes(selected, readonlyNames)
      ? 'readonly'
      : sameScopes(selected, availableNames)
        ? 'full'
        : 'custom',
  );
  const allSelected = $derived(
    availableNames.length > 0 &&
      availableNames.every((scope) => selectedSet.has(scope)),
  );

  const isSelected = (name: ApiScope) => selectedSet.has(name);
  const applyTemplate = (template: Exclude<Template, 'custom'>) => {
    selected =
      template === 'readonly' ? [...readonlyNames] : [...availableNames];
  };
  const selection = createAccessSelection<GrantableScope>({
    isEffective: (scope) => selectedSet.has(scope.name),
  });
  const actionNames = (action: ScopeAction) =>
    selection.actionItems(action).map((scope) => scope.name);
  const actionTitle = (row: ScopeRow, action: ScopeAction) => {
    const details = action.items
      .map((scope) => `${scope.name}: ${scope.description}`)
      .join(' · ');
    return selection.readLockedByWrite(row, action)
      ? `Included by Write access. ${details}`
      : details;
  };
  const toggleAction = (row: ScopeRow, action: ScopeAction) => {
    if (selection.readLockedByWrite(row, action)) return;
    const names = actionNames(action);
    const next = new Set(selected);
    if (names.every(isSelected)) {
      names.forEach((name) => next.delete(name));
    } else {
      names.forEach((name) => next.add(name));
      const read =
        action.action === 'write'
          ? selection.rowAction(row, 'read')
          : undefined;
      if (read) actionNames(read).forEach((name) => next.add(name));
    }
    selected = [...next];
  };
  const toggleAll = () => {
    selected = allSelected ? [] : [...availableNames];
  };
  const grouped = $derived.by(() =>
    ACCESS_CATEGORY_ORDER.map((category) => {
      const matching = scopes.filter((scope) => {
        if (accessCategory(scope.name) !== category) return false;
        if (!normalizedSearch) return true;
        return `${scope.name} ${scope.description}`
          .toLowerCase()
          .includes(normalizedSearch);
      });
      const rows = groupAccessItems(matching, (scope) => scope.name);
      return {
        category,
        rows,
        selectedCount: rows.reduce(
          (count, row) =>
            count +
            row.actions.reduce(
              (actionCount, action) =>
                actionCount +
                action.items.filter((scope) => isSelected(scope.name)).length,
              0,
            ),
          0,
        ),
      };
    }).filter(({ rows }) => rows.length > 0),
  );
  const isExpanded = (category: AccessCategory) =>
    expanded[category] || Boolean(normalizedSearch);
  const templates = $derived([
    {
      key: 'readonly' as const,
      label: 'Read only',
      count: readonlyNames.length,
    },
    {
      key: 'full' as const,
      label: 'Full access',
      count: availableNames.length,
    },
  ]);
</script>

<div class="flex flex-col">
  <div class="mb-2 flex items-center gap-1.5">
    <h3 class="text-sm font-medium text-muted-foreground">Access template</h3>
    <HelpTooltip
      text="Start from a safe read-only set, grant every permission your role allows, or customize individual permissions below."
    >
      <Info size={14} />
    </HelpTooltip>
  </div>

  <div
    class="mb-4 inline-flex max-w-full self-start rounded-md border bg-muted p-0.5"
  >
    {#each templates as template (template.key)}
      <button
        type="button"
        class={cn(
          'inline-flex min-h-8 items-center gap-2 rounded px-3 text-left text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          activeTemplate === template.key &&
            'bg-background text-foreground shadow-sm',
        )}
        aria-pressed={activeTemplate === template.key}
        onclick={() => applyTemplate(template.key)}
      >
        <span>{template.label}</span>
        <span class="text-xs font-normal text-muted-foreground"
          >{template.count}</span
        >
      </button>
    {/each}
  </div>

  <div class="mb-3 flex items-center justify-between gap-4">
    <div class="flex items-center gap-1.5">
      <h3 class="text-sm font-medium text-muted-foreground">Permissions</h3>
      <HelpTooltip text={permissionsHelp}>
        <Info size={14} />
      </HelpTooltip>
    </div>
    <button
      type="button"
      class="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      onclick={toggleAll}
    >
      {allSelected ? 'Deselect all' : 'Select all'}
    </button>
  </div>

  <div class="mb-3 flex items-center gap-3">
    <div class="relative min-w-0 flex-1">
      <Search
        size={14}
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        bind:value={search}
        placeholder="Search permissions..."
        aria-label="Search permissions"
        class="h-9 w-full rounded-md border border-input bg-background px-3 pl-8 text-sm outline-hidden transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
    </div>
    {#if search}
      <button
        type="button"
        class="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onclick={() => (search = '')}>Clear</button
      >
    {/if}
    <span class="shrink-0 text-xs tabular-nums text-muted-foreground"
      ><strong class="font-semibold text-foreground">{selected.length}</strong>
      / {availableNames.length}</span
    >
  </div>

  <div class="overflow-hidden rounded-md border bg-muted/20">
    {#each grouped as group (group.category)}
      <section class="border-b border-dashed last:border-b-0">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-expanded={isExpanded(group.category)}
          onclick={() => (expanded[group.category] = !expanded[group.category])}
        >
          <ChevronRight
            size={14}
            class={cn(
              'shrink-0 text-muted-foreground transition-transform duration-200',
              isExpanded(group.category) && 'rotate-90',
            )}
            aria-hidden="true"
          />
          <span class="flex-1">{group.category}</span>
          <span class="text-xs font-medium tabular-nums text-muted-foreground"
            >{group.selectedCount > 0
              ? `${group.selectedCount} selected`
              : ''}</span
          >
        </button>

        {#if isExpanded(group.category)}
          <div class="bg-background/50">
            <AccessMatrix
              rows={group.rows}
              rowClass="border-t border-dashed pl-9"
              cellState={(row, action) => ({
                checked: selection.actionChecked(action),
                indeterminate: selection.actionIndeterminate(action),
                inherited: selection.readLockedByWrite(row, action),
                disabled: selection.readLockedByWrite(row, action),
                title: actionTitle(row, action),
              })}
              onToggle={toggleAction}
            />
          </div>
        {/if}
      </section>
    {:else}
      <p class="px-4 py-8 text-center text-sm text-muted-foreground">
        No matching permissions.
      </p>
    {/each}
  </div>
</div>
