/*
 * MapLibre shrinks its pixel ratio evenly when a tall canvas would exceed its
 * size limit, as with a portrait phone in desktop mode. luma.gl instead clamps
 * each axis of deck's drawing buffer separately, while deck derives its viewport
 * from the width ratio alone, so a clamped height stretches the overlay
 * vertically. Rendering deck at the ratio MapLibre settled on keeps both canvases
 * the same shape and within the limit.
 */
export const getOverlayPixelRatio = (
  canvas: { width: number; height: number },
  container: { clientWidth: number; clientHeight: number },
): number | true => {
  if (!container.clientWidth || !container.clientHeight) return true;

  return Math.min(
    canvas.width / container.clientWidth,
    canvas.height / container.clientHeight,
  );
};
