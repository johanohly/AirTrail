<script lang="ts">
  import { pluralize, type FlightData } from '$lib/utils';

  import { Switch } from '$lib/components/ui/switch';

  let {
    flights,
    seatUserId,
  }: {
    flights: FlightData[];
    seatUserId?: string;
  } = $props();

  /* Off compacts the map to the rows and columns actually sat in; on fills
     the gaps so the cabin's shape shows. Deliberately not persisted. */
  let includeEmpty = $state(false);

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

  const occupied = $derived.by(() => {
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

  const rows = $derived.by(() => {
    if (!includeEmpty || occupied.numbers.length === 0) {
      return { numbers: occupied.numbers, letters: occupied.letters };
    }

    // Every row between the first and last sat in, and every letter up to
    // the last one used — minus I, which seat maps skip so it can't be
    // misread as a 1, unless an I seat was actually recorded
    const skipI = !occupied.letters.includes('I');
    const filledLetters: string[] = [];
    for (
      let code = 'A'.charCodeAt(0);
      code <= occupied.letters.at(-1)!.charCodeAt(0);
      code++
    ) {
      const letter = String.fromCharCode(code);
      if (!(skipI && letter === 'I')) filledLetters.push(letter);
    }

    return {
      numbers: Array.from(
        {
          length: occupied.numbers.at(-1)! - occupied.numbers[0]! + 1,
        },
        (_, i) => occupied.numbers[0]! + i,
      ),
      letters: filledLetters,
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
  <div class="mb-2 flex items-center justify-between gap-3">
    <p class="text-[13px] text-muted-foreground">
      {seatCounts.size}
      {pluralize(seatCounts.size, 'seat')} across
      {occupied.numbers.length}
      {pluralize(occupied.numbers.length, 'row')}
    </p>
    <label class="flex items-center gap-2 text-[13px] text-muted-foreground">
      Show empty rows and columns
      <Switch
        checked={includeEmpty}
        onCheckedChange={(value) => (includeEmpty = value)}
      />
    </label>
  </div>
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
