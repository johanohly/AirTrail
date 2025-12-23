<script lang="ts">
  import {
    Drawer as DrawerPrimitive,
    type ParentDrawerState,
  } from '@johly/vaul-svelte';

  let {
    shouldScaleBackground = true,
    open = $bindable(false),
    activeSnapPoint = $bindable(null),
    drawerState = $bindable<ParentDrawerState>(),
    ...restProps
  }: DrawerPrimitive.RootProps = $props();
</script>

<DrawerPrimitive.Root
  {shouldScaleBackground}
  bind:open
  bind:activeSnapPoint
  bind:drawerState
  {...restProps}
/>
