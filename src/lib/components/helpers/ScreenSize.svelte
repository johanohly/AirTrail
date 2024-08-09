<script lang="ts">
  import { screenSizeStore } from "$lib/utils/size";

  let width;
  let height;

  $: screenSizeStore.set({ width, height });
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />