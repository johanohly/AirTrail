<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import * as Calendar from '$lib/components/ui/calendar';
  import * as Select from '$lib/components/ui/select';
  import { Calendar as CalendarPrimitive } from 'bits-ui';
  import { Button } from '$lib/components/ui/button';
  import { CalendarArrowUp, CalendarArrowDown } from '@o7/icon/lucide';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import {
    type CalendarDate,
    DateFormatter,
    getLocalTimeZone,
    today,
  } from '@internationalized/date';
  import { MONTHS } from '$lib/data/datetime';

  let {
    date = $bindable(),
    title,
    iconDirection,
    disabled,
  }: {
    date: CalendarDate | undefined;
    title: string;
    iconDirection: 'up' | 'down';
    disabled: boolean;
  } = $props();

  let open = $state(false);
  const monthOptions = MONTHS.map((month, i) => ({
    value: String(i + 1),
    label: month,
  }));

  const monthFmt = new DateFormatter('en-US', {
    month: 'long',
  });
  const yearOptions = Array.from({ length: 100 }, (_, i) => ({
    label: String(new Date().getFullYear() - i),
    value: String(new Date().getFullYear() - i),
  }));

  let placeholder = $state(today(getLocalTimeZone()));
  const defaultYear = $derived.by(() => {
    return placeholder ? String(placeholder.year) : undefined;
  });
  const defaultMonth = $derived.by(() => {
    return placeholder ? String(placeholder.month) : undefined;
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        size="sm"
        class="h-8 border-dashed"
        {...props}
        {disabled}
      >
        {#if iconDirection === 'up'}
          <CalendarArrowUp size={20} class="mr-2" />
        {:else}
          <CalendarArrowDown size={20} class="mr-2" />
        {/if}
        {title}

        {#if date}
          <Separator orientation="vertical" class="mx-2 h-4" />
          <Badge variant="secondary" class="rounded-sm px-1 font-normal">
            {date.toString()}
          </Badge>
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="max-w-[400px] p-0" align="start" side="bottom">
    <CalendarPrimitive.Root
      type="single"
      weekdayFormat="short"
      class="rounded-md border p-3"
      bind:value={date}
      bind:placeholder
    >
      {#snippet children({ months, weekdays })}
        <Calendar.Header>
          <Calendar.Heading
            class="flex w-full items-center justify-between gap-2"
          >
            <Select.Root
              type="single"
              value={defaultMonth}
              items={monthOptions}
              onValueChange={(v) => {
                if (!v || !placeholder) return;
                if (v === String(placeholder?.month)) return;
                placeholder = placeholder.set({ month: +v });
              }}
            >
              <Select.Trigger aria-label="Select month" class="w-[60%]">
                {monthFmt.format(placeholder.toDate('UTC'))}
              </Select.Trigger>
              <Select.Content class="max-h-[200px] overflow-y-auto">
                {#each monthOptions as { value, label }}
                  <Select.Item {value} {label}>
                    {label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Select.Root
              type="single"
              value={defaultYear}
              items={yearOptions}
              onValueChange={(v) => {
                if (!v || !placeholder) return;
                if (v === String(placeholder?.year)) return;
                placeholder = placeholder.set({ year: +v });
              }}
            >
              <Select.Trigger aria-label="Select year" class="w-[40%]">
                {placeholder.year}
              </Select.Trigger>
              <Select.Content class="max-h-[200px] overflow-y-auto">
                {#each yearOptions as { value, label }}
                  <Select.Item {value} {label}>
                    {label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Calendar.Heading>
        </Calendar.Header>
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
      {/snippet}
    </CalendarPrimitive.Root>
  </Popover.Content>
</Popover.Root>
