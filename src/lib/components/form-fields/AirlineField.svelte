<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import type { SuperForm } from 'sveltekit-superforms';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { fly } from 'svelte/transition';
  import { CircleX, ChevronDown, ChevronUp } from '@o7/icon/lucide';
  import { z } from 'zod';
  import type { flightSchema } from '$lib/zod/flight';
  import { writable } from 'svelte/store';
  import { type Airline, airlineFromICAO } from '$lib/utils/data/airlines';
  import { AIRLINES } from '$lib/data/airlines';
  import { sortAndFilterByMatch } from '$lib/utils';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  const selected = writable(
    $formData.airline
      ? {
          label: airlineFromICAO($formData.airline)?.name,
          value: $formData.airline,
        }
      : undefined,
  );

  const {
    elements: { menu, input, option },
    states: { open, inputValue, touchedInput },
  } = createCombobox<string>({
    forceVisible: true,
    selected,
  });
  selected.subscribe((item) => {
    $formData.airline = item?.value ?? null;
  });

  // If the field is updated externally, update the selected value
  formData.subscribe((data) => {
    if (data['airline'] === $selected?.value) return;
    selected.set(
      data['airline']
        ? {
            label: airlineFromICAO(data['airline'])?.name,
            value: data['airline'],
          }
        : undefined,
    );
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  let airlines: Airline[] = $state([]);
  $effect(() => {
    if ($touchedInput && $inputValue !== '') {
      airlines = sortAndFilterByMatch(AIRLINES, $inputValue, [
        { key: 'icao', exact: true },
        { key: 'iata', exact: true },
        { key: 'name', exact: false },
      ]);
    } else {
      airlines = [];
    }
  });
</script>

<Form.Field {form} name="airline" class="flex flex-col">
  <Form.Control let:attrs>
    <Form.Label>Airline</Form.Label>
    <div class="relative">
      <input
        use:melt={$input}
        class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 pr-12"
        placeholder="Select airline"
      />
      {#if $open && $selected}
        <button
          type="button"
          onclick={() => {
            // @ts-expect-error - This is totally fine
            $selected = undefined;
            $inputValue = '';
          }}
          class="cursor-pointer absolute right-10 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <CircleX size="20" />
        </button>
      {/if}
      <div
        class="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
      >
        {#if $open}
          <ChevronUp class="size-4" />
        {:else}
          <ChevronDown class="size-4" />
        {/if}
      </div>
    </div>
    <input hidden bind:value={$formData.airline} name={attrs.name} />
  </Form.Control>
  {#if $open}
    <ul
      class="z-[5000] flex max-h-[300px] flex-col overflow-hidden rounded-lg border"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <div
        class="flex max-h-full flex-col gap-0 overflow-y-auto bg-card px-2 py-2 text-card-foreground dark:bg-dark-1"
        tabindex="0"
      >
        {#each airlines as airline}
          <li
            use:melt={$option({
              value: airline.icao,
              label: airline.name,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md py-2 pl-4 pr-4
        data-[highlighted]:bg-zinc-300 data-[highlighted]:dark:bg-dark-2"
          >
            <div class="flex flex-col">
              <span class="text-lg truncate">{airline.name}</span>
              <span class="text-sm opacity-75"
                >{airline.icao}{airline.iata ? ` - ${airline.iata}` : ''}</span
              >
            </div>
          </li>
        {:else}
          <li class="relative cursor-pointer rounded-md py-1 pl-8 pr-4">
            {#if $inputValue}
              No airlines found.
            {:else}
              Start typing to search...
            {/if}
          </li>
        {/each}
      </div>
    </ul>
  {/if}
  <Form.FieldErrors />
</Form.Field>
