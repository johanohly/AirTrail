<script lang="ts">
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';

  import { page } from '$app/state';
  import { codeForAirport } from '$lib/stats/aggregations';
  import { formatSignedDelay, type FlightDelay } from '$lib/stats/punctuality';
  import { formatDate, getPreferences } from '$lib/utils/preferences';

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
  const { flight } = $derived(delay);
  // Written in the direction flown, unlike route rows, which merge both
  // directions into one.
  const label = $derived(
    `${codeForAirport(flight.from) ?? '?'} – ${codeForAirport(flight.to) ?? '?'}`,
  );
</script>

<BreakdownRow
  share={delay.delayMinutes / largest}
  value={formatSignedDelay(delay.delayMinutes)}
  {onclick}
>
  <BreakdownLabel
    chartKey="routes"
    entryKey={label}
    details={{
      route: { first: flight.from, second: flight.to },
      description: flight.date
        ? formatDate(flight.date, prefs, flight.from?.tz)
        : undefined,
    }}
  />
</BreakdownRow>
