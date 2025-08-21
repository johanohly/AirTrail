<script lang="ts">
  import { Pie, PieChart, Svg } from 'layerchart';
  import { cubicInOut } from 'svelte/easing';

  import { cn } from '$lib/utils';

  let {
    title,
    data,
    expanded = false,
  }: {
    title: string;
    data: Record<string, number>;
    expanded?: boolean;
  } = $props();
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
  class={cn(
    'w-full border-[0.5px] border-zinc-300 rounded-sm p-2 dark:border-zinc-800',
    expanded ? 'h-auto' : 'h-[250px]',
  )}
>
  <div
    class={cn(
      'grid grid-cols-2 items-center border rounded-sm ',
      expanded ? '' : 'h-full',
      ' from-white bg-linear-to-br to-zinc-200/60 border-zinc-300 shadow-[2px_0_8px_rgba(0,0,0,0.1)]',
      'dark:from-zinc-950 dark:to-zinc-900/60 bg-linear-to-br  dark:border-zinc-900/50 dark:shadow-inner',
    )}
  >
    <div class={cn(expanded ? 'h-[380px] md:h-[420px]' : 'h-[160px]')}>
      <PieChart
        data={Object.entries(placeholderOrData).map(([key, value]) => ({
          label: key,
          value,
        }))}
        key="label"
        value="value"
        cRange={noData
          ? ['#3b82f650']
          : ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef']}
      />
    </div>
    <div
      class={cn(
        expanded ? 'max-h-[60vh] overflow-y-auto pr-4 py-2 space-y-1' : '',
      )}
    >
      {#if title}
        <div class="flex items-center justify-between pr-2">
          <p><span class="font-bold">{title}</span></p>
        </div>
      {/if}
      {#each Object.entries(data) as [key, value] (key)}
        <p><span class="font-bold">{value}</span> {key}</p>
      {/each}
    </div>
  </div>
</div>
