<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SquarePen, Trash2 } from '@o7/icon/lucide';

  import { getDrawerContext } from '$lib/components/ui/drawer/drawer.svelte';
  import { cn } from '$lib/utils';

  const drawerContext = getDrawerContext();

  type SwipeZone = 'neutral' | 'edit' | 'delete' | 'revealed';

  let {
    disabled = false,
    onEdit,
    onDelete,
    children,
  }: {
    disabled?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    children: Snippet<[{ isInteracting: boolean }]>;
  } = $props();

  let rowElement: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let currentOffsetX = $state(0);
  let actionsRevealed = $state(false);
  let lastZone = $state<SwipeZone>('neutral');
  let hasMoved = $state(false);
  let isHorizontalSwipe = $state(false);
  let isVerticalScroll = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let positionHistory: { x: number; time: number }[] = [];
  let activePointerId: number | null = null;
  let currentVelocity = $state(0);

  const LONG_PRESS_DURATION = 400;
  const MOVE_THRESHOLD = 10;
  const QUICK_SWIPE_VELOCITY = 0.8;

  const rowWidth = $derived(rowElement?.offsetWidth ?? 300);
  const currentZone = $derived.by((): SwipeZone => {
    const pct = Math.abs(currentOffsetX) / rowWidth;
    if (pct < 0.15) return 'neutral';
    if (pct < 0.4) return 'edit';
    if (pct < 0.65) return 'delete';
    return 'revealed';
  });
  const isInteracting = $derived(isDragging || actionsRevealed);
  const FAST_SWIPE_THRESHOLD = 0.5;
  const buttonRowTranslateX = $derived(rowWidth - currentOffsetX);
  const isFastSwipe = $derived(
    Math.abs(currentVelocity) >= FAST_SWIPE_THRESHOLD,
  );
  const showColoredBackground = $derived(
    isDragging && currentOffsetX > 0 && !actionsRevealed && !isFastSwipe,
  );

  const triggerHaptic = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  $effect(() => {
    if (currentZone !== lastZone && isDragging) {
      if (
        (currentZone === 'edit' || currentZone === 'delete') &&
        !isFastSwipe
      ) {
        triggerHaptic();
      }
      lastZone = currentZone;
    }
  });

  const calculateVelocity = (): number => {
    if (positionHistory.length < 2) return 0;
    const recent = positionHistory.slice(-3);
    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const deltaX = first.x - last.x;
    const deltaTime = last.time - first.time;
    if (deltaTime === 0) return 0;
    return deltaX / deltaTime;
  };

  const resetPosition = () => {
    currentOffsetX = 0;
    actionsRevealed = false;
    lastZone = 'neutral';
    currentVelocity = 0;
  };

  const goToRevealed = () => {
    actionsRevealed = true;
    currentOffsetX = rowWidth;
    currentVelocity = 0;
  };

  const clearLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const cleanupGlobalListeners = () => {
    window.removeEventListener('pointermove', handleGlobalPointerMove);
    window.removeEventListener('pointerup', handleGlobalPointerUp);
    window.removeEventListener('pointercancel', handleGlobalPointerUp);
    activePointerId = null;
  };

  // Cleanup on destroy
  $effect(() => {
    return () => {
      cleanupGlobalListeners();
      clearLongPress();
    };
  });

  // Close revealed actions on scroll or click outside
  $effect(() => {
    if (!actionsRevealed) return;

    const handleScroll = () => {
      if (!isDragging) resetPosition();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (!isDragging && rowElement && !rowElement.contains(e.target as Node)) {
        resetPosition();
      }
    };

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener('click', handleClickOutside, { capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('click', handleClickOutside, {
        capture: true,
      });
    };
  });

  // Use window listeners for reliable cross-browser touch handling
  const handleGlobalPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    handlePointerMove(e);
  };

  const handleGlobalPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    handlePointerUp();
    cleanupGlobalListeners();
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (disabled) return;
    cleanupGlobalListeners();

    isDragging = true;
    hasMoved = false;
    isVerticalScroll = false;
    startX = e.clientX;
    startY = e.clientY;
    positionHistory = [{ x: e.clientX, time: Date.now() }];
    activePointerId = e.pointerId;

    if (actionsRevealed) {
      isHorizontalSwipe = true;
      drawerContext?.lockDismiss();
    } else {
      isHorizontalSwipe = false;
      longPressTimer = setTimeout(() => {
        if (isDragging && currentOffsetX < MOVE_THRESHOLD) {
          isDragging = false;
          goToRevealed();
        }
      }, LONG_PRESS_DURATION);
    }

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || disabled) return;

    const deltaX = startX - e.clientX;
    const deltaY = startY - e.clientY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (actionsRevealed) e.preventDefault();
    if (isVerticalScroll) return;

    // Detect gesture direction on first significant movement
    if (!isHorizontalSwipe && !hasMoved) {
      if (absX > MOVE_THRESHOLD || absY > MOVE_THRESHOLD) {
        hasMoved = true;
        clearLongPress();

        if (absY > absX) {
          isVerticalScroll = true;
          return;
        } else {
          isHorizontalSwipe = true;
          drawerContext?.lockDismiss();
        }
      }
    }

    if (!isHorizontalSwipe) return;
    e.preventDefault();

    if (actionsRevealed) {
      const newOffset = rowWidth + deltaX;
      currentOffsetX = Math.max(0, Math.min(newOffset, rowWidth));
    } else {
      currentOffsetX = Math.max(0, Math.min(deltaX, rowWidth));
    }

    positionHistory.push({ x: e.clientX, time: Date.now() });
    if (positionHistory.length > 5) positionHistory.shift();
    currentVelocity = calculateVelocity();
  };

  const handlePointerUp = () => {
    clearLongPress();
    cleanupGlobalListeners();

    if (!isDragging || disabled) return;
    isDragging = false;

    if (isHorizontalSwipe) drawerContext?.unlockDismiss();

    const velocity = calculateVelocity();

    if (actionsRevealed) {
      if (velocity < -0.3 || currentZone === 'neutral') {
        resetPosition();
      } else {
        goToRevealed();
      }
      positionHistory = [];
      return;
    }

    // Quick swipe overrides zone-based action
    if (Math.abs(velocity) > QUICK_SWIPE_VELOCITY && hasMoved) {
      if (velocity > 0 && currentOffsetX > 20) goToRevealed();
      else if (velocity < 0) resetPosition();
      positionHistory = [];
      return;
    }

    switch (currentZone) {
      case 'neutral':
        resetPosition();
        break;
      case 'edit':
        onEdit?.();
        resetPosition();
        break;
      case 'delete':
        onDelete?.();
        resetPosition();
        break;
      case 'revealed':
        goToRevealed();
        break;
    }
    positionHistory = [];
  };

  const showDeleteIcon = $derived(
    currentZone === 'delete' || currentZone === 'revealed',
  );
  const iconOpacity = $derived.by(() => {
    const pct = Math.abs(currentOffsetX) / rowWidth;
    if (pct < 0.05) return 0;
    if (pct < 0.15) return (pct - 0.05) / 0.1;
    return 1;
  });
  const showRevealedButtons = $derived(currentZone === 'revealed');

  const handleEditClick = (e: MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onEdit?.();
    resetPosition();
  };

  const handleDeleteClick = (e: MouseEvent) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onDelete?.();
    resetPosition();
  };
</script>

<div class="relative overflow-hidden" bind:this={rowElement}>
  <!-- Button row (revealed on swipe) -->
  <div
    class={cn(
      'absolute inset-0 flex items-stretch bg-muted',
      !showRevealedButtons && 'pointer-events-none',
      !isDragging && 'transition-transform duration-200 ease-out',
    )}
    style:transform="translateX({buttonRowTranslateX}px)"
    style:touch-action="none"
    onpointerdown={handlePointerDown}
  >
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
      onclick={handleEditClick}
    >
      <SquarePen size={22} />
      <span class="text-xs font-medium">Edit</span>
    </button>
    <div class="w-px bg-border"></div>
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/15 transition-colors"
      onclick={handleDeleteClick}
    >
      <Trash2 size={22} />
      <span class="text-xs font-medium">Delete</span>
    </button>
  </div>

  <!-- Colored background during swipe -->
  {#if showColoredBackground}
    <div
      class="absolute inset-0 pointer-events-none transition-[background-color,opacity] duration-200"
      class:bg-muted={currentZone === 'neutral'}
      class:bg-primary={currentZone === 'edit'}
      class:bg-destructive={currentZone === 'delete' ||
        currentZone === 'revealed'}
      class:opacity-0={currentZone === 'revealed'}
    ></div>
  {/if}

  <!-- Swipe icon indicator -->
  {#if showColoredBackground && !showRevealedButtons}
    <div
      class="absolute inset-y-0 right-0 flex items-center justify-center pointer-events-none"
      style:width="{Math.abs(currentOffsetX)}px"
      style:opacity={iconOpacity}
    >
      {#if showDeleteIcon}
        <Trash2 size={22} class="text-destructive-foreground" />
      {:else}
        <SquarePen
          size={22}
          class={cn(
            currentZone === 'neutral'
              ? 'text-muted-foreground'
              : 'text-primary-foreground',
          )}
        />
      {/if}
    </div>
  {/if}

  <!-- Card content -->
  <div
    class={cn('relative bg-background select-none', {
      'cursor-grab': !disabled && !isDragging,
      'cursor-grabbing': isDragging,
      'transition-transform duration-200 ease-out': !isDragging,
    })}
    style:transform="translateX({-currentOffsetX}px)"
    style:touch-action={isHorizontalSwipe || actionsRevealed ? 'none' : 'pan-y'}
    onpointerdown={handlePointerDown}
  >
    {@render children({ isInteracting })}
  </div>
</div>
