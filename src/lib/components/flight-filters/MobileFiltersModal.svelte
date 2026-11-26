<script lang="ts">
  import { Check, ChevronRight, Search, X, Plus } from '@o7/icon';

  import {
    FILTER_DEFINITIONS,
    FILTER_GROUPS,
    filterDefinition,
    type FilterDefinition,
    type FilterId,
    type FilterOption,
    type FilterScope,
    type OptionFilterId,
  } from './definitions';
  import MobileDateFilterScreen from './MobileDateFilterScreen.svelte';
  import {
    clearFilter,
    createDefaultFilters,
    dateFilterSummary,
    filterOptions,
    filterScope,
    isFilterActive,
    operatorChoices,
    optionFilterState,
    setOptionFilter,
  } from './model';
  import {
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type MultiOptionFilterOperator,
    type OptionFilterOperator,
    type TempFilters,
  } from './types';

  import { page } from '$app/state';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
  } from '$lib/components/ui/modal';
  import { scopeSeatUserId } from '$lib/state.svelte';
  import { matchesWordPrefix } from '$lib/primitives';
  import { cn, type FlightData } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

  type Screen =
    | { kind: 'home' }
    | { kind: 'subjects' }
    | { kind: 'filter'; id: OptionFilterId }
    | { kind: 'date' };

  let {
    open = $bindable(),
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    open: boolean;
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  let screen = $state<Screen>({ kind: 'home' });
  let search = $state('');
  let wasOpen = $state(open);

  const drilldownActive = $derived(
    hasTempFilters || hasActiveTempFilters(tempFilters),
  );
  const seatUserId = $derived(scopeSeatUserId(page.data.user?.id));
  // The filters only shape the options through the seat scope, so a string
  // key keeps other filter changes from rebuilding every option list.
  const scopeKey = $derived(JSON.stringify(filterScope(filters, seatUserId)));
  const options = $derived(
    filterOptions(flights ?? [], {
      scope: JSON.parse(scopeKey) as FilterScope,
      tempFilters,
    }),
  );

  const visibleDefinitions = $derived(
    FILTER_DEFINITIONS.filter(
      (definition) => !(drilldownActive && 'replacedByDrilldown' in definition),
    ),
  );

  // An operator picked before any value, applied with the first value.
  let pendingOperator = $state<
    OptionFilterOperator | MultiOptionFilterOperator | undefined
  >();

  function go(next: Screen, keepSearch = false) {
    screen = next;
    pendingOperator = undefined;
    if (!keepSearch) search = '';
  }

  function openFilter(id: FilterId, keepSearch = false) {
    go(id === 'date' ? { kind: 'date' } : { kind: 'filter', id }, keepSearch);
  }

  // The same matching as the desktop menu search.
  function matchesQuery(option: FilterOption, query: string) {
    return [option.label, option.shortLabel, ...(option.keywords ?? [])].some(
      (text) => !!text && matchesWordPrefix(text, query),
    );
  }

  /*
   * Filters whose name matches the search, then those with a matching option,
   * which show the options that matched.
   */
  type SubjectEntry = { definition: FilterDefinition; matched?: string[] };

  const subjectGroups = $derived.by(() => {
    const query = search.trim();
    return FILTER_GROUPS.map((group) => {
      const inGroup = visibleDefinitions.filter(
        (definition) => definition.group === group.id,
      );
      if (!query) {
        return {
          ...group,
          entries: inGroup.map((definition): SubjectEntry => ({ definition })),
        };
      }
      const byName = inGroup.filter((definition) =>
        matchesWordPrefix(definition.label, query),
      );
      const byOption = inGroup.flatMap((definition): SubjectEntry[] => {
        if (definition.kind !== 'option' || byName.includes(definition)) {
          return [];
        }
        const matched = options[definition.id].filter((option) =>
          matchesQuery(option, query),
        );
        return matched.length
          ? [{ definition, matched: matched.map(({ label }) => label) }]
          : [];
      });
      return {
        ...group,
        entries: [
          ...byName.map((definition): SubjectEntry => ({ definition })),
          ...byOption,
        ],
      };
    }).filter((group) => group.entries.length);
  });

  const activeDefinitions = $derived(
    visibleDefinitions.filter((definition) =>
      isFilterActive(filters, definition.id),
    ),
  );

  $effect(() => {
    if (open && !wasOpen) {
      screen =
        activeDefinitions.length === 0 && !drilldownActive
          ? { kind: 'subjects' }
          : { kind: 'home' };
      search = '';
    } else if (!open && wasOpen) {
      go({ kind: 'home' });
    }

    wasOpen = open;
  });

  function selectedOptions(id: OptionFilterId) {
    const byValue = new Map(
      options[id].map((option) => [option.value, option]),
    );
    return optionFilterState(filters, id).values.map(
      (value) => byValue.get(value) ?? { value, label: value, count: 0 },
    );
  }

  function valueSummary(id: FilterId) {
    if (id === 'date') return dateFilterSummary(filters, prefs);
    const labels = selectedOptions(id).map(
      (option) => option.shortLabel ?? option.label,
    );
    if (!labels.length) return 'Choose values';
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }

  function filteredOptions(id: OptionFilterId) {
    const query = search.trim();
    if (!query) return options[id];
    return options[id].filter((option) => matchesQuery(option, query));
  }

  function toggleValue(id: OptionFilterId, value: string) {
    const { values } = optionFilterState(filters, id);
    filters = setOptionFilter(filters, id, {
      values: values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
      operator: values.length ? undefined : pendingOperator,
    });
  }

  function setOperator(
    id: OptionFilterId,
    operator: OptionFilterOperator | MultiOptionFilterOperator,
  ) {
    if (optionFilterState(filters, id).values.length) {
      filters = setOptionFilter(filters, id, { operator });
    } else {
      pendingOperator = operator;
    }
  }

  const title = $derived.by(() => {
    if (screen.kind === 'subjects') return 'Add filter';
    if (screen.kind === 'filter') return filterDefinition(screen.id).label;
    if (screen.kind === 'date') return 'Date';
    return 'Filters';
  });
</script>

{#snippet optionIcon(option: FilterOption, size = 20)}
  {@const style = `--mobile-filter-icon-size: ${size}px`}
  {#if option.icon?.kind === 'flag'}
    <img
      src={`https://flagcdn.com/${option.icon.country.toLowerCase()}.svg`}
      alt=""
      class="h-[calc(var(--mobile-filter-icon-size)*0.72)] w-[var(--mobile-filter-icon-size)] rounded-[2px] object-cover"
      {style}
    />
  {:else if option.icon?.kind === 'logo'}
    <img
      src={option.icon.src}
      alt=""
      class="size-[var(--mobile-filter-icon-size)] object-contain"
      {style}
    />
  {:else if option.icon?.kind === 'avatar'}
    <UserAvatar
      username={option.icon.username}
      userId={option.icon.userId}
      avatarHash={option.icon.avatarHash ?? null}
      {size}
      animated={false}
      class="size-[var(--mobile-filter-icon-size)]"
      {style}
    />
  {/if}
{/snippet}

{#snippet valueIconStack(id: OptionFilterId)}
  {@const selected = selectedOptions(id)
    .filter((option) => option.icon)
    .slice(0, 3)}
  {#if selected.length}
    <span class="flex shrink-0 items-center pl-1">
      {#each selected as option, index (option.value)}
        <span
          class="-ml-1 flex size-5 items-center justify-center overflow-hidden"
          style={`z-index: ${selected.length - index}`}
        >
          {@render optionIcon(option, 16)}
        </span>
      {/each}
    </span>
  {/if}
{/snippet}

<Modal bind:open drawerNoPadding>
  <ModalHeader class="border-b px-4 py-3">
    <div class="flex min-h-9 items-center gap-2">
      {#if screen.kind !== 'home'}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          onclick={() => go({ kind: 'home' })}
        >
          <ChevronRight size={18} class="rotate-180" />
        </Button>
      {/if}
      <h2 class="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
      {#if screen.kind === 'home' && activeDefinitions.length > 0}
        <Button
          variant="ghost"
          size="sm"
          class="px-2 text-muted-foreground"
          onclick={() => (filters = createDefaultFilters())}
        >
          Clear
        </Button>
      {/if}
    </div>
  </ModalHeader>

  <ModalBody class="overflow-hidden p-0">
    <AnimatedSizeContainer height class="max-h-[72dvh]">
      {#if screen.kind === 'home'}
        <div class="flex max-h-[72dvh] flex-col gap-4 overflow-y-auto p-4">
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed bg-muted/25 p-3 text-left transition-colors active:bg-muted"
            onclick={() => go({ kind: 'subjects' })}
          >
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-background shadow-xs"
            >
              <Plus size={20} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">Add filter</span>
              <span class="block text-xs text-muted-foreground">
                Pick a field, operator, and values
              </span>
            </span>
            <ChevronRight size={18} class="text-muted-foreground" />
          </button>

          {#if activeDefinitions.length}
            <div class="space-y-2">
              {#each activeDefinitions as definition (definition.id)}
                <div
                  class="group flex w-full items-center gap-2 rounded-xl border bg-background p-2.5 shadow-xs"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-muted"
                    onclick={() => openFilter(definition.id)}
                  >
                    <span
                      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    >
                      <definition.icon size={17} aria-hidden />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate text-sm font-semibold">
                          {definition.label}
                        </span>
                        {#if definition.kind === 'option'}
                          <span
                            class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {optionFilterState(filters, definition.id).operator}
                          </span>
                        {/if}
                      </span>
                      <span
                        class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        {#if definition.kind === 'option'}
                          {@render valueIconStack(definition.id)}
                        {/if}
                        <span class="truncate">
                          {valueSummary(definition.id)}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-muted"
                    aria-label={`Remove ${definition.label} filter`}
                    onclick={() =>
                      (filters = clearFilter(filters, definition.id))}
                  >
                    <X size={16} />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
            >
              No filters applied.
            </div>
          {/if}
        </div>
      {:else if screen.kind === 'subjects'}
        <div class="flex max-h-[72dvh] flex-col">
          <div class="border-b p-3">
            <label
              class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm"
            >
              <Search size={16} class="text-muted-foreground" />
              <input
                bind:value={search}
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="Search filters"
              />
            </label>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            {#each subjectGroups as group (group.id)}
              <div
                class="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground"
              >
                {group.label}
              </div>
              {#each group.entries as { definition, matched } (definition.id)}
                {@const active = isFilterActive(filters, definition.id)}
                <button
                  type="button"
                  class="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-muted"
                  onclick={() => openFilter(definition.id, !!matched)}
                >
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <definition.icon size={17} aria-hidden />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold">
                      {definition.label}
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {#if matched}
                        {matched.join(', ')}
                      {:else}
                        {active ? valueSummary(definition.id) : 'Not applied'}
                      {/if}
                    </span>
                  </span>
                  {#if active}
                    <Check size={16} class="text-foreground" />
                  {:else}
                    <ChevronRight size={18} class="text-muted-foreground" />
                  {/if}
                </button>
              {/each}
            {:else}
              <div class="p-6 text-center text-sm text-muted-foreground">
                No matching filters.
              </div>
            {/each}
          </div>
        </div>
      {:else if screen.kind === 'filter'}
        {@const id = screen.id}
        {@const state = optionFilterState(filters, id)}
        {@const operator = state.values.length
          ? state.operator
          : (pendingOperator ?? state.operator)}
        <div class="flex max-h-[72dvh] flex-col">
          <div class="space-y-3 border-b p-3">
            <div class="flex gap-2 overflow-x-auto pb-0.5">
              {#each operatorChoices(id, state.values.length) as choice (choice.value)}
                <button
                  type="button"
                  class={cn(
                    'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
                    operator === choice.value
                      ? 'border-foreground bg-foreground text-background'
                      : 'bg-background text-muted-foreground active:bg-muted',
                  )}
                  onclick={() => setOperator(id, choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
            <label
              class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm"
            >
              <Search size={16} class="text-muted-foreground" />
              <input
                bind:value={search}
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder={`Search ${filterDefinition(id).label.toLowerCase()}`}
              />
            </label>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            {#each filteredOptions(id) as option (option.value)}
              {@const selected = state.values.includes(option.value)}
              {@const secondary = option.description ?? option.shortLabel}
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-muted"
                onclick={() => toggleValue(id, option.value)}
              >
                <span
                  class={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded border',
                    selected &&
                      'border-foreground bg-foreground text-background',
                  )}
                >
                  {#if selected}
                    <Check size={14} />
                  {/if}
                </span>
                {#if option.icon}
                  <span
                    class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm text-muted-foreground"
                  >
                    {@render optionIcon(option, 22)}
                  </span>
                {/if}
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">
                    {option.label}
                  </span>
                  {#if secondary}
                    <span class="block truncate text-xs text-muted-foreground">
                      {secondary}
                    </span>
                  {/if}
                </span>
                <span
                  class="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {option.count}
                </span>
              </button>
            {:else}
              <div class="p-6 text-center text-sm text-muted-foreground">
                No matching options.
              </div>
            {/each}
          </div>
        </div>
      {:else if screen.kind === 'date'}
        <MobileDateFilterScreen bind:filters />
      {/if}
    </AnimatedSizeContainer>
  </ModalBody>

  {#if screen.kind !== 'subjects'}
    {@const selectedCount =
      screen.kind === 'home'
        ? activeDefinitions.length
        : screen.kind === 'filter'
          ? optionFilterState(filters, screen.id).values.length
          : 0}
    <ModalFooter class="border-t p-3">
      <Button
        class="h-11 w-full"
        onclick={() =>
          screen.kind === 'home' ? (open = false) : go({ kind: 'home' })}
      >
        Done
        {#if selectedCount}
          <span
            class="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs"
          >
            {selectedCount}
          </span>
        {/if}
      </Button>
    </ModalFooter>
  {/if}
</Modal>
