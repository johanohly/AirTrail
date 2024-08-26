<script lang="ts">
  import { cn } from '$lib/utils';

  let { classes, children } = $props();
</script>

<div
  class={cn(
    'border border-zinc-400 dark:border-zinc-700 relative shadow-[0px_5px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[0px_4px_0px_0px_rgba(255,255,255,0.5)] rounded-xl dark:bg-zinc-900/50 bg-zinc-50',
    classes,
  )}
>
  {@render children()}
</div>
