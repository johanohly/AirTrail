import { derived, writable } from 'svelte/store';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;

// must be defined here to avoid circular dependencies
export const screenSizeStore = writable({
  width: defaultWindow ? defaultWindow.innerWidth : 0,
  height: defaultWindow ? defaultWindow.innerHeight : 0,
});

export const isSmallScreen = derived(
  screenSizeStore,
  ($screenSize) => $screenSize.width >= 640,
);
export const isMediumScreen = derived(
  screenSizeStore,
  ($screenSize) => $screenSize.width >= 768,
);
export const isLargeScreen = derived(
  screenSizeStore,
  ($screenSize) => $screenSize.width >= 1024,
);
export const isXLScreen = derived(
  screenSizeStore,
  ($screenSize) => $screenSize.width >= 1280,
);
export const isXXLScreen = derived(
  screenSizeStore,
  ($screenSize) => $screenSize.width >= 1536,
);
