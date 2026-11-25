<script lang="ts">
  import type { FR24Leg } from '$lib/server/utils/fr24';

  import RotationLegRow, { type LegState } from './RotationLegRow.svelte';

  import { Separator } from '$lib/components/ui/separator';

  let {
    yourLeg,
    priorLegs,
    flightStatsUrl = null,
  }: {
    yourLeg: FR24Leg;
    priorLegs: FR24Leg[];
    // Deep link to FlightStats' details page for the user's own leg.
    // Only rendered on yourLeg when its state is 'mine' — priors are never
    // linked (per product decision: FlightStats fallback is scoped to the
    // user's scheduled flight before FR24 goes live). null when the scraper
    // couldn't resolve a URL, in which case the row shows no link.
    flightStatsUrl?: string | null;
  } = $props();

  // Unified state assignment for every leg in the rotation.
  //
  //   1. 'active' — FR24 is actively tracking this flight (ADS-B live), OR
  //      FR24 knows the flight is airborne but temporarily out of ADS-B
  //      coverage (over ocean, MEL'd transponder). Emerald border + tappable
  //      FR24 link. Physically only one leg per rotation can be here at a
  //      time (same aircraft, one live session), so no "pick one" tiebreak
  //      is needed.
  //   2. 'mine' — the user's own leg, and it isn't currently active. Blue
  //      border. Covers both pre-departure ("plane hasn't started boarding
  //      you yet") and post-landing ("you're on the ground, waiting for the
  //      6h server rule to hide the flight from the modal").
  //   3. 'landed' — a prior leg with an arrival timestamp that isn't
  //      currently live. Grey border — completed history.
  //   4. 'scheduled' — a prior leg with no timing data yet. No border.
  //
  // isMine controls font-weight independently of state (see RotationLegRow),
  // so the user's leg reads as "yours" in every state.
  const classify = (leg: FR24Leg, isMine: boolean): LegState => {
    if (leg.isLive || (leg.realDep && !leg.realArr)) return 'active';
    if (isMine) return 'mine';
    if (leg.realArr) return 'landed';
    return 'scheduled';
  };

  const yourLegState = $derived(classify(yourLeg, true));
</script>

<section class="space-y-1">
  <header class="flex items-baseline justify-between mb-2">
    <h3
      class="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
    >
      Today's rotation
    </h3>
    {#if yourLeg.tail}
      <span class="text-xs text-muted-foreground">
        Aircraft {yourLeg.tail}
      </span>
    {/if}
  </header>

  {#if priorLegs.length === 0}
    <p class="text-sm text-muted-foreground py-2">
      No earlier legs found for this aircraft today. Your flight is the first
      rotation we can see.
    </p>
  {:else}
    {#each priorLegs as leg, i (i)}
      <RotationLegRow {leg} state={classify(leg, false)} />
      <Separator />
    {/each}
  {/if}

  <RotationLegRow leg={yourLeg} state={yourLegState} isMine {flightStatsUrl} />
</section>
