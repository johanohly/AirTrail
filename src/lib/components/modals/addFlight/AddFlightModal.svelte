<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import SuperDebug, {
    defaults,
    type Infer,
    superForm,
  } from 'sveltekit-superforms';
  import { addFlightSchema } from '$lib/zod/flight';
  import { zod } from 'sveltekit-superforms/adapters';
  import { toast } from 'svelte-sonner';
  import {
    AirportField,
    DateTimeField,
  } from '$lib/components/modals/addFlight/fields';
  import { cn, toTitleCase } from '$lib/utils';
  import { buttonVariants } from '$lib/components/ui/button';
  import * as df from '@layerstack/utils';
  import { getLocalTimeZone } from '@internationalized/date';
  import { CalendarDays, Info } from '@o7/icon/lucide';
  import { Calendar } from '$lib/components/ui/calendar';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { Input } from '$lib/components/ui/input';

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
</script>

<Modal bind:open dialogOnly closeOnOutsideClick={false}>
  <h1>Add Flight</h1>
  <form method="POST" action="?/add-flight" class="grid gap-4" use:enhance>
    <SuperDebug data={$formData} />
    <AirportField field="from" {form} {formData} />
    <AirportField field="to" {form} {formData} />
    <DateTimeField field="departure" {form} {formData} {validate} />
    <DateTimeField field="arrival" {form} {formData} {validate} />
    <button type="submit">Submit</button>
    <!--<Form.Button>Add Flight</Form.Button> -->
  </form>
</Modal>
