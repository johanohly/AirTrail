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
      .catch(() => {});
  };

  // Clear a selected runway that no longer belongs to the chosen airport (e.g.
  // the airport was changed or cleared after picking a runway). Runway ids are
  // globally unique to one airport, so changing the airport always drops the
  // previous runway — even when the new airport has a runway of the same
  // number/ident.
  const dropStaleRunway = (
    runways: Runway[],
    idField: 'departureRunwayId' | 'arrivalRunwayId',
    endField: 'departureRunwayEnd' | 'arrivalRunwayEnd',
  ) => {
    const id = $formData[idField];
    if (id != null && !runways.some((r) => r.id === id)) {
      $formData[idField] = null;
      $formData[endField] = null;
    }
  };

  // Guard against out-of-order responses: the cleanup runs before the effect
  // re-fires (or on unmount), so a stale in-flight request can't clobber state.
  $effect(() => {
    let cancelled = false;
    load($formData.from?.id, (r) => {
      if (cancelled) return;
      departureRunways = r;
      dropStaleRunway(r, 'departureRunwayId', 'departureRunwayEnd');
    });
    return () => (cancelled = true);
  });
  $effect(() => {
    let cancelled = false;
    load($formData.to?.id, (r) => {
      if (cancelled) return;
      arrivalRunways = r;
      dropStaleRunway(r, 'arrivalRunwayId', 'arrivalRunwayEnd');
    });
    return () => (cancelled = true);
  });

  // Runway idents look like "16", "16L", "34R" — a heading number (01–36) with
  // an optional L/C/R side. Sort ends by number, then side, so parallel ends
  // group together, e.g. 16L, 16R, 34L, 34R.
  const SIDE_ORDER: Record<string, number> = { '': 0, L: 1, C: 2, R: 3 };
  const identKey = (ident: string) => {
    const m = /^(\d{1,2})\s*([LCR]?)/.exec(ident);
    return { num: m ? Number(m[1]) : 0, side: SIDE_ORDER[m?.[2] ?? ''] ?? 0 };
  };

  // Each runway contributes both of its ends as separate options; the value
  // encodes the runway id and which end was chosen, e.g. "42:le".
  const toOptions = (runways: Runway[]) =>
    runways
      .flatMap((r) => [
        ...(r.leIdent ? [{ value: `${r.id}:le`, label: r.leIdent }] : []),
        ...(r.heIdent ? [{ value: `${r.id}:he`, label: r.heIdent }] : []),
      ])
      .sort((a, b) => {
        const ka = identKey(a.label);
        const kb = identKey(b.label);
        return ka.num - kb.num || ka.side - kb.side;
      });

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
                        ? `Select ${section.label.toLowerCase()} runway`
                        : `Select ${section.label.toLowerCase()} airport first`)}
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
