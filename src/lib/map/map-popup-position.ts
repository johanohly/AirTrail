import type { PickingInfo } from '@deck.gl/core';
import type { Map as MaplibreMap, Popup as MaplibrePopup } from 'maplibre-gl';

export type MapPointerPixel = { x: number; y: number };

export type DeckPointerEvent = {
  offsetCenter?: MapPointerPixel;
  srcEvent?: Event & {
    point?: MapPointerPixel;
    lngLat?: { lng: number; lat: number };
    clientX?: number;
    clientY?: number;
  };
};

const POPUP_OFFSET = 20;
const POPUP_FALLBACK_SIZE = { width: 320, height: 280 };

export const getDeckPointerPixel = (
  info: PickingInfo,
  event?: DeckPointerEvent,
): MapPointerPixel | undefined =>
  event?.srcEvent?.point ??
  event?.offsetCenter ??
  (info.pixel ? { x: info.pixel[0], y: info.pixel[1] } : undefined) ??
  (Number.isFinite(info.x) && Number.isFinite(info.y)
    ? { x: info.x, y: info.y }
    : undefined);

export const getDeckPointerLngLat = (
  info: PickingInfo,
  event: DeckPointerEvent | undefined,
  map: MaplibreMap | undefined,
): [number, number] | undefined => {
  if (event?.srcEvent?.lngLat) {
    return [event.srcEvent.lngLat.lng, event.srcEvent.lngLat.lat];
  }

  const point = getDeckPointerPixel(info, event);
  if (map && point) {
    const lngLat = map.unproject([point.x, point.y]);
    return [lngLat.lng, lngLat.lat];
  }

  const srcEvent = event?.srcEvent;
  if (
    map &&
    typeof srcEvent?.clientX === 'number' &&
    typeof srcEvent.clientY === 'number'
  ) {
    const rect = map.getContainer().getBoundingClientRect();
    const lngLat = map.unproject([
      srcEvent.clientX - rect.left,
      srcEvent.clientY - rect.top,
    ]);
    return [lngLat.lng, lngLat.lat];
  }

  return info.coordinate?.length
    ? ([info.coordinate[0], info.coordinate[1]] as [number, number])
    : undefined;
};

export const getPopupAnchor = (
  point: MapPointerPixel,
  container: Pick<HTMLElement, 'clientWidth' | 'clientHeight'>,
  popupSize = POPUP_FALLBACK_SIZE,
) => {
  const vertical =
    point.y + POPUP_OFFSET + popupSize.height > container.clientHeight
      ? 'bottom'
      : 'top';
  const horizontal =
    point.x + POPUP_OFFSET + popupSize.width > container.clientWidth
      ? 'right'
      : 'left';
  return `${vertical}-${horizontal}` as const;
};

export const createPopupPositionController = (
  getMap: () => MaplibreMap | undefined,
) => {
  let popup: MaplibrePopup | undefined;

  const update = (point: MapPointerPixel | undefined) => {
    const map = getMap();
    if (!popup || !map || !point) return;

    const element = popup.getElement();
    const popupSize = {
      width: element?.offsetWidth || POPUP_FALLBACK_SIZE.width,
      height: element?.offsetHeight || POPUP_FALLBACK_SIZE.height,
    };
    popup.options.anchor = getPopupAnchor(point, map.getContainer(), popupSize);
  };

  return {
    setPopup(nextPopup: MaplibrePopup) {
      popup = nextPopup;
    },
    update,
  };
};
