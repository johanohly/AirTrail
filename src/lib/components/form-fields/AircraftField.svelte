<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { CircleX, ChevronsUpDown } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import * as Form from '$lib/components/ui/form';
  import type { Aircraft } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  const selected = writable(
    $formData.aircraft
      ? {
          label: $formData.aircraft?.name || 'Unknown Aircraft',
          value: $formData.aircraft.id,
        }
      : undefined,
  );

  const {
    elements: { menu, input, option },
    states: { open, inputValue, touchedInput },
  } = createCombobox<Aircraft>({
    forceVisible: true,
    selected,
    onSelectedChange: ({ next }) => {
      if (next?.value) {
        $formData.aircraft = next.value;
      } else {
        $formData.aircraft = null;
      }
      return next;
    },
  });

  // If the field is updated externally, update the selected value
  formData.subscribe(() => {
    if (
      $formData.aircraft === $selected?.value ||
      (!$formData.aircraft && !$selected?.value)
    ) {
      return;
    }

    selected.set(
      $formData.aircraft
        ? {
            label: $formData.aircraft?.name || 'Unknown Aircraft',
            value: $formData.aircraft.id,
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

  let aircraft: Aircraft[] = $state([]);
  let loading = $state(false);

  $effect(() => {
    if ($touchedInput && $inputValue !== '' && !loading) {
      loading = true;
      debounce(async () => {
        aircraft = await api.autocomplete.aircraft.query($inputValue);
        loading = false;
      });
    } else if (!loading && ($inputValue === '' || !$open)) {
      aircraft = [];
    }
  });

  // Ensure results are repopulated when the input is focused/opened with a prefilled value
  $effect(() => {
    if ($open && !$touchedInput && $inputValue !== '' && !loading) {
      loading = true;
      (async () => {
        try {
          const res = await api.autocomplete.aircraft.query($inputValue);
          aircraft = res;
        } catch (error) {
          console.error('Error fetching aircraft:', error);
          aircraft = [];
        } finally {
          loading = false;
        }
      })();
    }
  });
</script>

<Form.Field {form} name="aircraft" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Aircraft</Form.Label>
      <div class="relative">
        <input
          use:melt={$input}
          class="pr-16 border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
          placeholder="Select aircraft"
        />
        {#if $open && $selected}
          <button
            transition:fly={{ duration: 200, x: 20 }}
            type="button"
            onclick={() => {
              // @ts-expect-error - This is totally fine
              $selected = undefined;
              $inputValue = '';
            }}
            class="cursor-pointer absolute right-10 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <CircleX size={16} />
          </button>
        {/if}
        <div
          class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronsUpDown size={16} class="opacity-50" />
        </div>
      </div>
      <input hidden bind:value={$formData.aircraft} name={props.name} />
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
        use:autoAnimate
        class="flex max-h-full flex-col gap-1 overflow-y-auto bg-popover text-card-foreground"
        tabindex="0"
      >
        {#each aircraft as entry (entry.id)}
          <li
            use:melt={$option({
              value: entry,
              label: entry.name,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2"
          >
            <div class="flex flex-col">
              <span class="truncate">{entry.name}</span>
              <span class="text-sm opacity-75">{entry.icao || 'No ICAO'}</span>
            </div>
          </li>
        {:else}
          <li
            class="relative cursor-pointer scroll-my-2 rounded-md p-2
        bg-popover dark:bg-dark-1 border"
          >
            {#if loading}
              Loading aircraft...
            {:else if $inputValue}
              No aircraft found.
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
