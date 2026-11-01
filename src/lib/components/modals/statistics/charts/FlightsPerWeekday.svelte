<script lang="ts">
  import ColumnChart from './ColumnChart.svelte';

  import type { FlightData } from '$lib/utils';
  import {
    getStartOfWeekDay,
    supportsWeekdayBreakdown,
  } from '$lib/utils/datetime';

  let {
    flights,
    compact = false,
  }: { flights: FlightData[]; compact?: boolean } = $props();

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const data = $derived.by(() => {
    const firstDay = getStartOfWeekDay();
    return Array.from({ length: 7 }, (_, i) => (i + firstDay) % 7).map(
      (weekday) => ({
        key: weekday,
        label: WEEKDAYS[weekday] ?? '',
        name: WEEKDAYS[weekday] ?? '',
        value: flights.filter(
          (flight) =>
            supportsWeekdayBreakdown(flight.datePrecision) &&
            flight.date?.getDay() === weekday,
        ).length,
      }),
    );
  });
</script>

<ColumnChart {data} {compact} testId="flights-per-weekday" />
