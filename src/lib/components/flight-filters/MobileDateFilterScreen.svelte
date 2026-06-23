<script lang="ts">
  import { CalendarDate, type DateValue } from '@internationalized/date';
  import { ChevronLeft, ChevronRight } from '@o7/icon';
  import { DateRangePicker } from 'bits-ui';

  import {
    cloneFlightFilters,
    dateFilterSummary,
  } from '$lib/components/flight-filters/model';
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as CalendarParts from '$lib/components/ui/calendar';
  import { cn } from '$lib/utils';

  let {
    filters = $bindable(),
  }: {
    filters: FlightFilters;
  } = $props();

  let calendarPlaceholder = $state<DateValue | undefined>(undefined);

  function updateFilters(next: Partial<FlightFilters>) {
    filters = cloneFlightFilters(filters, next);
  }

  function setDateMode(mode: 'single' | 'range' | 'from' | 'to') {
    const today = new CalendarDate(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
    );
    const anchor = filters.fromDate ?? filters.toDate ?? today;

    if (mode === 'single') {
      updateFilters({ years: [], fromDate: anchor, toDate: anchor });
    } else if (mode === 'range') {
      updateFilters({
        years: [],
        fromDate: filters.fromDate ?? anchor,
        toDate: filters.toDate ?? anchor,
      });
    } else if (mode === 'from') {
      updateFilters({ years: [], fromDate: anchor, toDate: undefined });
    } else {
      updateFilters({ years: [], fromDate: undefined, toDate: anchor });
    }
  }

  function dateMode() {
    if (filters.fromDate && filters.toDate) {
      return filters.fromDate.compare(filters.toDate) === 0
        ? 'single'
        : 'range';
    }
    if (filters.fromDate) return 'from';
    if (filters.toDate) return 'to';
    return 'single';
  }

  function setThisYear() {
    const year = new Date().getFullYear();
    updateFilters({
      years: [],
      fromDate: new CalendarDate(year, 1, 1),
      toDate: new CalendarDate(year, 12, 31),
    });
  }

  const dateRangeValue = $derived.by(() => ({
    start: filters.fromDate,
    end:
      filters.fromDate && filters.toDate?.compare(filters.fromDate) === 0
        ? undefined
        : filters.toDate,
  }));

  $effect(() => {
    const anchor = filters.fromDate ?? filters.toDate;
    if (anchor && !calendarPlaceholder) calendarPlaceholder = anchor;
  });

  function handleDateRangeChange(
    value:
      | { start: DateValue | undefined; end: DateValue | undefined }
      | undefined,
  ) {
    const start = value?.start as CalendarDate | undefined;
    const end = value?.end as CalendarDate | undefined;
    const mode = dateMode();

    if (!start && !end) {
      updateFilters({ years: [], fromDate: undefined, toDate: undefined });
      return;
    }

    const anchor = start ?? end;
    if (anchor) calendarPlaceholder = anchor;

    if (mode === 'single') {
      updateFilters({ years: [], fromDate: anchor, toDate: anchor });
    } else if (mode === 'from') {
      updateFilters({ years: [], fromDate: anchor, toDate: undefined });
    } else if (mode === 'to') {
      updateFilters({ years: [], fromDate: undefined, toDate: anchor });
    } else {
      updateFilters({
        years: [],
        fromDate: start,
        toDate: end ?? start,
      });
    }
  }
</script>

<AnimatedSizeContainer height class="max-h-[72dvh]">
  <div class="max-h-[72dvh] overflow-y-auto p-4">
    <div class="mb-3 text-sm text-muted-foreground">
      {dateFilterSummary(filters)}
    </div>
    <div class="mb-4 flex gap-2 overflow-x-auto">
      {#each [{ value: 'single', label: 'Exact' }, { value: 'range', label: 'Range' }, { value: 'from', label: 'From' }, { value: 'to', label: 'Until' }] as mode (mode.value)}
        <button
          type="button"
          class={cn(
            'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
            dateMode() === mode.value
              ? 'border-foreground bg-foreground text-background'
              : 'bg-background text-muted-foreground active:bg-muted',
          )}
          onclick={() =>
            setDateMode(mode.value as 'single' | 'range' | 'from' | 'to')}
        >
          {mode.label}
        </button>
      {/each}
    </div>

    <DateRangePicker.Root
      value={dateRangeValue}
      onValueChange={handleDateRangeChange}
      bind:placeholder={calendarPlaceholder}
      weekdayFormat="short"
      fixedWeeks
      closeOnRangeSelect={false}
      class="mx-auto flex w-full max-w-[340px] flex-col gap-2"
    >
      <DateRangePicker.Calendar
        class="rounded-xl border bg-background p-3 shadow-xs"
      >
        {#snippet children({ months, weekdays })}
          <DateRangePicker.Header class="flex items-center justify-between">
            <CalendarParts.PrevButton>
              <ChevronLeft class="size-4" />
            </CalendarParts.PrevButton>
            <DateRangePicker.Heading class="text-sm font-medium" />
            <CalendarParts.NextButton>
              <ChevronRight class="size-4" />
            </CalendarParts.NextButton>
          </DateRangePicker.Header>
          <div class="pt-3">
            {#each months as month (month.value)}
              <DateRangePicker.Grid
                class="w-full border-collapse select-none space-y-1"
              >
                <DateRangePicker.GridHead>
                  <DateRangePicker.GridRow
                    class="mb-1 flex w-full justify-between"
                  >
                    {#each weekdays as day (day)}
                      <DateRangePicker.HeadCell
                        class="w-10 text-center text-xs font-normal text-muted-foreground"
                      >
                        {day.slice(0, 2)}
                      </DateRangePicker.HeadCell>
                    {/each}
                  </DateRangePicker.GridRow>
                </DateRangePicker.GridHead>
                <DateRangePicker.GridBody>
                  {#each month.weeks as weekDates (weekDates)}
                    <DateRangePicker.GridRow class="flex w-full">
                      {#each weekDates as date (date)}
                        <DateRangePicker.Cell
                          {date}
                          month={month.value}
                          class="relative m-0 size-10 overflow-visible p-0 text-center text-sm"
                        >
                          <DateRangePicker.Day
                            class={cn(
                              'group relative inline-flex size-10 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-sm font-normal transition-colors',
                              'hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring',
                              'data-disabled:pointer-events-none data-disabled:text-foreground/30 data-outside-month:pointer-events-none data-outside-month:text-muted-foreground/40',
                              'data-highlighted:rounded-none data-highlighted:bg-muted',
                              'data-selected:bg-muted data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:rounded-none',
                              'data-selection-start:rounded-md data-selection-start:bg-foreground data-selection-start:text-background data-selection-start:font-semibold',
                              'data-selection-end:rounded-md data-selection-end:bg-foreground data-selection-end:text-background data-selection-end:font-semibold',
                            )}
                          >
                            {date.day}
                          </DateRangePicker.Day>
                        </DateRangePicker.Cell>
                      {/each}
                    </DateRangePicker.GridRow>
                  {/each}
                </DateRangePicker.GridBody>
              </DateRangePicker.Grid>
            {/each}
          </div>
        {/snippet}
      </DateRangePicker.Calendar>
    </DateRangePicker.Root>

    <div class="mt-4 grid grid-cols-2 gap-2">
      <Button variant="outline" class="h-11" onclick={setThisYear}>
        This year
      </Button>
      <Button
        variant="outline"
        class="h-11"
        onclick={() =>
          updateFilters({
            years: [],
            fromDate: undefined,
            toDate: undefined,
          })}
      >
        Clear date
      </Button>
    </div>
  </div>
</AnimatedSizeContainer>
