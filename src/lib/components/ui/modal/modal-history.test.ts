import { describe, expect, it, vi } from 'vitest';

import { createModalHistoryController } from './modal-history';

const createAdapter = () => {
  let listener: ((event: { state?: unknown }) => void) | undefined;
  let keydownListener:
    | ((event: {
        key: string;
        defaultPrevented?: boolean;
        preventDefault: () => void;
        stopPropagation: () => void;
      }) => void)
    | undefined;
  const pushState = vi.fn();
  const back = vi.fn();
  return {
    adapter: {
      pushState,
      back,
      listen: (callback: typeof listener) => {
        listener = callback;
        return () => {
          listener = undefined;
        };
      },
      listenKeydown: (callback: typeof keydownListener) => {
        keydownListener = callback;
        return () => {
          keydownListener = undefined;
        };
      },
    },
    pushState,
    back,
    pop(state: unknown = null) {
      listener?.({ state });
    },
    keydown(key: string, defaultPrevented = false) {
      const event = {
        key,
        defaultPrevented,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };
      keydownListener?.(event);
      return event;
    },
  };
};

describe('modal history controller', () => {
  it('closes the top modal on browser back', () => {
    const fake = createAdapter();
    const close = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('settings', close);

    fake.pop();

    expect(close).toHaveBeenCalledOnce();
    expect(controller.peek()).toBeUndefined();
    expect(fake.back).not.toHaveBeenCalled();
  });

  it('serializes a programmatic close of nested modals', () => {
    const fake = createAdapter();
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('parent', closeParent);
    controller.open('child', closeChild);

    controller.close('parent');
    expect(closeChild).toHaveBeenCalledOnce();
    expect(fake.back).toHaveBeenCalledTimes(1);

    fake.pop({ modal: 'parent' });
    expect(controller.peek()).toBe('parent');
    expect(fake.back).toHaveBeenCalledTimes(2);

    fake.pop();
    expect(controller.peek()).toBeUndefined();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('does not restore state into a parent that is also closing', () => {
    const fake = createAdapter();
    const restoreParent = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', vi.fn(), {
      onStateChange: restoreParent,
    });
    controller.pushState('statistics', { activeChart: 'routes' });
    controller.open('list', vi.fn());

    controller.close('statistics');
    fake.pop({
      modal: 'statistics',
      modalState: { activeChart: 'routes' },
      modalDepth: 1,
    });

    expect(restoreParent).not.toHaveBeenCalled();

    fake.pop({ modal: 'statistics', modalDepth: 0 });
    fake.pop();
    expect(controller.peek()).toBeUndefined();
  });

  it('keeps a modal open when leaving its internal history entry', () => {
    const fake = createAdapter();
    const close = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', close);

    fake.pop({ modal: 'statistics' });

    expect(close).not.toHaveBeenCalled();
    expect(controller.peek()).toBe('statistics');
  });

  it('unwinds internal entries before completing a programmatic close', () => {
    const fake = createAdapter();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', vi.fn());

    controller.close('statistics');
    fake.pop({ modal: 'statistics', modalState: { activeChart: 'routes' } });

    expect(fake.back).toHaveBeenCalledTimes(2);
    expect(controller.peek()).toBe('statistics');

    fake.pop();

    expect(controller.peek()).toBeUndefined();
  });

  it('queues a new modal until a pending close traversal completes', () => {
    const fake = createAdapter();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('list', vi.fn());

    controller.close('list');
    controller.open('details', vi.fn());

    expect(fake.pushState).toHaveBeenCalledTimes(1);
    expect(fake.pushState).toHaveBeenLastCalledWith(
      { modal: 'list', modalState: undefined, modalDepth: 0 },
      '',
    );
    expect(controller.peek()).toBe('details');

    fake.pop();

    expect(fake.pushState).toHaveBeenCalledTimes(2);
    expect(fake.pushState).toHaveBeenLastCalledWith(
      { modal: 'details', modalState: undefined, modalDepth: 0 },
      '',
    );
    expect(controller.peek()).toBe('details');
  });

  it('resolves transition waiters after history traversal and queue flushing', async () => {
    const fake = createAdapter();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('list', vi.fn());

    const closing = controller.close('list');
    controller.open('details', vi.fn());
    let settled = false;
    closing.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    fake.pop();
    await closing;

    expect(settled).toBe(true);
    expect(controller.peek()).toBe('details');
    expect(fake.pushState).toHaveBeenCalledTimes(2);
  });

  it('queues a reopened modal until its old entry finishes closing', () => {
    const fake = createAdapter();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('details', vi.fn());

    controller.close('details');
    controller.open('details', vi.fn());

    expect(fake.pushState).toHaveBeenCalledTimes(1);
    fake.pop();
    expect(fake.pushState).toHaveBeenCalledTimes(2);
    expect(controller.peek()).toBe('details');
  });

  it('restores modal-local state through the controller', () => {
    const fake = createAdapter();
    const restore = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', vi.fn(), { onStateChange: restore });
    controller.pushState('statistics', { activeChart: 'routes' });

    expect(fake.pushState).toHaveBeenLastCalledWith(
      {
        modal: 'statistics',
        modalState: { activeChart: 'routes' },
        modalDepth: 1,
      },
      '',
    );

    controller.back('statistics');
    fake.pop({ modal: 'statistics' });

    expect(fake.back).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(undefined);
    expect(controller.peek()).toBe('statistics');
  });

  it('backs out of local state before a queued modal reaches history', () => {
    const fake = createAdapter();
    const restore = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('list', vi.fn());
    controller.close('list');
    controller.open('statistics', vi.fn(), { onStateChange: restore });
    controller.pushState('statistics', { activeChart: 'routes' });

    controller.back('statistics');

    expect(restore).toHaveBeenCalledWith(undefined);
    expect(fake.back).toHaveBeenCalledOnce();
    fake.pop();
    expect(fake.pushState).toHaveBeenCalledTimes(2);
    expect(fake.pushState).toHaveBeenLastCalledWith(
      { modal: 'statistics', modalState: undefined, modalDepth: 0 },
      '',
    );
  });

  it('restores depth when browser Forward re-enters local state', () => {
    const fake = createAdapter();
    const close = vi.fn();
    const restore = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', close, { onStateChange: restore });
    controller.pushState('statistics', { activeChart: 'routes' });

    fake.pop({ modal: 'statistics', modalDepth: 0 });
    fake.pop({
      modal: 'statistics',
      modalState: { activeChart: 'routes' },
      modalDepth: 1,
    });
    controller.back('statistics');

    expect(restore).toHaveBeenLastCalledWith({ activeChart: 'routes' });
    expect(fake.back).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('dispatches Escape only to the top modal', () => {
    const fake = createAdapter();
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('parent', closeParent);
    controller.open('child', closeChild);

    const event = fake.keydown('Escape');

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('accepts targeted Escape only from the top modal layer', () => {
    const fake = createAdapter();
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('parent', closeParent);
    controller.open('child', closeChild);

    expect(controller.escape('parent')).toBe(false);
    expect(closeParent).not.toHaveBeenCalled();
    expect(closeChild).not.toHaveBeenCalled();

    expect(controller.escape('child')).toBe(true);
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('uses Escape to leave internal state before closing the modal', () => {
    const fake = createAdapter();
    const close = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('statistics', close);
    controller.pushState('statistics', { activeChart: 'routes' });

    fake.keydown('Escape');

    expect(fake.back).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('leaves Escape to a nested control that already handled it', () => {
    const fake = createAdapter();
    const close = vi.fn();
    const controller = createModalHistoryController(fake.adapter);
    controller.open('add-flight', close);

    const event = fake.keydown('Escape', true);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
