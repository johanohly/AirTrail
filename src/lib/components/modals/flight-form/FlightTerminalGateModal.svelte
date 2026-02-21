<script lang="ts">
  import { ArrowUpRight } from '@o7/icon/lucide';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { isSmallScreen } from '$lib/utils/size';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<Infer<typeof flightSchema>>;
  } = $props();

  const { form: formData } = form;

  let open = $state(false);

  const hasData = $derived(
    !!$formData.departureTerminal ||
      !!$formData.departureGate ||
      !!$formData.arrivalTerminal ||
      !!$formData.arrivalGate,
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
  <ArrowUpRight size={20} />
  {#if $isSmallScreen}
    Terminal & Gate
  {/if}
</Button>

<Modal bind:open class="max-w-md" closeOnOutsideClick={false}>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Terminal & Gate</h2>
  </ModalHeader>
  <ModalBody>
    <div class="grid gap-3">
      {#each [{ label: 'Departure', terminal: 'departureTerminal', gate: 'departureGate', termPlaceholder: 'e.g. 2E', gatePlaceholder: 'e.g. A12' }, { label: 'Arrival', terminal: 'arrivalTerminal', gate: 'arrivalGate', termPlaceholder: 'e.g. 1', gatePlaceholder: 'e.g. B7' }] as section (section.label)}
        <fieldset class="rounded-lg border px-3 pb-3 pt-2">
          <legend
            class="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {section.label}
          </legend>
          <div class="grid grid-cols-2 gap-2">
            <Form.Field {form} name={section.terminal} class="flex flex-col">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Terminal</Form.Label>
                  <Input
                    bind:value={$formData[section.terminal]}
                    placeholder={section.termPlaceholder}
                    {...props}
                  />
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>
            <Form.Field {form} name={section.gate} class="flex flex-col">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Gate</Form.Label>
                  <Input
                    bind:value={$formData[section.gate]}
                    placeholder={section.gatePlaceholder}
                    {...props}
                  />
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>
          </div>
        </fieldset>
      {/each}
    </div>
  </ModalBody>
  <div class="flex justify-end gap-2 px-6 pb-4">
    <Button size="sm" onclick={() => (open = false)}>Done</Button>
  </div>
</Modal>
