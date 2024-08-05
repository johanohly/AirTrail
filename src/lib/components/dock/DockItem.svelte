<script lang="ts">
  import { cn } from "$lib/utils";
  import {
    Motion,
    useMotionValue,
    useSpring,
    useTransform
  } from "svelte-motion";

  export let magnification = 60;
  export let distance = 160;
  export let mouseX = 0;
  let mint = useMotionValue(mouseX);
  $: mint.set(mouseX);

  let className: string | undefined = "";
  export { className as class };

  let iconElement: HTMLDivElement;

  let distanceCalc = useTransform(mint, (val: number) => {
    const bounds = iconElement?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  let widthSync = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [38, magnification, 38]
  );

  let width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12
  });

  let iconClass = cn(
    "flex aspect-square cursor-pointer items-center justify-center rounded-full",
    className
  );
</script>

<Motion style={{ width: width }} let:motion>
  <div use:motion bind:this={iconElement} class={iconClass}>
    <slot></slot>
  </div>
</Motion>
