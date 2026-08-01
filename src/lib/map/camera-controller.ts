import maplibregl, {
  type EaseToOptions,
  type FlyToOptions,
  type Map as MapLibreMap,
} from 'maplibre-gl';

import { globeCameraForArcs, type GlobeFitArc } from './globe-fit';

import { calculateBounds } from '$lib/utils/latlng';

export type MapProjection = 'globe' | 'mercator';
export type CameraPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CameraFocusTarget =
  | { type: 'point'; center: [number, number]; zoom: number }
  | { type: 'arcs'; arcs: GlobeFitArc[]; projection: MapProjection };

type FitIntent = {
  type: 'fit';
  arcs: GlobeFitArc[];
  projection: MapProjection;
  padding: CameraPadding;
  source: 'automatic' | 'manual';
  resultMode: CameraMode;
};

type FocusIntent = {
  type: 'focus';
  target: CameraFocusTarget;
  padding: CameraPadding;
};

type CameraIntent =
  | FitIntent
  | FocusIntent
  | { type: 'padding'; padding: CameraPadding }
  | { type: 'restore'; rotationEnabled: boolean }
  | { type: 'orientation'; rotationEnabled: boolean };

export type CameraViewState = {
  selectionActive: boolean;
  focusRequest: number;
  focusTarget?: CameraFocusTarget;
  padding: CameraPadding;
  projection: MapProjection;
  overviewArcs: GlobeFitArc[];
  automaticFitRequest: number;
};

type CameraMode = 'overview' | 'details' | 'custom';

type CameraSnapshot = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  mode: CameraMode;
};

type FrameScheduler = {
  request: (callback: FrameRequestCallback) => number;
  cancel: (handle: number) => void;
};

type CameraControllerOptions = {
  onPreviousViewChange?: (available: boolean) => void;
  frameScheduler?: FrameScheduler;
};

const intentPriority = (intent: CameraIntent) => {
  // One frame can contain several reactive state changes. Keep only the
  // strongest resulting camera intent so their execution order is explicit:
  // restoration > selection focus > overview fit > padding-only adjustment.
  switch (intent.type) {
    case 'padding':
      return 10;
    case 'fit':
      return intent.source === 'manual' ? 25 : 20;
    case 'focus':
      return 30;
    case 'restore':
      return 40;
    case 'orientation':
      return 50;
  }
};

const cameraEventGenerationKey = 'airtrailCameraGeneration';
const defaultFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

const addPadding = (padding: CameraPadding, amount: number) => ({
  top: padding.top + amount,
  right: padding.right + amount,
  bottom: padding.bottom + amount,
  left: padding.left + amount,
});

const paddingEquals = (left: CameraPadding, right: CameraPadding) =>
  left.top === right.top &&
  left.right === right.right &&
  left.bottom === right.bottom &&
  left.left === right.left;

export const createMapCameraController = (
  map: MapLibreMap,
  options: CameraControllerOptions = {},
) => {
  const frameScheduler = options.frameScheduler ?? defaultFrameScheduler;
  let previousCamera: CameraSnapshot | null = null;
  let pendingIntent: CameraIntent | null = null;
  let pendingOrientation: Extract<
    CameraIntent,
    { type: 'orientation' }
  > | null = null;
  let pendingFrame: number | null = null;
  let pendingAutomaticFit = false;
  let mapTouchActive = false;
  let selectionActive = false;
  let handledFocusRequest = -1;
  let handledAutomaticFitRequest = 0;
  let lastPadding: CameraPadding | null = null;
  let cameraMode: CameraMode = 'overview';
  let movementGeneration = 0;
  const moveEndHandlers = new Set<(event: unknown) => void>();

  const setPreviousCamera = (camera: CameraSnapshot | null) => {
    previousCamera = camera;
    options.onPreviousViewChange?.(camera !== null);
  };

  const snapshotCamera = (): CameraSnapshot => {
    const center = map.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      mode: cameraMode,
    };
  };

  const beginProgrammaticMove = () => {
    const generation = ++movementGeneration;
    const eventData = { [cameraEventGenerationKey]: generation };
    const handleMoveEnd = (event: unknown) => {
      const completedGeneration = (
        event as Record<string, unknown> | undefined
      )?.[cameraEventGenerationKey];
      if (completedGeneration !== generation) return;

      map.off('moveend', handleMoveEnd);
      moveEndHandlers.delete(handleMoveEnd);
    };
    moveEndHandlers.add(handleMoveEnd);
    map.on('moveend', handleMoveEnd);
    return eventData;
  };

  const targetForArcs = (
    arcs: GlobeFitArc[],
    projection: MapProjection,
    padding: CameraPadding,
  ) => {
    if (projection === 'globe') {
      const canvas = map.getCanvas();
      return globeCameraForArcs(arcs, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        padding,
      });
    }

    const bounds = calculateBounds(arcs);
    if (!bounds) return undefined;

    const savedPadding = map.getPadding();
    try {
      // cameraForBounds uses persistent and option padding differently when
      // calculating its center. Pin the calculation to the target persistent
      // padding, then restore it before the next render.
      map.setPadding(padding);
      const target = map.cameraForBounds(bounds);
      if (!target?.center || target.zoom === undefined) return undefined;
      const center = maplibregl.LngLat.convert(target.center);
      return {
        center: [center.lng, center.lat] as [number, number],
        zoom: target.zoom,
      };
    } finally {
      map.setPadding(savedPadding);
    }
  };

  const executeFit = (intent: FitIntent) => {
    const padding = addPadding(intent.padding, 60);
    if (intent.projection === 'globe') {
      const target = targetForArcs(intent.arcs, intent.projection, padding);
      if (!target) return;
      map.setPadding(padding);
      map.flyTo(
        {
          center: target.center,
          zoom: target.zoom,
          essential: true,
        },
        beginProgrammaticMove(),
      );
      cameraMode = intent.resultMode;
      return;
    }

    const bounds = calculateBounds(intent.arcs);
    if (!bounds) return;
    map.setPadding(padding);
    map.fitBounds(bounds, undefined, beginProgrammaticMove());
    cameraMode = intent.resultMode;
  };

  const executeFocus = (intent: FocusIntent) => {
    const target =
      intent.target.type === 'point'
        ? intent.target
        : targetForArcs(
            intent.target.arcs,
            intent.target.projection,
            intent.padding,
          );
    if (!target) return;

    const currentCenter = map.getCenter();
    const cameraMoved =
      Math.abs(currentCenter.lng - target.center[0]) > 1e-4 ||
      Math.abs(currentCenter.lat - target.center[1]) > 1e-4 ||
      Math.abs(map.getZoom() - target.zoom) > 1e-2;

    setPreviousCamera(snapshotCamera());
    const transition: FlyToOptions | EaseToOptions = {
      center: target.center,
      zoom: target.zoom,
      padding: intent.padding,
      duration: cameraMoved ? 1200 : 300,
      essential: true,
    };
    const eventData = beginProgrammaticMove();
    if (cameraMoved) {
      map.flyTo(transition, eventData);
    } else {
      map.easeTo(transition, eventData);
    }
    cameraMode = 'details';
  };

  const execute = (intent: CameraIntent) => {
    switch (intent.type) {
      case 'fit':
        executeFit(intent);
        break;
      case 'focus':
        executeFocus(intent);
        break;
      case 'padding':
        map.easeTo(
          {
            padding: intent.padding,
            duration: 300,
            essential: true,
          },
          beginProgrammaticMove(),
        );
        break;
      case 'restore':
        if (!previousCamera) return;
        cameraMode = previousCamera.mode;
        map.easeTo(
          {
            center: previousCamera.center,
            zoom: previousCamera.zoom,
            bearing: intent.rotationEnabled ? previousCamera.bearing : 0,
            pitch: 0,
            duration: 650,
            essential: true,
          },
          beginProgrammaticMove(),
        );
        setPreviousCamera(null);
        break;
      case 'orientation': {
        const bearing = intent.rotationEnabled ? map.getBearing() : 0;
        if (map.getPitch() === 0 && map.getBearing() === bearing) return;
        map.easeTo(
          {
            pitch: 0,
            bearing,
            duration: 0,
            essential: true,
          },
          beginProgrammaticMove(),
        );
        break;
      }
    }
  };

  const flush = () => {
    pendingFrame = null;
    const orientation = pendingOrientation;
    pendingOrientation = null;
    if (orientation) execute(orientation);

    if (pendingIntent?.type === 'focus' && mapTouchActive) {
      return;
    }

    const intent = pendingIntent;
    pendingIntent = null;
    if (intent) execute(intent);
  };

  const request = (intent: CameraIntent) => {
    if (intent.type === 'orientation') {
      pendingOrientation = intent;
    } else if (
      !pendingIntent ||
      intentPriority(intent) >= intentPriority(pendingIntent)
    ) {
      pendingIntent = intent;
    }
    if (
      pendingIntent?.type === 'focus' &&
      mapTouchActive &&
      pendingOrientation === null
    )
      return;
    pendingFrame ??= frameScheduler.request(flush);
  };

  const requestOverviewFit = (view: CameraViewState) => {
    request({
      type: 'fit',
      arcs: view.overviewArcs,
      projection: view.projection,
      padding: view.padding,
      source: 'automatic',
      resultMode: 'overview',
    });
  };

  const markCustomCamera = (event: unknown) => {
    const cameraEvent = event as Record<string, unknown> | undefined;
    const generation = cameraEvent?.[cameraEventGenerationKey];
    if (typeof generation === 'number') return;
    if (!cameraEvent?.originalEvent && cameraEvent?.geolocateSource !== true)
      return;

    cameraMode = 'custom';
    pendingAutomaticFit = false;
    if (previousCamera) setPreviousCamera(null);
  };

  const markMapTouchStart = () => {
    mapTouchActive = true;
  };

  const markMapTouchEnd = () => {
    mapTouchActive = false;
    if (pendingIntent && pendingFrame === null) {
      pendingFrame = frameScheduler.request(flush);
    }
  };

  map.on('movestart', markCustomCamera);
  map.on('dragstart', markCustomCamera);
  map.on('zoomstart', markCustomCamera);
  map.on('rotatestart', markCustomCamera);
  map.on('pitchstart', markCustomCamera);
  map.on('touchstart', markMapTouchStart);
  map.on('touchend', markMapTouchEnd);
  map.on('touchcancel', markMapTouchEnd);

  return {
    fit(
      arcs: GlobeFitArc[],
      config: {
        projection: MapProjection;
        padding: CameraPadding;
      },
    ) {
      const intent: FitIntent = {
        type: 'fit',
        arcs,
        projection: config.projection,
        padding: config.padding,
        source: 'manual',
        resultMode: selectionActive ? 'details' : 'overview',
      };
      request(intent);
    },
    reconcile(view: CameraViewState) {
      const selectionClosed = selectionActive && !view.selectionActive;
      const paddingChanged =
        lastPadding !== null && !paddingEquals(lastPadding, view.padding);
      const focusTarget = view.focusTarget;
      const focusRequested =
        focusTarget !== undefined && view.focusRequest !== handledFocusRequest;
      const automaticFitRequested =
        view.automaticFitRequest !== handledAutomaticFitRequest;

      selectionActive = view.selectionActive;
      lastPadding = view.padding;
      handledAutomaticFitRequest = view.automaticFitRequest;

      if (focusRequested) {
        handledFocusRequest = view.focusRequest;
        request({
          type: 'focus',
          target: focusTarget,
          padding: view.padding,
        });
      }

      if (view.selectionActive) {
        if (
          automaticFitRequested &&
          (focusRequested ||
            pendingIntent?.type === 'focus' ||
            cameraMode === 'details')
        ) {
          pendingAutomaticFit = true;
        }
        if (!focusRequested && paddingChanged) {
          request({ type: 'padding', padding: view.padding });
        }
        return;
      }

      if (selectionClosed && pendingIntent?.type === 'focus') {
        pendingIntent = null;
      }

      const releaseAutomaticFit =
        selectionClosed &&
        cameraMode === 'details' &&
        (pendingAutomaticFit || automaticFitRequested);
      if (selectionClosed) pendingAutomaticFit = false;

      if (releaseAutomaticFit) {
        requestOverviewFit(view);
      } else {
        if (automaticFitRequested && cameraMode === 'overview') {
          requestOverviewFit(view);
        }
        if (selectionClosed && cameraMode === 'details') {
          cameraMode = 'custom';
        }
      }

      if (paddingChanged && !releaseAutomaticFit) {
        request({ type: 'padding', padding: view.padding });
      }
    },
    restore(rotationEnabled: boolean) {
      request({ type: 'restore', rotationEnabled });
    },
    normalizeOrientation(rotationEnabled: boolean) {
      request({ type: 'orientation', rotationEnabled });
    },
    destroy() {
      if (pendingFrame !== null) frameScheduler.cancel(pendingFrame);
      pendingFrame = null;
      pendingIntent = null;
      pendingOrientation = null;
      pendingAutomaticFit = false;
      map.off('movestart', markCustomCamera);
      map.off('dragstart', markCustomCamera);
      map.off('zoomstart', markCustomCamera);
      map.off('rotatestart', markCustomCamera);
      map.off('pitchstart', markCustomCamera);
      map.off('touchstart', markMapTouchStart);
      map.off('touchend', markMapTouchEnd);
      map.off('touchcancel', markMapTouchEnd);
      for (const handler of moveEndHandlers) map.off('moveend', handler);
      moveEndHandlers.clear();
    },
  };
};

export type MapCameraController = ReturnType<typeof createMapCameraController>;
