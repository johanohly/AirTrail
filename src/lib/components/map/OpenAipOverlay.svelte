<script lang="ts">
  import {
    FillLayer,
    LineLayer,
    SymbolLayer,
    VectorTileSource,
  } from 'svelte-maplibre';

  import {
    OPENAIP_AIRSPACE_SOURCE_ID,
    type OpenAipOverlayLayer,
  } from '$lib/map/openaip';

  let {
    tileUrlTemplate,
    layers,
  }: {
    tileUrlTemplate: string;
    layers: OpenAipOverlayLayer[];
  } = $props();
</script>

<VectorTileSource
  id={OPENAIP_AIRSPACE_SOURCE_ID}
  tiles={[tileUrlTemplate]}
  attribution={'<a href="https://www.openaip.net" target="_blank" rel="noreferrer">openAIP</a>'}
>
  {#each layers as layer (layer.id)}
    {#if layer.kind === 'fill'}
      <FillLayer
        id={layer.id}
        sourceLayer={layer.sourceLayer}
        filter={layer.filter}
        minzoom={layer.minzoom}
        maxzoom={layer.maxzoom}
        layout={layer.layout}
        paint={layer.paint}
      />
    {:else if layer.kind === 'line'}
      <LineLayer
        id={layer.id}
        sourceLayer={layer.sourceLayer}
        filter={layer.filter}
        minzoom={layer.minzoom}
        maxzoom={layer.maxzoom}
        layout={layer.layout}
        paint={layer.paint}
      />
    {:else}
      <SymbolLayer
        id={layer.id}
        sourceLayer={layer.sourceLayer}
        filter={layer.filter}
        minzoom={layer.minzoom}
        maxzoom={layer.maxzoom}
        layout={layer.layout}
        paint={layer.paint}
      />
    {/if}
  {/each}
</VectorTileSource>
