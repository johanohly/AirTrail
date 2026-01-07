<script lang="ts">
  import { screenSizeStore } from '$lib/utils/size';

  let width = $state<number | undefined>();
  let height = $state<number | undefined>();

  $effect(() => {
    if (width !== undefined && height !== undefined) {
      screenSizeStore.set({ width, height });
    }
  });
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />
