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

  const SHORT_MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  let { flights }: { flights: FlightData[] } = $props();

  const flightsPerMonth = $derived.by(() => {
    const data = flights;
    if (!data) return;

    const months = Array.from({ length: 12 }, (_, i) => i);
    return months.map((month) => {
      const monthFlights = data.filter(
        (flight) =>
          flight.departure && dayjs.unix(flight.departure).month() === month,
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
          return SHORT_MONTHS[i] ?? '';
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
        return MONTHS[data.month];
      }}
      let:data
    >
      <TooltipItem label="Flights" value={data.flights} />
    </Tooltip>
  </Chart>
</div>
