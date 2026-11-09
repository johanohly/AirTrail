<script lang="ts">
  import { writable } from 'svelte/store';

  import { Button } from '$lib/components/ui/button';
  import { trpc } from '$lib/trpc';
  import { PHOTO_BROWSER_CACHE_MS } from '$lib/zod/aircraft-photo';

  import AircraftPhotoFigure from './AircraftPhotoFigure.svelte';

  let { reg }: { reg: string } = $props();

  const regStore = writable(reg);
  $effect(() => {
    regStore.set(reg);
  });

  const photoQuery = trpc.aircraft.getPhoto.query(regStore, {
    staleTime: PHOTO_BROWSER_CACHE_MS,
    gcTime: PHOTO_BROWSER_CACHE_MS,
    refetchOnWindowFocus: false,
  });

  const result = $derived($photoQuery.data);
  const photo = $derived(result?.status === 'found' ? result.photo : null);
  const unavailable = $derived(
    $photoQuery.isError || result?.status === 'unavailable',
  );

  // The API may be reachable when the CDN isn't, as on restricted networks. Show
  // nothing then instead of a broken image.
  let failedSrc = $state<string | null>(null);
</script>

{#if $photoQuery.isLoading}
  <div class="aspect-[3/2] w-full animate-pulse rounded-md bg-muted"></div>
{:else if photo}
  {#if failedSrc !== photo.thumbnailSrc}
    <AircraftPhotoFigure
      {reg}
      {photo}
      onerror={() => (failedSrc = photo.thumbnailSrc)}
    />
  {/if}
{:else if unavailable}
  <div class="flex items-center justify-between gap-2">
    <p class="text-xs text-muted-foreground">Couldn't load photo</p>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={$photoQuery.isFetching}
      onclick={() => $photoQuery.refetch()}
    >
      Retry
    </Button>
  </div>
{/if}
