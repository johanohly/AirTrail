export const RAINVIEWER_METADATA_URL =
  'https://api.rainviewer.com/public/weather-maps.json';
export const RAINVIEWER_SOURCE_ID = 'airtrail-rainviewer-source';
export const RAINVIEWER_LAYER_ID = 'airtrail-rainviewer-radar';
export const RAINVIEWER_MAX_NATIVE_ZOOM = 7;

type RainViewerFrame = {
  time: number;
  path: string;
};

type RainViewerMetadata = {
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
};

const isFrame = (value: unknown): value is RainViewerFrame => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const frame = value as Partial<RainViewerFrame>;

  return typeof frame.time === 'number' && typeof frame.path === 'string';
};

export const getLatestRainViewerTileTemplate = (
  metadata: unknown,
): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const input = metadata as Partial<RainViewerMetadata>;

  if (typeof input.host !== 'string') {
    return null;
  }

  const observedFrames = (input.radar?.past ?? []).filter(isFrame);
  const forecastFrames = (input.radar?.nowcast ?? []).filter(isFrame);
  const frames = observedFrames.length > 0 ? observedFrames : forecastFrames;
  const latestFrame = frames.at(-1);

  if (!latestFrame) {
    return null;
  }

  return `${input.host}${latestFrame.path}/512/{z}/{x}/{y}/2/1_1.png`;
};
