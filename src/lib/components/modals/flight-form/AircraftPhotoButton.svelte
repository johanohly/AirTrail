<script lang="ts">
  import { Camera } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';
  import { fade } from 'svelte/transition';

  import AircraftPhotoFigure from '$lib/components/map-details/AircraftPhotoFigure.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import { trpc } from '$lib/trpc';
  import { PHOTO_BROWSER_CACHE_MS } from '$lib/zod/aircraft-photo';

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
  const photo = $derived(
    $photoQuery.data?.status === 'found' ? $photoQuery.data.photo : null,
  );

  // The button only promises a photo once the image has actually loaded, so a
  // slow CDN never opens onto an empty popover and a blocked one hides it.
  let loadedSrc = $state<string | null>(null);
  $effect(() => {
    if (!photo) return;
    const src = photo.thumbnailSrc;
    const image = new Image();
    image.onload = () => (loadedSrc = src);
    image.src = src;
    return () => {
      image.onload = null;
    };
  });
</script>

{#if photo && loadedSrc === photo.thumbnailSrc}
  <div transition:fade={{ duration: 150 }}>
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-foreground"
            aria-label="Show aircraft photo"
            title="Show aircraft photo"
          >
            <Camera size={16} />
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content
        align="end"
        class="w-[min(26rem,calc(100vw-2rem))] p-2"
        role="dialog"
        aria-label="Aircraft photo"
      >
        <AircraftPhotoFigure {reg} {photo} />
      </Popover.Content>
    </Popover.Root>
  </div>
{/if}
