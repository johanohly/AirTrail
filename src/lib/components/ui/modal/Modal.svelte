<script lang="ts" module>
  import { getContext } from 'svelte';

  const ModalContextKey = Symbol('ModalContext');

  export type ModalContext = {
    closeModal: () => void;
    registerHeader: () => void;
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

  const state = $state({
    hasHeader: false,
  });

  setContext(ModalContextKey, {
    closeModal: () => (open = false),
    registerHeader: () => (state.hasHeader = true),
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
      class={cn('max-h-full overflow-y-auto', presetConfig.class, className)}
      closeButton={resolvedCloseButton}
      preventScroll={false}
      escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
      interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
      noPadding={state.hasHeader}
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open shouldScaleBackground>
    <Drawer.Content noPadding={state.hasHeader}>
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
