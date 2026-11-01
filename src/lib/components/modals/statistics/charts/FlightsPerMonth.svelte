<script lang="ts">
  import ColumnChart from './ColumnChart.svelte';

  import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
  import type { FlightData } from '$lib/utils';
  import { supportsMonthBreakdown } from '$lib/utils/datetime';

  let {
    flights,
    compact = false,
  }: { flights: FlightData[]; compact?: boolean } = $props();

  const data = $derived(
    Array.from({ length: 12 }, (_, month) => ({
      key: month,
      label: SHORT_MONTHS[month] ?? '',
      name: MONTHS[month] ?? '',
      value: flights.filter(
        (flight) =>
          supportsMonthBreakdown(flight.datePrecision) &&
          flight.date?.getMonth() === month,
      ).length,
    })),
  );
</script>

<ColumnChart {data} {compact} testId="flights-per-month" />
