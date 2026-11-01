<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import { Axis, Bars, Chart, Labels, Svg, Tooltip } from 'layerchart';
  import { MediaQuery } from 'svelte/reactivity';

  import { countFlightsPerYear } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';

  let { flights }: { flights: FlightData[] } = $props();

  const touchPointer = new MediaQuery('(pointer: coarse)');
  const flightsPerYear = $derived(countFlightsPerYear(flights));
  // Leave room for the widest count and a gap between adjacent labels.
  const countLabelWidth = $derived(
    Math.max(1, ...flightsPerYear.map((d) => String(d.flights).length)) * 8 + 4,
  );
</script>

<div class="w-full h-[200px] p-4 border rounded">
  {#if flightsPerYear.length === 0}
    <div class="flex items-center justify-center h-full">
      <p class="text-zinc-400 dark:text-zinc-600">No data</p>
    </div>
  {:else}
    <Chart
      data={flightsPerYear}
      x="year"
      xScale={scaleBand().padding(0.4)}
      y="flights"
      yBaseline={0}
      yNice={2}
      padding={{ left: 32, top: 16, bottom: 16 }}
      tooltipContext={{ mode: 'band' }}
    >
      {#snippet children({ context })}
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
            format={(year) => String(year)}
            tickSpacing={44}
            rule
          />
          <Bars
            width={Math.min(56, context.xScale.bandwidth?.() ?? 56)}
            radius={4}
            rounded="top"
            class="fill-primary"
          />
          {#if context.width / flightsPerYear.length >= countLabelWidth}
            <Labels format="integer" class="text-xs fill-foreground" />
          {/if}
        </Svg>
        <!-- Touch needs room above the finger, even outside the chart. -->
        <Tooltip.Root
          x="data"
          y={touchPointer.current ? 'pointer' : 'data'}
          anchor={touchPointer.current ? 'bottom' : 'top-left'}
          yOffset={touchPointer.current ? 96 : 0}
          contained={touchPointer.current ? 'window' : 'container'}
          motion={touchPointer.current ? 'none' : 'spring'}
          portal={false}
        >
          {#snippet children({ data })}
            <span class="whitespace-nowrap">
              {data.year}: {data.flights}
              {pluralize(data.flights, 'flight')}
            </span>
          {/snippet}
        </Tooltip.Root>
      {/snippet}
    </Chart>
  {/if}
</div>
