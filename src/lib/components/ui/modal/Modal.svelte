<script lang="ts" module>
  import { getContext } from 'svelte';

  const ModalContextKey = Symbol('ModalContext');

  export type ModalState = {
    hasHeader: boolean;
    hasFooter: boolean;
  };

  export type ModalContext = {
    closeModal: () => void;
    registerHeader: () => void;
    registerFooter: () => void;
    getState: () => ModalState;
  };
  export const getModalContext = () =>
    getContext<ModalContext>(ModalContextKey);
</script>

<script lang="ts">
  import { setContext, type Snippet } from 'svelte';

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
    dialogNoPadding = false,
    drawerNoPadding = false,
    children,
  }: {
    open: boolean;
    class?: string;
    preset?: ModalPreset;
    dialogOnly?: boolean;
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
    closeButton?: boolean;
    dialogNoPadding?: boolean;
    drawerNoPadding?: boolean;
    children: Snippet;
  } = $props();

  const state = $state({
    hasHeader: false,
    hasFooter: false,
  });

  setContext(ModalContextKey, {
    closeModal: () => (open = false),
    registerHeader: () => (state.hasHeader = true),
    registerFooter: () => (state.hasFooter = true),
    getState: () => state,
  });

  const presetConfig = $derived(presets[preset]);
  const resolvedCloseButton = $derived(
    state.hasHeader ? false : (closeButton ?? presetConfig.closeButton),
  );

  const useDialog = isMediumScreen;
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open>
    <Dialog.Content
      class={cn(
        'max-h-full overflow-y-auto',
        presetConfig.class,
        { 'p-0 gap-0': dialogNoPadding || state.hasHeader },
        className,
      )}
      closeButton={resolvedCloseButton}
      preventScroll={false}
      escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
      interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open shouldScaleBackground>
    <Drawer.Content noPadding={drawerNoPadding || state.hasHeader}>
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
