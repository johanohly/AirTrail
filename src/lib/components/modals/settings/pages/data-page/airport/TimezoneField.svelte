<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { createCombobox, melt } from '@melt-ui/svelte';
  import { CircleX, ChevronsUpDown } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { HelpTooltip } from '$lib/components/ui/tooltip/index.js';
  import type { airportSchema } from '$lib/zod/airport';

  const { form }: { form: SuperForm<Infer<typeof airportSchema>> } = $props();

  const { form: formData } = form;

  const timezones = Intl.supportedValuesOf('timeZone');

  const selected = writable(
    $formData.tz
      ? {
          label: $formData.tz,
          value: $formData.tz,
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
    $formData.tz = item?.value ?? null;
  });

  $effect(() => {
    if (!$open) {
      $inputValue = $selected?.label ?? '';
    }
  });

  let filtered: string[] = $state([]);
  $effect(() => {
    if ($open && $inputValue !== '') {
      filtered = timezones.filter((tz) =>
        tz.toLowerCase().includes($inputValue.toLowerCase()),
      );
    } else {
      filtered = [];
    }
  });
</script>

<Form.Field {form} name="tz" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Timezone</Form.Label>
      <Form.Description>
        The timezone of the airport. <HelpTooltip
          text="Needed for accurate time normalization. The backend converts all times to UTC for storage, so it needs to know the timezone for conversion."
        />
      </Form.Description>
      <div class="relative">
        <input
          use:melt={$input}
          class="pr-16 border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
          placeholder="Select a timezone"
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
          class="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronsUpDown size={16} />
        </div>
      </div>
      <input hidden bind:value={$formData.tz} name={props.name} />
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
        {#each filtered as entry}
          <li
            use:melt={$option({
              value: entry,
              label: entry,
            })}
            class="relative cursor-pointer scroll-my-2 rounded-md p-2 dark:bg-dark-1 border data-highlighted:bg-zinc-300 dark:data-highlighted:bg-dark-2"
          >
            <span class="truncate">{entry}</span>
          </li>
        {:else}
          <li
            class="relative cursor-pointer scroll-my-2 rounded-md p-2
        bg-popover dark:bg-dark-1 border"
          >
            {#if $inputValue}
              No timezones found.
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
