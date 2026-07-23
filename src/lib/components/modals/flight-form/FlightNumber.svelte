<script lang="ts">
  import { TZDate } from '@date-fns/tz';
  import {
    format,
    isToday,
    isTomorrow,
    isYesterday,
    parseJSON,
  } from 'date-fns';
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { appConfig } from '$lib/state.svelte';
  import { api } from '$lib/trpc';
  import {
    formatDate,
    formatTime,
    getPreferences,
  } from '$lib/utils/preferences';
  import type { flightSchema } from '$lib/zod/flight';

  import FlightMergeConflictModal from './FlightMergeConflictModal.svelte';
  import {
    buildMergeFieldStates,
    FORM_DATE_FORMAT,
    getFetchedSources,
    isConflict,
    type MergeChoice,
    type MergeField,
    type MergeFieldKey,
  } from './merge-fields';

  const prefs = $derived(getPreferences(page.data.user));

  const resultDateLabel = (date: TZDate) =>
    formatDate(date, prefs, date.timeZone);
  const resultRelativeLabel = (date: TZDate) => {
    if (isYesterday(date)) return 'Yesterday';
    if (isTomorrow(date)) return 'Tomorrow';
    return null;
  };

  type FlightFormData = z.infer<typeof flightSchema>;
  type TimetableTab = 'scheduled' | 'actual';

  let {
    form,
    onLookupApplied = () => {},
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
    onLookupApplied?: (preferredTab: TimetableTab) => void;
  } = $props();
  const { form: formData } = form;

  // Result type after parsing - uses TZDate for timezone-aware dates
  type LookupResult = {
    from: FlightFormData['from'];
    to: FlightFormData['to'];
    departure: TZDate | null;
    arrival: TZDate | null;
    departureScheduled: TZDate | null;
    arrivalScheduled: TZDate | null;
    departureTz?: string | null;
    arrivalTz?: string | null;
    airline: FlightFormData['airline'];
    aircraft: FlightFormData['aircraft'];
    aircraftReg?: FlightFormData['aircraftReg'];
    departureTerminal?: FlightFormData['departureTerminal'];
    departureGate?: FlightFormData['departureGate'];
    arrivalTerminal?: FlightFormData['arrivalTerminal'];
    arrivalGate?: FlightFormData['arrivalGate'];
  };

  let lookupResults: LookupResult[] | null = $state(null);
  let isSearching = $state(false);
  let isApplying = $state(false);

  // When set, the merge-conflict picker is shown; `resolve` returns the user's
  // per-field choices, or null if they cancelled.
  let mergeState = $state<{
    fields: MergeField[];
    applied: MergeField[];
    resolve: (choices: Record<string, MergeChoice> | null) => void;
  } | null>(null);

  function clearResults() {
    lookupResults = null;
  }

  function isFutureFlight(result: LookupResult): boolean {
    const referenceDate =
      result.departureScheduled ??
      result.departure ??
      result.arrivalScheduled ??
      result.arrival ??
      null;

    if (!referenceDate) return false;
    return referenceDate.getTime() > Date.now();
  }

  function getPreferredTimetableTab(result: LookupResult): TimetableTab | null {
    const futureFlight = isFutureFlight(result);
    const hasActualTimes = !!(
      result.departure &&
      result.arrival &&
      !futureFlight
    );
    const hasScheduledTimes = !!(
      result.departureScheduled ||
      result.arrivalScheduled ||
      (futureFlight && (result.departure || result.arrival))
    );

    if (hasActualTimes) return 'actual';
    if (hasScheduledTimes) return 'scheduled';
    return null;
  }

  /** Writes a single fetched field into the form. */
  function applyField(
    key: MergeFieldKey,
    result: LookupResult,
    aircraft: FlightFormData['aircraft'],
    sources: ReturnType<typeof getFetchedSources>,
  ) {
    const setDateTime = (
      source: TZDate,
      dateField:
        | 'departure'
        | 'arrival'
        | 'departureScheduled'
        | 'arrivalScheduled',
      timeField:
        | 'departureTime'
        | 'arrivalTime'
        | 'departureScheduledTime'
        | 'arrivalScheduledTime',
    ) => {
      $formData[dateField] = format(source, FORM_DATE_FORMAT);
      $formData[timeField] = formatTime(source, prefs, source.timeZone);
    };

    switch (key) {
      case 'from':
        $formData.from = result.from;
        break;
      case 'to':
        $formData.to = result.to;
        break;
      case 'airline':
        $formData.airline = result.airline ?? null;
        break;
      case 'aircraft':
        $formData.aircraft = aircraft;
        break;
      case 'aircraftReg':
        $formData.aircraftReg = result.aircraftReg ?? null;
        break;
      case 'departure':
        if (sources.departure)
          setDateTime(sources.departure, 'departure', 'departureTime');
        break;
      case 'arrival':
        if (sources.arrival)
          setDateTime(sources.arrival, 'arrival', 'arrivalTime');
        break;
      case 'departureScheduled':
        if (sources.departureScheduled)
          setDateTime(
            sources.departureScheduled,
            'departureScheduled',
            'departureScheduledTime',
          );
        break;
      case 'arrivalScheduled':
        if (sources.arrivalScheduled)
          setDateTime(
            sources.arrivalScheduled,
            'arrivalScheduled',
            'arrivalScheduledTime',
          );
        break;
      case 'departureTerminal':
        $formData.departureTerminal = result.departureTerminal ?? null;
        break;
      case 'departureGate':
        $formData.departureGate = result.departureGate ?? null;
        break;
      case 'arrivalTerminal':
        $formData.arrivalTerminal = result.arrivalTerminal ?? null;
        break;
      case 'arrivalGate':
        $formData.arrivalGate = result.arrivalGate ?? null;
        break;
    }
  }

  async function applyLookupResult(result: LookupResult) {
    if (!result) return;

    let aircraft = result.aircraft ?? null;
    if (!aircraft && result.aircraftReg) {
      isApplying = true;
      try {
        aircraft = await api.flight.lookupAircraftByReg.query(
          result.aircraftReg,
        );
      } catch {
        // ignore, this field is not required
      }
      isApplying = false;
    }

    const sources = getFetchedSources(result, isFutureFlight(result));
    const states = buildMergeFieldStates({
      current: $formData,
      result,
      aircraft,
      sources,
      formatTime: (date) => formatTime(date, prefs, date.timeZone),
    });

    // Conflicts (a value on both sides that differ) are resolved by the user;
    // everything else the lookup provides is applied automatically. Fields the
    // lookup has no value for are left untouched.
    const toField = ({
      key,
      label,
      currentDisplay,
      fetchedDisplay,
    }: MergeField): MergeField => ({
      key,
      label,
      currentDisplay,
      fetchedDisplay,
    });
    const conflicts = states.filter(isConflict);
    // Non-conflicting fetched values that will be applied automatically.
    const applied = states.filter((s) => s.fetchedPresent && !isConflict(s));

    let choices: Record<string, MergeChoice> = {};
    if (conflicts.length > 0) {
      const resolved = await new Promise<Record<string, MergeChoice> | null>(
        (resolve) => {
          mergeState = {
            fields: conflicts.map(toField),
            applied: applied.map(toField),
            resolve,
          };
        },
      );
      mergeState = null;
      if (!resolved) return;
      choices = resolved;
    }

    for (const state of states) {
      if (!state.fetchedPresent) continue;
      if (isConflict(state) && choices[state.key] !== 'fetched') continue;
      applyField(state.key, result, aircraft, sources);
    }

    const preferredTimetableTab = getPreferredTimetableTab(result);

    if (preferredTimetableTab) {
      onLookupApplied(preferredTimetableTab);
    }

    clearResults();
    toast.success('Flight found');
  }

  function getPrimaryDate(item: LookupResult): TZDate | null {
    return item.departure ?? item.arrival ?? null;
  }

  const lookupFlight = async () => {
    if (!$formData.flightNumber) {
      return;
    }

    isSearching = true;
    clearResults();

    const normalizedFlightNumber = $formData.flightNumber
      .trim()
      .replace(/\s/g, '');

    let results: LookupResult[] = [];
    try {
      const tempResults = await api.flight.lookup.query({
        flightNumber: normalizedFlightNumber,
        date: $formData.departure ?? undefined,
      });
      results = tempResults.map((r) => ({
        ...r,
        airline: r.airline ?? null,
        aircraft: r.aircraft ?? null,
        departure: r.departure
          ? new TZDate(parseJSON(r.departure), r.departureTz ?? 'UTC')
          : null,
        arrival: r.arrival
          ? new TZDate(parseJSON(r.arrival), r.arrivalTz ?? 'UTC')
          : null,
        departureScheduled: r.departureScheduled
          ? new TZDate(parseJSON(r.departureScheduled), r.departureTz ?? 'UTC')
          : null,
        arrivalScheduled: r.arrivalScheduled
          ? new TZDate(parseJSON(r.arrivalScheduled), r.arrivalTz ?? 'UTC')
          : null,
      }));
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Error looking up flight';
      toast.error(message);
      isSearching = false;
      return;
    }

    isSearching = false;

    if (!Array.isArray(results) || results.length === 0) {
      toast.error('Flight not found');
      return;
    }

    if (results.length === 1 && results[0]) {
      applyLookupResult(results[0]);
      return;
    }

    // Sort results by datetime ascending (oldest first)
    const sorted = results.slice().sort((a, b) => {
      const da = getPrimaryDate(a);
      const db = getPrimaryDate(b);

      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;

      return da.getTime() - db.getTime();
    });

    lookupResults = sorted;
    toast.info('Multiple flights found. Please choose one.');
  };
</script>

<Form.Field {form} name="flightNumber">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label class="flex gap-2">
        Flight Number
        {#if appConfig.configured?.integrations.aeroDataBoxKey}
          <HelpTooltip
            text="If you set the departure date before searching, it will be considered when searching for flights."
          />
        {:else}
          <HelpTooltip>
            {#snippet content()}
              For more detailed results, configure the <a
                href="https://airtrail.johan.ohly.dk/docs/integrations/aerodatabox"
                target="_blank">AeroDataBox integration.</a
              >
            {/snippet}
          </HelpTooltip>
        {/if}
      </Form.Label>
      <div class="grid grid-cols-[1fr_auto] gap-2">
        <Input
          bind:value={$formData.flightNumber}
          oninput={(e) => {
            lookupResults = null;
            $formData.flightNumber = e.currentTarget.value
              .replace(/\s/g, '')
              .toUpperCase();
          }}
          {...props}
        />
        <Button
          onclick={lookupFlight}
          disabled={!$formData.flightNumber || isSearching || isApplying}
          variant="secondary"
          class="h-full"
          >{isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if lookupResults && lookupResults.length > 1}
  <div class="mt-3 space-y-2">
    <div
      class="flex items-center justify-between text-sm text-muted-foreground"
    >
      <span>Select your flight</span>
      <Button
        variant="ghost"
        size="sm"
        onclick={clearResults}
        disabled={isApplying}>Clear</Button
      >
    </div>

    <div class="space-y-1.5">
      {#each lookupResults as r}
        {@const primaryDate = getPrimaryDate(r)}
        {@const isFlightToday = primaryDate && isToday(primaryDate)}
        <button
          onclick={() => applyLookupResult(r)}
          disabled={isApplying}
          class="group w-full rounded-lg border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-sm active:scale-[0.98] {isFlightToday
            ? 'border-primary/40 bg-primary/5'
            : ''}"
        >
          <div class="flex gap-3">
            <div
              class="flex flex-col items-center justify-center rounded-md border px-2.5 py-2 {isFlightToday
                ? 'border-primary/70 bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-muted/50'} flex-shrink-0"
            >
              {#if primaryDate}
                <div class="text-xs font-bold leading-none tabular-nums">
                  {resultDateLabel(primaryDate)}
                </div>
              {:else}
                <div class="text-xs">?</div>
              {/if}
            </div>

            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-baseline gap-1.5">
                {#if isFlightToday}
                  <span
                    class="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground"
                  >
                    Today
                  </span>
                {:else if primaryDate && resultRelativeLabel(primaryDate)}
                  <span class="text-xs font-medium text-muted-foreground">
                    {resultRelativeLabel(primaryDate)}
                  </span>
                {/if}
              </div>

              <div class="font-semibold text-base leading-tight">
                {r.from?.iata ?? r.from?.icao ?? '?'} → {r.to?.iata ??
                  r.to?.icao ??
                  '?'}
              </div>

              {#if r.departure && r.arrival}
                <div
                  class="text-sm font-medium tabular-nums text-muted-foreground"
                >
                  {formatTime(r.departure, prefs, r.departure.timeZone)} – {formatTime(
                    r.arrival,
                    prefs,
                    r.arrival.timeZone,
                  )}
                </div>
              {/if}

              <div class="text-xs text-muted-foreground truncate">
                {r.airline?.name ?? r.airline?.icao ?? 'Unknown'}
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if mergeState}
  <FlightMergeConflictModal
    open={true}
    fields={mergeState.fields}
    applied={mergeState.applied}
    onResolve={(choices) => mergeState?.resolve(choices)}
    onCancel={() => mergeState?.resolve(null)}
  />
{/if}
