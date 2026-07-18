<script lang="ts">
  import { Road } from '@o7/icon/lucide';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import * as Select from '$lib/components/ui/select';
  import type { RunwayEnd } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { isSmallScreen } from '$lib/utils/size';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<Infer<typeof flightSchema>>;
  } = $props();

  const { form: formData } = form;

  let open = $state(false);

  type Runway = { id: number; leIdent: string | null; heIdent: string | null };

  let departureRunways = $state<Runway[]>([]);
  let arrivalRunways = $state<Runway[]>([]);

  const load = (id: number | undefined, set: (runways: Runway[]) => void) => {
    if (!id) {
      set([]);
      return;
    }
    api.runway.getByAirport
      .query(id)
      .then(set)
      .catch(() => set([]));
  };

  // Guard against out-of-order responses: the cleanup runs before the effect
  // re-fires (or on unmount), so a stale in-flight request can't clobber state.
  $effect(() => {
    let cancelled = false;
    load($formData.from?.id, (r) => {
      if (!cancelled) departureRunways = r;
    });
    return () => (cancelled = true);
  });
  $effect(() => {
    let cancelled = false;
    load($formData.to?.id, (r) => {
      if (!cancelled) arrivalRunways = r;
    });
    return () => (cancelled = true);
  });

  // Each runway contributes both of its ends as separate options; the value
  // encodes the runway id and which end was chosen, e.g. "42:le".
  const toOptions = (runways: Runway[]) =>
    runways.flatMap((r) => [
      ...(r.leIdent ? [{ value: `${r.id}:le`, label: r.leIdent }] : []),
      ...(r.heIdent ? [{ value: `${r.id}:he`, label: r.heIdent }] : []),
    ]);

  const hasData = $derived(
    !!$formData.departureRunwayId || !!$formData.arrivalRunwayId,
  );
</script>

<Button
  size={$isSmallScreen ? 'sm' : 'icon-sm'}
  variant="outline"
  class={hasData ? 'border-primary text-primary' : ''}
  onclick={() => {
    open = true;
  }}
>
  <Road size={20} />
  {#if $isSmallScreen}
    Runways
  {/if}
</Button>

<Modal bind:open class="max-w-md" closeOnOutsideClick={false}>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Runways</h2>
  </ModalHeader>
  <ModalBody>
    <div class="grid gap-3">
      {#each [{ label: 'Departure', idField: 'departureRunwayId', endField: 'departureRunwayEnd', runways: departureRunways, airport: $formData.from }, { label: 'Arrival', idField: 'arrivalRunwayId', endField: 'arrivalRunwayEnd', runways: arrivalRunways, airport: $formData.to }] as section (section.label)}
        {@const options = toOptions(section.runways)}
        {@const current =
          $formData[section.idField] && $formData[section.endField]
            ? `${$formData[section.idField]}:${$formData[section.endField]}`
            : ''}
        <fieldset class="rounded-lg border px-3 pb-3 pt-2">
          <legend
            class="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {section.label}
          </legend>
          <Form.Field {form} name={section.idField} class="flex flex-col">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>Runway</Form.Label>
                <Select.Root
                  type="single"
                  value={current}
                  onValueChange={(value) => {
                    if (!value) {
                      $formData[section.idField] = null;
                      $formData[section.endField] = null;
                    } else {
                      const [id, end] = value.split(':');
                      $formData[section.idField] = Number(id);
                      $formData[section.endField] = end as RunwayEnd;
                    }
                  }}
                  allowDeselect
                >
                  <Select.Trigger {...props} disabled={!section.airport}>
                    {options.find((option) => option.value === current)
                      ?.label ??
                      (section.airport
                        ? 'Select runway'
                        : 'Select an airport first')}
                  </Select.Trigger>
                  <Select.Content>
                    {#each options as option (option.value)}
                      <Select.Item value={option.value} label={option.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </fieldset>
      {/each}
    </div>
  </ModalBody>
  <div class="flex justify-end gap-2 px-6 pb-4">
    <Button size="sm" onclick={() => (open = false)}>Done</Button>
  </div>
</Modal>
