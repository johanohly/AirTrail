<script lang="ts">
  import createGlobe from 'cobe';
  import type { Marker } from 'cobe';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { spring } from 'svelte/motion';

  import { cn } from '$lib/utils';

  const getThemeOptions = (): {
    dark: number;
    diffuse: number;
    mapBrightness: number;
    baseColor: [number, number, number];
    markerColor: [number, number, number];
    glowColor: [number, number, number];
  } => {
    return mode.current === 'light'
      ? {
          dark: 0,
          diffuse: 0,
          mapBrightness: 10,
          baseColor: [1, 1, 1],
          markerColor: [60 / 255, 131 / 255, 246 / 255],
          glowColor: [0.4, 0.4, 0.4],
        }
      : {
          dark: 1,
          diffuse: 1.2,
          mapBrightness: 6,
          baseColor: [0.1, 0.1, 0.1],
          markerColor: [60 / 255, 131 / 255, 246 / 255],
          glowColor: [1, 1, 1],
        };
  };

  let x = spring(0, {
    stiffness: 0.04,
    damping: 0.4,
    precision: 0.005,
  });
  let className = '';
  export { className as class };
  let pointerInteracting: any = null;
  let pointerInteractionMovement = 0;
  let canvas: HTMLCanvasElement;

  const markers: (Marker & { delay: number })[] = [
    { location: [14.5995, 120.9842], size: 0.025, id: 'manila', delay: 0 },
    { location: [19.076, 72.8777], size: 0.025, id: 'mumbai', delay: 0.3 },
    { location: [23.8103, 90.4125], size: 0.025, id: 'dhaka', delay: 0.6 },
    { location: [30.0444, 31.2357], size: 0.025, id: 'cairo', delay: 0.9 },
    { location: [39.9042, 116.4074], size: 0.025, id: 'beijing', delay: 1.2 },
    { location: [-23.5505, -46.6333], size: 0.025, id: 'saopaulo', delay: 1.5 },
    { location: [19.4326, -99.1332], size: 0.025, id: 'mexico', delay: 1.8 },
    { location: [40.7128, -74.006], size: 0.025, id: 'nyc', delay: 2.1 },
    { location: [34.6937, 135.5022], size: 0.025, id: 'osaka', delay: 2.4 },
    { location: [41.0082, 28.9784], size: 0.025, id: 'istanbul', delay: 2.7 },
  ];

  let phi = 0;
  let width = 0;
  let onResize = () => {
    width = canvas.offsetWidth;
  };
  onMount(() => {
    if (navigator.webdriver) return;

    const testCanvas = document.createElement('canvas');
    if (
      !testCanvas.getContext('webgl2') &&
      !testCanvas.getContext('webgl') &&
      !testCanvas.getContext('experimental-webgl')
    ) {
      return;
    }

    window.addEventListener('resize', onResize);
    onResize();
    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width,
      height: width,
      phi: 0,
      theta: 0.3,
      mapSamples: 16000,
      ...getThemeOptions(),
      markerElevation: 0,
      markers,
    });

    let frameId: number;
    function animate() {
      if (!pointerInteracting) {
        phi += 0.005;
      }
      globe.update({
        phi: phi + $x,
        width: width * 2,
        height: width * 2,
        ...getThemeOptions(),
      });
      frameId = requestAnimationFrame(animate);
    }
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      globe.destroy();
    };
  });
</script>

<main class={cn('aspect-square h-full max-h-[50dvw] max-w-[50dvw]', className)}>
  <canvas
    class="h-full w-full contain-[layout_paint_size]"
    bind:this={canvas}
    onpointerdown={(e) => {
      pointerInteracting = e.clientX - pointerInteractionMovement;
      canvas.style.cursor = 'grabbing';
    }}
    onpointerup={() => {
      pointerInteracting = null;
      canvas.style.cursor = 'grab';
    }}
    onpointerout={() => {
      pointerInteracting = null;
      canvas.style.cursor = 'grab';
    }}
    onmousemove={(e) => {
      if (pointerInteracting !== null) {
        const delta = e.clientX - pointerInteracting;
        pointerInteractionMovement = delta;
        x.set(delta / 200);
      }
    }}
  />
  {#each markers as marker (marker.id)}
    <div
      class="globe-pulse"
      style="position-anchor: --cobe-{marker.id}; opacity: var(--cobe-visible-{marker.id}, 0); filter: blur(calc((1 - var(--cobe-visible-{marker.id}, 0)) * 8px)); --delay: {marker.delay}s;"
    >
      <span class="globe-pulse-ring"></span>
      <span class="globe-pulse-ring"></span>
      <span class="globe-pulse-dot"></span>
    </div>
  {/each}
</main>
