<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';

  import AirlinePicker from '$lib/components/form-fields/AirlinePicker.svelte';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import CreateAirline from '$lib/components/modals/settings/pages/data-page/airline/CreateAirline.svelte';
  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Airline, Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { pluralize } from '$lib/utils';

  let {
    importedCount = 0,
    unknownAirports = {},
    unknownAirlines = {},
    unknownUsers = {},
    exportedUsers = [],
    busy = false,
    onreprocess,
    onclose,
  }: {
    importedCount?: number;
    unknownAirports?: Record<string, number[]>;
    unknownAirlines?: Record<string, number[]>;
    unknownUsers?: Record<string, number[]>;
    exportedUsers?: {
      id: string;
      username: string;
      displayName: string;
      mappedUserId: string | null;
    }[];
    busy?: boolean;
    onreprocess?: (
      airportMapping: Record<string, Airport>,
      airlineMapping: Record<string, Airline>,
      userMapping: Record<string, string>,
    ) => void;
    onclose?: () => void;
  } = $props();

  const unknownAirportCodes = $derived(Object.keys(unknownAirports));
  const unknownAirlineCodes = $derived(Object.keys(unknownAirlines));
  const unknownUserKeys = $derived(Object.keys(unknownUsers));
  const exportedUserEntries = $derived(
    exportedUsers.length
      ? exportedUsers
      : unknownUserKeys
          .map((key) => decodeUnknownUser(key))
          .map((u) => ({
            ...u,
            mappedUserId: null,
          })),
  );

  const usersPromise = api.user.list.query();

  let airportMapping: Record<string, Airport> = $state({});
  let airlineMapping: Record<string, Airline> = $state({});
  let userMapping: Record<string, string> = $state(
    Object.fromEntries(
      exportedUsers
        .filter((user) => user.mappedUserId)
        .map((user) => [user.id, user.mappedUserId!]),
    ),
  );
  const canReprocess = $derived(
    (Object.values(airportMapping).some(Boolean) ||
      Object.values(airlineMapping).some(Boolean) ||
      Object.values(userMapping).some(Boolean)) &&
      !busy,
  );
  const mappedAirportCount = $derived(Object.keys(airportMapping).length);
  const mappedAirlineCount = $derived(Object.keys(airlineMapping).length);
  const mappedUserCount = $derived(Object.keys(userMapping).length);

  let createAirport = $state(false);
  let createAirline = $state(false);

  const setAirportMapping = (code: string, airport: Airport | null) => {
    if (airport) {
      airportMapping[code] = airport;
    } else {
      delete airportMapping[code];
    }
  };

  const setAirlineMapping = (code: string, airline: Airline | null) => {
    if (airline) {
      airlineMapping[code] = airline;
    } else {
      delete airlineMapping[code];
    }
  };

  const decodeUnknownUser = (value: string) => {
    const [id, username, displayName] = value.split('|');
    return {
      id,
      username,
      displayName,
    };
  };

  const setUserMapping = (exportedUserId: string, mappedUserId: string) => {
    if (mappedUserId) {
      userMapping[exportedUserId] = mappedUserId;
    } else {
      delete userMapping[exportedUserId];
    }
  };

  const handleReprocess = () => {
    onreprocess?.(airportMapping, airlineMapping, userMapping);
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Import Status</h3>

  <Card class="p-4">
    <div class="flex items-start gap-3">
      <Check
        class="text-green-600 dark:text-green-500 mt-0.5 shrink-0"
        size={20}
      />
      <div class="flex-1">
        <p class="font-medium text-sm">Import Complete</p>
        <p class="text-sm text-muted-foreground mt-0.5">
          Successfully imported {importedCount}
          {pluralize(importedCount, 'flight')}
        </p>
      </div>
    </div>

    {#if unknownAirportCodes.length || unknownAirlineCodes.length || exportedUserEntries.length}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {unknownAirportCodes.length +
              unknownAirlineCodes.length +
              exportedUserEntries.length}
            Unknown {pluralize(
              unknownAirportCodes.length +
                unknownAirlineCodes.length +
                exportedUserEntries.length,
              'Mapping',
            )}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            Match unknown airports, airlines and users, then re-import.
          </p>
        </div>
      </div>

      <ScrollArea class="h-[28dvh] mt-4 pr-2">
        <div class="space-y-3">
          {#if unknownAirportCodes.length}
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Airports ({unknownAirportCodes.length})
              </p>
              {#each unknownAirportCodes as code (code)}
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-20 h-9 bg-muted/50 rounded-md border shrink-0"
                  >
                    <span class="text-sm font-mono font-medium">{code}</span>
                  </div>
                  <div class="flex-1">
                    <AirportPicker
                      placeholder="Search for airport..."
                      onchange={(airport) => setAirportMapping(code, airport)}
                      onCreateNew={() => (createAirport = true)}
                      disabled={busy}
                      compact
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          {#if unknownAirlineCodes.length}
            <div class="space-y-2" class:mt-4={unknownAirportCodes.length}>
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Airlines ({unknownAirlineCodes.length})
              </p>
              {#each unknownAirlineCodes as code (code)}
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-20 h-9 bg-muted/50 rounded-md border shrink-0"
                  >
                    <span class="text-sm font-mono font-medium">{code}</span>
                  </div>
                  <div class="flex-1">
                    <AirlinePicker
                      placeholder="Search for airline..."
                      onchange={(airline) => setAirlineMapping(code, airline)}
                      onCreateNew={() => (createAirline = true)}
                      disabled={busy}
                      compact
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          {#if exportedUserEntries.length}
            <div
              class="space-y-2"
              class:mt-4={unknownAirportCodes.length ||
                unknownAirlineCodes.length}
            >
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Users ({exportedUserEntries.length})
              </p>
              {#await usersPromise then users}
                {#each exportedUserEntries as unknownUser (unknownUser.id)}
                  <div class="flex items-center gap-3">
                    <div class="w-40 shrink-0">
                      <div class="text-sm font-medium">
                        {unknownUser.displayName}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        @{unknownUser.username}
                      </div>
                    </div>
                    <div class="flex-1">
                      <select
                        class="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        disabled={busy}
                        value={userMapping[unknownUser.id] ?? ''}
                        onchange={(event) =>
                          setUserMapping(
                            unknownUser.id,
                            (event.currentTarget as HTMLSelectElement).value,
                          )}
                      >
                        <option value="">Select local user...</option>
                        {#each users as user (user.id)}
                          <option value={user.id}
                            >{user.displayName} (@{user.username})</option
                          >
                        {/each}
                      </select>
                    </div>
                  </div>
                {/each}
              {/await}
            </div>
          {/if}
        </div>
      </ScrollArea>

      {#if mappedAirportCount > 0 || mappedAirlineCount > 0 || mappedUserCount > 0}
        <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
          <p class="text-xs text-muted-foreground">
            {#if mappedAirportCount > 0}
              {mappedAirportCount} of {unknownAirportCodes.length}
              {pluralize(unknownAirportCodes.length, 'airport')} mapped
            {/if}
            {#if mappedAirportCount > 0 && (mappedAirlineCount > 0 || mappedUserCount > 0)}
              <span class="mx-1">•</span>
            {/if}
            {#if mappedAirlineCount > 0}
              {mappedAirlineCount} of {unknownAirlineCodes.length}
              {pluralize(unknownAirlineCodes.length, 'airline')} mapped
            {/if}
            {#if mappedAirlineCount > 0 && mappedUserCount > 0}
              <span class="mx-1">•</span>
            {/if}
            {#if mappedUserCount > 0}
              {mappedUserCount} of {exportedUserEntries.length}
              {pluralize(exportedUserEntries.length, 'user')} mapped
            {/if}
          </p>
        </div>
      {/if}

      <div class="mt-4 flex flex-wrap gap-2">
        <Button
          onclick={handleReprocess}
          disabled={!canReprocess}
          class="flex-1 sm:flex-none"
        >
          Apply Mapping & Re-import
        </Button>
        <Button
          href="https://ourairports.com/"
          target="_blank"
          variant="outline"
          class="gap-1"
        >
          Search OurAirports
          <ExternalLink size={14} />
        </Button>
        <Button variant="ghost" onclick={() => onclose?.()} class="ml-auto">
          Close
        </Button>
      </div>
    {:else}
      <div class="mt-4 flex justify-end">
        <Button onclick={() => onclose?.()}>Done</Button>
      </div>
    {/if}
  </Card>
</div>

<CreateAirport bind:open={createAirport} withoutTrigger />
<CreateAirline bind:open={createAirline} withoutTrigger />
