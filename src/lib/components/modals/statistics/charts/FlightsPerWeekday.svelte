<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import {
    Area,
    Axis,
    Chart,
    ChartClipPath,
    LinearGradient,
    Points,
    Spline,
    Svg,
    Tooltip,
  } from 'layerchart';
  import { cubicInOut } from 'svelte/easing';

  import type { FlightData } from '$lib/utils';
  import { getStartOfWeekDay } from '$lib/utils/datetime';

  let { flights }: { flights: FlightData[] } = $props();

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const flightsPerWeekday = $derived.by(() => {
    const data = flights;
    if (!data) return;

    const firstDay = getStartOfWeekDay() === 'Monday' ? 1 : 0;

    const weekdays = Array.from({ length: 7 }, (_, i) => (i + firstDay) % 7);

    return weekdays.map((weekday) => {
      const weekdayFlights = data.filter(
        (flight) => flight.date?.getDay() === weekday,
      );
      return {
        weekday,
        flights: weekdayFlights.length,
      };
    });
  });
</script>

<div class="w-full h-[200px] p-4 border rounded">
  <Chart
    data={flightsPerWeekday}
    x="weekday"
    xScale={scaleBand().padding(0.4)}
    y="flights"
    yNice={2}
    padding={{ left: 16, bottom: 16 }}
    tooltip={{ mode: 'bisect-x' }}
  >
    <Svg>
      <Axis
        placement="left"
        grid
        rule
        ticks={(scale) => scale.ticks?.().filter(Number.isInteger)}
        format="integer"
      />
      <Axis
        placement="bottom"
        format={(i) => {
          return WEEKDAYS[i] ?? '';
        }}
        rule
      />
      <Spline class="stroke-2 stroke-primary" />
      <LinearGradient class="from-primary/70 to-primary/0" vertical>
        {#snippet children({ gradient })}
          <Area fill={gradient} />
          <Points r={5} class="fill-primary" />
        {/snippet}
      </LinearGradient>
    </Svg>
    <Tooltip.Root x="data" y="data">
      {#snippet children({ data })}
        <Tooltip.Header>{WEEKDAYS[data.weekday]}</Tooltip.Header>
        <Tooltip.Item label="Flights" value={data.flights} />
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
