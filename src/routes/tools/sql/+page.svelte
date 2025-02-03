<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/input';
  import { api } from '$lib/trpc';

  $effect(() => {
    if (page.data.user?.role !== 'owner') {
      goto('/');
    }
  });

  let query = $state('');
  let result: { cols: string[]; rows: any[] } | { error: string } | null =
    $state(null);
  const execute = async () => {
    result = await api.sql.execute.query(query);
  };
</script>

<div class="container h-full flex flex-col items-center justify-center gap-2">
  <h1 class="text-2xl font-medium">SQL Console</h1>
  <Textarea bind:value={query} placeholder="Your SQL query" />
  <Button onclick={execute}>Execute</Button>
  {#if result}
    {#if 'error' in result}
      <div class="text-red-500">{result.error}</div>
    {:else}
      <div class="w-full relative overflow-x-auto">
        <table class="w-full text-sm text-left text-muted-foreground">
          <thead class="text-xs uppercase bg-card-hover">
            <tr>
              {#each result.cols as col}
                <th scope="col" class="px-6 py-3">{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each result.rows as row}
              <tr class="border-b border">
                {#each result.cols as col}
                  <td class="px-6 py-4">{row[col]}</td>
                {/each}
              </tr>
            {:else}
              <tr>
                <td class="text-center px-6 py-4" colspan={result.cols.length}
                  >No data</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
