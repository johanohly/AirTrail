<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte';

  import { cn, flyAndScale } from '$lib/utils';

  let className = '';
  export { className as class };
  export let text: string;

  const {
    elements: { trigger, content, arrow },
    states: { open },
  } = createTooltip({
    positioning: {
      placement: 'top',
    },
    openDelay: 500,
  });
</script>

<button class={cn(className)} type="button" use:melt={$trigger}>
  <slot />
</button>

{#if open}
  <div
    use:melt={$content}
    transition:flyAndScale={{ y: 8, duration: 150 }}
    class="z-50 overflow-hidden rounded-md bg-card px-3 py-1.5 text-xs text-card-foreground border"
  >
    <div use:melt={$arrow} />
    <p>{text}</p>
  </div>
{/if}
