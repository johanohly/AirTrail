<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import FlightInformation from './FlightInformation.svelte';
  import FlightNumber from './FlightNumber.svelte';
  import SeatInformation from './SeatInformation.svelte';

  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<Infer<typeof flightSchema>>;
  } = $props();
</script>

<div
  class="grid w-full gap-y-4 max-md:overflow-auto md:grid-cols-[3fr_2fr] max-md:max-h-[calc(100dvh-200px)] max-md:min-h-[min(566px,_calc(100dvh-200px))]"
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
