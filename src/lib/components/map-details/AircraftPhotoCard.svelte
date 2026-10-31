<script lang="ts">
  import { writable } from 'svelte/store';

  import { Button } from '$lib/components/ui/button';
  import { trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';

  let {
    reg,
    compact = false,
  }: {
    reg: string;
    compact?: boolean;
  } = $props();

  const regStore = writable(reg);
  $effect(() => {
    regStore.set(reg);
  });

  // The server may already hold a response for up to the 24 hours Planespotters
  // allows, so the browser can't add much on top of that.
  const photoQuery = trpc.aircraft.getPhoto.query(regStore, {
    staleTime: 5 * 60 * 1000,
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
  <div
    class={cn(
      'w-full animate-pulse rounded-md bg-muted',
      compact ? 'h-20' : 'aspect-[3/2]',
    )}
  ></div>
{:else if photo}
  {#if failedSrc !== photo.thumbnailSrc}
    <figure>
      <a href={photo.link} target="_blank" rel="noopener noreferrer">
        <img
          src={photo.thumbnailSrc}
          alt="{reg}, photo by {photo.photographer}"
          loading="lazy"
          onerror={() => (failedSrc = photo.thumbnailSrc)}
          class={cn(
            'w-full rounded-md border border-border/60 object-cover',
            compact && 'h-20',
          )}
        />
      </a>
      <figcaption class="mt-1 text-xs text-muted-foreground">
        © {photo.photographer} /
        <a
          href={photo.link}
          target="_blank"
          rel="noopener noreferrer"
          class="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          Planespotters.net
        </a>
      </figcaption>
    </figure>
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
{:else if compact && result?.status === 'none'}
  <p class="text-xs text-muted-foreground">No photo found</p>
{/if}
