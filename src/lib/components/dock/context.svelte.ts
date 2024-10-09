export const dockContext: {
  mouseX: number;
  magnification: number;
  distance: number;
} = $state({
  mouseX: Infinity,
  magnification: 60,
  distance: 140,
});
