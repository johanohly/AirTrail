<script lang="ts">
  import { ChevronRight, Info, Search } from '@o7/icon/lucide';

  import AccessCheckbox from '$lib/components/access/AccessCheckbox.svelte';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';
  import type { ApiScope, GrantableScope } from '$lib/api/v1/scopes';
  import {
    groupAccessItems,
    type AccessRow,
  } from '$lib/authorization/access-presentation';

  type ScopeCategory =
    | 'Profile'
    | 'Flights'
    | 'Reference data'
    | 'Personal data'
    | 'Administration';
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

  const categoryOrder: ScopeCategory[] = [
    'Profile',
    'Flights',
    'Reference data',
    'Personal data',
    'Administration',
  ];

  const scopeCategory = (name: string): ScopeCategory => {
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

  let search = $state('');
  let expanded = $state<Record<ScopeCategory, boolean>>({
    Profile: false,
    Flights: false,
    'Reference data': false,
    'Personal data': false,
    Administration: false,
  });

  const normalizedSearch = $derived(search.trim().toLowerCase());
  const availableNames = $derived(scopes.map((scope) => scope.name));
  const readonlyNames = $derived(
    scopes.filter((scope) => scope.readOnly).map((scope) => scope.name),
  );
  const sameScopes = (left: readonly ApiScope[], right: readonly ApiScope[]) =>
    left.length === right.length &&
    left.every((scope) => right.includes(scope));
  const activeTemplate = $derived<Template>(
    sameScopes(selected, readonlyNames)
      ? 'readonly'
      : sameScopes(selected, availableNames)
        ? 'full'
        : 'custom',
  );
  const allSelected = $derived(
    availableNames.length > 0 &&
      availableNames.every((scope) => selected.includes(scope)),
  );

  const isSelected = (name: ApiScope) => selected.includes(name);
  const applyTemplate = (template: Exclude<Template, 'custom'>) => {
    selected =
      template === 'readonly' ? [...readonlyNames] : [...availableNames];
  };
  const actionNames = (action: ScopeAction) =>
    action.items.map((scope) => scope.name);
  const actionSelected = (action: ScopeAction) =>
    actionNames(action).every(isSelected);
  const actionIndeterminate = (action: ScopeAction) => {
    const names = actionNames(action);
    return names.some(isSelected) && !names.every(isSelected);
  };
  const rowAction = (row: ScopeRow, kind: ScopeAction['action']) =>
    row.actions.find((action) => action.action === kind);
  const rowWriteSelected = (row: ScopeRow) => {
    const write = rowAction(row, 'write');
    return write !== undefined && actionNames(write).some(isSelected);
  };
  const readLocked = (row: ScopeRow, action: ScopeAction) =>
    action.action === 'read' && rowWriteSelected(row);
  const actionTitle = (row: ScopeRow, action: ScopeAction) => {
    const details = action.items
      .map((scope) => `${scope.name}: ${scope.description}`)
      .join(' · ');
    return readLocked(row, action)
      ? `Included by Write access. ${details}`
      : details;
  };
  const toggleAction = (row: ScopeRow, action: ScopeAction) => {
    if (readLocked(row, action)) return;
    const names = actionNames(action);
    const next = new Set(selected);
    if (names.every(isSelected)) {
      names.forEach((name) => next.delete(name));
    } else {
      names.forEach((name) => next.add(name));
      const read =
        action.action === 'write' ? rowAction(row, 'read') : undefined;
      if (read) actionNames(read).forEach((name) => next.add(name));
    }
    selected = [...next];
  };
  const toggleAll = () => {
    selected = allSelected ? [] : [...availableNames];
  };
  const grouped = $derived.by(() =>
    categoryOrder
      .map((category) => {
        const matching = scopes.filter((scope) => {
          if (scopeCategory(scope.name) !== category) return false;
          if (!normalizedSearch) return true;
          return `${scope.name} ${scope.description}`
            .toLowerCase()
            .includes(normalizedSearch);
        });
        return {
          category,
          rows: groupAccessItems(matching, (scope) => scope.name),
        };
      })
      .filter(({ rows }) => rows.length > 0),
  );
  const selectedCountFor = (rows: ScopeRow[]) =>
    rows.reduce(
      (count, row) =>
        count +
        row.actions.reduce(
          (actionCount, action) =>
            actionCount +
            action.items.filter((scope) => isSelected(scope.name)).length,
          0,
        ),
      0,
    );
  const isExpanded = (category: ScopeCategory) =>
    expanded[category] || Boolean(normalizedSearch);
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
    <button
      type="button"
      class={cn(
        'inline-flex min-h-8 items-center gap-2 rounded px-3 text-left text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        activeTemplate === 'readonly' &&
          'bg-background text-foreground shadow-sm',
      )}
      aria-pressed={activeTemplate === 'readonly'}
      onclick={() => applyTemplate('readonly')}
    >
      <span>Read only</span>
      <span class="text-xs font-normal text-muted-foreground"
        >{readonlyNames.length}</span
      >
    </button>
    <button
      type="button"
      class={cn(
        'inline-flex min-h-8 items-center gap-2 rounded px-3 text-left text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        activeTemplate === 'full' && 'bg-background text-foreground shadow-sm',
      )}
      aria-pressed={activeTemplate === 'full'}
      onclick={() => applyTemplate('full')}
    >
      <span>Full access</span>
      <span class="text-xs font-normal text-muted-foreground"
        >{availableNames.length}</span
      >
    </button>
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
            >{selectedCountFor(group.rows) > 0
              ? `${selectedCountFor(group.rows)} selected`
              : ''}</span
          >
        </button>

        {#if isExpanded(group.category)}
          <div class="bg-background/50">
            {#each group.rows as row (row.key)}
              <div
                class="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-dashed px-3 py-2 pl-9"
              >
                <p class="min-w-0 truncate text-sm text-foreground">
                  {row.label}
                </p>
                <div
                  class="inline-flex h-7 shrink-0 gap-3 rounded-md border bg-muted/30 px-1.5"
                  aria-label={`${row.label} access`}
                >
                  {#each row.actions as action (action.action)}
                    <AccessCheckbox
                      checked={actionSelected(action)}
                      indeterminate={actionIndeterminate(action)}
                      inherited={readLocked(row, action)}
                      disabled={readLocked(row, action)}
                      label={action.action === 'read' ? 'Read' : 'Write'}
                      title={actionTitle(row, action)}
                      onclick={() => toggleAction(row, action)}
                    />
                  {/each}
                </div>
              </div>
            {/each}
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
