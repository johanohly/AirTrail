<script lang="ts">
  import { type DateValue, parseDate, Time } from '@internationalized/date';
  import { CalendarDays } from '@o7/icon/lucide';
  import { DateField, TimeField } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { cn, toTitleCase } from '$lib/utils';
  import { dateValueFromISO } from '$lib/utils/datetime';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    field,
    form,
  }: {
    field: 'departure' | 'arrival';
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData, validate } = form;

  const timePartsRegex = /^(\d{1,2})(?::|\.|)(\d{2})(?:\s?(am|pm))?$/i;
  const parseTimeValue = (value: string) => {
    const match = value.trim().match(timePartsRegex);
    if (!match) return undefined;

    const [, hourPart, minutePart, ampm] = match;
    if (!hourPart || !minutePart) return undefined;

    let hours = Number(hourPart);
    const minutes = Number(minutePart);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;

    if (ampm) {
      const period = ampm.toLowerCase();
      if (period === 'pm' && hours < 12) {
        hours += 12;
      }
      if (period === 'am' && hours === 12) {
        hours = 0;
      }
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return undefined;
    }

    return new Time(hours, minutes);
  };

  const formatTimeValue = (value: Time) => {
    const pad = (part: number) => part.toString().padStart(2, '0');
    return `${pad(value.hour)}:${pad(value.minute)}`;
  };

  let dateValue: DateValue | undefined = $state(
    $formData[field] ? dateValueFromISO($formData[field]) : undefined,
  );

  let timeValue: Time | undefined = $state(
    $formData[`${field}Time`]
      ? parseTimeValue($formData[`${field}Time`])
      : undefined,
  );

  $effect(() => {
    if ($formData[field]) {
      const date = dateValueFromISO($formData[field]);
      if (!dateValue || date.compare(dateValue) !== 0) {
        dateValue = date;
      }
    } else {
      dateValue = undefined;
    }
  });

  $effect(() => {
    const timeString = $formData[`${field}Time`];
    if (timeString) {
      const parsed = parseTimeValue(timeString);
      if (!parsed) {
        timeValue = undefined;
        return;
      }

      if (
        !timeValue ||
        parsed.hour !== timeValue.hour ||
        parsed.minute !== timeValue.minute
      ) {
        timeValue = parsed;
      }
    } else {
      timeValue = undefined;
    }
  });
</script>

<div class="grid gap-2 grid-cols-[3fr_2fr] items-start">
  <Form.Field {form} name={field}>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>
          {toTitleCase(field)}{field === 'departure' ? ' *' : ''}
        </Form.Label>
        <DateField.Root
          value={dateValue}
          onValueChange={(v) => {
            if (v === undefined) {
              dateValue = undefined;
              $formData[field] = null;
              validate(field);
              return;
            }
            dateValue = v;
            $formData[field] = dateValue.toDate('UTC').toISOString();
            validate(field);
          }}
          granularity="day"
          minValue={parseDate('1970-01-01')}
          locale={navigator.language}
        >
          <div class="flex w-full flex-col gap-1.5">
            <DateField.Input
              class={cn(
                'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
              )}
            >
              {#snippet children({ segments })}
                {#each segments as { part, value }}
                  <div class="inline-block select-none">
                    {#if part === 'literal'}
                      <DateField.Segment {part} class="text-muted-foreground">
                        {value}
                      </DateField.Segment>
                    {:else}
                      <DateField.Segment
                        {part}
                        class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
                      >
                        {value}
                      </DateField.Segment>
                    {/if}
                  </div>
                {/each}
                <Popover.Root>
                  <Popover.Trigger
                    {...props}
                    class="ml-auto inline-flex items-center justify-center text-muted-foreground transition-all hover:text-foreground active:text-foreground"
                  >
                    <CalendarDays size={16} />
                  </Popover.Trigger>
                  <Popover.Content class="p-0">
                    <Calendar
                      type="single"
                      value={dateValue}
                      onValueChange={(v) => {
                        if (v === undefined) {
                          dateValue = undefined;
                          $formData[field] = null;
                          validate(field);
                          return;
                        }
                        dateValue = v;
                        $formData[field] = dateValue
                          ?.toDate('UTC')
                          .toISOString();
                        validate(field);
                      }}
                    />
                  </Popover.Content>
                </Popover.Root>
              {/snippet}
            </DateField.Input>
          </div>
        </DateField.Root>
        <input hidden bind:value={$formData[field]} name={props.name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name={`${field}Time`}>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="flex items-center gap-2">
          Time
          <HelpTooltip text="Local airport time." />
        </Form.Label>
        <TimeField.Root
          value={timeValue}
          onValueChange={(value) => {
            if (!value) {
              timeValue = undefined;
              $formData[`${field}Time`] = null;
              validate(`${field}Time`);
              return;
            }

            timeValue = value;
            $formData[`${field}Time`] = formatTimeValue(value);
            validate(`${field}Time`);
          }}
          granularity="minute"
          locale={navigator.language}
        >
          <div class="flex w-full flex-col gap-1.5">
            <TimeField.Input
              class={cn(
                'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
              )}
            >
              {#snippet children({ segments })}
                {#each segments as { part, value }}
                  <div class="inline-block select-none">
                    {#if part === 'literal'}
                      <TimeField.Segment {part} class="text-muted-foreground">
                        {value}
                      </TimeField.Segment>
                    {:else}
                      <TimeField.Segment
                        {part}
                        class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
                      >
                        {value}
                      </TimeField.Segment>
                    {/if}
                  </div>
                {/each}
              {/snippet}
            </TimeField.Input>
          </div>
        </TimeField.Root>
        <input
          hidden
          bind:value={$formData[`${field}Time`]}
          name={props.name}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</div>
