<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { ChevronsUpDown } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import * as Form from '$lib/components/ui/form';
  import type { Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { cn, toTitleCase } from '$lib/utils';
  import { airportSearchCache } from '$lib/utils/data/airports/cache';
  import type { flightSchema } from '$lib/zod/flight';

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
          label: $formData[field].name,
          value: $formData[field],
        }
      : undefined,
  );

  const {
    elements: { menu, input, option },
    states: { open, inputValue, touchedInput },
  } = createCombobox<Airport>({
    forceVisible: true,
    selected,
    onSelectedChange: ({ next }) => {
      if (next?.value) $formData[field] = next.value;
      return next;
    },
  });

  // If the field is updated externally, update the selected value
  formData.subscribe(() => {
    if (
      $formData[field] === $selected?.value ||
      (!$formData[field] && !$selected?.value)
    )
      return;
    selected.set(
      $formData[field]
        ? {
            label: $formData[field].name,
            value: $formData[field],
          }
        : undefined,
    );
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
      const cached = airportSearchCache.get($inputValue.toLowerCase());
      if (cached) {
        airports = cached;
        return;
      }
      loading = true;
      debounce(async () => {
        airports = await api.autocomplete.airport.query($inputValue);
        loading = false;
        airportSearchCache.set($inputValue.toLowerCase(), airports);
      });
    } else if (!loading) {
      airports = [];
    }
  });
</script>

<Form.Field {form} name={`${field}.code`} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>{toTitleCase(field)} *</Form.Label>
      <div class="relative">
        <input
          use:melt={$input}
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 pr-12"
          placeholder="Select an airport"
        />
        <div
          class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronsUpDown class="size-4 opacity-50" />
        </div>
      </div>
      <input hidden bind:value={$formData[field]} name={props.name} />
    {/snippet}
  </Form.Control>
  {#if $open}
    <ul
      class="z-5000 flex max-h-[300px] flex-col overflow-hidden rounded-lg"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="flex max-h-full flex-col gap-1 overflow-y-auto bg-popover text-card-foreground"
        tabindex="0"
        use:autoAnimate
      >
        {#each airports as airport}
          <li
            use:melt={$option({
              value: airport,
              label: airport.name,
              disabled: loading,
            })}
            class={cn(
              'relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2',
              'transition-[filter]',
              {
                'pointer-events-none blur-xs': loading,
              },
            )}
          >
            <div class="flex flex-row gap-2 justify-between">
              <div class="flex flex-col overflow-hidden">
                <span class="truncate">{airport.name}</span>
                <p class="text-sm">
                  {#if airport.iata}
                    <span class="text-muted-foreground">IATA</span>
                    <b class="mr-2">{airport.iata}</b>
                  {/if}
                  <span class="text-muted-foreground">ICAO</span>
                  <b>{airport.code}</b>
                </p>
              </div>
              <div class="w-12 shrink-0">
                <img
                  src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
                  alt={airport.country}
                  class="aspect-video h-full"
                />
              </div>
            </div>
          </li>
        {:else}
          <li
            class="relative cursor-pointer scroll-my-2 rounded-md p-2
        bg-popover dark:bg-dark-1 border"
          >
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
