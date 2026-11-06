import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';

import {
  createMapCameraController,
  type CameraFocusTarget,
  type CameraPadding,
} from './camera-controller';
import type { GlobeFitArc } from './globe-fit';

type CameraCall = {
  name: string;
  options?: Record<string, unknown>;
  eventData?: Record<string, unknown>;
};

const padding = (top = 0, right = 0, bottom = 0, left = 0): CameraPadding => ({
  top,
  right,
  bottom,
  left,
});

const arc = {
  from: { id: 1, lat: 55.6, lon: 12.6 },
  to: { id: 2, lat: 40.7, lon: -74 },
} as GlobeFitArc;

const updatedArc = {
  from: { id: 3, lat: 1, lon: 3 },
  to: { id: 4, lat: 2, lon: 4 },
} as GlobeFitArc;

const createFrameScheduler = () => {
  let callback: FrameRequestCallback | null = null;
  const request = vi.fn((next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  const cancel = vi.fn();

  return {
    scheduler: { request, cancel },
    flush() {
      const next = callback;
      callback = null;
      if (!next) throw new Error('No camera frame was scheduled');
      next(0);
    },
    request,
    cancel,
  };
};

const createFakeMap = () => {
  const calls: CameraCall[] = [];
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  let center = { lng: 0, lat: 0 };
  let zoom = 2;
  let bearing = 15;
  let pitch = 0;
  let currentPadding = padding();
  let cameraForBoundsError: Error | null = null;

  const recordTransition = (
    name: string,
    options: Record<string, unknown>,
    eventData?: Record<string, unknown>,
  ) => {
    calls.push({ name, options, eventData });
    const nextCenter = options.center as [number, number] | undefined;
    if (nextCenter) center = { lng: nextCenter[0], lat: nextCenter[1] };
    if (typeof options.zoom === 'number') zoom = options.zoom;
    if (typeof options.bearing === 'number') bearing = options.bearing;
    if (typeof options.pitch === 'number') pitch = options.pitch;
    if (options.padding) currentPadding = options.padding as CameraPadding;
  };

  const fake = {
    getCenter: () => center,
    getZoom: () => zoom,
    getBearing: () => bearing,
    getPitch: () => pitch,
    getPadding: () => currentPadding,
    getCanvas: () => ({ clientWidth: 1200, clientHeight: 800 }),
    setPadding(next: CameraPadding) {
      calls.push({ name: 'setPadding', options: next });
      currentPadding = next;
      return fake;
    },
    cameraForBounds() {
      calls.push({ name: 'cameraForBounds' });
      if (cameraForBoundsError) throw cameraForBoundsError;
      return { center: [4, 5] as [number, number], zoom: 6 };
    },
    flyTo(
      options: Record<string, unknown>,
      eventData?: Record<string, unknown>,
    ) {
      recordTransition('flyTo', options, eventData);
      return fake;
    },
    easeTo(
      options: Record<string, unknown>,
      eventData?: Record<string, unknown>,
    ) {
      recordTransition('easeTo', options, eventData);
      return fake;
    },
    fitBounds(
      bounds: unknown,
      options?: Record<string, unknown>,
      eventData?: Record<string, unknown>,
    ) {
      calls.push({
        name: 'fitBounds',
        options: { bounds, ...options },
        eventData,
      });
      return fake;
    },
    on(event: string, handler: (event: unknown) => void) {
      const handlers = listeners.get(event) ?? new Set();
      handlers.add(handler);
      listeners.set(event, handlers);
      return fake;
    },
    off(event: string, handler: (event: unknown) => void) {
      listeners.get(event)?.delete(handler);
      return fake;
    },
  };

  return {
    map: fake as unknown as MapLibreMap,
    calls,
    emit(event: string, data: Record<string, unknown> = {}) {
      for (const handler of [...(listeners.get(event) ?? [])]) handler(data);
    },
    failCameraForBounds(error: Error) {
      cameraForBoundsError = error;
    },
  };
};

const pointTarget = (
  center: [number, number] = [10, 20],
  zoom = 8,
): CameraFocusTarget => ({ type: 'point', center, zoom });

const reconcile = (
  controller: ReturnType<typeof createMapCameraController>,
  {
    focusRequest = 1,
    focusTarget,
    selectionActive = focusTarget !== undefined,
    viewPadding = padding(),
    projection = 'mercator' as const,
    overviewArcs = [arc],
    automaticFitRequest = 0,
  }: {
    focusRequest?: number;
    focusTarget?: CameraFocusTarget;
    selectionActive?: boolean;
    viewPadding?: CameraPadding;
    projection?: 'globe' | 'mercator';
    overviewArcs?: GlobeFitArc[];
    automaticFitRequest?: number;
  } = {},
) =>
  controller.reconcile({
    selectionActive,
    focusRequest,
    focusTarget,
    padding: viewPadding,
    projection,
    overviewArcs,
    automaticFitRequest,
  });

describe('map camera controller', () => {
  it('lets selection focus win over queued automatic fitting and padding', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: padding(40, 20, 440, 20),
      automaticFitRequest: 1,
    });
    frames.flush();

    expect(frames.request).toHaveBeenCalledTimes(1);
    expect(fake.calls.map((call) => call.name)).toEqual(['flyTo']);
  });

  it('keeps focus queued until an active map touch finishes', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    fake.emit('touchstart');
    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: padding(40, 20, 440, 20),
    });

    expect(fake.calls).toEqual([]);
    expect(frames.request).not.toHaveBeenCalled();

    fake.emit('touchend');
    expect(frames.request).toHaveBeenCalledTimes(1);
    frames.flush();
    expect(fake.calls.map((call) => call.name)).toEqual(['flyTo']);
  });

  it('focuses details after the user has moved the camera', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    fake.emit('dragstart', { originalEvent: {} });
    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: padding(40, 20, 440, 20),
    });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual(['flyTo']);
  });

  it('gives geolocation ownership of the camera', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const previousStates: boolean[] = [];
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
      onPreviousViewChange: (available) => previousStates.push(available),
    });
    const detailPadding = padding(40, 20, 440, 20);

    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
    });
    frames.flush();
    fake.calls.length = 0;

    reconcile(controller, {
      selectionActive: true,
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
      automaticFitRequest: 1,
    });
    fake.emit('movestart', { geolocateSource: true });
    reconcile(controller, {
      selectionActive: false,
      viewPadding: padding(),
      automaticFitRequest: 1,
    });
    frames.flush();

    expect(previousStates).toEqual([true, false]);
    expect(fake.calls.map((call) => call.name)).toEqual(['easeTo']);
  });

  it('manual fitting restores automatic fitting outside details', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    fake.emit('dragstart', { originalEvent: {} });
    reconcile(controller, { automaticFitRequest: 1 });
    expect(frames.request).not.toHaveBeenCalled();

    controller.fit([arc], {
      projection: 'mercator',
      padding: padding(),
    });
    frames.flush();
    fake.calls.length = 0;
    frames.request.mockClear();

    reconcile(controller, { automaticFitRequest: 2 });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual([
      'setPadding',
      'fitBounds',
    ]);
  });

  it('keeps the initial automatic fit after non-user map startup events', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    fake.emit('zoomstart');
    reconcile(controller, { automaticFitRequest: 1 });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual([
      'setPadding',
      'fitBounds',
    ]);
  });

  it('lets a filtered-result fit replace details-close padding', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: padding(40, 20, 440, 20),
    });
    frames.flush();
    fake.calls.length = 0;

    reconcile(controller, {
      selectionActive: false,
      viewPadding: padding(),
      automaticFitRequest: 1,
    });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual([
      'setPadding',
      'fitBounds',
    ]);
  });

  it('cancels a queued camera command during cleanup', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    reconcile(controller, { focusTarget: pointTarget() });
    controller.destroy();

    expect(frames.cancel).toHaveBeenCalledWith(1);
    expect(fake.calls).toEqual([]);
  });

  it('pins mercator padding while calculating an arc focus target', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    reconcile(controller, {
      focusTarget: { type: 'arcs', arcs: [arc], projection: 'mercator' },
      viewPadding: padding(40, 20, 440, 20),
    });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual([
      'setPadding',
      'cameraForBounds',
      'setPadding',
      'flyTo',
    ]);
    expect(fake.calls[0]?.options).toEqual(padding(40, 20, 440, 20));
    expect(fake.calls[2]?.options).toEqual(padding());
  });

  it('restores persistent padding if target calculation fails', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });
    fake.failCameraForBounds(new Error('cannot fit'));

    reconcile(controller, {
      focusTarget: { type: 'arcs', arcs: [arc], projection: 'mercator' },
      viewPadding: padding(40, 20, 440, 20),
    });

    expect(() => frames.flush()).toThrow('cannot fit');
    expect(fake.calls.at(-1)).toEqual({
      name: 'setPadding',
      options: padding(),
    });
  });

  it('eases when focus only needs to interpolate padding', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    reconcile(controller, {
      focusTarget: pointTarget([0, 0], 2),
      viewPadding: padding(40, 20, 440, 20),
    });
    frames.flush();

    expect(fake.calls[0]).toMatchObject({
      name: 'easeTo',
      options: { duration: 300, padding: padding(40, 20, 440, 20) },
    });
  });

  it('keeps the previous view available after details padding is removed', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const previousStates: boolean[] = [];
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
      onPreviousViewChange: (available) => previousStates.push(available),
    });

    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: padding(40, 20, 440, 20),
    });
    frames.flush();
    reconcile(controller, {
      focusRequest: 1,
      viewPadding: padding(),
    });
    frames.flush();

    expect(previousStates).toEqual([true]);

    controller.restore(true);
    frames.flush();
    expect(previousStates).toEqual([true, false]);
  });

  it('keeps a newer programmatic move active when an older move ends', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const previousStates: boolean[] = [];
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
      onPreviousViewChange: (available) => previousStates.push(available),
    });

    reconcile(controller, {
      focusRequest: 1,
      focusTarget: pointTarget([10, 20], 8),
    });
    frames.flush();
    const firstMove = fake.calls.at(-1)?.eventData;
    reconcile(controller, {
      focusRequest: 2,
      focusTarget: pointTarget([30, 40], 9),
    });
    frames.flush();
    const secondMove = fake.calls.at(-1)?.eventData;

    fake.emit('moveend', firstMove);
    fake.emit('dragstart', secondMove);
    controller.restore(true);
    frames.flush();

    expect(fake.calls.at(-1)).toMatchObject({
      name: 'easeTo',
      options: { center: [10, 20], zoom: 8, bearing: 15, duration: 650 },
    });
    expect(previousStates.at(-1)).toBe(false);
  });

  it('normalizes bearing and pitch when globe rotation is disabled', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });

    controller.normalizeOrientation(false);
    frames.flush();

    expect(fake.calls[0]).toMatchObject({
      name: 'easeTo',
      options: { bearing: 0, pitch: 0, duration: 0 },
    });
  });

  it('defers automatic fitting until untouched details close', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });
    const detailPadding = padding(40, 20, 440, 20);
    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
    });
    frames.flush();
    fake.calls.length = 0;
    frames.request.mockClear();

    reconcile(controller, {
      selectionActive: true,
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
      overviewArcs: [arc],
      automaticFitRequest: 1,
    });
    expect(frames.request).not.toHaveBeenCalled();

    reconcile(controller, {
      selectionActive: false,
      viewPadding: padding(),
      overviewArcs: [updatedArc],
      automaticFitRequest: 1,
    });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual([
      'setPadding',
      'fitBounds',
    ]);
    expect(fake.calls[1]?.options?.bounds).toEqual([
      [3, 1],
      [4, 2],
    ]);
  });

  it('cancels deferred and future automatic fitting after user movement', () => {
    const fake = createFakeMap();
    const frames = createFrameScheduler();
    const controller = createMapCameraController(fake.map, {
      frameScheduler: frames.scheduler,
    });
    const detailPadding = padding(40, 20, 440, 20);
    reconcile(controller, {
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
    });
    frames.flush();
    fake.emit('moveend', fake.calls.at(-1)?.eventData);
    fake.calls.length = 0;
    frames.request.mockClear();

    reconcile(controller, {
      selectionActive: true,
      focusTarget: pointTarget(),
      viewPadding: detailPadding,
      automaticFitRequest: 1,
    });
    fake.emit('dragstart', { originalEvent: {} });
    reconcile(controller, {
      selectionActive: false,
      viewPadding: padding(),
      automaticFitRequest: 1,
    });
    frames.flush();

    expect(fake.calls.map((call) => call.name)).toEqual(['easeTo']);

    frames.request.mockClear();
    reconcile(controller, {
      selectionActive: false,
      viewPadding: padding(),
      automaticFitRequest: 2,
    });
    expect(frames.request).not.toHaveBeenCalled();
  });
});
