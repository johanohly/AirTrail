<script lang="ts">
  import {
    Calendar as CalendarPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';

  import * as Calendar from './index.js';

  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    value = $bindable(),
    placeholder = $bindable(),
    class: className,
    weekdayFormat = 'short',
    minValue,
    maxValue,
    ...restProps
  }: WithoutChildrenOrChild<CalendarPrimitive.RootProps> = $props();

  const locale = navigator.language;

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
      const disabled =
        (minValue && i < minValue.year) || (maxValue && i > maxValue.year);
      years.push({ value: i, label: i.toString(), disabled });
    }
    return years;
  });
  const selectableMonths = $derived.by(() => {
    if (!placeholder) return [];
    const months = [];
    for (let i = 0; i < 12; i++) {
      const disabled =
        (minValue &&
          placeholder.year === minValue.year &&
          i < minValue.month) ||
        (maxValue && placeholder.year === maxValue.year && i > maxValue.month);
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

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<CalendarPrimitive.Root
  bind:value={value as never}
  bind:ref
  bind:placeholder
  {weekdayFormat}
  class={cn('p-3', className)}
  fixedWeeks={true}
  {locale}
  {minValue}
  {maxValue}
  {...restProps}
>
  {#snippet children({ months, weekdays })}
    <Calendar.Header>
      <Calendar.PrevButton />
      <Calendar.Heading bind:placeholder bind:mode />
      <Calendar.NextButton />
    </Calendar.Header>
    <div class="relative overflow-hidden">
      <Calendar.Months>
        {#each months as month}
          <Calendar.Grid>
            <Calendar.GridHead>
              <Calendar.GridRow class="flex">
                {#each weekdays as weekday}
                  <Calendar.HeadCell>
                    {weekday.slice(0, 2)}
                  </Calendar.HeadCell>
                {/each}
              </Calendar.GridRow>
            </Calendar.GridHead>
            <Calendar.GridBody>
              {#each month.weeks as weekDates}
                <Calendar.GridRow class="mt-2 w-full">
                  {#each weekDates as date}
                    <Calendar.Cell {date} month={month.value}>
                      <Calendar.Day />
                    </Calendar.Cell>
                  {/each}
                </Calendar.GridRow>
              {/each}
            </Calendar.GridBody>
          </Calendar.Grid>
        {/each}
      </Calendar.Months>
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
</CalendarPrimitive.Root>
