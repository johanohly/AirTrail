<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    title,
    data,
  }: {
    title: string;
    data: Record<string, { visited: number; total: number }>;
  } = $props();

  const noData = $derived.by(() => Object.values(data).length === 0);

  const sortedEntries = $derived.by(() => {
    return Object.entries(data).sort(([, a], [, b]) => b.visited - a.visited);
  });

  const getPercentage = (visited: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((visited / total) * 100);
  };
</script>

<div
  class={cn(
    'relative w-full border-[0.5px] border-zinc-300 rounded-sm p-2 dark:border-zinc-800 min-h-[250px]',
  )}
>
  <div
    class={cn(
      'border rounded-sm h-full p-4',
      'from-white bg-linear-to-br to-zinc-200/60 border-zinc-300 shadow-[2px_0_8px_rgba(0,0,0,0.1)]',
      'dark:from-zinc-950 dark:to-zinc-900/60 bg-linear-to-br dark:border-zinc-900/50 dark:shadow-inner',
    )}
  >
    {#if title}
      <div class="mb-4">
        <p class="font-bold text-sm">{title}</p>
      </div>
    {/if}

    {#if noData}
      <div class="flex items-center justify-center h-[200px]">
        <p class="text-zinc-400 dark:text-zinc-600">No data</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each sortedEntries as [continent, { visited, total }] (continent)}
          {@const percentage = getPercentage(visited, total)}
          <div class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">{continent}</span>
              <span class="text-zinc-600 dark:text-zinc-400">
                {visited}/{total} ({percentage}%)
              </span>
            </div>
            <div
              class="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden"
            >
              <div
                class="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                style="width: {percentage}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
