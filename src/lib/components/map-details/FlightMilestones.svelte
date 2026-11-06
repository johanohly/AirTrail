<script lang="ts">
  import type { FlightMilestone } from './flight-milestones';

  let { milestones }: { milestones: FlightMilestone[] } = $props();
</script>

{#if milestones.length}
  <div class="flex flex-col gap-1.5">
    <p class="text-xs tracking-wider text-muted-foreground uppercase">
      Milestones
    </p>
    <div class="flex flex-wrap gap-1.5">
      {#each milestones as milestone (milestone.key)}
        <span
          class="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs"
        >
          {milestone.text}
        </span>
      {/each}
    </div>
  </div>
{/if}
