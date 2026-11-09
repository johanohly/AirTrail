<script lang="ts">
  import type { AircraftPhoto } from '$lib/zod/aircraft-photo';

  let {
    reg,
    photo,
    onerror,
  }: {
    reg: string;
    photo: AircraftPhoto;
    onerror?: () => void;
  } = $props();
</script>

<figure>
  <a href={photo.link} target="_blank" rel="noopener">
    <img
      src={photo.thumbnailSrc}
      alt={photo.photographer ? `${reg}, photo by ${photo.photographer}` : reg}
      loading="lazy"
      {onerror}
      class="w-full rounded-md border border-border/60 object-cover"
    />
  </a>
  <figcaption class="mt-1 text-xs text-muted-foreground">
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
