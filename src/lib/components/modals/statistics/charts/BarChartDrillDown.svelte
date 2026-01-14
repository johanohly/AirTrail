<script lang="ts">
  import { Check, X } from '@o7/icon/lucide';
  import { Button } from '$lib/components/ui/button';
  import type { CountryDetail } from '$lib/stats/aggregations';

  let {
    continent,
    countries,
    onBack,
  }: {
    continent: string;
    countries: CountryDetail[];
    onBack: () => void;
  } = $props();

  const visitedCount = $derived(countries.filter((c) => c.visited).length);
  const totalCount = $derived(countries.length);
</script>

<div class="min-h-[80vh]">
  <!-- Header -->
  <div
    class="border-b border-zinc-200 dark:border-zinc-700 backdrop-blur-sm sticky top-0 z-10"
  >
    <div class="flex flex-col justify-center p-6">
      <Button
        variant="link"
        size="sm"
        onclick={onBack}
        class="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-0 h-auto w-fit text-left font-normal underline-offset-2"
      >
        ← Back to Overview
      </Button>
      <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        {continent}
      </h1>
      <p class="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
        {visitedCount} of {totalCount} countries visited
      </p>
    </div>
  </div>

  <!-- Country List -->
  <div class="p-6">
    <div class="max-w-4xl mx-auto">
      <div
        class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        <div class="max-h-[70vh] overflow-y-auto">
          <div class="divide-y divide-zinc-200 dark:divide-zinc-700">
            {#each countries as country (country.numeric)}
              <div
                class="p-4 flex items-center gap-3 {country.visited
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-zinc-50 dark:bg-zinc-800/30 opacity-60'}"
              >
                <!-- Icon -->
                <div class="flex-shrink-0">
                  {#if country.visited}
                    <Check class="w-5 h-5 text-green-600 dark:text-green-400" />
                  {:else}
                    <X class="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                  {/if}
                </div>

                <!-- Country name -->
                <div class="flex-1">
                  <div
                    class="font-medium {country.visited
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400'}"
                  >
                    {country.name}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
