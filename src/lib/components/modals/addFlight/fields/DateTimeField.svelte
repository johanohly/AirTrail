<script lang="ts">
  import { cn, toTitleCase } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button';
  import * as df from '@layerstack/utils';
  import {
    type DateValue,
    getLocalTimeZone,
    parseDate,
  } from '@internationalized/date';
  import { Calendar } from '$lib/components/ui/calendar';
  import { CalendarDays } from '@o7/icon/lucide';
  import { Input } from '$lib/components/ui/input';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import type { SuperForm } from 'sveltekit-superforms';
  import { Info } from '@o7/icon/lucide';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { z } from 'zod';
  import type { addFlightSchema } from '$lib/zod/flight';

  let {
    field,
    form,
    formData,
    validate,
  }: {
    field: 'departure' | 'arrival';
    form: SuperForm<z.infer<typeof addFlightSchema>>;
    formData: typeof form.form;
    validate: typeof form.validate;
  } = $props();

  let dateValue: DateValue | undefined = $state(
    $formData[field] ? parseDate($formData[field]) : undefined,
  );
</script>

<div class="grid gap-2 grid-cols-[3fr_2fr]">
  <Form.Field {form} name={field} class="flex flex-col">
    <Form.Control let:attrs>
      <Form.Label>
        {toTitleCase(field)}{field === 'departure' ? ' *' : ''}
      </Form.Label>
      <Popover.Root>
        <Popover.Trigger
          class={cn(
            buttonVariants({ variant: 'outline' }),
            'h-10 justify-start text-left font-normal',
            !dateValue && 'text-muted-foreground',
          )}
          {...attrs}
        >
          <CalendarDays class="mr-2" size="16" />
          {dateValue
            ? df.format(dateValue.toDate(getLocalTimeZone()))
            : 'Pick a date'}
        </Popover.Trigger>
        <Popover.Content class="w-auto p-0" align="start">
          <Calendar
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
          />
        </Popover.Content>
      </Popover.Root>
      <input hidden bind:value={$formData[field]} name={attrs.name} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name={`${field}Time`} class="flex flex-col">
    <Form.Control let:attrs>
      <Form.Label class="flex gap-1">
        Time
        <TextTooltip text="Time can be in 24-hour and 12-hour format">
          <Info size="15" />
        </TextTooltip>
      </Form.Label>
      <Input {...attrs} bind:value={$formData[`${field}Time`]} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</div>
