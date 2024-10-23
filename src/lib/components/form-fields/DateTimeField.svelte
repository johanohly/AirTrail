<script lang="ts">
  import { flyAndScale, toTitleCase } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button';
  import { type DateValue, parseDate } from '@internationalized/date';
  import { CalendarDays, ArrowLeft, ArrowRight, Info } from '@o7/icon/lucide';
  import { Input } from '$lib/components/ui/input';
  import * as Form from '$lib/components/ui/form';
  import { DatePicker } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { z } from 'zod';
  import type { flightSchema } from '$lib/zod/flight';
  import { dateValueFromISO } from '$lib/utils/datetime';

  let {
    field,
    form,
  }: {
    field: 'departure' | 'arrival';
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData, validate } = form;

  let dateValue: DateValue | undefined = $state(
    $formData[field] ? dateValueFromISO($formData[field]) : undefined,
  );
</script>

<div class="grid gap-2 grid-cols-[3fr_2fr]">
  <Form.Field {form} name={field} class="flex flex-col">
    <Form.Control let:attrs>
      <Form.Label>
        {toTitleCase(field)}{field === 'departure' ? ' *' : ''}
      </Form.Label>
      <DatePicker.Root
        bind:value={dateValue}
        onValueChange={(value) => {
          if (value === undefined) {
            $formData[field] = undefined;
            validate(field);
            return;
          }
          $formData[field] = value.toDate('UTC').toISOString();
          validate(field);
        }}
        granularity="day"
        weekdayFormat="short"
        fixedWeeks={true}
        weekStartsOn={1}
        minValue={parseDate('1970-01-01')}
        locale={navigator.language}
      >
        <div class="flex w-full max-w-[232px] flex-col gap-1.5">
          <DatePicker.Input
            let:segments
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#each segments as { part, value }}
              <div class="inline-block select-none">
                {#if part === 'literal'}
                  <DatePicker.Segment {part} class="text-muted-foreground">
                    {value}
                  </DatePicker.Segment>
                {:else}
                  <DatePicker.Segment
                    {part}
                    class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:!ring-0 focus-visible:!ring-offset-0 aria-[valuetext=Empty]:text-muted-foreground"
                  >
                    {value}
                  </DatePicker.Segment>
                {/if}
              </div>
            {/each}
            <DatePicker.Trigger
              class="ml-auto inline-flex items-center justify-center text-muted-foreground transition-all hover:text-foreground active:text-foreground"
              {...attrs}
            >
              <CalendarDays size="20" />
            </DatePicker.Trigger>
          </DatePicker.Input>
          <DatePicker.Content
            sideOffset={6}
            transition={flyAndScale}
            transitionConfig={{ duration: 150, y: -8 }}
            class="z-50"
          >
            <DatePicker.Calendar
              class="rounded-[15px] border bg-popover p-[22px] shadow-popover"
              let:months
              let:weekdays
            >
              <DatePicker.Header class="flex items-center justify-between">
                <DatePicker.PrevButton
                  class={buttonVariants({ variant: 'outline', size: 'icon' })}
                >
                  <ArrowLeft />
                </DatePicker.PrevButton>
                <DatePicker.Heading class="text-[15px] font-medium" />
                <DatePicker.NextButton
                  class={buttonVariants({ variant: 'outline', size: 'icon' })}
                >
                  <ArrowRight />
                </DatePicker.NextButton>
              </DatePicker.Header>
              <div
                class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0"
              >
                {#each months as month}
                  <DatePicker.Grid
                    class="w-full border-collapse select-none space-y-1"
                  >
                    <DatePicker.GridHead>
                      <DatePicker.GridRow
                        class="mb-1 flex w-full justify-between"
                      >
                        {#each weekdays as day}
                          <DatePicker.HeadCell
                            class="w-10 rounded-md text-xs !font-normal text-muted-foreground"
                          >
                            <div>{day.slice(0, 2)}</div>
                          </DatePicker.HeadCell>
                        {/each}
                      </DatePicker.GridRow>
                    </DatePicker.GridHead>
                    <DatePicker.GridBody>
                      {#each month.weeks as weekDates}
                        <DatePicker.GridRow class="flex w-full">
                          {#each weekDates as date}
                            <DatePicker.Cell
                              {date}
                              class="relative size-10 !p-0 text-center text-sm"
                            >
                              <DatePicker.Day
                                {date}
                                month={month.value}
                                class="group relative inline-flex size-10 items-center justify-center whitespace-nowrap rounded-[9px] border border-transparent bg-transparent p-0 text-sm font-normal text-foreground transition-all hover:border-foreground data-[disabled]:pointer-events-none data-[outside-month]:pointer-events-none data-[selected]:bg-foreground data-[selected]:font-medium data-[disabled]:text-foreground/30 data-[selected]:text-background data-[unavailable]:text-muted-foreground data-[unavailable]:line-through"
                              >
                                <div
                                  class="absolute top-[5px] hidden size-1 rounded-full bg-foreground transition-all group-data-[today]:block group-data-[selected]:bg-background"
                                />
                                {date.day}
                              </DatePicker.Day>
                            </DatePicker.Cell>
                          {/each}
                        </DatePicker.GridRow>
                      {/each}
                    </DatePicker.GridBody>
                  </DatePicker.Grid>
                {/each}
              </div>
            </DatePicker.Calendar>
          </DatePicker.Content>
        </div>
      </DatePicker.Root>
      <input hidden bind:value={$formData[field]} name={attrs.name} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name={`${field}Time`} class="flex flex-col">
    <Form.Control let:attrs>
      <Form.Label class="flex gap-1">
        Time
        <TextTooltip
          text="Local time. Time can be in 24-hour and 12-hour format."
        >
          <Info size="15" />
        </TextTooltip>
      </Form.Label>
      <Input {...attrs} bind:value={$formData[`${field}Time`]} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</div>
