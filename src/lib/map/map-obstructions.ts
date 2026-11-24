/*
 * Floating controls drawn over the bottom of the map, such as the navigation
 * dock, mark themselves with `data-map-obstruction="bottom"`. Fits measure
 * how far up into the map they reach, so no route ends up underneath one.
 */
export const bottomObstructionInset = (container: HTMLElement) => {
  const map = container.getBoundingClientRect();
  let inset = 0;
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-map-obstruction="bottom"]',
  )) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (
      rect.right <= map.left ||
      rect.left >= map.right ||
      rect.bottom <= map.top ||
      rect.top >= map.bottom
    ) {
      continue;
    }
    inset = Math.max(inset, map.bottom - rect.top);
  }
  return inset;
};
