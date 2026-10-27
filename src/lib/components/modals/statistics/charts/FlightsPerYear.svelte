<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@o7/icon/lucide';
  import { scaleBand, scaleLinear } from 'd3-scale';
  import { Axis, Bars, Chart, Grid, Labels, Svg } from 'layerchart';
  import type { Component } from 'svelte';

  import { countFlightsPerYear } from '$lib/stats/aggregations';
  import { cn, type FlightData } from '$lib/utils';

  // Room every year needs for its axis label, so a long history scrolls
  // sideways instead of skipping labels
  const MIN_YEAR_WIDTH = 44;
  // Keeps the bars of a short history from stretching across the card
  const MAX_YEAR_WIDTH = 96;
  // Gap between bars, as a share of the width each year gets
  const BAR_PADDING = 0.4;
  // With the card padding and the strip below that keeps overlay scrollbars
  // off the year labels, the card is 200px tall like the other charts
  const CHART_HEIGHT = 156;
  const CHART_PADDING = { top: 16, bottom: 16 };
  // How far one arrow press scrolls, as a share of the visible part
  const SCROLL_STEP = 0.8;

  let { flights }: { flights: FlightData[] } = $props();

  let viewport: HTMLDivElement | undefined = $state();
  let viewportWidth = $state(0);
  let scrollLeft = $state(0);

  const flightsPerYear = $derived(countFlightsPerYear(flights));

  const chartWidth = $derived(
    Math.max(viewportWidth, flightsPerYear.length * MIN_YEAR_WIDTH),
  );
  // Centers a short history instead of widening its bars, while the grid
  // and axis still span the card
  const outerPadding = $derived(
    Math.max(
      BAR_PADDING,
      (chartWidth / MAX_YEAR_WIDTH - flightsPerYear.length + BAR_PADDING) / 2,
    ),
  );
  const overflows = $derived(chartWidth > viewportWidth);

  // Shared by the fixed axis and the scrolling bars so their ticks line up
  const yDomain = $derived(
    scaleLinear()
      .domain([0, Math.max(1, ...flightsPerYear.map((d) => d.flights))])
      .nice(5)
      .domain(),
  );
  const yTicks = (scale: { ticks?: () => number[] }) =>
    scale.ticks?.().filter(Number.isInteger) ?? [];

  const hiddenBefore = $derived(overflows && scrollLeft > 1);
  const hiddenAfter = $derived(
    overflows && scrollLeft + viewportWidth < chartWidth - 1,
  );

  // Open on the newest years whenever the counted years change; a resize or
  // rotation keeps the position the viewer scrolled to
  let scrolledToNewestFor: typeof flightsPerYear | undefined;
  $effect(() => {
    if (!viewport || viewportWidth === 0) return;
    if (scrolledToNewestFor === flightsPerYear) return;

    scrolledToNewestFor = flightsPerYear;
    viewport.scrollLeft = viewport.scrollWidth;
    scrollLeft = viewport.scrollLeft;
  });

  const scrollTowards = (direction: -1 | 1) =>
    viewport?.scrollBy({
      left: direction * viewportWidth * SCROLL_STEP,
      behavior: 'smooth',
    });
</script>

{#snippet scrollArrow(
  direction: -1 | 1,
  Icon: Component<{ size?: number; class?: string }>,
  edgeClass: string,
  iconClass: string,
)}
  <!-- Only the circle takes clicks, so swipes that start on the fade still
       scroll the chart. Keyboard users scroll the focusable chart itself. -->
  <div
    class={cn(
      'pointer-events-none absolute top-0 w-12 flex items-center from-background to-transparent',
      edgeClass,
    )}
    style:height="{CHART_HEIGHT}px"
  >
    <button
      type="button"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => scrollTowards(direction)}
      class="pointer-events-auto size-5 flex items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm"
    >
      <!-- The point of a chevron carries more ink than its open side, so it
           is nudged towards the open side to look centered -->
      <Icon size={18} class={iconClass} />
    </button>
  </div>
{/snippet}

<div class="w-full h-[200px] p-4 border rounded flex contain-inline-size">
  {#if flightsPerYear.length === 0}
    <div class="flex items-center justify-center w-full">
      <p class="text-zinc-400 dark:text-zinc-600">No data</p>
    </div>
  {:else}
    <div class="w-8 shrink-0" style:height="{CHART_HEIGHT}px">
      <Chart
        data={flightsPerYear}
        y="flights"
        {yDomain}
        padding={{ ...CHART_PADDING, left: 32 }}
      >
        <Svg>
          <Axis placement="left" rule ticks={yTicks} format="integer" />
        </Svg>
      </Chart>
    </div>
    <div class="relative min-w-0 flex-1">
      <!-- Focusable so keyboard users can scroll it with the arrow keys -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={viewport}
        bind:clientWidth={viewportWidth}
        onscroll={() => (scrollLeft = viewport?.scrollLeft ?? 0)}
        role="region"
        aria-label="Flights per year"
        tabindex={overflows ? 0 : undefined}
        class="scrollbar-subtle overflow-x-auto pb-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div style:width="{chartWidth}px" style:height="{CHART_HEIGHT}px">
          <!-- Every chart has a tooltip layer, which only lets touches pan
               vertically unless told otherwise -->
          <Chart
            data={flightsPerYear}
            x="year"
            xScale={scaleBand()
              .paddingInner(BAR_PADDING)
              .paddingOuter(outerPadding)}
            y="flights"
            {yDomain}
            padding={CHART_PADDING}
            tooltipContext={{ touchEvents: 'auto' }}
          >
            <Svg>
              <Grid y {yTicks} />
              <Axis placement="bottom" format={(year) => String(year)} rule />
              <Bars radius={4} rounded="top" class="fill-primary" />
              <Labels format="integer" class="text-xs fill-foreground" />
            </Svg>
          </Chart>
        </div>
      </div>
      {#if hiddenBefore}
        {@render scrollArrow(
          -1,
          ChevronLeft,
          'left-0 pl-1 justify-start bg-linear-to-r',
          'translate-x-px',
        )}
      {/if}
      {#if hiddenAfter}
        {@render scrollArrow(
          1,
          ChevronRight,
          'right-0 pr-1 justify-end bg-linear-to-l',
          '-translate-x-px',
        )}
      {/if}
    </div>
  {/if}
</div>
