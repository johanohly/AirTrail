<script lang="ts">
  import dayjs from 'dayjs';
  import {
    Area,
    Axis,
    Chart,
    LinearGradient,
    Points,
    Svg,
    Tooltip,
    TooltipItem,
  } from 'layerchart';
  import { scaleBand } from 'd3-scale';
  import type { FlightData } from '$lib/utils';

  let { flights }: { flights: FlightData[] } = $props();

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const flightsPerWeekday = $derived.by(() => {
    const data = flights;
    if (!data) return;

    const weekdays = Array.from({ length: 7 }, (_, i) => i);
    return weekdays.map((weekday) => {
      const weekdayFlights = data.filter(
        (flight) =>
          flight.departure && dayjs.unix(flight.departure).day() === weekday,
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
    tooltip={{ mode: 'band' }}
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
      <LinearGradient class="from-primary/50 to-primary/0" vertical let:url>
        <Area line={{ class: 'stroke-2 stroke-primary' }} fill={url} />
        <Points r={5} class="fill-primary" />
      </LinearGradient>
    </Svg>
    <Tooltip
      header={(data) => {
        return WEEKDAYS[data.weekday];
      }}
      let:data
    >
      <TooltipItem label="Flights" value={data.flights} />
    </Tooltip>
  </Chart>
</div>
