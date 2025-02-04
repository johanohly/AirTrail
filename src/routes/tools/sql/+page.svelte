<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/input';
  import * as Table from '$lib/components/ui/table';
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
      <div class="max-h-[80dvh] overflow-y-auto w-full rounded-md border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              {#each result.cols as col}
                <Table.Head>
                  {col}
                </Table.Head>
              {/each}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each result.rows as row}
              <Table.Row>
                {#each result.cols as col}
                  <Table.Cell>
                    {row[col]}
                  </Table.Cell>
                {/each}
              </Table.Row>
            {:else}
              <Table.Row>
                <Table.Cell colspan={result.rows.length}>No data</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
  {/if}
</div>
