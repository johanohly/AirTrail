<script lang="ts">
  import { FlightTakeoff, LocationOn, Flight } from '@o7/icon/material/solid';

  import { PageHeader } from '../';

  import Aircraft from './aircraft/Aircraft.svelte';
  import CustomAirports from './airport/CustomAirports.svelte';
  import UpdateFromSource from './UpdateFromSource.svelte';
  import StatCard from './StatCard.svelte';

  import type { Aircraft as AircraftType, Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { Card } from '$lib/components/ui/card';
  import { CardContent } from '$lib/components/ui/card/index.js';

  let numAirports: number | null = $state(null);
  let customAirports: Airport[] = $state([]);
  let aircraft: AircraftType[] = $state([]);

  const fetchAirports = async () => {
    const airportData = await api.airport.getData.query();
    numAirports = airportData.numAirports;
    customAirports = airportData.customAirports;
  };

  const fetchAircraft = async () => {
    aircraft = await api.aircraft.list.query();
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
    <Card>
      <CardContent>
        <div class="flex flex-col">
          <StatCard title="Airports" value={numAirports}>
            {#snippet icon()}
              <FlightTakeoff class="text-primary" />
            {/snippet}
          </StatCard>
          <StatCard title="Custom Airports" value={customAirports.length}>
            {#snippet icon()}
              <LocationOn class="text-primary" />
            {/snippet}
          </StatCard>
          <StatCard title="Aircraft" value={aircraft.length}>
            {#snippet icon()}
              <Flight class="text-primary" />
            {/snippet}
          </StatCard>
        </div>
      </CardContent>
    </Card>

    <UpdateFromSource {fetchAirports} />
    <CustomAirports bind:airports={customAirports} {fetchAirports} />
    <Aircraft bind:aircraft {fetchAircraft} />
  </div>
</PageHeader>
