<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  const DrawerContextKey = Symbol('DrawerContext');

  export type DrawerContext = {
    lockDismiss: () => void;
    unlockDismiss: () => void;
  };

  export const getDrawerContext = () =>
    getContext<DrawerContext | undefined>(DrawerContextKey);
</script>

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

  let dismissLocked = $state(false);

  setContext(DrawerContextKey, {
    lockDismiss: () => {
      dismissLocked = true;
    },
    unlockDismiss: () => {
      dismissLocked = false;
    },
  } satisfies DrawerContext);
</script>

<DrawerPrimitive.Root
  {shouldScaleBackground}
  bind:open
  bind:activeSnapPoint
  bind:drawerState
  dismissible={!dismissLocked}
  {...restProps}
/>
