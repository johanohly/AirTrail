/**
 * AirTrail's own bottom-sheet drawer core (replaces @johly/vaul-svelte).
 *
 * Architecture:
 * - A single "openness" number (0 closed .. 1 fully open) per drawer drives every
 *   visual: content transform, overlay opacity, background wrapper scale, and the
 *   parent drawer's stacked-card effect. Open, close, drag, and release all flow
 *   through the same value, so nothing can get out of sync.
 * - All styling goes through CSS custom properties rendered from Svelte state
 *   (see drawer.css); JS never writes transforms directly.
 * - Gestures use one-shot axis arbitration: the first movement past the slop
 *   decides whether the gesture belongs to the drawer (vertical-dominant), a
 *   horizontal consumer like SwipeableFlightRow, or a scroll container. The
 *   decision is never revisited mid-gesture.
 * - Nesting works through Svelte context (component tree, not DOM), so portaled
 *   child drawers still find their parent. Parents count open children.
 * - The background wrapper ([data-drawer-wrapper]) is owned by a module-level
 *   controller that applies the max openness across all root-level drawers,
 *   which makes overlapping open/close sequences race-free.
 */
import { onDestroy } from 'svelte';

import { browser } from '$app/environment';

export const DRAWER_TRANSITION_MS = 500;

const AXIS_SLOP = 6;
const AXIS_BIAS = 2;
const CLOSE_THRESHOLD = 0.25;
/** px/ms downward velocity that dismisses regardless of distance */
const VELOCITY_CLOSE = 0.4;
const SNAP_VELOCITY_THRESHOLD = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MIN_EXIT_MS = 150;
const NESTED_LIFT_PX = 16;
const NESTED_DISPLACEMENT = 16;
const BG_WINDOW_OFFSET = 26;
const SWIPE_IGNORE_SELECTOR = '[data-swipe-ignore], [data-vaul-no-drag]';

export type SnapPoint = number | string;

/* ------------------------------------------------------------------ */
/* Background wrapper controller (module singleton)                    */
/* ------------------------------------------------------------------ */

type BgOwner = { progress: number; dragging: boolean };

const bgOwners = new Map<symbol, BgOwner>();
let bgActive = false;
let bgRestoreTimer: number | null = null;
let savedBodyBackground: string | null = null;

const getWrapper = (): HTMLElement | null =>
  document.querySelector('[data-drawer-wrapper]');

const applyBackground = () => {
  const wrapper = getWrapper();
  if (!wrapper) return;

  let progress = 0;
  let dragging = false;
  for (const owner of bgOwners.values()) {
    progress = Math.max(progress, owner.progress);
    dragging ||= owner.dragging;
  }

  wrapper.style.setProperty(
    '--drawer-bg-scale',
    String((window.innerWidth - BG_WINDOW_OFFSET) / window.innerWidth),
  );
  wrapper.style.setProperty('--drawer-bg-progress', String(progress));
  wrapper.toggleAttribute('data-drawer-bg-dragging', dragging);

  const active = progress > 0;
  if (active && !bgActive) {
    bgActive = true;
    if (bgRestoreTimer !== null) {
      // Reactivated before the previous close finished restoring; keep the
      // original saved background instead of re-snapshotting our own black.
      clearTimeout(bgRestoreTimer);
      bgRestoreTimer = null;
    } else {
      savedBodyBackground = document.body.style.background;
    }
    wrapper.toggleAttribute('data-drawer-bg-active', true);
    document.body.style.background = 'black';
  } else if (!active && bgActive) {
    bgActive = false;
    bgRestoreTimer = window.setTimeout(() => {
      bgRestoreTimer = null;
      if (savedBodyBackground) {
        document.body.style.background = savedBodyBackground;
      } else {
        document.body.style.removeProperty('background');
      }
      savedBodyBackground = null;
      getWrapper()?.toggleAttribute('data-drawer-bg-active', false);
    }, DRAWER_TRANSITION_MS);
  }
};

const setBackgroundProgress = (
  owner: symbol,
  progress: number,
  dragging = false,
) => {
  if (!browser) return;
  bgOwners.set(owner, { progress, dragging });
  applyBackground();
};

const removeBackgroundOwner = (owner: symbol) => {
  if (!browser) return;
  if (bgOwners.delete(owner)) applyBackground();
};

/* ------------------------------------------------------------------ */
/* Snap point resolution                                               */
/* ------------------------------------------------------------------ */

/** Resolves snap points to translateY offsets in px (0 = fully open). */
export const resolveSnapOffsets = (
  snapPoints: SnapPoint[] | undefined,
  containerHeight: number,
): number[] => {
  if (!snapPoints?.length) return [];
  return snapPoints.map((point) => {
    if (typeof point === 'string') {
      return Math.max(0, containerHeight - parseInt(point, 10));
    }
    return Math.max(0, containerHeight - point * containerHeight);
  });
};

const dampen = (value: number) => 8 * (Math.log(value + 1) - 2) + 16;

/* ------------------------------------------------------------------ */
/* Root state                                                          */
/* ------------------------------------------------------------------ */

export interface DrawerRootOpts {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  beforeDismiss: (attempt: DrawerDismissAttempt) => boolean | Promise<boolean>;
  modal: () => boolean;
  dismissible: () => boolean;
  snapPoints: () => SnapPoint[] | undefined;
  activeSnapPoint: () => SnapPoint | null;
  setActiveSnapPoint: (point: SnapPoint | null) => void;
  shouldScaleBackground: () => boolean;
}

export interface DrawerDismissAttempt {
  settle: () => void;
}

export interface DrawerParentContext {
  childOpenChange: (id: symbol, open: boolean) => void;
  childProgress: (openness: number, dragging: boolean) => void;
}

type GestureSession = {
  pointerId: number | null;
  touchId: number | null;
  startX: number;
  startY: number;
  /** 'pending' until axis arbitration; decision is final for the gesture */
  state: 'pending' | 'claimed' | 'rejected';
  scrollTarget: HTMLElement | null;
  ignored: boolean;
  claimY: number;
  startRest: number;
  drawerHeight: number;
  history: { y: number; t: number }[];
};

export class DrawerRootState {
  readonly id = Symbol('drawer');
  readonly opts: DrawerRootOpts;
  readonly parent: DrawerParentContext | null;

  drawerNode = $state<HTMLElement | null>(null);
  overlayNode = $state<HTMLElement | null>(null);

  /** live drag offset in px, applied on top of the snap rest offset */
  delta = $state(0);
  dragging = $state(false);
  /** 0 closed .. 1 fully open; only meaningful while open or dragging */
  openness = $state(1);
  exitDurationMs = $state(DRAWER_TRANSITION_MS);

  /* nested children */
  private openChildren = new Set<symbol>();
  childOpenness = $state(0);
  childDragging = $state(false);

  private innerHeight = $state(browser ? window.innerHeight : 0);
  private innerWidth = $state(browser ? window.innerWidth : 0);
  private openedAt = 0;
  private session: GestureSession | null = null;
  private detachSessionListeners: (() => void) | null = null;

  /* keyboard repositioning */
  private keyboardIsOpen = false;
  private previousDiffFromInitial = 0;
  private initialDrawerHeight = 0;

  readonly snapOffsets = $derived.by(() =>
    resolveSnapOffsets(this.opts.snapPoints(), this.innerHeight),
  );

  readonly restOffset = $derived.by(() => {
    const points = this.opts.snapPoints();
    if (!points?.length) return 0;
    const active = this.opts.activeSnapPoint() ?? points[0];
    const index = points.findIndex((point) => point === active);
    return this.snapOffsets[index === -1 ? 0 : index] ?? 0;
  });

  /** Stacked-card visuals apply only to full-height parents; a snap-positioned
   * sheet owns its transform and must not be lifted/scaled by children. */
  readonly appliesNestedVisuals = $derived.by(
    () => !this.opts.snapPoints()?.length,
  );

  readonly nestedLift = $derived.by(() =>
    this.appliesNestedVisuals ? NESTED_LIFT_PX * this.childOpenness : 0,
  );

  readonly nestedScale = $derived.by(() => {
    if (!this.appliesNestedVisuals || this.innerWidth === 0) return 1;
    const target = (this.innerWidth - NESTED_DISPLACEMENT) / this.innerWidth;
    return 1 - (1 - target) * this.childOpenness;
  });

  readonly contentStyleVars = $derived.by(
    () =>
      `--drawer-rest: ${this.restOffset}px;` +
      `--drawer-delta: ${this.delta}px;` +
      `--drawer-lift: ${this.nestedLift}px;` +
      `--drawer-scale: ${this.nestedScale};` +
      `--drawer-exit-duration: ${this.exitDurationMs}ms;`,
  );

  readonly overlayStyleVars = $derived.by(
    () =>
      `--drawer-progress: ${this.openness};` +
      `--drawer-exit-duration: ${this.exitDurationMs}ms;`,
  );

  readonly isDraggingVisual = $derived.by(
    () => this.dragging || this.childDragging,
  );

  constructor(opts: DrawerRootOpts, parent: DrawerParentContext | null) {
    this.opts = opts;
    this.parent = parent;

    if (browser) {
      $effect(() => {
        const onResize = () => {
          this.innerHeight = window.innerHeight;
          this.innerWidth = window.innerWidth;
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      });

      // Open/close side effects: background scale, parent notification.
      $effect(() => {
        const open = this.opts.open();
        if (open) {
          this.openedAt = Date.now();
          this.exitDurationMs = DRAWER_TRANSITION_MS;
          this.openness = 1;
          this.delta = 0;
          this.notifyOpenness(1, false);
          this.parent?.childOpenChange(this.id, true);
        } else {
          this.endSession();
          this.notifyOpenness(0, false);
          this.parent?.childOpenChange(this.id, false);
        }
      });

      // Gesture listeners on the drawer content node.
      $effect(() => {
        const node = this.drawerNode;
        if (!node) return;

        const onTouchStart = (e: TouchEvent) => this.onTouchStart(e);
        const onPointerDown = (e: PointerEvent) => this.onPointerDown(e);
        node.addEventListener('touchstart', onTouchStart, { passive: true });
        node.addEventListener('pointerdown', onPointerDown);
        return () => {
          node.removeEventListener('touchstart', onTouchStart);
          node.removeEventListener('pointerdown', onPointerDown);
          this.endSession();
        };
      });

      // Reposition the drawer when the virtual keyboard opens/closes.
      $effect(() => {
        const node = this.drawerNode;
        if (!node || !window.visualViewport) return;
        const onViewportResize = () => this.onVisualViewportChange(node);
        window.visualViewport.addEventListener('resize', onViewportResize);
        return () =>
          window.visualViewport?.removeEventListener(
            'resize',
            onViewportResize,
          );
      });
    }

    onDestroy(() => {
      this.endSession();
      removeBackgroundOwner(this.id);
      this.parent?.childOpenChange(this.id, false);
    });
  }

  /** Propagates openness to the background controller or the parent drawer. */
  private notifyOpenness(openness: number, dragging: boolean) {
    if (this.parent) {
      this.parent.childProgress(openness, dragging);
    } else if (this.opts.shouldScaleBackground()) {
      setBackgroundProgress(this.id, openness, dragging);
    }
  }

  /* ---------------- nesting (parent side) ---------------- */

  readonly parentContext: DrawerParentContext = {
    childOpenChange: (id, open) => {
      if (open) this.openChildren.add(id);
      else this.openChildren.delete(id);
      this.childOpenness = this.openChildren.size > 0 ? 1 : 0;
      this.childDragging = false;
    },
    childProgress: (openness, dragging) => {
      this.childOpenness = openness;
      this.childDragging = dragging;
    },
  };

  /* ---------------- gestures ---------------- */

  private onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) {
      this.endSession();
      return;
    }
    const touch = e.touches[0]!;
    this.beginSession(e.target, touch.clientX, touch.clientY, {
      touchId: touch.identifier,
    });
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch') return; // handled by the touch path
    if (e.button !== 0) return;
    this.beginSession(e.target, e.clientX, e.clientY, {
      pointerId: e.pointerId,
    });
  }

  private beginSession(
    eventTarget: EventTarget | null,
    x: number,
    y: number,
    ids: { touchId?: number; pointerId?: number },
  ) {
    if (!this.opts.open() || !this.drawerNode || this.session) return;

    const target = eventTarget instanceof HTMLElement ? eventTarget : null;
    if (!target || target.closest('select')) return;

    // A non-dismissible drawer without snap points has nowhere to drag to.
    if (!this.opts.dismissible() && !this.opts.snapPoints()?.length) return;

    this.session = {
      pointerId: ids.pointerId ?? null,
      touchId: ids.touchId ?? null,
      startX: x,
      startY: y,
      state: 'pending',
      scrollTarget: this.findScrollable(target),
      ignored: !!target.closest(SWIPE_IGNORE_SELECTOR),
      claimY: y,
      startRest: this.restOffset,
      drawerHeight: this.drawerNode.getBoundingClientRect().height,
      history: [],
    };

    const doc = this.drawerNode.ownerDocument;
    if (ids.touchId !== undefined) {
      const onMove = (e: TouchEvent) => this.onTouchMove(e);
      const onEnd = (e: TouchEvent) => this.onTouchEnd(e);
      doc.addEventListener('touchmove', onMove, {
        passive: false,
        capture: true,
      });
      doc.addEventListener('touchend', onEnd, { capture: true });
      doc.addEventListener('touchcancel', onEnd, { capture: true });
      this.detachSessionListeners = () => {
        doc.removeEventListener('touchmove', onMove, { capture: true });
        doc.removeEventListener('touchend', onEnd, { capture: true });
        doc.removeEventListener('touchcancel', onEnd, { capture: true });
      };
    } else {
      const onMove = (e: PointerEvent) => this.onPointerMove(e);
      const onUp = (e: PointerEvent) => this.onPointerUp(e);
      doc.addEventListener('pointermove', onMove);
      doc.addEventListener('pointerup', onUp);
      doc.addEventListener('pointercancel', onUp);
      this.detachSessionListeners = () => {
        doc.removeEventListener('pointermove', onMove);
        doc.removeEventListener('pointerup', onUp);
        doc.removeEventListener('pointercancel', onUp);
      };
    }
  }

  private findScrollable(target: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = target;
    while (el && el !== this.drawerNode) {
      if (el.scrollHeight > el.clientHeight) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  private onTouchMove(e: TouchEvent) {
    const session = this.session;
    if (!session) return;
    const touch = Array.from(e.touches).find(
      (t) => t.identifier === session.touchId,
    );
    if (!touch) return;
    if (e.touches.length > 1) {
      // Pinch or multi-touch: never claim.
      session.state = 'rejected';
      return;
    }
    this.handleMove(e, touch.clientX, touch.clientY, e.cancelable);
  }

  private onPointerMove(e: PointerEvent) {
    const session = this.session;
    if (!session || e.pointerId !== session.pointerId) return;
    this.handleMove(e, e.clientX, e.clientY, true);
  }

  private handleMove(
    e: TouchEvent | PointerEvent,
    x: number,
    y: number,
    cancelable: boolean,
  ) {
    const session = this.session!;
    if (session.state === 'rejected') return;

    if (session.state === 'claimed') {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      this.updateDrag(y);
      return;
    }

    // One-shot axis arbitration.
    const dx = Math.abs(x - session.startX);
    const dy = y - session.startY;
    const ady = Math.abs(dy);

    if (session.ignored) {
      session.state = 'rejected';
      return;
    }
    // Horizontal-dominant: the gesture belongs to a horizontal consumer
    // (row swipe) or native horizontal scroll. Yield permanently.
    if (dx >= AXIS_SLOP && dx > ady + AXIS_BIAS) {
      session.state = 'rejected';
      return;
    }
    if (ady < AXIS_SLOP) return; // not attributable yet

    // The browser already committed this gesture to a native scroll.
    if (!cancelable) {
      session.state = 'rejected';
      return;
    }
    // Don't fight the enter animation.
    if (Date.now() - this.openedAt < DRAWER_TRANSITION_MS) {
      session.state = 'rejected';
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      session.state = 'rejected';
      return;
    }

    const down = dy > 0;
    const scrollTarget = session.scrollTarget;
    if (scrollTarget) {
      const canScrollUp = scrollTarget.scrollTop > 0;
      const canScrollDown =
        scrollTarget.scrollTop <
        scrollTarget.scrollHeight - scrollTarget.clientHeight - 1;
      const minRest = this.snapOffsets.length
        ? Math.min(...this.snapOffsets)
        : 0;
      const hasSnapRoomUp = session.startRest > minRest;

      if (down && canScrollUp) {
        session.state = 'rejected';
        return;
      }
      if (!down && !hasSnapRoomUp && canScrollDown) {
        session.state = 'rejected';
        return;
      }
    }

    // Claim the gesture.
    session.state = 'claimed';
    session.claimY = y;
    this.dragging = true;
    if ('pointerId' in e && this.drawerNode) {
      this.drawerNode.setPointerCapture(e.pointerId);
    }
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }

  private updateDrag(y: number) {
    const session = this.session!;
    const rawDelta = y - session.claimY;
    const target = session.startRest + rawDelta;
    const minRest = this.snapOffsets.length ? Math.min(...this.snapOffsets) : 0;

    let delta: number;
    if (target < minRest) {
      // Damped overdrag beyond the fully-open position.
      delta = minRest - session.startRest - dampen(minRest - target);
    } else {
      delta = rawDelta;
    }
    this.delta = delta;

    const now = Date.now();
    session.history.push({ y, t: now });
    while (session.history.length > 1 && now - session.history[0]!.t > 100) {
      session.history.shift();
    }

    const travel = Math.max(0, session.startRest + delta);
    this.openness =
      session.drawerHeight > 0
        ? 1 - Math.min(1, travel / session.drawerHeight)
        : 1;
    this.notifyOpenness(this.openness, true);
  }

  private onTouchEnd(e: TouchEvent) {
    const session = this.session;
    if (!session) return;
    if (Array.from(e.touches).some((t) => t.identifier === session.touchId)) {
      return; // our touch is still down
    }
    this.finishSession();
  }

  private onPointerUp(e: PointerEvent) {
    const session = this.session;
    if (!session || e.pointerId !== session.pointerId) return;
    this.finishSession();
  }

  private finishSession() {
    const session = this.session;
    if (session?.state === 'claimed') {
      this.release(session);
    }
    this.endSession();
  }

  private endSession() {
    this.detachSessionListeners?.();
    this.detachSessionListeners = null;
    this.session = null;
    if (this.dragging) this.dragging = false;
  }

  private velocityOf(session: GestureSession): number {
    const history = session.history;
    if (history.length < 2) return 0;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.y - first.y) / dt; // px/ms, positive = downward
  }

  private release(session: GestureSession) {
    const velocity = this.velocityOf(session);
    const offsets = this.snapOffsets;
    const dismissible = this.opts.dismissible();

    if (!offsets.length) {
      const shouldClose =
        dismissible &&
        this.delta > 0 &&
        (velocity > VELOCITY_CLOSE ||
          this.delta > CLOSE_THRESHOLD * session.drawerHeight);
      if (shouldClose) {
        void this.closeFromDrag(session, velocity);
      } else {
        this.delta = 0;
        this.openness = 1;
        this.notifyOpenness(1, false);
      }
      return;
    }

    // Snap points: project the release position with a velocity boost, then
    // snap to the closest candidate (including "closed" when dismissible).
    const current = session.startRest + this.delta;
    const velocityOffset =
      Math.abs(velocity) >= SNAP_VELOCITY_THRESHOLD
        ? Math.max(-4, Math.min(4, velocity)) * SNAP_VELOCITY_MULTIPLIER
        : 0;
    const projected = current + velocityOffset;

    let bestOffset = offsets[0]!;
    let bestDistance = Math.abs(projected - bestOffset);
    for (const offset of offsets) {
      const distance = Math.abs(projected - offset);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = offset;
      }
    }

    const closeDistance = Math.abs(projected - session.drawerHeight);
    if (dismissible && closeDistance < bestDistance) {
      void this.closeFromDrag(session, velocity);
      return;
    }

    const points = this.opts.snapPoints()!;
    const index = offsets.indexOf(bestOffset);
    this.opts.setActiveSnapPoint(points[index] ?? points[0]!);
    this.delta = 0;
    this.openness = 1;
    this.notifyOpenness(1, false);
  }

  private async closeFromDrag(session: GestureSession, velocity: number) {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      this.delta = 0;
      this.openness = 1;
      this.notifyOpenness(1, false);
    };

    if (!(await this.opts.beforeDismiss({ settle }))) {
      settle();
      return;
    }

    if (settled) {
      this.exitDurationMs = DRAWER_TRANSITION_MS;
      this.opts.setOpen(false);
      return;
    }

    const remaining = Math.max(
      0,
      session.drawerHeight - (session.startRest + this.delta),
    );
    this.exitDurationMs = Math.round(
      Math.min(
        DRAWER_TRANSITION_MS,
        Math.max(MIN_EXIT_MS, remaining / Math.max(velocity, 0.7)),
      ),
    );
    this.opts.setOpen(false);
  }

  /* ---------------- virtual keyboard ---------------- */

  private onVisualViewportChange(node: HTMLElement) {
    const focusedElement = document.activeElement as HTMLElement | null;
    const isInput =
      focusedElement instanceof HTMLInputElement ||
      focusedElement instanceof HTMLTextAreaElement ||
      focusedElement?.isContentEditable;
    if (!isInput && !this.keyboardIsOpen) return;

    const visualViewportHeight = window.visualViewport?.height ?? 0;
    const totalHeight = window.innerHeight;
    let diffFromInitial = totalHeight - visualViewportHeight;
    const drawerHeight = node.getBoundingClientRect().height || 0;
    if (!this.initialDrawerHeight) {
      this.initialDrawerHeight = drawerHeight;
    }
    const offsetFromTop = node.getBoundingClientRect().top;

    // Only treat height changes over 60px as real keyboard open/close moves.
    if (Math.abs(this.previousDiffFromInitial - diffFromInitial) > 60) {
      const wasOpen = this.keyboardIsOpen;
      this.keyboardIsOpen = !this.keyboardIsOpen;
      if (wasOpen && !this.keyboardIsOpen) {
        node.style.removeProperty('height');
        node.style.removeProperty('bottom');
        this.previousDiffFromInitial = 0;
        this.initialDrawerHeight = 0;
        return;
      }
    }

    if (this.snapOffsets.length) {
      diffFromInitial += this.restOffset;
    }
    this.previousDiffFromInitial = diffFromInitial;

    if (drawerHeight > visualViewportHeight || this.keyboardIsOpen) {
      const height = node.getBoundingClientRect().height;
      let newDrawerHeight = height;
      if (height > visualViewportHeight) {
        newDrawerHeight = visualViewportHeight - offsetFromTop;
      }
      node.style.height = `${Math.max(
        newDrawerHeight,
        visualViewportHeight - offsetFromTop,
      )}px`;
    } else {
      node.style.height = `${this.initialDrawerHeight}px`;
    }

    if (this.snapOffsets.length && !this.keyboardIsOpen) {
      node.style.bottom = '0px';
    } else {
      node.style.bottom = `${Math.max(diffFromInitial, 0)}px`;
    }
  }
}
