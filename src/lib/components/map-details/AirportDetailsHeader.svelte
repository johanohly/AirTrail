<script lang="ts">
  import type { prepareVisitedAirports } from '$lib/utils';

  type VisitedAirport = ReturnType<typeof prepareVisitedAirports>[number];

  let { airport }: { airport: VisitedAirport } = $props();
</script>

<div class="flex items-start gap-3 px-4 py-4">
  <img
    src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
    alt={airport.country}
    class="h-8 w-11 shrink-0 rounded object-cover shadow-sm"
  />
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline gap-1.5">
      <span class="text-2xl leading-none font-semibold tracking-tight">
        {airport.iata ?? airport.icao}
      </span>
      {#if airport.iata}
        <span class="font-mono text-xs leading-none text-muted-foreground">
          {airport.icao}
        </span>
      {/if}
    </div>
    <h2 class="mt-1 truncate text-sm leading-tight font-medium">
      {airport.name}
    </h2>
    <p class="mt-0.5 truncate text-xs text-muted-foreground">
      {airport.municipality
        ? `${airport.municipality}, ${airport.country}`
        : airport.country}
    </p>
  </div>
</div>
