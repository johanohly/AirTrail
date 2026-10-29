<script lang="ts">
  import { onMount } from 'svelte';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { AircraftField, AirlineField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import { appConfig } from '$lib/state.svelte';
  import { api } from '$lib/trpc';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
    flightId,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
    /** Present when editing an existing flight — photo updates are persisted. */
    flightId?: number;
  } = $props();
  const { form: formData } = form;

  const photosEnabled = $derived(
    appConfig.config?.integrations?.aircraftPhotosEnabled === true,
  );

  type PhotoDisplay = {
    link: string;
    thumbnailSrc: string;
    photographer: string;
  };

  let photo = $state<PhotoDisplay | null>(null);
  let photoLoading = $state(false);
  // Offline / air-gapped: hide the preview instead of a broken frame.
  let imgFailed = $state(false);
  $effect(() => {
    photo;
    imgFailed = false;
  });
  // The registration the current preview belongs to, so blur only reacts to changes.
  let fetchedReg = $state('');

  const rowToDisplay = (row: {
    photoLink: string;
    thumbnailUrl: string;
    photographer: string;
  }): PhotoDisplay => ({
    link: row.photoLink,
    thumbnailSrc: row.thumbnailUrl,
    photographer: row.photographer,
  });

  const previewReg = async (reg: string) => {
    if (flightId) {
      const row = await api.aircraft.refetchPhoto.mutate({ flightId, reg });
      photo = row ? rowToDisplay(row) : null;
    } else {
      // New flight, nothing to persist yet — ephemeral preview only.
      photo = (await api.aircraft.previewPhotoByReg.query(reg)) ?? null;
    }
  };

  const loadPhoto = async () => {
    const reg = $formData.aircraftReg?.trim() ?? '';
    fetchedReg = reg;
    if (!reg) return;
    photoLoading = true;
    try {
      if (flightId) {
        const row = await api.aircraft.getOrFetchPhoto.query(flightId);
        photo = row ? rowToDisplay(row) : null;
      } else {
        photo = (await api.aircraft.previewPhotoByReg.query(reg)) ?? null;
      }
    } catch {
      photo = null;
    } finally {
      photoLoading = false;
    }
  };

  onMount(() => {
    if (photosEnabled) void loadPhoto();
  });

  const onRegBlur = async () => {
    if (!photosEnabled) return;
    const reg = $formData.aircraftReg?.trim() ?? '';
    if (reg === fetchedReg) return;
    fetchedReg = reg;

    if (!reg || reg.length < 2) {
      photo = null;
      if (flightId) {
        // Registration cleared — drop the stored photo.
        try {
          await api.aircraft.refetchPhoto.mutate({ flightId, reg: null });
        } catch {
          // ignore
        }
      }
      return;
    }

    photoLoading = true;
    try {
      await previewReg(reg);
    } catch {
      photo = null;
    } finally {
      photoLoading = false;
    }
  };
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
            <Input
              bind:value={$formData.aircraftReg}
              onblur={onRegBlur}
              {...props}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    {#if photosEnabled && (photoLoading || (photo && !imgFailed))}
      <!-- Mirrors the aircraft/reg grid so the photo matches the
           registration input's column width exactly. -->
      <div class="grid grid-cols-[2fr_1fr] gap-2">
        <div></div>
        {#if photoLoading && !photo}
          <div class="h-20 w-full animate-pulse rounded-md bg-muted"></div>
        {:else if photo}
          <figure>
            <a href={photo.link} target="_blank" rel="noopener noreferrer">
              <img
                src={photo.thumbnailSrc}
                alt={`${fetchedReg || 'Aircraft'} — photo by ${photo.photographer}`}
                loading="lazy"
                onerror={() => (imgFailed = true)}
                class="h-20 w-full rounded-md border border-border/60 object-cover"
              />
            </a>
            <figcaption
              class="mt-1 text-[10px] leading-tight text-muted-foreground"
            >
              © {photo.photographer} /
              <a
                href={photo.link}
                target="_blank"
                rel="noopener noreferrer"
                class="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
              >
                Planespotters.net
              </a>
            </figcaption>
          </figure>
        {/if}
      </div>
    {/if}
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
