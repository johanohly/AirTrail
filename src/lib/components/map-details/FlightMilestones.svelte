<script lang="ts">
  import {
    formatOrdinal,
    type FlightMilestone,
  } from '$lib/utils/data/flight-milestones';

  let { milestones }: { milestones: FlightMilestone[] } = $props();
</script>

{#if milestones.length}
  <div class="flex flex-col gap-1.5">
    <p class="text-xs tracking-wider text-muted-foreground uppercase">
      Milestones
    </p>
    <div class="flex flex-wrap gap-1.5">
      {#each milestones as m (m.key)}
        {#if m.firstOnly || m.ordinal === 1}
          <span
            class="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
          >
            <span aria-hidden="true">✦</span>
            {#if m.firstOnly}
              {m.label}
            {:else}
              1st {m.label}
            {/if}
          </span>
        {:else}
          <span
            class="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs"
          >
            <span class="font-medium tabular-nums">
              {formatOrdinal(m.ordinal)}
            </span>
            {m.label}
          </span>
        {/if}
      {/each}
    </div>
  </div>
{/if}
