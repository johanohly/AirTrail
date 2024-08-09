<script lang="ts">
  import { Motion } from "svelte-motion";
  import { tv, type VariantProps } from "tailwind-variants";
  import { cn } from "$lib/utils";

  interface DockProps extends VariantProps<typeof dockVariants> {
    className?: string;
    magnification?: number;
    distance?: number;
    direction?: "top" | "middle" | "bottom";
  }

  let className: DockProps["className"] = undefined;
  export { className as class };
  export let magnification: DockProps["magnification"] = 60;
  export let distance: DockProps["distance"] = 140;
  export let direction: DockProps["direction"] = "middle";

  const dockVariants = tv({
    base:
      "h-[58px] p-2 flex gap-2 rounded-2xl border bg-background/70 backdrop-blur-md"
  });

  let dockElement: HTMLDivElement;
  let mouseX = Infinity;

  function handleMouseMove(e: MouseEvent) {
    mouseX = e.pageX;
  }

  function handleMouseLeave() {
    mouseX = Infinity;
  }

  let dockClass = cn(dockVariants({ className }), {
    "items-start": direction === "top",
    "items-center": direction === "middle",
    "items-end": direction === "bottom"
  });
</script>

<Motion let:motion>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    use:motion
    bind:this={dockElement}
    on:mousemove={(e) => handleMouseMove(e)}
    on:mouseleave={handleMouseLeave}
    class={dockClass}
  >
    <slot {mouseX} {magnification} {distance}>
      <!-- Your Content -->
      Default
    </slot>
  </div>
</Motion>
