<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type $$Props = HTMLAttributes<HTMLDivElement> & {
    level?: "1" | "2";
    error?: boolean;
  };

  let className: $$Props["class"] = undefined;
  export { className as class };

  export let level: $$Props["level"] = "1";
  const rounded = level === "1" ? "rounded-xl" : "rounded-md";
  const darkBg = level === "1" ? "dark:bg-dark-1" : "dark:bg-dark-2";
</script>

<div
  class={cn(`bg-card ${darkBg} text-card-foreground ${rounded} border shadow-sm`, className)}
  {...$$restProps}
>
  <slot />
</div>
