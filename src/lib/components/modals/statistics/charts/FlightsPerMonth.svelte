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
      <Spline
        draw={{ easing: cubicInOut, delay: 500 }}
        class="stroke-2 stroke-primary"
      />
      <LinearGradient class="from-primary/50 to-primary/0" vertical let:url>
        <ChartClipPath
          initialY={300}
          initialHeight={0}
          tweened={{
            y: { duration: 1000, easing: cubicInOut, delay: 600 },
            height: { duration: 1000, easing: cubicInOut, delay: 600 },
          }}
        >
          <Area fill={url} />
        </ChartClipPath>
        <ChartClipPath
          initialX={0}
          initialWidth={0}
          tweened={{
            x: { duration: 1000, easing: cubicInOut },
            width: { duration: 1000, easing: cubicInOut },
          }}
        >
          <Points r={5} class="fill-primary" />
        </ChartClipPath>
      </LinearGradient>
    </Svg>
    <Tooltip.Root x="data" y="data" let:data>
      <Tooltip.Header>{MONTHS[data.month]}</Tooltip.Header>
      <Tooltip.Item label="Flights" value={data.flights} />
    </Tooltip.Root>
  </Chart>
</div>
