<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import type { SuperForm } from 'sveltekit-superforms';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { fly } from 'svelte/transition';
  import { ChevronDown, ChevronUp } from '@o7/icon/lucide';
  import { api } from '$lib/trpc';
  import {
    type Airport,
    airportFromICAO,
    airportSearchCache,
  } from '$lib/utils/data';
  import { toTitleCase } from '$lib/utils';
  import { z } from 'zod';
  import type { flightSchema } from '$lib/zod/flight';
  import { writable } from 'svelte/store';

  let {
    field,
    form,
  }: {
    field: 'from' | 'to';
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  const selected = writable(
    $formData[field]
      ? {
          label: airportFromICAO($formData[field])?.name,
          value: $formData[field],
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
    if (item) {
      $formData[field] = item.value;
    }
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  const debounce = (callback: () => void) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(callback, 450);
  };

  let airports: Airport[] = $state([]);
  let loading = $state(false);
  $effect(() => {
    if ($touchedInput && $inputValue !== '' && !loading) {
      const cached = airportSearchCache.get($inputValue);
      if (cached) {
        airports = cached;
        return;
      } else {
        airports = [];
      }
      loading = true;
      debounce(async () => {
        airports = await api.autocomplete.airport.query($inputValue);
        loading = false;
        airportSearchCache.set($inputValue, airports);
      });
    } else {
      airports = [];
    }
  });
</script>

<Form.Field {form} name={field} class="flex flex-col">
  <Form.Control let:attrs>
    <Form.Label>{toTitleCase(field)} *</Form.Label>
    <div class="relative">
      <input
        use:melt={$input}
        class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 pr-12"
        placeholder="Select an airport"
      />
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
    <input hidden bind:value={$formData[field]} name={attrs.name} />
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
        {#each airports as airport}
          <li
            use:melt={$option({
              value: airport.ICAO,
              label: airport.name,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md py-2 pl-4 pr-4
        data-[highlighted]:bg-zinc-300 data-[highlighted]:dark:bg-dark-2"
          >
            <div class="flex flex-col">
              <div class="flex items-center">
                <img
                  src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
                  alt={airport.country}
                  class="w-8 h-5 mr-2"
                />
                <span class="text-lg truncate">{airport.name}</span>
              </div>
              <span class="text-sm opacity-75"
                >{airport.IATA ?? airport.ICAO}{airport.IATA
                  ? ` - ${airport.ICAO}`
                  : ''}</span
              >
            </div>
          </li>
        {:else}
          <li class="relative cursor-pointer rounded-md py-1 pl-8 pr-4">
            {#if loading}
              Loading...
            {:else if $inputValue}
              No airports found.
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
