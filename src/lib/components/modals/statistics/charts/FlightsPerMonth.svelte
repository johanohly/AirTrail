<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { APIFlight } from '$lib/db';
  import dayjs from 'dayjs';
  import { Axis, Bars, Chart, Svg, Tooltip, TooltipItem } from 'layerchart';
  import { scaleBand } from 'd3-scale';

  let { flights }: { flights: Readable<{ data: APIFlight[] | undefined }> } =
    $props();

  const flightsPerMonth = $derived.by(() => {
    const data = $flights.data;
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
      <Axis placement="left" grid rule />
      <Axis
        placement="bottom"
        format={(i) => {
          const months = [
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
          return months[i] ?? '';
        }}
        rule
      />
      <Bars radius={4} strokeWidth={1} class="fill-primary" />
    </Svg>
    <Tooltip
      header={(data) => {
        const months = [
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
        return months[data.month];
      }}
      let:data
    >
      <TooltipItem label="Flights" value={data.flights} />
    </Tooltip>
  </Chart>
</div>
