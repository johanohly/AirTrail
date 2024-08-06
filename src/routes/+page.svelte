<script lang="ts">
  import { trpc } from "$lib/trpc";
  import { onMount } from "svelte";
  import { Dock, DockTooltipItem } from "$lib/components/dock";
  import { GitBranchPlus, Settings, LayoutList } from "@o7/icon/lucide";
  import { Separator } from "$lib/components/ui/separator";
  import { mode, toggleMode } from "mode-watcher";
  import { DeckGlLayer, MapLibre, Popup } from "svelte-maplibre";
  import { ArcLayer, IconLayer } from "@deck.gl/layers";
  import { distanceBetween, findByIata, linearClamped } from "$lib/utils";
  import { AIRPORTS } from "$lib/data/airports";
  import { toast } from "svelte-sonner";

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
  const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

  const style = $derived(
    $mode === "light"
      ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json");

  const flightArcs = $derived.by(() => {
      const data = $flights.data;
      if (!data) return [];

      return data.map((flight) => {
        const fromAirport = findByIata(flight.from);
        const toAirport = findByIata(flight.to);
        if (!fromAirport || !toAirport) return null;

        return {
          id: flight.id,
          distance: distanceBetween([fromAirport.lon, fromAirport.lat], [toAirport.lon, toAirport.lat]) / 1000,
          from: [fromAirport.lon, fromAirport.lat],
          to: [toAirport.lon, toAirport.lat],
          fromName: fromAirport.name,
          toName: toAirport.name
        };
      });
    }
  );

  const deleteFlight = async (fId: number) => {
    const toastId = toast.loading("Deleting flight...");
    try {
      const result = await $deleteFlightMutation.mutateAsync(fId);
      console.log(result);
    } catch (error) {
      console.error(typeof error, error);
    }
    toast.success("Flight deleted", { id: toastId });
  };
</script>

<div class="h-[100dvh]">
  <MapLibre
    {style}
    standardControls
  >
    <DeckGlLayer
      type={ArcLayer}
      data={flightArcs}
      getSourcePosition={(d) => d.from}
      getTargetPosition={(d) => d.to}
      getSourceColor={[255, 255, 255]}
      getTargetColor={[255, 255, 255]}
      getWidth={(d) => linearClamped(d.distance)}
      getHeight={0}
      greatCircle={true}
    >
      <Popup openOn="click" let:data>
        From {data.fromName} to {data.toName}
        <button onclick={deleteFlight(data.id)}>delete</button>
      </Popup>
    </DeckGlLayer>

    <DeckGlLayer
      type={IconLayer}
      data={AIRPORTS}
      getPosition={(d) => [d.lon, d.lat]}
      getIcon={(d) => "marker"}
      getColor={[255, 255, 255]}
      getSize={10}
      sizeScale={-2}
      iconAtlas="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png"
      iconMapping="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json"
    >
      <Popup openOn="click" let:data>
        {data.name}
      </Popup>
    </DeckGlLayer>
  </MapLibre>
</div>

<div class="absolute z-10">
  <button onclick={toggleMode}>Toggle</button>
</div>

<!--
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
-->

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
