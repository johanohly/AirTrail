<script lang="ts">
  import { Tooltip as TooltipPrimitive } from '$lib/primitives';
</script>

<TooltipPrimitive.Arrow width={12} height={6}>
  <svg
    width="12"
    height="6"
    viewBox="0 0 12 6"
    preserveAspectRatio="none"
    data-arrow=""
    style="display: block; overflow: visible;"
  >
    <polygon points="-1,-1 13,-1 6,6" fill="var(--color-popover)" />
    <polyline
      points="0,0 6,6 12,0"
      fill="none"
      stroke="var(--color-border)"
      stroke-width="1"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</TooltipPrimitive.Arrow>
