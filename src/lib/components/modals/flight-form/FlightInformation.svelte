<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { AircraftField, AirlineField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import { appConfig } from '$lib/state.svelte';
  import type { flightSchema } from '$lib/zod/flight';

  import AircraftPhotoButton from './AircraftPhotoButton.svelte';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  // The photo button sits inside the Registration input, which is why that
  // column keeps a minimum width that fits a typical registration on phones.
  const photosEnabled = $derived(
    appConfig.config?.integrations?.aircraftPhotosEnabled ?? false,
  );

  // Every lookup can reach Planespotters, so wait until typing has settled.
  let photoReg = $state($formData.aircraftReg?.trim() ?? '');
  $effect(() => {
    const reg = $formData.aircraftReg?.trim() ?? '';
    const timer = setTimeout(() => (photoReg = reg), 500);
    return () => clearTimeout(timer);
  });
</script>

<section>
  <Separator class="mt-2 mb-3 max-md:hidden" />
  <div class="grid gap-4">
    <div class="grid grid-cols-[2fr_minmax(7.5rem,1fr)] gap-2">
      <AircraftField {form} />
      <Form.Field {form} name="aircraftReg" class="flex flex-col">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Registration</Form.Label>
            <div class="relative">
              <Input
                bind:value={$formData.aircraftReg}
                class={photosEnabled ? 'pr-9' : undefined}
                {...props}
              />
              {#if photosEnabled && photoReg}
                <div class="absolute inset-y-0 end-0.5 flex items-center">
                  <AircraftPhotoButton reg={photoReg} />
                </div>
              {/if}
            </div>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    <AirlineField {form} />
    <Form.Field {form} name="note">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Notes</Form.Label>
          <Textarea
            bind:value={$formData.note}
            class="resize-y h-20 min-h-10 max-h-32"
            {...props}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
</section>
