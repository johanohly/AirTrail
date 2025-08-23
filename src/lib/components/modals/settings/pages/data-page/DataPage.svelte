<script lang="ts">
  import { FlightTakeoff, LocationOn, Flight } from '@o7/icon/material/solid';

  import { PageHeader } from '../';

  import Aircraft from './aircraft/Aircraft.svelte';
  import CustomAirports from './airport/CustomAirports.svelte';
  import UpdateFromSource from './UpdateFromSource.svelte';

  import StatCard from '$lib/components/modals/settings/pages/data-page/StatCard.svelte';
  import type { Aircraft as AircraftType, Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';

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

  const zeros = (value: number) => {
    const maxLength = 13;
    const valueLength = value.toString().length;
    const zeroLength = maxLength - valueLength;

    return '0'.repeat(zeroLength);
  };
</script>

<PageHeader
  title="Data"
  subtitle="Manage custom airports, airlines and airplanes."
>
  <div class="flex flex-col gap-4">
    <div class="flex">
      <div
        class="flex flex-col justify-between rounded-3xl bg-zinc-50 dark:bg-dark-1 p-5"
      >
        <div class="flex flex-wrap gap-x-12">
          <div class="flex place-items-center gap-4 text-primary">
            <FlightTakeoff />
            <p>Airports</p>
          </div>

          <div class="relative text-center font-mono text-2xl font-semibold">
            <span class="text-[#DCDADA] dark:text-[#525252]"
              >{zeros(numAirports ?? 0)}</span
            ><span class="text-primary">{numAirports}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-12">
          <div class="flex place-items-center gap-4 text-primary">
            <LocationOn />
            <p>Custom Airports</p>
          </div>

          <div class="relative text-center font-mono text-2xl font-semibold">
            <span class="text-[#DCDADA] dark:text-[#525252]"
              >{zeros(customAirports.length)}</span
            ><span class="text-primary">{customAirports.length}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-12">
          <div class="flex place-items-center gap-4 text-primary">
            <Flight />
            <p>Aircraft</p>
          </div>

          <div class="relative text-center font-mono text-2xl font-semibold">
            <span class="text-[#DCDADA] dark:text-[#525252]"
              >{zeros(aircraft.length ?? 0)}</span
            ><span class="text-primary">{aircraft.length}</span>
          </div>
        </div>
      </div>
    </div>

    <UpdateFromSource {fetchAirports} />
    <CustomAirports bind:airports={customAirports} {fetchAirports} />
    <Aircraft bind:aircraft {fetchAircraft} />
  </div>
</PageHeader>
