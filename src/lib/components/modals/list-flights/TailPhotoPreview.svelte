<script lang="ts">
  import { toStore } from 'svelte/store';

  import AircraftPhotoFigure from '$lib/components/map-details/AircraftPhotoFigure.svelte';
  import { trpc } from '$lib/trpc';
  import { PHOTO_BROWSER_CACHE_MS } from '$lib/zod/aircraft-photo';

  let { reg }: { reg: string } = $props();

  // Same query as the flight details photo, so the two share one cache entry.
  // A busy server answers `unavailable`, which shouldn't stick for minutes when
  // the preview has no retry button.
  const photoQuery = trpc.aircraft.getPhoto.query(
    toStore(() => reg),
    {
      staleTime: (query) =>
        query.state.data?.status === 'unavailable' ? 0 : PHOTO_BROWSER_CACHE_MS,
      gcTime: PHOTO_BROWSER_CACHE_MS,
      refetchOnWindowFocus: false,
    },
  );

  const result = $derived($photoQuery.data);
  const photo = $derived(result?.status === 'found' ? result.photo : null);

  // Thumbnails come in different shapes, so the image sets the box's height.
  // It is shown only once loaded, so the box doesn't open at the wrong size.
  let loadedSrc = $state<string | null>(null);
  let failedSrc = $state<string | null>(null);
  $effect(() => {
    if (!photo) return;
    const src = photo.smallThumbnailSrc;
    const image = new Image();
    image.onload = () => (loadedSrc = src);
    image.onerror = () => (failedSrc = src);
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  });

  const imageReady = $derived(!!photo && loadedSrc === photo.smallThumbnailSrc);
  const imageFailed = $derived(
    !!photo && failedSrc === photo.smallThumbnailSrc,
  );
</script>

{#if $photoQuery.isLoading || (photo && !imageReady && !imageFailed)}
  <div class="h-[133px] w-[200px] animate-pulse rounded-sm bg-muted"></div>
{:else if photo && imageReady}
  <AircraftPhotoFigure {reg} {photo} small />
{:else if $photoQuery.isError || result?.status === 'unavailable' || imageFailed}
  <p class="px-1 text-xs text-muted-foreground">Couldn't load photo</p>
{:else}
  <p class="px-1 text-xs text-muted-foreground">No photo on Planespotters</p>
{/if}
