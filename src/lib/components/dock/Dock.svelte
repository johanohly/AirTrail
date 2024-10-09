<script lang="ts">
  import { Motion } from 'svelte-motion';
  import { cn } from '$lib/utils';
  import { dockContext } from './context.svelte';
  import type { Snippet } from 'svelte';

  let {
    class: className = undefined,
    direction = 'middle',
    children,
  }: {
    class?: string;
    direction?: 'top' | 'middle' | 'bottom';
    children: Snippet;
  } = $props();

  function handleMouseMove(e: MouseEvent) {
    dockContext.mouseX = e.pageX;
  }

  function handleMouseLeave() {
    dockContext.mouseX = Infinity;
  }

  let dockClass = cn(
    'h-[58px] p-2 flex gap-2 rounded-2xl border bg-background/70 backdrop-blur-md',
    className,
    {
      'items-start': direction === 'top',
      'items-center': direction === 'middle',
      'items-end': direction === 'bottom',
    },
  );
</script>

<Motion let:motion>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:motion
    onmousemove={(e) => handleMouseMove(e)}
    onmouseleave={handleMouseLeave}
    class={dockClass}
  >
    {@render children()}
  </div>
</Motion>
