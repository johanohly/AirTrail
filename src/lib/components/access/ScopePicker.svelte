<script lang="ts">
  import { ChevronRight, Info, Search } from '@o7/icon/lucide';

  import AccessMatrix from '$lib/components/access/AccessMatrix.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Tabs from '$lib/components/ui/tabs';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';
  import type { ApiScope, GrantableScope } from '$lib/api/v1/scopes';
  import {
    accessPresentation,
    groupAccessItems,
    ACCESS_CATEGORY_ORDER,
    type AccessCategory,
  } from '$lib/authorization/access-presentation';
  import { createAccessSelection } from '$lib/authorization/access-selection';

  type Template = 'readonly' | 'full' | 'custom';

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
  const selection = createAccessSelection<GrantableScope, ApiScope>({
    key: (scope) => scope.name,
    describe: (scope) => `${scope.name}: ${scope.description}`,
  });
  const toggleAll = () => {
    selected = allSelected ? [] : [...availableNames];
  };
  const grouped = $derived.by(() =>
    ACCESS_CATEGORY_ORDER.map((category) => {
      const matching = scopes.filter((scope) => {
        if (accessPresentation(scope.name).category !== category) return false;
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

  <Tabs.Root
    value={activeTemplate}
    onValueChange={(value) => {
      if (value === 'readonly' || value === 'full') applyTemplate(value);
    }}
    activationMode="manual"
    class="mb-4 self-start"
  >
    <Tabs.List>
      {#each templates as template (template.key)}
        <Tabs.Trigger value={template.key} class="px-3">
          {template.label}
          <span class="text-xs font-normal text-muted-foreground"
            >{template.count}</span
          >
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>

  <div class="mb-3 flex items-center justify-between gap-4">
    <div class="flex items-center gap-1.5">
      <h3 class="text-sm font-medium text-muted-foreground">Permissions</h3>
      <HelpTooltip text={permissionsHelp}>
        <Info size={14} />
      </HelpTooltip>
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="h-7 px-2 text-muted-foreground"
      onclick={toggleAll}
    >
      {allSelected ? 'Deselect all' : 'Select all'}
    </Button>
  </div>

  <div class="mb-3 flex items-center gap-3">
    <div class="relative min-w-0 flex-1">
      <Search
        size={14}
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        bind:value={search}
        placeholder="Search permissions..."
        aria-label="Search permissions"
        class="pl-8"
      />
    </div>
    {#if search}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 shrink-0 px-2 text-muted-foreground"
        onclick={() => (search = '')}>Clear</Button
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
                checked: selection.actionChecked(selected, action),
                indeterminate: selection.actionIndeterminate(selected, action),
                inherited: selection.actionInherited(selected, row, action),
                disabled: selection.actionInherited(selected, row, action),
                title: selection.actionTitle(selected, row, action),
              })}
              onToggle={(row, action) =>
                (selected = selection.toggle(selected, row, action))}
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
