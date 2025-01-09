<script lang="ts">
  import { fly } from 'svelte/transition';

  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { api } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';

  const { fetchAirports }: { fetchAirports: () => Promise<void> } = $props();

  let checkingForUpdates = $state(false);
  let result: Awaited<
    ReturnType<typeof api.airport.updateFromSource.mutate>
  > | null = $state(null);

  const checkForUpdates = async () => {
    checkingForUpdates = true;

    result = await api.airport.updateFromSource.mutate();
    await fetchAirports();

    checkingForUpdates = false;
  };
</script>

<Card>
  <CardHeader>
    <CardTitle>Airport Source</CardTitle>
    <CardDescription>
      By default, AirTrail uses <a
        href="https://ourairports.com/"
        target="_blank"
        class="underline text-blue-500">OurAirports</a
      > as the source for airport data. If OurAirports updates their data, you can
      in turn update the internal data used by AirTrail here.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {#if !checkingForUpdates && !result}
      <Button onclick={checkForUpdates} variant="outline">
        Check for updates
      </Button>
    {:else}
      <div class="flex flex-col gap-5">
        <div class="flex gap-5">
          <dl class="flex flex-col text-sm">
            <dt class="text-muted-foreground mb-2">Status</dt>
            <dd class="flex items-center gap-2">
              <span
                class={cn('size-[10px] rounded-full', {
                  'bg-yellow-500 animate-ping': checkingForUpdates,
                  'bg-green-500': result,
                })}
              />
              <span class="font-medium">
                {checkingForUpdates ? 'Updating' : 'Success'}
              </span>
            </dd>
          </dl>
          {#if result}
            <dl in:fly={{ x: -10 }} class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Took</dt>
              <dd class="flex gap-2">
                <span class="font-medium">
                  {Duration.fromSeconds(result.time / 1000).toHuman()}
                </span>
              </dd>
            </dl>
          {/if}
        </div>
        {#if result}
          <div class="flex gap-5">
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Added</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.created}</span>
              </dd>
            </dl>
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Updated</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.updated}</span>
              </dd>
            </dl>
            <dl class="flex flex-col text-sm">
              <dt class="text-muted-foreground mb-2">Deleted</dt>
              <dd class="flex gap-2">
                <span class="font-medium font-mono">{result.created}</span>
              </dd>
            </dl>
          </div>
        {/if}
      </div>
    {/if}
  </CardContent>
</Card>
