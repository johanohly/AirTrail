<script lang="ts">
  import { Check } from '@o7/icon/lucide';

  import DrillDownSheet from '../DrillDownSheet.svelte';

  import type { CountryDetail } from '$lib/stats/aggregations';

  let {
    continent,
    countries,
    onBack,
  }: {
    continent: string;
    countries: CountryDetail[];
    onBack: () => void;
  } = $props();

  const visitedCount = $derived(countries.filter((c) => c.visited).length);
</script>

<DrillDownSheet
  title={continent}
  subtitle="{visitedCount} of {countries.length} countries visited"
  {onBack}
>
  <ul>
    {#each countries as country (country.code)}
      <li
        class={[
          'flex h-8 items-center gap-2 px-2 text-[13px]',
          !country.visited && 'text-muted-foreground',
        ]}
      >
        <img
          src="https://flagcdn.com/{country.code.toLowerCase()}.svg"
          alt=""
          class={[
            'h-3 w-[18px] shrink-0 rounded-[2px] object-cover shadow-xs',
            !country.visited && 'opacity-50 grayscale',
          ]}
          loading="lazy"
          decoding="async"
        />
        <span class="min-w-0 flex-1 truncate">{country.name}</span>
        {#if country.visited}
          <Check size={15} class="shrink-0" aria-label="Visited" />
        {/if}
      </li>
    {/each}
  </ul>
</DrillDownSheet>
