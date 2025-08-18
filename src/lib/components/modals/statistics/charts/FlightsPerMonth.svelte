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

  import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
  import type { FlightData } from '$lib/utils';

  let { flights }: { flights: FlightData[] } = $props();

  const flightsPerMonth = $derived.by(() => {
    const data = flights;
    if (!data) return;

    const months = Array.from({ length: 12 }, (_, i) => i);
    return months.map((month) => {
      const monthFlights = data.filter(
        (flight) => flight.date.getMonth() === month,
      );
      return {
        month,
        flights: monthFlights.length,
      };
    });
  });
</script>

<div class="w-full h-[200px] p-4 border rounded">
  <Chart
    data={flightsPerMonth}
    x="month"
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
          return SHORT_MONTHS[i] ?? '';
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
        <Tooltip.Header>{MONTHS[data.month]}</Tooltip.Header>
        <Tooltip.Item label="Flights" value={data.flights} />
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
