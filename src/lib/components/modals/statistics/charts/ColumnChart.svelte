<script lang="ts">
  import { scaleBand } from 'd3-scale';
  import { Axis, Bars, Chart, Labels, Svg, Tooltip } from 'layerchart';
  import { MediaQuery } from 'svelte/reactivity';

  import { Button } from '$lib/components/ui/button';
  import { pluralize } from '$lib/utils';

  type Column = {
    key: number;
    /** The name on the axis. */
    label: string;
    /** The name in the tooltip. */
    name: string;
    value: number;
  };

  let {
    data,
    selected = [],
    onSelect,
    capWidth = 96,
    tickSpacing,
    compact = false,
    testId,
  }: {
    data: Column[];
    selected?: number[];
    onSelect?: (key: number) => void;
    capWidth?: number;
    tickSpacing?: number;
    compact?: boolean;
    testId?: string;
  } = $props();

  const touchPointer = new MediaQuery('(pointer: coarse)');
  // Leave room for the widest count and a gap between adjacent labels.
  const countLabelWidth = $derived(
    Math.max(1, ...data.map((d) => String(d.value).length)) * 8 + 4,
  );
  const tallest = $derived(Math.max(0, ...data.map((d) => d.value)));
  const isSelected = (column: Column) => selected.includes(column.key);
  const countLabel = (value: number) => (value > 0 ? String(value) : '');
  const flightCount = (column: Column) =>
    `${column.name}: ${column.value} ${pluralize(column.value, 'flight')}`;
  const labelFor = (key: number) =>
    data.find((column) => column.key === key)?.label ?? '';
</script>

<div
  class={[
    'w-full',
    compact ? 'h-20' : 'h-[132px]',
    onSelect && '[&_.lc-tooltip-rect]:cursor-pointer',
  ]}
  data-testid={testId}
>
  <Chart
    {data}
    x="key"
    xScale={scaleBand().padding(0.2)}
    y="value"
    yBaseline={0}
    padding={{ top: 16, bottom: 18 }}
    tooltipContext={{
      mode: 'band',
      onclick: (_, { data: column }) => {
        // An empty year would leave nothing on the page to pick another from.
        if (column.value > 0) onSelect?.(column.key);
      },
    }}
  >
    {#snippet children({ context })}
      {@const barWidth = Math.min(capWidth, context.xScale.bandwidth?.() ?? 0)}
      <Svg>
        <Axis
          placement="bottom"
          format={labelFor}
          {tickSpacing}
          rule={{ class: 'stroke-border' }}
          tickLength={0}
          tickLabelProps={{
            class: 'fill-muted-foreground stroke-none text-[11px]',
          }}
        />
        <Bars
          width={barWidth}
          radius={3}
          rounded="top"
          class="fill-primary"
          fillOpacity={(column) =>
            selected.length && !isSelected(column) ? 0.35 : 1}
        />
        <Labels
          format={context.width / data.length >= countLabelWidth
            ? countLabel
            : (value) => (value === tallest ? countLabel(value) : '')}
          class="text-xs fill-foreground"
        />
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
        {#snippet children({ data: column })}
          <span class="whitespace-nowrap">{flightCount(column)}</span>
        {/snippet}
      </Tooltip.Root>
    {/snippet}
  </Chart>
</div>
{#if onSelect}
  <!-- The bars only respond to a pointer, so keyboards get the same choice. -->
  <div
    class="sr-only flex-wrap gap-1 pt-2 focus-within:not-sr-only focus-within:flex"
  >
    {#each data.filter((d) => d.value > 0) as column (column.key)}
      <Button
        variant="outline"
        size="sm"
        aria-pressed={isSelected(column)}
        onclick={() => onSelect(column.key)}
      >
        {flightCount(column)}
      </Button>
    {/each}
  </div>
{/if}
