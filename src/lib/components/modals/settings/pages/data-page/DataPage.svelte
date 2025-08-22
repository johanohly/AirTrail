<script lang="ts">
  import { FlightTakeoff, LocationOn } from '@o7/icon/material/solid';

  import { PageHeader } from '../';

  import CustomAirports from './airport/CustomAirports.svelte';
  import Aircraft from './aircraft/Aircraft.svelte';
  import UpdateFromSource from './UpdateFromSource.svelte';

  import StatCard from '$lib/components/modals/settings/pages/data-page/StatCard.svelte';
  import type { Aircraft as AircraftType, Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';

  let numAirports: number | null = $state(null);
  let customAirports: Airport[] = $state([]);
  let numAircraft: number | null = $state(null);
  let aircraft: AircraftType[] = $state([]);

  const fetchAirports = async () => {
    const airportData = await api.airport.getData.query();
    numAirports = airportData.numAirports;
    customAirports = airportData.customAirports;
  };

  const fetchAircraft = async () => {
    const aircraftData = await api.aircraft.getData.query();
    numAircraft = aircraftData.numAircraft;
    aircraft = aircraftData.aircraft;
  };

  $effect(() => {
    fetchAirports();
    fetchAircraft();
  });
</script>

<PageHeader
  title="Data"
  subtitle="Manage custom airports, airlines and airplanes."
>
  <div class="flex flex-col gap-4">
    <div class="flex gap-4">
      <StatCard title="Airports" value={numAirports}>
        {#snippet icon()}
          <FlightTakeoff class="text-primary" />
        {/snippet}
      </StatCard>
      <StatCard
        title="Custom Airports"
        value={numAirports ? customAirports.length : null}
      >
        {#snippet icon()}
          <LocationOn class="text-primary" />
        {/snippet}
      </StatCard>
      <StatCard title="Aircraft" value={numAircraft}>
        {#snippet icon()}
          <FlightTakeoff class="text-primary" />
        {/snippet}
      </StatCard>
    </div>
    <UpdateFromSource {fetchAirports} />
    <CustomAirports bind:airports={customAirports} {fetchAirports} />
    <Aircraft bind:aircraft {fetchAircraft} />
  </div>
</PageHeader>
