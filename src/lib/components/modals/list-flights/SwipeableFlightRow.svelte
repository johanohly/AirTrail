<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Motion, useMotionValue, useSpring } from 'svelte-motion';
  import { SquarePen, Trash2 } from '@o7/icon/lucide';

  import { cn } from '$lib/utils';

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

  // Element refs
  let rowElement: HTMLDivElement | undefined = $state();

  // Gesture state
  let isDragging = $state(false);
  let isLongPressing = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let currentOffsetX = $state(0);
  let actionsRevealed = $state(false);
  let lastZone = $state<SwipeZone>('neutral');
  let hasMoved = $state(false); // Track if user actually swiped vs clicked
  let isHorizontalSwipe = $state(false); // Lock scroll once horizontal swipe detected

  // Long press timer
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const LONG_PRESS_DURATION = 400;
  const MOVE_THRESHOLD = 10; // pixels before considered a swipe

  // Velocity tracking
  let positionHistory: { x: number; time: number }[] = [];
  const QUICK_SWIPE_VELOCITY = 0.8;

  // svelte-motion spring for card
  const offsetX = useMotionValue(0);
  const springOffset = useSpring(offsetX, {
    stiffness: 400,
    damping: 30,
  });

  // Row width for percentage calculations
  const rowWidth = $derived(rowElement?.offsetWidth ?? 300);

  // Zone calculation
  const currentZone = $derived.by((): SwipeZone => {
    const pct = Math.abs(currentOffsetX) / rowWidth;
    if (pct < 0.15) return 'neutral';
    if (pct < 0.4) return 'edit';
    if (pct < 0.65) return 'delete';
    return 'revealed';
  });

  // Expose interaction state for children
  const isInteracting = $derived(isDragging || actionsRevealed);

  // Button row translation - slides in from right
  const buttonRowTranslateX = $derived(rowWidth - currentOffsetX);

  // Only show colored backgrounds when actively dragging (not during spring animation)
  const showColoredBackground = $derived(isDragging && currentOffsetX > 0);

  // Haptic feedback
  const triggerHaptic = (intensity: number = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(intensity);
    }
  };

  // Zone change detection for haptics
  $effect(() => {
    if (currentZone !== lastZone && isDragging) {
      if (currentZone === 'edit') triggerHaptic(15);
      else if (currentZone === 'delete') triggerHaptic(25);
      else if (currentZone === 'revealed') triggerHaptic(35);
      lastZone = currentZone;
    }
  });

  // Calculate velocity from position history
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

  // Reset position
  const resetPosition = () => {
    currentOffsetX = 0;
    actionsRevealed = false;
    offsetX.set(0);
    lastZone = 'neutral';
  };

  // Go to revealed state - fully replace the card
  const goToRevealed = () => {
    actionsRevealed = true;
    currentOffsetX = rowWidth;
    offsetX.set(-rowWidth);
    triggerHaptic(35);
  };

  // Close on scroll or click outside
  $effect(() => {
    if (!actionsRevealed) return;

    const handleScroll = () => {
      // Don't collapse if actively dragging
      if (isDragging) return;
      resetPosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Don't collapse if actively dragging
      if (isDragging) return;
      if (rowElement && !rowElement.contains(e.target as Node)) {
        resetPosition();
      }
    };

    // Listen on capture phase to catch scroll before it's handled
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

  // Clear long press timer
  const clearLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    isLongPressing = false;
  };

  // Pointer event handlers
  const handlePointerDown = (e: PointerEvent) => {
    if (disabled) return;

    isDragging = true;
    hasMoved = false;
    isHorizontalSwipe = false;
    startX = e.clientX;
    startY = e.clientY;
    positionHistory = [{ x: e.clientX, time: Date.now() }];

    // Start long press timer (only if not already revealed)
    if (!actionsRevealed) {
      longPressTimer = setTimeout(() => {
        if (isDragging && currentOffsetX < MOVE_THRESHOLD) {
          isLongPressing = true;
          isDragging = false;
          goToRevealed();
        }
      }, LONG_PRESS_DURATION);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || disabled) return;

    const deltaX = startX - e.clientX;
    const deltaY = startY - e.clientY;

    // Detect horizontal swipe intent and lock scroll
    if (!isHorizontalSwipe && !hasMoved) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      // If moved enough and more horizontal than vertical, lock to horizontal
      if (absX > MOVE_THRESHOLD && absX > absY) {
        isHorizontalSwipe = true;
      }
    }

    // Prevent scrolling when horizontal swipe detected
    if (isHorizontalSwipe) {
      e.preventDefault();
    }

    // Mark as moved if threshold exceeded
    if (Math.abs(deltaX) > MOVE_THRESHOLD) {
      hasMoved = true;
      clearLongPress();
    }

    if (actionsRevealed) {
      // When revealed, allow swiping back (right swipe = negative deltaX)
      const newOffset = rowWidth + deltaX;
      currentOffsetX = Math.max(0, Math.min(newOffset, rowWidth));
    } else {
      // Normal left swipe
      currentOffsetX = Math.max(0, Math.min(deltaX, rowWidth));
    }

    offsetX.set(-currentOffsetX);

    positionHistory.push({ x: e.clientX, time: Date.now() });
    if (positionHistory.length > 5) positionHistory.shift();
  };

  const handlePointerUp = () => {
    clearLongPress();

    if (!isDragging || disabled) return;
    isDragging = false;

    const velocity = calculateVelocity();

    // Quick swipe detection - skip zones entirely
    if (Math.abs(velocity) > QUICK_SWIPE_VELOCITY && hasMoved) {
      if (velocity > 0 && currentOffsetX > 20) {
        // Quick left swipe - go to revealed
        goToRevealed();
      } else if (velocity < 0) {
        // Quick right swipe - close
        resetPosition();
      }
      positionHistory = [];
      return;
    }

    // Zone-based action (only if not a quick swipe)
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

  // Which icon to show during swipe
  const showDeleteIcon = $derived(
    currentZone === 'delete' || currentZone === 'revealed',
  );

  // Icon opacity - fade in as you swipe
  const iconOpacity = $derived.by(() => {
    const pct = Math.abs(currentOffsetX) / rowWidth;
    if (pct < 0.05) return 0;
    if (pct < 0.15) return (pct - 0.05) / 0.1;
    return 1;
  });

  // Revealed buttons - show when in revealed zone
  const showRevealedButtons = $derived(currentZone === 'revealed');

  // Handle action button clicks - only if not swiping
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
  <!-- Layer 1: Full-width button row (slides in from right, underneath colored bg) -->
  <div
    class={cn(
      'absolute inset-0 flex items-stretch bg-muted',
      !showRevealedButtons && 'pointer-events-none',
    )}
    style:transform="translateX({buttonRowTranslateX}px)"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
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

  <!-- Layer 2: Colored background (fades out to reveal button row) -->
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

  <!-- Layer 3: Single centered icon (visible during swipe, hidden when buttons shown) -->
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

  <!-- Foreground: Translating card content -->
  <Motion style={{ x: springOffset }} let:motion>
    <div
      use:motion
      class={cn('relative bg-background select-none', {
        'cursor-grab': !disabled && !isDragging,
        'cursor-grabbing': isDragging,
      })}
      style:touch-action={isHorizontalSwipe ? 'none' : 'pan-y'}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    >
      {@render children({ isInteracting })}
    </div>
  </Motion>
</div>
