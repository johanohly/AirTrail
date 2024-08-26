<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { addFlightSchema } from '$lib/zod/flight';
  import { zod } from 'sveltekit-superforms/adapters';
  import { Input } from '$lib/components/ui/input';
  import { toast } from 'svelte-sonner';
  import {
    type DateValue,
    getLocalTimeZone,
    parseDate,
  } from '@internationalized/date';
  import { buttonVariants } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import * as df from '@layerstack/utils';
  import { Calendar } from '$lib/components/ui/calendar';
  import { CalendarDays } from '@o7/icon/lucide';

  let {
    open = $bindable(),
    invalidator,
  }: { open: boolean; invalidator: { onSuccess: () => void } } = $props();

  type Message = { type: 'success' | 'error'; text: string };

  const form = superForm(
    defaults<Infer<typeof addFlightSchema>, Message>(zod(addFlightSchema)),
    {
      validators: zod(addFlightSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            invalidator.onSuccess();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance, validate } = form;

  let departureValue: DateValue | undefined = $state(
    $formData.departure ? parseDate($formData.departure) : undefined,
  );
</script>

<Modal bind:open dialogOnly>
  <h1>Add Flight</h1>
  <form method="POST" action="?/add-flight" use:enhance>
    <Form.Field {form} name="from">
      <Form.Control let:attrs>
        <Form.Label>From</Form.Label>
        <Input {...attrs} bind:value={$formData.from} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="to">
      <Form.Control let:attrs>
        <Form.Label>To</Form.Label>
        <Input {...attrs} bind:value={$formData.to} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="departure" class="flex flex-col">
      <Form.Control let:attrs>
        <Form.Label>Departure</Form.Label>
        <Popover.Root>
          <Popover.Trigger
            class={cn(
              buttonVariants({ variant: 'outline' }),
              'w-[240px] justify-start text-left font-normal',
              !departureValue && 'text-muted-foreground',
            )}
            {...attrs}
          >
            <CalendarDays class="mr-2" size="16" />
            {departureValue
              ? df.format(departureValue.toDate(getLocalTimeZone()))
              : 'Pick a date'}
          </Popover.Trigger>
          <Popover.Content class="w-auto p-0" align="start">
            <Calendar
              bind:value={departureValue}
              onValueChange={(value) => {
                if (value === undefined) {
                  $formData.departure = undefined;
                  validate('departure');
                  return;
                }
                $formData.departure = value.toDate('UTC').toISOString();
                validate('departure');
              }}
            />
          </Popover.Content>
          <input hidden bind:value={$formData.departure} name={attrs.name} />
        </Popover.Root>
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Button>Add Flight</Form.Button>
  </form>
</Modal>
