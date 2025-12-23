<script lang="ts">
  import { ChevronRight, Globe } from '@o7/icon';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import FlightInformation from './FlightInformation.svelte';
  import FlightNumber from './FlightNumber.svelte';
  import SeatInformation from './SeatInformation.svelte';

  import { page } from '$app/state';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Modal, ModalFooter, ModalHeader } from '$lib/components/ui/modal';
  import { flightAddedState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { flightSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
      validators: zod(flightSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.flight.list.utils.invalidate();
            open = false;
            flightAddedState.added = true;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;

  $effect(() => {
    if ($formData.seats[0] && $formData.seats[0].userId === '<USER_ID>') {
      $formData.seats[0].userId = page.data.user?.id ?? null;
    }
  });
</script>

<Modal bind:open closeOnOutsideClick={false} class="max-w-screen-lg gap-0">
  <ModalHeader>
    <div class="flex min-w-0 max-w-full items-center gap-1">
      <div class="flex min-w-0 items-center gap-2 px-1.5">
        <span class="min-w-0 truncate text-sm font-semibold">Flights</span>
      </div>
      <ChevronRight size={14} class="text-muted-foreground shrink-0" />
      <div class="flex min-w-0 items-center gap-2 px-1">
        <div
          class="flex items-center justify-center rounded-full bg-muted px-0 size-5 shrink-0"
        >
          <Globe size={14} />
        </div>
        <h3 class="!mt-0 max-w-sm truncate text-sm font-medium">New flight</h3>
      </div>
    </div>
  </ModalHeader>
  <form method="POST" action="/api/flight/save/form" use:enhance>
    <div
      class="grid w-full gap-y-4 max-md:overflow-auto md:grid-cols-[1fr_1fr] max-md:max-h-[calc(100dvh-200px)] max-md:min-h-[min(566px,_calc(100dvh-200px))]"
    >
      <!-- First column: uses contents on mobile to flatten, block on desktop to group -->
      <div
        class="contents md:flex md:min-h-[min(566px,_calc(100dvh-200px))] md:max-h-[calc(100dvh-200px)] md:flex-col md:gap-4 md:overflow-auto md:scrollbar-hide md:px-6 md:py-4"
      >
        <div class="order-1 px-6 md:order-none md:px-0">
          <div class="flex flex-col gap-4 py-4 md:py-0">
            <FlightNumber {form} />
            <AirportField field="from" {form} />
            <AirportField field="to" {form} />
            <DateTimeField field="departure" {form} />
            <DateTimeField field="arrival" {form} />
          </div>
        </div>
        <div class="order-3 px-6 md:order-none md:px-0">
          <div class="flex flex-col gap-4 py-4 md:py-0">
            <FlightInformation {form} />
          </div>
        </div>
      </div>
      <div
        class="order-2 scrollbar-hide px-6 md:order-none md:max-h-[calc(100dvh-200px)] md:min-h-[min(566px,_calc(100dvh-200px))] md:overflow-auto md:pl-0"
      >
        <div class="relative">
          <div
            class="absolute inset-0 rounded-xl border bg-neutral-50 dark:bg-input/30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          ></div>
          <div class="relative px-4 py-3">
            <SeatInformation {form} />
          </div>
        </div>
      </div>
    </div>
    <ModalFooter>
      <Form.Button size="sm">Add Flight</Form.Button>
    </ModalFooter>
  </form>
</Modal>
