<script lang="ts">
  import TailPhotoPreview from './TailPhotoPreview.svelte';

  import {
    PopoverTooltipArrow,
    popoverTooltipClass,
  } from '$lib/components/display';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import { Tooltip as TooltipPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let { reg }: { reg: string } = $props();

  // Planespotters airframe pages are keyed by their own ids; search lands on
  // the airframe for an exact registration.
  const href = $derived(
    `https://www.planespotters.net/search?q=${encodeURIComponent(reg)}`,
  );

  const modalCtx = getModalContext();
  const zIndex = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    return modalZ !== undefined ? modalZ + 5 : undefined;
  });
</script>

<TooltipPrimitive.Root delayDuration={250}>
  <TooltipPrimitive.Trigger onclick={(e) => e.stopPropagation()}>
    {#snippet child({ props })}
      <a
        {...props}
        {href}
        target="_blank"
        rel="noopener"
        class="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >{reg}</a
      >
    {/snippet}
  </TooltipPrimitive.Trigger><TooltipPrimitive.Portal>
    <TooltipPrimitive.Content sideOffset={8} side="top">
      {#snippet child({ props, wrapperProps })}
        <div {...wrapperProps}>
          <div
            {...props}
            style:z-index={zIndex}
            class={cn(popoverTooltipClass, 'p-1.5')}
          >
            <TailPhotoPreview {reg} />
            <PopoverTooltipArrow />
          </div>
        </div>
      {/snippet}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
