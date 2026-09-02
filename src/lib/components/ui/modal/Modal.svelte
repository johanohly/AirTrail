<script lang="ts" module>
  import { getContext } from 'svelte';

  export const ModalContextKey = Symbol('ModalContext');

  export type ModalState = {
    hasHeader: boolean;
    hasFooter: boolean;
  };

  export type ModalContext = {
    closeModal: () => void;
    isBusy: () => boolean;
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
  import { onDestroy, setContext, tick, type Snippet } from 'svelte';
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
  import {
    confirmDiscardChanges,
    decideModalDismissal,
    type ModalCloseReason,
    type ModalDismissalMode,
    type ModalPresentation,
  } from './modal-dismissal';

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
    dismissal,
    dirty = false,
    busy = false,
    confirmExplicitClose = false,
    onDiscard,
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
    dismissal?: ModalDismissalMode;
    dirty?: boolean;
    busy?: boolean;
    confirmExplicitClose?: boolean;
    onDiscard?: () => void | Promise<void>;
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
    closeModal: () => void requestClose('explicit'),
    isBusy: () => busy,
    registerHeader: () => (modalState.hasHeader = true),
    registerFooter: () => (modalState.hasFooter = true),
    getState: () => modalState,
    getContentZIndex: () => (layerAssigned ? 1001 + layer * 20 : undefined),
  });

  const presetConfig = $derived(presets[preset]);
  const dismissalMode = $derived(
    dismissal ?? (preset === 'alert' ? 'dialog' : 'view'),
  );
  const resolvedCloseButton = $derived(
    modalState.hasHeader ? false : (closeButton ?? presetConfig.closeButton),
  );

  const useDialog = isMediumScreen;
  const presentation = $derived<ModalPresentation>(
    $useDialog || dialogOnly ? 'dialog' : 'sheet',
  );

  const modalId = generateUUID();
  const localHistoryHandle: ModalHistoryHandle = {
    push: (state) => pushModalHistoryState(modalId, state),
    back: () => backModalHistory(modalId),
  };
  let pendingHistoryReason: 'escape' | 'history' = 'history';
  let closing = false;
  let confirming = false;
  let contentRef: HTMLElement | null = $state(null);
  let refusalAnimation: Animation | undefined;

  const pulseDismissRefusal = () => {
    if (
      !contentRef ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    refusalAnimation?.cancel();
    refusalAnimation = contentRef.animate(
      [{ scale: '1' }, { scale: '1.02' }, { scale: '1' }],
      { duration: 300, easing: 'ease' },
    );
  };

  const approveClose = async (
    reason: ModalCloseReason,
    beforeConfirm?: () => void,
  ) => {
    const decision = decideModalDismissal({
      mode: dismissalMode,
      presentation,
      reason,
      dirty,
      busy,
      closeOnOutsideClick,
      closeOnEscape,
    });

    if (decision.kind === 'block') {
      if (decision.pulse) pulseDismissRefusal();
      return false;
    }

    if (decision.kind === 'confirm') {
      if (confirming) return false;
      beforeConfirm?.();
      const focusTarget =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      confirming = true;
      try {
        if (!(await confirmDiscardChanges())) {
          await tick();
          focusTarget?.focus({ preventScroll: true });
          return false;
        }
      } finally {
        confirming = false;
      }
    }

    if (dismissalMode === 'form' && dirty) await onDiscard?.();
    return true;
  };

  const requestClose = async (reason: ModalCloseReason) => {
    if (closing || !(await approveClose(reason))) return false;
    closing = true;
    open = false;
    return true;
  };

  const registerHistory = () => {
    openModalHistory(
      modalId,
      () => {
        const reason = pendingHistoryReason;
        pendingHistoryReason = 'history';
        void (async () => {
          const closed = await requestClose(reason);
          if (!closed && reason === 'history' && open) registerHistory();
        })();
      },
      { closeOnEscape, onStateChange: onHistoryStateChange },
    );
  };

  const handleDialogEscape = (event: KeyboardEvent) => {
    event.preventDefault();
    if (handleBackButton) {
      pendingHistoryReason = 'escape';
      escapeModalHistory(modalId);
      queueMicrotask(() => (pendingHistoryReason = 'history'));
    } else {
      void requestClose('escape');
    }
  };
  const handleInteractOutside = (event: PointerEvent) => {
    event.preventDefault();
  };
  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    void requestClose('backdrop');
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
    } else if (!open && !contentRef && layerAssigned) {
      layerAssigned = false;
    }
  });

  $effect(() => {
    if (open !== previousOpen) {
      previousOpen = open;
      if (open) closing = false;
      onOpenChange?.(open);
    }
  });

  $effect(() => {
    if (!browser || !handleBackButton) return;

    if (open) {
      registerHistory();
    } else {
      closeModalHistory(modalId);
    }
  });

  onDestroy(() => {
    refusalAnimation?.cancel();
    if (historyHandle === localHistoryHandle) historyHandle = undefined;
    unregisterModalHistory(modalId);
  });
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open>
    <Dialog.Content
      bind:ref={contentRef}
      class={cn(
        'max-h-full overflow-y-auto',
        presetConfig.class,
        { 'p-0 gap-0': dialogNoPadding || modalState.hasHeader },
        className,
      )}
      closeButton={resolvedCloseButton}
      closeButtonDisabled={busy}
      onClose={() =>
        void requestClose(confirmExplicitClose ? 'programmatic' : 'explicit')}
      preventScroll={false}
      escapeKeydownBehavior="close"
      onEscapeKeydown={handleDialogEscape}
      interactOutsideBehavior="ignore"
      onInteractOutside={handleInteractOutside}
      onOverlayClick={handleOverlayClick}
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
    beforeDismiss={({ settle }) => approveClose('gesture', settle)}
  >
    <Drawer.Content
      bind:ref={contentRef}
      noPadding={drawerNoPadding || modalState.hasHeader}
      raw={drawerRawContent}
      class={className}
      {overlayClass}
      {overlayStyle}
      style={contentStyle}
      escapeKeydownBehavior="close"
      onEscapeKeydown={handleDialogEscape}
      interactOutsideBehavior="ignore"
      onInteractOutside={handleInteractOutside}
      onOverlayClick={handleOverlayClick}
    >
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
