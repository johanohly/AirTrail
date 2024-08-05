<script lang="ts">
  import { trpc } from "$lib/trpc";
  import { onMount } from "svelte";
  import { Dock, DockTooltipItem } from "$lib/components/dock";
  import { GitBranchPlus, Settings, LayoutList } from "@o7/icon/lucide";
  import { Separator } from "$lib/components/ui/separator";

  const PRIMARY = [
    {
      label: "Add flight",
      icon: GitBranchPlus
    },
    {
      label: "List flights",
      icon: LayoutList,
      href: "/flights"
    }
  ];
  const SECONDARY = [
    {
      label: "Settings",
      icon: Settings,
      href: "/settings"
    }
    /*{
      label: "FlightRadar24",
      icon: Radar,
      href: "https://flightradar24.com"
    }*/
  ];

  const { data } = $props();
  const user = data.user;
  const flights = trpc.flight.list.query();

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    }
  };
  const deleteFlight = trpc.flight.delete.mutation(invalidator);
</script>

{#if $flights.isSuccess}
  <div class="flex flex-col">
    {#each $flights.data as flight}
      <div class="flex items-center justify-between p-4 border-b border-zinc-900/10">
        <div class="flex items-center space-x-4">
          <p>{flight.from}</p>
          <p>{flight.to}</p>
        </div>
        <button
          class="text-red-500"
          onclick={() => $deleteFlight.mutate(flight.id)}
        >
          Delete
        </button>
      </div>
    {/each}
  </div>
{/if}

<div class="absolute bottom-6 left-1/2">
  <Dock
    let:mouseX
    let:distance
    let:magnification
  >
    {#each PRIMARY as item}
      <DockTooltipItem {item} {mouseX} {distance} {magnification} />
    {/each}
    <Separator orientation="vertical" class="h-full w-[0.6px]" />
    {#each SECONDARY as item}
      <DockTooltipItem {item} {mouseX} {distance} {magnification} />
    {/each}
  </Dock>
</div>
