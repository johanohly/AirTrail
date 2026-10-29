<script lang="ts">
  import { RefreshCw } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';

  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { api, trpc } from '$lib/trpc';

  let {
    flightId,
    reg,
    compact = false,
  }: {
    flightId: number;
    reg: string;
    compact?: boolean;
  } = $props();

  const flightIdStore = writable(flightId);
  $effect(() => {
    flightIdStore.set(flightId);
  });

  const photoQuery = trpc.aircraft.getOrFetchPhoto.query(flightIdStore, {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const photo = $derived($photoQuery.data ?? null);
  const isLoading = $derived($photoQuery.isLoading);

  let refetching = $state(false);
  const refetch = async () => {
    refetching = true;
    try {
      await api.aircraft.refetchPhoto.mutate({ flightId });
      await trpc.aircraft.getOrFetchPhoto.utils.invalidate(flightId);
    } finally {
      refetching = false;
    }
  };

  const fetchedLabel = $derived.by(() => {
    if (!photo) return '';
    const fetched = new Date(photo.fetchedAt);
    if (Number.isNaN(fetched.getTime())) return `Registration ${photo.reg}`;
    return `Fetched ${new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fetched)} · ${photo.reg}`;
  });

  const alt = $derived(`${reg} — photo by ${photo?.photographer ?? ''}`);
</script>

{#if photo && !isLoading}
  <figure class="relative">
    <a href={photo.photoLink} target="_blank" rel="noopener noreferrer">
      <img
        src={photo.thumbnailUrl}
        {alt}
        loading="lazy"
        class={compact
          ? 'h-20 w-full rounded-md border border-border/60 object-cover'
          : 'w-full rounded-lg border border-border/60 object-cover'}
      />
    </a>
    {#if !compact}
      <button
        type="button"
        class="absolute top-1.5 right-1.5 cursor-pointer rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        aria-label="Refetch aircraft photo"
        onclick={refetch}
        disabled={refetching}
      >
        <TextTooltip content={fetchedLabel}>
          <RefreshCw size={13} class={refetching ? 'animate-spin' : ''} />
        </TextTooltip>
      </button>
    {/if}
    <figcaption
      class={compact
        ? 'mt-1 text-[10px] leading-tight text-muted-foreground'
        : 'mt-1.5 text-xs text-muted-foreground'}
    >
      © {photo.photographer} /
      <a
        href={photo.photoLink}
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
      >
        Planespotters.net
      </a>
    </figcaption>
  </figure>
{:else if isLoading}
  <div class={compact ? 'h-20 w-full' : 'aspect-[3/2] w-full'}>
    <div class="animate-pulse rounded-lg bg-muted"></div>
  </div>
{/if}
