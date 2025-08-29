<script lang="ts" generics="T extends Record<string, unknown>">
  import { type DateValue, parseDate } from '@internationalized/date';
  import { CalendarDays, ChevronLeft, ChevronRight, X } from '@o7/icon/lucide';
  import { DateRangePicker } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import * as Calendar from '$lib/components/ui/calendar';
  import { Portal } from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';

  let {
    form,
    startName,
    endName,
    label,
    required = false,
  }: {
    form: SuperForm<T>;
    startName: string;
    endName: string;
    label: string;
    required?: boolean;
  } = $props();

  const { form: formData, validate } = form;

  const minValue = parseDate('1970-01-01');
  const locale = navigator.language;

  // Convert string dates to DateValue for the component
  let dateRange: { start: DateValue | undefined; end: DateValue | undefined } =
    $state({
      start: $formData[startName] ? parseDate($formData[startName]) : undefined,
      end: $formData[endName] ? parseDate($formData[endName]) : undefined,
    });

  // Handle date range changes from the DateRangePicker
  function handleValueChange(
    value:
      | { start: DateValue | undefined; end: DateValue | undefined }
      | undefined,
  ) {
    if (!value) {
      // Clear both dates
      $formData[startName] = '';
      $formData[endName] = '';
    } else {
      // Update form data with new values
      $formData[startName] = value.start ? value.start.toString() : '';
      $formData[endName] = value.end ? value.end.toString() : '';
    }

    // Validate both fields
    validate(startName);
    validate(endName);
  }

  let placeholder: DateValue | undefined = $state(undefined);
  let mode: 'normal' | 'year' | 'month' = $state('normal');
  let yearEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (mode === 'year' && yearEl) {
      yearEl.scrollIntoView();
    }
  });

  const selectableYears = $derived.by(() => {
    const years = [];
    for (let i = 1912; i <= 2100; i++) {
      const disabled = minValue && i < minValue.year;
      years.push({ value: i, label: i.toString(), disabled });
    }
    return years;
  });

  const selectableMonths = $derived.by(() => {
    if (!placeholder) return [];
    const months = [];
    for (let i = 0; i < 12; i++) {
      const disabled =
        minValue && placeholder.year === minValue.year && i < minValue.month;
      months.push({
        value: i + 1,
        label: new Date(0, i).toLocaleString(locale, { month: 'short' }),
        disabled,
      });
    }
    return months;
  });

  const selectYear = (value: number) => {
    placeholder = placeholder?.set({ year: value });
    mode = 'month';
  };

  const selectMonth = (value: number) => {
    placeholder = placeholder?.set({ month: value });
    mode = 'normal';
  };
</script>

<DateRangePicker.Root
  bind:placeholder
  value={dateRange.start && dateRange.end ? dateRange : undefined}
  onValueChange={handleValueChange}
  weekdayFormat="short"
  fixedWeeks={true}
  class="flex w-full max-w-[340px] flex-col gap-1.5"
  {locale}
  {minValue}
>
  <DateRangePicker.Label class="text-sm font-medium">
    {label}{required ? ' *' : ''}
  </DateRangePicker.Label>
  <div
    class={cn(
      'border-input bg-background text-foreground focus-within:border-border-input-hover focus-within:shadow-date-field-focus hover:border-border-input-hover flex w-full select-none items-center border px-2 py-3 text-sm tracking-[0.01em]',
      'h-9 rounded-md shadow-xs transition-[color,box-shadow]',
      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    )}
  >
    {#each ['start', 'end'] as type (type)}
      <DateRangePicker.Input {type}>
        {#snippet children({ segments })}
          {#each segments as { part, value }, i (part + i)}
            <div class="inline-block select-none">
              {#if part === 'literal'}
                <DateRangePicker.Segment
                  {part}
                  class="text-muted-foreground p-1"
                >
                  {value}
                </DateRangePicker.Segment>
              {:else}
                <DateRangePicker.Segment
                  {part}
                  class="rounded-md hover:bg-muted focus:bg-muted focus:text-foreground aria-[valuetext=Empty]:text-muted-foreground focus-visible:ring-0! focus-visible:ring-offset-0! px-1 py-1"
                >
                  {value}
                </DateRangePicker.Segment>
              {/if}
            </div>
          {/each}
        {/snippet}
      </DateRangePicker.Input>
      {#if type === 'start'}
        <div aria-hidden="true" class="text-muted-foreground px-1">–</div>
      {/if}
    {/each}
    {#if $formData[startName] || $formData[endName]}
      <button
        type="button"
        onclick={() => {
          $formData[startName] = '';
          $formData[endName] = '';
          dateRange = { start: undefined, end: undefined };
        }}
        class="text-foreground/60 hover:bg-muted active:bg-dark-10 ml-auto inline-flex size-7 items-center justify-center rounded-md transition-all"
      >
        <X size={16} />
      </button>
    {/if}
    <DateRangePicker.Trigger
      class="text-foreground/60 hover:bg-muted active:bg-dark-10 ml-auto inline-flex size-7 items-center justify-center rounded-md transition-all"
    >
      <CalendarDays size={16} />
    </DateRangePicker.Trigger>
  </div>

  <Portal>
    <DateRangePicker.Content class="z-50">
      <DateRangePicker.Calendar
        class="rounded-md border bg-background shadow-md mt-2 p-3"
      >
        {#snippet children({ months, weekdays })}
          <DateRangePicker.Header class="flex items-center justify-between">
            <Calendar.PrevButton>
              <ChevronLeft class="size-4" />
            </Calendar.PrevButton>
            <Calendar.Heading bind:placeholder bind:mode />
            <Calendar.NextButton>
              <ChevronRight class="size-4" />
            </Calendar.NextButton>
          </DateRangePicker.Header>
          <div class="relative overflow-hidden">
            <div
              class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0"
            >
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
                          class="text-muted-foreground font-normal w-10 rounded-md text-xs"
                        >
                          <div>{day.slice(0, 2)}</div>
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
                            class="relative m-0 size-10 overflow-visible text-center text-sm focus-within:relative focus-within:z-20 p-0"
                          >
                            <DateRangePicker.Day
                              class={cn(
                                'rounded-md text-foreground hover:border-foreground focus-visible:ring-foreground',
                                'data-selection-end:rounded-md data-selection-start:rounded-md data-highlighted:bg-muted data-selected:bg-muted',
                                'data-selection-end:bg-foreground data-selection-start:bg-foreground',
                                'data-disabled:text-foreground/30 data-selected:text-foreground',
                                'data-selection-end:text-background data-selection-start:text-background',
                                'data-unavailable:text-muted-foreground',
                                'data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:focus-visible:border-foreground',
                                'data-disabled:pointer-events-none data-highlighted:rounded-none',
                                'data-outside-month:pointer-events-none data-selected:font-medium',
                                'data-selection-end:font-medium data-selection-start:font-medium',
                                'data-selection-start:focus-visible:ring-2 data-selection-start:focus-visible:ring-offset-2',
                                'data-unavailable:line-through',
                                'data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:rounded-none',
                                'data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:focus-visible:ring-0',
                                'data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:focus-visible:ring-offset-0',
                                'group relative inline-flex size-10 items-center justify-center overflow-visible whitespace-nowrap border border-transparent bg-transparent p-0 text-sm font-normal transition-all',
                              )}
                            >
                              <div
                                class="bg-foreground group-data-selected:bg-background group-data-today:block absolute top-[5px] hidden size-1 rounded-full transition-all"
                              ></div>
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
            <div
              class={cn('bg-popover absolute inset-0 z-10', {
                hidden: mode === 'normal',
              })}
            >
              <ScrollArea class="h-full">
                {#if mode === 'year'}
                  <div class="grid grid-cols-4">
                    {#each selectableYears as year}
                      {#snippet yearBtn()}
                        <Button
                          onclick={() => selectYear(year.value)}
                          disabled={year.disabled}
                          variant={year.value === placeholder?.year
                            ? 'default'
                            : 'ghost'}
                          class="rounded-full"
                        >
                          {year.label}
                        </Button>
                      {/snippet}
                      {#if year.value === placeholder?.year}
                        <div bind:this={yearEl} class="z-10">
                          {@render yearBtn()}
                        </div>
                      {:else}
                        <div>
                          {@render yearBtn()}
                        </div>
                      {/if}
                    {/each}
                  </div>
                {:else if mode === 'month'}
                  <div class="grid grid-cols-3 gap-4">
                    {#each selectableMonths as month}
                      <Button
                        onclick={() => selectMonth(month.value)}
                        size="lg"
                        disabled={month.disabled}
                        variant={month.value === placeholder?.month
                          ? 'default'
                          : 'ghost'}
                        class="rounded-full"
                      >
                        {month.label}
                      </Button>
                    {/each}
                  </div>
                {/if}
              </ScrollArea>
            </div>
          </div>
        {/snippet}
      </DateRangePicker.Calendar>
    </DateRangePicker.Content>
  </Portal>
</DateRangePicker.Root>

<!-- Hidden form inputs for form submission -->
<input type="hidden" name={startName} bind:value={$formData[startName]} />
<input type="hidden" name={endName} bind:value={$formData[endName]} />
