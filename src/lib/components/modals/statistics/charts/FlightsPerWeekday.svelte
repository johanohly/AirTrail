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

  let { flights }: { flights: FlightData[] } = $props();

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const flightsPerWeekday = $derived.by(() => {
    const data = flights;
    if (!data) return;

    const weekdays = Array.from({ length: 7 }, (_, i) => i);
    return weekdays.map((weekday) => {
      const weekdayFlights = data.filter(
        (flight) => flight.date.getDay() === weekday,
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
      <Tooltip.Header>{WEEKDAYS[data.weekday]}</Tooltip.Header>
      <Tooltip.Item label="Flights" value={data.flights} />
    </Tooltip.Root>
  </Chart>
</div>
