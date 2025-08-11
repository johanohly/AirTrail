<script lang="ts">
  import { type DateValue, parseDate } from '@internationalized/date';
  import { CalendarDays } from '@o7/icon/lucide';
  import { DateField } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { toTitleCase } from '$lib/utils';
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

  let dateValue: DateValue | undefined = $state(
    $formData[field] ? dateValueFromISO($formData[field]) : undefined,
  );
</script>

<div class="grid gap-2 grid-cols-[3fr_2fr]">
  <Form.Field {form} name={field} class="flex flex-col">
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
          <div class="flex w-full max-w-[232px] flex-col gap-1.5">
            <DateField.Input
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <CalendarDays size="20" />
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
  <Form.Field {form} name={`${field}Time`} class="flex flex-col">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="flex gap-1">
          Time
          <HelpTooltip
            text="Local time. Time can be in 24-hour and 12-hour format."
          />
        </Form.Label>
        <Input {...props} bind:value={$formData[`${field}Time`]} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</div>
