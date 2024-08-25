<script lang="ts">
  import { Chart, Pie, Svg, Tooltip } from 'layerchart';
  import { scaleOrdinal } from 'd3-scale';
  import { cn } from '$lib/utils';

  let { data }: { data: Record<string, number> } = $props();
</script>

<div
  class="w-full h-[200px] border-[0.5px] border-zinc-300 rounded-sm p-2 dark:border-zinc-800"
>
  <div
    class={cn(
      'h-full grid grid-cols-2 items-center border rounded-sm ',
      ' from-white bg-gradient-to-br to-zinc-200/60 border-zinc-300 shadow-[2px_0_8px_rgba(0,_0,_0,_0.1)]',
      'dark:from-zinc-950 dark:to-zinc-900/60 bg-gradient-to-br  dark:border-zinc-900/50 dark:shadow-inner',
    )}
  >
    <div class="h-[130px]">
      <Chart
        data={Object.entries(data).map(([key, value]) => ({
          label: key,
          value,
        }))}
        x="value"
        r="label"
        rScale={scaleOrdinal()}
        rDomain={Object.entries(data)
          .sort((a, b) => b[1] - a[1])
          .map(([key]) => key)}
        rRange={['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef']}
        let:tooltip
      >
        <Svg>
          <Pie {tooltip} />
        </Svg>
        <Tooltip header={(d) => d.label} />
      </Chart>
    </div>
    <div>
      {#each Object.entries(data) as [key, value]}
        <p><span class="font-bold">{value}</span> {key}</p>
      {/each}
    </div>
  </div>
</div>
