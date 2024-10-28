<script lang="ts">
  import { Chart, CircleClipPath, Pie, Svg, Tooltip } from 'layerchart';
  import { cn } from '$lib/utils';

  let { data }: { data: Record<string, number> } = $props();
  const noData = $derived.by(
    () => Object.values(data).reduce((a, b) => a + b, 0) === 0,
  );
  const placeholderOrData = $derived.by(() => {
    if (noData) {
      return { 'No data': 1 };
    }
    return Object.fromEntries(
      Object.entries(data).sort(([, a], [, b]) => b - a),
    );
  });
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
        data={Object.entries(placeholderOrData).map(([key, value]) => ({
          label: key,
          value,
        }))}
        c="label"
        x="value"
        cRange={noData
          ? ['#3b82f650']
          : ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef']}
        let:c
        let:cScale
        let:tooltip
      >
        <Svg center>
          <CircleClipPath initialR={0} r={80} tweened>
            <Pie {tooltip} />
          </CircleClipPath>
        </Svg>
        <Tooltip.Root let:data>
          <Tooltip.List>
            <Tooltip.Item
              label={data.label}
              value={data.value}
              color={cScale?.(c(data))}
            />
          </Tooltip.List>
        </Tooltip.Root>
      </Chart>
    </div>
    <div>
      {#each Object.entries(data) as [key, value]}
        <p><span class="font-bold">{value}</span> {key}</p>
      {/each}
    </div>
  </div>
</div>
