<script lang="ts">
  import { PieChart } from 'layerchart';

  import { Button } from '$lib/components/ui/button';
  import { type ChartKey, CHARTS } from '$lib/stats/aggregations';
  import { type FlightData } from '$lib/utils';

  let {
    chartKey,
    data,
    flights,
    onBack,
  }: {
    chartKey: ChartKey;
    data: Record<string, number>;
    flights: FlightData[];
    onBack: () => void;
  } = $props();

  const chartDef = $derived(CHARTS[chartKey]);
  const totalCount = $derived(Object.values(data).reduce((a, b) => a + b, 0));
  const sortedEntries = $derived(
    Object.entries(data).sort(([, a], [, b]) => b - a),
  );

  const noData = $derived(totalCount === 0);
  const chartData = $derived.by(() => {
    if (noData) {
      return [{ label: 'No data', value: 1 }];
    }
    return sortedEntries.map(([key, value]) => ({
      label: key,
      value,
    }));
  });

  const getPercentage = (value: number) => {
    if (totalCount === 0) return 0;
    return Math.round((value / totalCount) * 100);
  };
</script>

<div class="min-h-[80vh]">
  <!-- Header -->
  <div
    class="border-b border-zinc-200 dark:border-zinc-700 backdrop-blur-sm sticky top-0 z-10"
  >
    <div class="p-6">
      <div class="flex items-center gap-4">
        <Button
          variant="ghost"
          onclick={onBack}
          class="hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ← Back to Overview
        </Button>
        <div class="flex-1">
          <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            {chartDef.title}
          </h1>
          <p class="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
            {totalCount} total entries across {flights.length} flights
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="p-6">
    <div class="max-w-7xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-8 items-start">
        <!-- Chart Section -->
        <div class="space-y-6">
          <div
            class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2
                class="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Distribution Overview
              </h2>
            </div>
            <div class="p-6">
              <div class="h-[400px] flex items-center justify-center">
                <PieChart
                  data={chartData}
                  key="label"
                  value="value"
                  cRange={noData
                    ? ['#3b82f650']
                    : [
                        '#3b82f6',
                        '#6366f1',
                        '#8b5cf6',
                        '#a855f7',
                        '#d946ef',
                        '#ec4899',
                        '#f59e0b',
                        '#10b981',
                        '#06b6d4',
                        '#8b5cf6',
                      ]}
                />
              </div>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="grid grid-cols-2 gap-4">
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {sortedEntries.length}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Unique Categories
              </div>
            </div>
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {totalCount}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Total Count
              </div>
            </div>
          </div>
        </div>

        <!-- Data List Section -->
        <div
          class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        >
          <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Detailed Breakdown
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              All {sortedEntries.length} categories ranked by frequency
            </p>
          </div>
          <div class="max-h-[500px] overflow-y-auto">
            {#if noData}
              <div class="p-8 text-center text-zinc-500 dark:text-zinc-400">
                <div class="text-4xl mb-2">📊</div>
                <p class="text-lg font-medium">No data available</p>
                <p class="text-sm">
                  This chart will populate as you add more flights
                </p>
              </div>
            {:else}
              <div class="divide-y divide-zinc-200 dark:divide-zinc-700">
                {#each sortedEntries as [key, value], index (key)}
                  <div
                    class="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="flex-shrink-0">
                          <div
                            class="w-3 h-3 rounded-full bg-gradient-to-r"
                            style="background: linear-gradient(45deg,
                                 {[
                              '#3b82f6',
                              '#6366f1',
                              '#8b5cf6',
                              '#a855f7',
                              '#d946ef',
                              '#ec4899',
                              '#f59e0b',
                              '#10b981',
                              '#06b6d4',
                              '#8b5cf6',
                            ][index % 10]},
                                 {[
                              '#6366f1',
                              '#8b5cf6',
                              '#a855f7',
                              '#d946ef',
                              '#ec4899',
                              '#f59e0b',
                              '#10b981',
                              '#06b6d4',
                              '#8b5cf6',
                              '#3b82f6',
                            ][index % 10]})"
                          ></div>
                        </div>
                        <div>
                          <div
                            class="font-medium text-zinc-900 dark:text-zinc-100"
                          >
                            {key}
                          </div>
                          <div class="text-sm text-zinc-600 dark:text-zinc-400">
                            Rank #{index + 1}
                          </div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div
                          class="font-bold text-lg text-zinc-900 dark:text-zinc-100"
                        >
                          {value}
                        </div>
                        <div class="text-sm text-zinc-600 dark:text-zinc-400">
                          {getPercentage(value)}%
                        </div>
                      </div>
                    </div>
                    <!-- Progress bar -->
                    <div class="mt-2">
                      <div
                        class="w-full bg-zinc-200 dark:bg-zinc-600 rounded-full h-2"
                      >
                        <div
                          class="h-2 rounded-full bg-gradient-to-r transition-all duration-300"
                          style="width: {getPercentage(
                            value,
                          )}%; background: linear-gradient(45deg,
                            {[
                            '#3b82f6',
                            '#6366f1',
                            '#8b5cf6',
                            '#a855f7',
                            '#d946ef',
                            '#ec4899',
                            '#f59e0b',
                            '#10b981',
                            '#06b6d4',
                            '#8b5cf6',
                          ][index % 10]},
                            {[
                            '#6366f1',
                            '#8b5cf6',
                            '#a855f7',
                            '#d946ef',
                            '#ec4899',
                            '#f59e0b',
                            '#10b981',
                            '#06b6d4',
                            '#8b5cf6',
                            '#3b82f6',
                          ][index % 10]})"
                        ></div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
