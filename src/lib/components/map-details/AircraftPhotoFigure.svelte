<script lang="ts">
  import { cn } from '$lib/utils';
  import type { AircraftPhoto } from '$lib/zod/aircraft-photo';

  let {
    reg,
    photo,
    small = false,
    onerror,
  }: {
    reg: string;
    photo: AircraftPhoto;
    small?: boolean;
    onerror?: () => void;
  } = $props();
</script>

<figure class={cn({ 'w-[200px]': small })}>
  <a href={photo.link} target="_blank" rel="noopener">
    <img
      src={small ? photo.smallThumbnailSrc : photo.thumbnailSrc}
      alt={photo.photographer ? `${reg}, photo by ${photo.photographer}` : reg}
      loading="lazy"
      {onerror}
      class={small
        ? 'mx-auto h-auto max-h-[200px] w-auto max-w-full rounded-sm object-contain'
        : 'w-full rounded-md border border-border/60 object-cover'}
    />
  </a>
  <figcaption
    class={cn('mt-1 text-muted-foreground', small ? 'text-[11px]' : 'text-xs')}
  >
    {#if photo.photographer}© {photo.photographer} /{/if}
    <a
      href={photo.link}
      target="_blank"
      rel="noopener"
      class="underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      Planespotters.net
    </a>
  </figcaption>
</figure>
