<script lang="ts">
  import { Camera } from '@o7/icon/lucide';
  import { derived, writable } from 'svelte/store';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { AircraftField, AirlineField } from '$lib/components/form-fields';
  import AircraftPhotoCard from '$lib/components/map-details/AircraftPhotoCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { Separator } from '$lib/components/ui/separator';
  import { appConfig } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { PHOTO_BROWSER_CACHE_MS } from '$lib/zod/aircraft-photo';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  // Every lookup can reach Planespotters, so wait until typing has settled.
  let photoReg = $state($formData.aircraftReg?.trim() ?? '');
  $effect(() => {
    const reg = $formData.aircraftReg?.trim() ?? '';
    const timer = setTimeout(() => (photoReg = reg), 500);
    return () => clearTimeout(timer);
  });

  const photoRegStore = writable('');
  $effect(() => {
    photoRegStore.set(photoReg);
  });

  // Plain option objects are snapshotted by trpc-svelte-query, so derive them
  // to keep `enabled` reactive while the registration is being typed.
  const photoQuery = trpc.aircraft.getPhoto.query(
    photoRegStore,
    derived(photoRegStore, ($reg) => ({
      staleTime: PHOTO_BROWSER_CACHE_MS,
      gcTime: PHOTO_BROWSER_CACHE_MS,
      refetchOnWindowFocus: false,
      enabled: !!$reg,
    })),
  );
  const hasPhoto = $derived($photoQuery.data?.status === 'found');

  let photoOpen = $state(false);
  const showPhotoButton = $derived(
    !!photoReg &&
      !!appConfig.config?.integrations?.aircraftPhotosEnabled &&
      hasPhoto,
  );
</script>

<section>
  <Separator class="mt-2 mb-3 max-md:hidden" />
  <div class="grid gap-4">
    <div class="grid grid-cols-[2fr_1fr] gap-2">
      <AircraftField {form} />
      <Form.Field {form} name="aircraftReg" class="flex flex-col">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Registration</Form.Label>
            <div class="relative">
              <Input
                bind:value={$formData.aircraftReg}
                class={showPhotoButton ? 'pr-9' : ''}
                {...props}
              />
              {#if showPhotoButton}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="View aircraft photo"
                  title="View aircraft photo"
                  class="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onclick={() => (photoOpen = true)}
                >
                  <Camera size={16} />
                </Button>
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

  <Modal bind:open={photoOpen} class="max-w-lg">
    <ModalHeader>
      <h2 class="text-lg font-medium">{photoReg}</h2>
    </ModalHeader>
    <ModalBody>
      <AircraftPhotoCard reg={photoReg} />
    </ModalBody>
  </Modal>
</section>
