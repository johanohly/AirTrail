type PopStateLike = { state?: unknown };
type KeydownLike = {
  key: string;
  defaultPrevented?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

type HistoryAdapter = {
  pushState: (data: unknown, unused: string) => void;
  back: () => void;
  listen: (callback: (event: PopStateLike) => void) => () => void;
  listenKeydown?: (callback: (event: KeydownLike) => void) => () => void;
};

type ModalHistoryEntryBase = {
  id: string;
  closeFromHistory: () => void;
  closeOnEscape: boolean;
  onStateChange?: (state: unknown) => void;
};

type ActiveModalHistoryEntry = ModalHistoryEntryBase & {
  status: 'active';
  internalDepth: number;
};

type ClosingModalHistoryEntry = ModalHistoryEntryBase & {
  status: 'closing';
  internalDepth: number;
  traversing: boolean;
};

type QueuedModalHistoryEntry = ModalHistoryEntryBase & {
  status: 'queued';
  queuedStates: unknown[];
};

type ModalHistoryEntry =
  | ActiveModalHistoryEntry
  | ClosingModalHistoryEntry
  | QueuedModalHistoryEntry;

type ModalHistoryOptions = {
  closeOnEscape?: boolean;
  onStateChange?: (state: unknown) => void;
};

type ModalBrowserState = {
  modal?: unknown;
  modalState?: unknown;
  modalDepth?: unknown;
};

export type ModalHistoryHandle = {
  push: (state: unknown) => void;
  back: () => void;
};

export const createModalHistoryController = (adapter: HistoryAdapter) => {
  const stack: ModalHistoryEntry[] = [];
  const idleWaiters = new Set<() => void>();

  const stateFromEvent = (event: PopStateLike) =>
    (event.state as ModalBrowserState | null | undefined) ?? undefined;

  const removeEntry = (id: string) => {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index !== -1) stack.splice(index, 1);
  };

  const removeQueuedEntry = (id: string) => {
    const index = stack.findIndex(
      (entry) => entry.id === id && entry.status === 'queued',
    );
    if (index !== -1) stack.splice(index, 1);
    return index !== -1;
  };

  const topBrowserEntry = () =>
    stack.findLast((entry) => entry.status !== 'queued');

  const hasClosingEntry = () =>
    stack.some((entry) => entry.status === 'closing');

  const settleIdleWaiters = () => {
    if (hasClosingEntry()) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  };

  const whenIdle = () => {
    if (!hasClosingEntry()) return Promise.resolve();
    return new Promise<void>((resolve) => idleWaiters.add(resolve));
  };

  const notifyDestination = (destination: ModalBrowserState | undefined) => {
    if (typeof destination?.modal !== 'string') return;
    const entry = stack.findLast(
      (candidate) =>
        candidate.id === destination.modal && candidate.status === 'active',
    );
    if (!entry) return;
    entry.onStateChange?.(destination.modalState);
  };

  const activateEntry = (entry: QueuedModalHistoryEntry) => {
    adapter.pushState(
      { modal: entry.id, modalState: undefined, modalDepth: 0 },
      '',
    );
    let internalDepth = 0;
    for (const state of entry.queuedStates) {
      internalDepth += 1;
      adapter.pushState(
        { modal: entry.id, modalState: state, modalDepth: internalDepth },
        '',
      );
    }
    const index = stack.indexOf(entry);
    if (index !== -1) {
      stack[index] = { ...entry, status: 'active', internalDepth };
    }
  };

  const flushQueuedEntries = () => {
    if (hasClosingEntry()) return;
    for (const entry of [...stack]) {
      if (entry.status === 'queued') activateEntry(entry);
    }
    settleIdleWaiters();
  };

  const drainClosingEntries = () => {
    const top = topBrowserEntry();
    if (!top || top.status !== 'closing') {
      flushQueuedEntries();
      return;
    }
    if (top.traversing) return;
    top.traversing = true;
    adapter.back();
  };

  const stopListening = adapter.listen((event) => {
    const destination = stateFromEvent(event);
    const destinationModal = destination?.modal;

    const traversingEntry = stack.find(
      (entry) => entry.status === 'closing' && entry.traversing,
    );
    if (traversingEntry) {
      if (destinationModal === traversingEntry.id) {
        adapter.back();
        return;
      }

      removeEntry(traversingEntry.id);
      notifyDestination(destination);
      drainClosingEntries();
      return;
    }

    const top = topBrowserEntry();
    if (!top) return;

    if (destinationModal === top.id) {
      const destinationDepth = destination?.modalDepth;
      top.internalDepth =
        typeof destinationDepth === 'number' &&
        Number.isInteger(destinationDepth) &&
        destinationDepth >= 0
          ? destinationDepth
          : Math.max(0, top.internalDepth - 1);
      top.onStateChange?.(destination?.modalState);
      return;
    }

    removeEntry(top.id);
    top.closeFromHistory();
    notifyDestination(destination);
    flushQueuedEntries();
  });

  const escape = (id?: string) => {
    const top = stack.at(-1);
    if (!top || (id !== undefined && top.id !== id)) return false;

    if (top.status === 'queued' && top.queuedStates.length > 0) {
      top.queuedStates.pop();
      top.onStateChange?.(top.queuedStates.at(-1));
    } else if (top.status !== 'queued' && top.internalDepth > 0) {
      adapter.back();
    } else if (top.closeOnEscape) {
      top.closeFromHistory();
    }
    return true;
  };

  const stopListeningKeydown =
    adapter.listenKeydown?.((event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (!escape()) return;

      event.preventDefault();
      event.stopPropagation();
    }) ?? (() => {});

  const open = (
    id: string,
    closeFromHistory: () => void,
    options: ModalHistoryOptions = {},
  ) => {
    const queued = stack.find(
      (entry): entry is QueuedModalHistoryEntry =>
        entry.id === id && entry.status === 'queued',
    );
    if (queued) {
      queued.closeFromHistory = closeFromHistory;
      queued.closeOnEscape = options.closeOnEscape ?? true;
      queued.onStateChange = options.onStateChange;
      return;
    }

    const existing = stack.find(
      (entry) => entry.id === id && entry.status !== 'queued',
    );
    if (existing) {
      if (existing.status === 'closing') {
        stack.push({
          id,
          status: 'queued',
          closeFromHistory,
          closeOnEscape: options.closeOnEscape ?? true,
          onStateChange: options.onStateChange,
          queuedStates: [],
        });
        return;
      }
      existing.closeFromHistory = closeFromHistory;
      existing.closeOnEscape = options.closeOnEscape ?? true;
      existing.onStateChange = options.onStateChange;
      return;
    }

    const entry: ModalHistoryEntry = {
      id,
      status: 'queued',
      closeFromHistory,
      closeOnEscape: options.closeOnEscape ?? true,
      onStateChange: options.onStateChange,
      queuedStates: [],
    };
    stack.push(entry);
    if (!hasClosingEntry()) activateEntry(entry);
  };

  const close = (id: string) => {
    if (removeQueuedEntry(id)) return whenIdle();

    const index = stack.findIndex(
      (entry) => entry.id === id && entry.status === 'active',
    );
    if (index === -1) return whenIdle();

    for (let i = stack.length - 1; i >= index; i -= 1) {
      const entry = stack[i]!;
      if (entry.status !== 'active') continue;
      stack[i] = { ...entry, status: 'closing', traversing: false };
      if (i > index) entry.closeFromHistory();
    }
    drainClosingEntries();
    return whenIdle();
  };

  const unregister = (id: string) => {
    if (removeQueuedEntry(id)) return;
    const entry = stack.find(
      (candidate) => candidate.id === id && candidate.status !== 'queued',
    );
    if (!entry) return;
    entry.closeFromHistory = () => {};
    if (entry.status === 'active') close(id);
  };

  const pushState = (id: string, state: unknown) => {
    const queued = stack.find(
      (entry): entry is QueuedModalHistoryEntry =>
        entry.id === id && entry.status === 'queued',
    );
    if (queued) {
      queued.queuedStates.push(state);
      return;
    }

    const top = topBrowserEntry();
    if (top?.id !== id || top.status !== 'active') return;
    top.internalDepth += 1;
    adapter.pushState(
      { modal: id, modalState: state, modalDepth: top.internalDepth },
      '',
    );
  };

  const back = (id: string) => {
    const top = stack.at(-1);
    if (top?.id !== id) return;
    if (top.status === 'queued' && top.queuedStates.length > 0) {
      top.queuedStates.pop();
      top.onStateChange?.(top.queuedStates.at(-1));
    } else if (top.status !== 'queued' && top.internalDepth > 0) {
      adapter.back();
    }
  };

  return {
    open,
    close,
    unregister,
    pushState,
    back,
    escape,
    whenIdle,

    peek() {
      return stack.at(-1)?.id;
    },

    destroy() {
      stopListening();
      stopListeningKeydown();
      stack.length = 0;
      settleIdleWaiters();
    },
  };
};

let browserController:
  | ReturnType<typeof createModalHistoryController>
  | undefined;

const getBrowserController = () => {
  if (typeof window === 'undefined') return undefined;
  browserController ??= createModalHistoryController({
    pushState: (data, unused) =>
      history.pushState(
        {
          ...(history.state as Record<string, unknown> | null),
          ...(data as Record<string, unknown>),
        },
        unused,
      ),
    back: () => history.back(),
    listen: (callback) => {
      window.addEventListener('popstate', callback);
      return () => window.removeEventListener('popstate', callback);
    },
    listenKeydown: (callback) => {
      window.addEventListener('keydown', callback);
      return () => window.removeEventListener('keydown', callback);
    },
  });
  return browserController;
};

export const openModalHistory = (
  id: string,
  closeFromHistory: () => void,
  options?: ModalHistoryOptions,
) => getBrowserController()?.open(id, closeFromHistory, options);

export const closeModalHistory = (id: string) =>
  getBrowserController()?.close(id);

export const unregisterModalHistory = (id: string) =>
  getBrowserController()?.unregister(id);

export const pushModalHistoryState = (id: string, state: unknown) =>
  getBrowserController()?.pushState(id, state);

export const backModalHistory = (id: string) =>
  getBrowserController()?.back(id);

export const escapeModalHistory = (id: string) =>
  getBrowserController()?.escape(id);

export const peekModalHistory = () => getBrowserController()?.peek();

export const waitForModalHistoryIdle = () =>
  getBrowserController()?.whenIdle() ?? Promise.resolve();
