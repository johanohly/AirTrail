<script lang="ts">
  import type { BreakdownDetails } from './breakdown';

  import { AirlineIcon } from '$lib/components/display';
  import type { FlightChartKey } from '$lib/stats/aggregations';

  let {
    chartKey,
    entryKey,
    details,
  }: {
    chartKey: FlightChartKey;
    entryKey: string;
    details: BreakdownDetails;
  } = $props();

  const isCode = $derived(
    chartKey === 'airports' ||
      chartKey === 'routes' ||
      chartKey === 'aircraft-regs',
  );
</script>

{#snippet flag(country: string | null | undefined)}
  {#if country}
    <img
      src="https://flagcdn.com/{country.toLowerCase()}.svg"
      alt=""
      title={country.toUpperCase()}
      class="h-3 w-[18px] shrink-0 rounded-[2px] object-cover shadow-xs"
      loading="lazy"
      decoding="async"
    />
  {/if}
{/snippet}

{#if details.airline}
  <AirlineIcon airline={details.airline} size={20} fallback="plane" />
{:else if details.airport}
  {@render flag(details.airport.country)}
{:else if details.route}
  {@render flag(details.route.first?.country)}
  {@render flag(details.route.second?.country)}
{/if}
<span
  class={['shrink-0', isCode ? 'font-semibold' : 'min-w-0 truncate shrink']}
>
  {entryKey}
</span>
{#if details.description}
  <span class="min-w-0 truncate text-muted-foreground">
    {details.description}
  </span>
{/if}
