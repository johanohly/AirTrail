<script lang="ts">
  import { pluralize, type FlightData } from '$lib/utils';

  let {
    flights,
    seatUserId,
  }: {
    flights: FlightData[];
    seatUserId?: string;
  } = $props();

  const seatCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const flight of flights) {
      const passengers = seatUserId
        ? flight.passengers.filter((p) => p.userId === seatUserId)
        : flight.passengers;
      for (const { seatNumber } of passengers) {
        const match = seatNumber?.trim().match(/^(\d{1,3})\s*([A-Z])$/i);
        if (!match) continue;

        const seat = `${match[1]}${match[2]!.toUpperCase()}`;
        counts.set(seat, (counts.get(seat) ?? 0) + 1);
      }
    }
    return counts;
  });

  const rows = $derived.by(() => {
    const numbers = new Set<number>();
    const letters = new Set<string>();
    for (const seat of seatCounts.keys()) {
      numbers.add(Number(seat.slice(0, -1)));
      letters.add(seat.at(-1)!);
    }
    return {
      numbers: [...numbers].sort((a, b) => a - b),
      letters: [...letters].sort(),
    };
  });

  const maxCount = $derived(Math.max(0, ...seatCounts.values()));

  /* Brightness follows how often the seat was taken, so repeats stand out */
  const seatStyle = (count: number) => {
    const intensity = 60 + Math.round((count / maxCount) * 40);
    return `background-color: color-mix(in oklab, var(--primary) ${intensity}%, transparent)`;
  };
</script>

{#if seatCounts.size === 0}
  <p class="py-3 text-sm text-muted-foreground">No seat numbers recorded yet</p>
{:else}
  <p class="mb-2 text-[13px] text-muted-foreground">
    {seatCounts.size}
    {pluralize(seatCounts.size, 'seat')} across
    {rows.numbers.length}
    {pluralize(rows.numbers.length, 'row')}
  </p>
  <div class="overflow-x-auto pb-1">
    <div class="flex w-fit flex-col gap-1">
      <div class="flex gap-1">
        <div class="w-8 shrink-0"></div>
        {#each rows.letters as letter (letter)}
          <div class="w-9 text-center text-[13px] text-muted-foreground">
            {letter}
          </div>
        {/each}
      </div>
      {#each rows.numbers as rowNumber (rowNumber)}
        <div class="flex items-center gap-1">
          <div
            class="w-8 shrink-0 text-right text-[13px] text-muted-foreground"
          >
            {rowNumber}
          </div>
          {#each rows.letters as letter (letter)}
            {@const seat = `${rowNumber}${letter}`}
            {@const count = seatCounts.get(seat) ?? 0}
            <div
              class="flex h-7 w-9 items-center justify-center rounded-sm text-[13px] font-semibold"
              class:bg-muted={count === 0}
              class:text-primary-foreground={count > 0}
              style={count > 0 ? seatStyle(count) : ''}
              title={count > 0 ? `${seat} · ${count}×` : seat}
            >
              {#if count > 0}{letter}{/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}
