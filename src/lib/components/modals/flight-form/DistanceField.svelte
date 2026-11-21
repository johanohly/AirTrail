<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';

  import { page } from '$app/state';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { measureTrackDistance } from '$lib/track/distance';
  import { resolveFlightDistance } from '$lib/utils/flight-distance';
  import {
    convertDistance,
    distanceToKm,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';
  import type { FlightFormData } from '$lib/zod/flight';

  let { form }: { form: SuperForm<FlightFormData> } = $props();
  const { form: formData } = form;

  const prefs = $derived(getPreferences(page.data.user));

  // What the flight gets when the field is left empty, so the placeholder
  // shows it.
  const automaticKm = $derived.by(() => {
    const { from, to, track } = $formData;
    return (
      resolveFlightDistance({
        from,
        to,
        manualDistance: null,
        trackDistance: track ? measureTrackDistance(track) : null,
      })?.km ?? null
    );
  });

  const placeholder = $derived(
    automaticKm === null
      ? undefined
      : Math.round(convertDistance(automaticKm, prefs)).toString(),
  );

  // The form stores km. Rounding away the unit conversion's float error keeps
  // a typed value as it was typed.
  const getValue = () => {
    const km = $formData.manualDistance;
    return typeof km === 'number'
      ? Math.round(convertDistance(km, prefs) * 1e6) / 1e6
      : null;
  };
  const setValue = (value: number | null) => {
    $formData.manualDistance =
      typeof value === 'number' && Number.isFinite(value)
        ? distanceToKm(value, prefs)
        : null;
  };
</script>

<Form.Field {form} name="manualDistance" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Distance</Form.Label>
      <div class="relative">
        <Input
          type="number"
          inputmode="decimal"
          min="0"
          step="any"
          {placeholder}
          bind:value={getValue, setValue}
          class="pr-10"
          {...props}
        />
        <span
          class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground"
        >
          {distanceUnitLabel(prefs)}
        </span>
      </div>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
