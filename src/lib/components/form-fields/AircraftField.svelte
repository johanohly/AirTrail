<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { CircleX, ChevronsUpDown } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import * as Form from '$lib/components/ui/form';
  import { AIRCRAFT } from '$lib/data/aircraft';
  import { sortAndFilterByMatch } from '$lib/utils';
  import {
    type Aircraft,
    aircraftFromICAO,
    WTC_TO_LABEL,
  } from '$lib/utils/data/aircraft';
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
          label: aircraftFromICAO($formData.aircraft)?.name,
          value: $formData.aircraft,
        }
      : undefined,
  );

  const {
    elements: { menu, input, option },
    states: { open, inputValue },
  } = createCombobox<string>({
    forceVisible: true,
    selected,
  });
  selected.subscribe((item) => {
    $formData.aircraft = item?.value ?? null;
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  let aircraft: Aircraft[] = $state([]);
  $effect(() => {
    if ($open && $inputValue !== '') {
      aircraft = sortAndFilterByMatch(
        // @ts-expect-error - This is totally fine
        AIRCRAFT,
        $inputValue,
        [
          { key: 'icao', exact: true },
          { key: 'name', exact: false },
        ],
      );
    } else {
      aircraft = [];
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
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 pr-16"
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
            <CircleX size="20" />
          </button>
        {/if}
        <div
          class="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronsUpDown class="size-4" />
        </div>
      </div>
      <input hidden bind:value={$formData.aircraft} name={props.name} />
    {/snippet}
  </Form.Control>
  {#if $open}
    <ul
      class="z-[5000] flex max-h-[300px] flex-col overflow-hidden rounded-lg"
      use:melt={$menu}
      transition:fly={{ duration: 150, y: -5 }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        use:autoAnimate
        class="flex max-h-full flex-col gap-1 overflow-y-auto bg-popover text-card-foreground"
        tabindex="0"
      >
        {#each aircraft as entry}
          <li
            use:melt={$option({
              value: entry.icao,
              label: entry.name,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-[highlighted]:bg-zinc-300 data-[highlighted]:dark:bg-dark-2"
          >
            <div class="flex flex-col">
              <span class="truncate">{entry.name}</span>
              <span class="text-sm opacity-75"
                >{entry.icao} - {WTC_TO_LABEL[entry.wtc]}</span
              >
            </div>
          </li>
        {:else}
          <li
            class="relative cursor-pointer scroll-my-2 rounded-md p-2
        bg-popover dark:bg-dark-1 border"
          >
            {#if $inputValue}
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
