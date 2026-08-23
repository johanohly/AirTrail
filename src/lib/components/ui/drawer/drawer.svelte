<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  import type {
    DrawerDismissAttempt,
    DrawerParentContext,
  } from './internal.svelte';

  const DrawerParentKey = Symbol('DrawerParent');
  const DrawerStateKey = Symbol('DrawerState');

  export const getDrawerState = () =>
    getContext<DrawerRootState>(DrawerStateKey);

  const getParentDrawer = () =>
    getContext<DrawerParentContext | undefined>(DrawerParentKey);
</script>

<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import { DrawerRootState, type SnapPoint } from './internal.svelte';

  let {
    open = $bindable(false),
    activeSnapPoint = $bindable(null),
    snapPoints,
    modal = true,
    dismissible = true,
    beforeDismiss = (_attempt: DrawerDismissAttempt) => true,
    shouldScaleBackground = true,
    children,
  }: {
    open?: boolean;
    activeSnapPoint?: SnapPoint | null;
    snapPoints?: SnapPoint[];
    modal?: boolean;
    dismissible?: boolean;
    beforeDismiss?: (
      attempt: DrawerDismissAttempt,
    ) => boolean | Promise<boolean>;
    shouldScaleBackground?: boolean;
    children?: Snippet;
  } = $props();

  // Read the parent before registering ourselves so nesting chains correctly.
  const parent = getParentDrawer() ?? null;

  const state = new DrawerRootState(
    {
      open: () => open,
      setOpen: (o) => (open = o),
      beforeDismiss: (attempt) => beforeDismiss(attempt),
      modal: () => modal,
      dismissible: () => dismissible,
      snapPoints: () => snapPoints,
      activeSnapPoint: () => activeSnapPoint,
      setActiveSnapPoint: (point) => (activeSnapPoint = point),
      shouldScaleBackground: () => shouldScaleBackground,
    },
    parent,
  );

  setContext(DrawerStateKey, state);
  setContext(DrawerParentKey, state.parentContext);
</script>

<DialogPrimitive.Root
  bind:open={
    () => open,
    (o) => {
      if (!o && !dismissible) return;
      open = o;
    }
  }
>
  {@render children?.()}
</DialogPrimitive.Root>
