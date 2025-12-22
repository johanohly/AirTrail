<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  const DRAWER_CONTEXT_KEY = Symbol('drawer-context');

  export function setInsideDrawer() {
    setContext(DRAWER_CONTEXT_KEY, true);
  }

  export function isInsideDrawer(): boolean {
    return getContext(DRAWER_CONTEXT_KEY) === true;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  type ModalPreset = 'default' | 'alert';

  const presets: Record<ModalPreset, { class: string; closeButton: boolean }> =
    {
      default: { class: 'max-w-lg', closeButton: true },
      alert: { class: 'max-w-md', closeButton: false },
    };

  let {
    open = $bindable(),
    class: className,
    preset = 'default',
    dialogOnly = false,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeButton,
    children,
  }: {
    open: boolean;
    class?: string;
    preset?: ModalPreset;
    dialogOnly?: boolean;
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
    closeButton?: boolean;
    children: Snippet;
  } = $props();

  const presetConfig = $derived(presets[preset]);
  const resolvedCloseButton = $derived(closeButton ?? presetConfig.closeButton);

  const useDialog = isMediumScreen;
  const nested = isInsideDrawer();
  const willRenderDrawer = !$useDialog && !dialogOnly;

  // Set context so nested modals know they're inside a drawer
  // Only set when we're actually rendering a drawer
  if (willRenderDrawer) {
    setInsideDrawer();
  }
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open>
    <Dialog.Content
      class={cn('max-h-full overflow-y-auto', presetConfig.class, className)}
      closeButton={resolvedCloseButton}
      preventScroll={false}
      escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
      interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
    >
      {@render children?.()}
    </Dialog.Content>
  </Dialog.Root>
{:else if nested}
  <Drawer.NestedRoot bind:open shouldScaleBackground>
    <Drawer.Content>
      {@render children()}
    </Drawer.Content>
  </Drawer.NestedRoot>
{:else}
  <Drawer.Root bind:open shouldScaleBackground>
    <Drawer.Content>
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
