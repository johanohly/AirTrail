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

  // Global modal stack for proper back button handling with nested modals
  const modalHistoryStack: string[] = [];
  let modalLayerCounter = 0;

  export function pushModalHistory(id: string): void {
    modalHistoryStack.push(id);
  }

  export function popModalHistory(): string | undefined {
    return modalHistoryStack.pop();
  }

  export function peekModalHistory(): string | undefined {
    return modalHistoryStack[modalHistoryStack.length - 1];
  }

  export function removeFromModalHistory(id: string): boolean {
    const index = modalHistoryStack.indexOf(id);
    if (index !== -1) {
      modalHistoryStack.splice(index, 1);
      return true;
    }
    return false;
  }
</script>

<script lang="ts">
  import { setContext, type Snippet, onMount } from 'svelte';
  import { browser } from '$app/environment';

  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';
  import { generateUUID } from '$lib/utils/string';

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
    drawerSnapPoints,
    overlayClass,
    activeSnapPoint = $bindable<string | number | null>(null),
    shouldScaleBackground = true,
    handleBackButton = true,
    onOpenChange,
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
    drawerSnapPoints?: Array<string | number>;
    overlayClass?: string;
    activeSnapPoint?: string | number | null;
    shouldScaleBackground?: boolean;
    handleBackButton?: boolean;
    onOpenChange?: (open: boolean) => void;
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
  });

  const presetConfig = $derived(presets[preset]);
  const resolvedCloseButton = $derived(
    modalState.hasHeader ? false : (closeButton ?? presetConfig.closeButton),
  );

  const useDialog = isMediumScreen;

  const modalId = generateUUID();
  let historyPushed = $state(false);
  let closingFromPopstate = $state(false);
  let previousOpen = $state(open);
  let layer = $state(0);
  let layerAssigned = $state(false);

  const overlayStyle = $derived(
    layerAssigned ? `z-index: ${1000 + layer * 20};` : undefined,
  );
  const contentStyle = $derived(
    layerAssigned ? `z-index: ${1001 + layer * 20};` : undefined,
  );

  function handlePopstate(event: PopStateEvent) {
    const isTopmostModal = peekModalHistory() === modalId;
    const wasTriggeredByThisModal = event.state?.modal === modalId;
    if (
      historyPushed &&
      open &&
      !closingFromPopstate &&
      isTopmostModal &&
      !wasTriggeredByThisModal
    ) {
      closingFromPopstate = true;
      historyPushed = false;
      popModalHistory();
      open = false;
      setTimeout(() => {
        closingFromPopstate = false;
      }, 0);
    }
  }

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

    if (open && !historyPushed) {
      history.pushState({ modal: modalId }, '');
      pushModalHistory(modalId);
      historyPushed = true;
    } else if (!open && historyPushed && !closingFromPopstate) {
      historyPushed = false;
      removeFromModalHistory(modalId);
      history.back();
    }
  });

  onMount(() => {
    if (!browser || !handleBackButton) return;

    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      if (historyPushed) {
        removeFromModalHistory(modalId);
        history.back();
      }
    };
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
      escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
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
