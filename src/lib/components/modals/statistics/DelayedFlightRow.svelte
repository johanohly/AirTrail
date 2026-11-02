<script lang="ts">
  import { page } from '$app/state';

  import {
    routeLabelForFlight,
    type FlightDelay,
  } from '$lib/stats/aggregations';
  import { Duration } from '$lib/utils/datetime';
  import { formatDate, getPreferences } from '$lib/utils/preferences';

  import BreakdownRow from './BreakdownRow.svelte';

  let {
    delay,
    largest,
    onclick,
  }: {
    delay: FlightDelay;
    /** The largest delay in the list, sizing this row's bar. */
    largest: number;
    onclick?: () => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));
  // Late is +, early is −, the way delays are usually spoken about
  const signed = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${Duration.fromSeconds(Math.abs(minutes) * 60).toString(true)}`;
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

<BreakdownRow
  share={delay.delayMinutes / largest}
  value={signed(delay.delayMinutes)}
  {onclick}
>
  {@render flag(delay.flight.from?.country)}
  {@render flag(delay.flight.to?.country)}
  <span class="min-w-0 shrink truncate font-semibold">
    {routeLabelForFlight(delay.flight) ?? 'Unknown flight'}
  </span>
  {#if delay.flight.date}
    <span class="min-w-0 truncate text-muted-foreground">
      {formatDate(delay.flight.date, prefs, delay.flight.from?.tz)}
    </span>
  {/if}
</BreakdownRow>
