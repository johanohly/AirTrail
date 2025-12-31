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
    handleBackButton = true,
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
    handleBackButton?: boolean;
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

  function handlePopstate(event: PopStateEvent) {
    const isTopmostModal = peekModalHistory() === modalId;
    if (historyPushed && open && !closingFromPopstate && isTopmostModal) {
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
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open shouldScaleBackground>
    <Drawer.Content noPadding={drawerNoPadding || modalState.hasHeader}>
      {@render children()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
