<script lang="ts">
  import { Dot } from '@o7/icon/lucide';
  import type { HTMLAttributes } from 'svelte/elements';

  import type { WithElementRef } from '$lib/primitives';

  let {
    ref = $bindable(null),
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} role="separator" {...restProps}>
  {#if children}
    {@render children?.()}
  {:else}
    <Dot />
  {/if}
</div>
