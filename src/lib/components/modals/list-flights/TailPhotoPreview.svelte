<script lang="ts">
  import { writable } from 'svelte/store';

  import { trpc } from '$lib/trpc';
  import { PHOTO_BROWSER_CACHE_MS } from '$lib/zod/aircraft-photo';

  let { reg }: { reg: string } = $props();

  const regStore = writable(reg);
  $effect(() => {
    regStore.set(reg);
  });

  // Same query as the flight details photo, so the two share one cache entry.
  const photoQuery = trpc.aircraft.getPhoto.query(regStore, {
    staleTime: PHOTO_BROWSER_CACHE_MS,
    gcTime: PHOTO_BROWSER_CACHE_MS,
    refetchOnWindowFocus: false,
  });

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
  <figure class="w-[200px]">
    <img
      src={photo.smallThumbnailSrc}
      alt={photo.photographer ? `${reg}, photo by ${photo.photographer}` : reg}
      class="mx-auto h-auto max-h-[200px] w-auto max-w-full rounded-sm object-contain"
    />
    <figcaption class="mt-1 truncate text-[11px] text-muted-foreground">
      {#if photo.photographer}© {photo.photographer} /{/if}
      Planespotters.net
    </figcaption>
  </figure>
{:else if $photoQuery.isError || result?.status === 'unavailable'}
  <p class="px-1 text-xs text-muted-foreground">Couldn't load photo</p>
{:else}
  <p class="px-1 text-xs text-muted-foreground">No photo on Planespotters</p>
{/if}
