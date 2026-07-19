<script lang="ts" module>
  import { getContext } from 'svelte';

  export const ModalContextKey = Symbol('ModalContext');

  export type ModalState = {
    hasHeader: boolean;
    hasFooter: boolean;
  };

  export type ModalContext = {
    closeModal: () => void;
    registerHeader: () => void;
    registerFooter: () => void;
    getState: () => ModalState;
    getContentZIndex: () => number | undefined;
  };
  export const getModalContext = () =>
    getContext<ModalContext>(ModalContextKey);

  let modalLayerCounter = 0;
</script>

<script lang="ts">
  import { onDestroy, setContext, type Snippet } from 'svelte';
  import { browser } from '$app/environment';

  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';
  import { generateUUID } from '$lib/utils/string';
  import {
    backModalHistory,
    closeModalHistory,
    escapeModalHistory,
    openModalHistory,
    pushModalHistoryState,
    unregisterModalHistory,
    type ModalHistoryHandle,
  } from './modal-history';

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
    drawerRawContent = false,
    drawerModal = true,
    drawerSnapPoints,
    overlayClass,
    activeSnapPoint = $bindable<string | number | null>(null),
    shouldScaleBackground = true,
    handleBackButton = true,
    onOpenChange,
    onHistoryStateChange,
    historyHandle = $bindable(),
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
    drawerRawContent?: boolean;
    drawerModal?: boolean;
    drawerSnapPoints?: Array<string | number>;
    overlayClass?: string;
    activeSnapPoint?: string | number | null;
    shouldScaleBackground?: boolean;
    handleBackButton?: boolean;
    onOpenChange?: (open: boolean) => void;
    onHistoryStateChange?: (state: unknown) => void;
    historyHandle?: ModalHistoryHandle;
    children: Snippet;
  } = $props();

  const modalState = $state({
    hasHeader: false,
    hasFooter: false,
  });

  setContext(ModalContextKey, {
    closeModal: () => (open = false),
    registerHeader: () => (modalState.hasHeader = true),
    registerFooter: () => (modalState.hasFooter = true),
    getState: () => modalState,
    getContentZIndex: () => (layerAssigned ? 1001 + layer * 20 : undefined),
  });

  const presetConfig = $derived(presets[preset]);
  const resolvedCloseButton = $derived(
    modalState.hasHeader ? false : (closeButton ?? presetConfig.closeButton),
  );

  const useDialog = isMediumScreen;

  const modalId = generateUUID();
  const localHistoryHandle: ModalHistoryHandle = {
    push: (state) => pushModalHistoryState(modalId, state),
    back: () => backModalHistory(modalId),
  };
  const handleDialogEscape = (event: KeyboardEvent) => {
    event.preventDefault();
    escapeModalHistory(modalId);
  };
  historyHandle = localHistoryHandle;
  let previousOpen = $state(open);
  let layer = $state(0);
  let layerAssigned = $state(false);

  const overlayStyle = $derived(
    layerAssigned ? `z-index: ${1000 + layer * 20};` : undefined,
  );
  const contentStyle = $derived(
    layerAssigned ? `z-index: ${1001 + layer * 20};` : undefined,
  );

  $effect(() => {
    if (open && !layerAssigned) {
      layer = ++modalLayerCounter;
      layerAssigned = true;
    } else if (!open && layerAssigned) {
      layerAssigned = false;
    }
  });

  $effect(() => {
    if (open !== previousOpen) {
      previousOpen = open;
      onOpenChange?.(open);
    }
  });

  $effect(() => {
    if (!browser || !handleBackButton) return;

    if (open) {
      openModalHistory(
        modalId,
        () => {
          open = false;
        },
        { closeOnEscape, onStateChange: onHistoryStateChange },
      );
    } else {
      closeModalHistory(modalId);
    }
  });

  onDestroy(() => {
    if (historyHandle === localHistoryHandle) historyHandle = undefined;
    unregisterModalHistory(modalId);
  });
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open>
    <Dialog.Content
      class={cn(
        'max-h-full overflow-y-auto',
        presetConfig.class,
        { 'p-0 gap-0': dialogNoPadding || modalState.hasHeader },
        className,
      )}
      closeButton={resolvedCloseButton}
      preventScroll={false}
      escapeKeydownBehavior={handleBackButton
        ? 'close'
        : closeOnEscape
          ? 'close'
          : 'ignore'}
      onEscapeKeydown={handleBackButton ? handleDialogEscape : undefined}
      interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
      {overlayClass}
      {overlayStyle}
      style={contentStyle}
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root
    bind:open
    bind:activeSnapPoint
    {shouldScaleBackground}
    modal={drawerModal}
    snapPoints={drawerSnapPoints}
  >
    <Drawer.Content
      noPadding={drawerNoPadding || modalState.hasHeader}
      raw={drawerRawContent}
      class={className}
      {overlayClass}
      {overlayStyle}
      style={contentStyle}
    >
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
