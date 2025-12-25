<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirportFormFields from './AirportFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import type { Airport } from '$lib/db/types';
  import { airportSearchCache } from '$lib/utils/data/airports/cache';
  import { airportSchema } from '$lib/zod/airport';

  let {
    open = $bindable(false),
    onAirportCreate,
    withoutTrigger = false,
  }: {
    open?: boolean;
    onAirportCreate?: (airport: Airport) => Promise<void>;
    withoutTrigger?: boolean;
  } = $props();

  const form = superForm(
    defaults<Infer<typeof airportSchema>>(zod(airportSchema)),
    {
      dataType: 'json',
      validators: zod(airportSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            open = false;
            airportSearchCache.clear();
            onAirportCreate?.({ ...form.data, custom: true });
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance } = form;
</script>

{#if !withoutTrigger}
  <Button variant="outline" onclick={() => (open = true)}>
    <Plus size={16} class="shrink-0 mr-2" />
    Create
  </Button>
{/if}

<Modal bind:open>
  <ModalBreadcrumbHeader section="Airports" title="Add airport" icon={Plus} />
  <form method="POST" action="/api/airport/save/form" use:enhance>
    <ModalBody>
      <div class="grid gap-4">
        <AirportFormFields {form} />
      </div>
    </ModalBody>
    <ModalFooter>
      <Form.Button>Create</Form.Button>
    </ModalFooter>
  </form>
</Modal>
