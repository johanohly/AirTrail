<script lang="ts">
  import { pluralize, type FlightData } from '$lib/utils';

  import { Switch } from '$lib/components/ui/switch';
  import { seatNumberDistribution } from '$lib/stats/aggregations';

  let {
    flights,
    seatUserId,
    onOpen,
  }: {
    flights: FlightData[];
    seatUserId?: string;
    onOpen?: (seat: string) => void;
  } = $props();

  /* Off compacts the map to the rows and columns actually sat in; on fills
     the gaps so the cabin's shape shows. Deliberately not persisted. */
  let includeEmpty = $state(false);

  const seatCounts = $derived(
    seatNumberDistribution(flights, { userId: seatUserId }),
  );

  const occupied = $derived.by(() => {
    const numbers = new Set<number>();
    const letters = new Set<string>();
    for (const seat of Object.keys(seatCounts)) {
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

    // Every row from the front of the cabin (1) to the last sat in, and
    // every letter up to the last one used — minus I, which seat maps skip
    // so it can't be misread as a 1, unless an I seat was actually recorded
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

    const firstRow = Math.min(1, occupied.numbers[0]!);
    return {
      numbers: Array.from(
        { length: occupied.numbers.at(-1)! - firstRow + 1 },
        (_, i) => firstRow + i,
      ),
      letters: filledLetters,
    };
  });

  const occupiedSeatCount = $derived(Object.keys(seatCounts).length);
  const maxCount = $derived(Math.max(0, ...Object.values(seatCounts)));

  /* Brightness follows how often the seat was taken, so repeats stand out */
  const seatStyle = (count: number) => {
    const intensity = 60 + Math.round((count / maxCount) * 40);
    return `background-color: color-mix(in oklab, var(--primary) ${intensity}%, transparent)`;
  };
</script>

{#if occupiedSeatCount === 0}
  <p class="py-3 text-sm text-muted-foreground">No seat numbers recorded yet</p>
{:else}
  <div class="mb-2 flex items-center justify-between gap-3">
    <p class="text-[13px] text-muted-foreground">
      {occupiedSeatCount}
      {pluralize(occupiedSeatCount, 'seat')} across
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
            {@const count = seatCounts[seat] ?? 0}
            {#if count > 0}
              <button
                type="button"
                class="flex h-7 w-9 cursor-pointer items-center justify-center rounded-sm text-[13px] font-semibold text-primary-foreground outline-none transition-[filter] hover:brightness-110 focus-visible:ring-1 focus-visible:ring-ring"
                style={seatStyle(count)}
                title="{seat} · {count}×"
                onclick={() => onOpen?.(seat)}
              >
                {letter}
              </button>
            {:else}
              <div class="h-7 w-9 rounded-sm bg-muted" title={seat}></div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}
