<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirlineFormFields from './AirlineFormFields.svelte';

  import IconUploadField from '$lib/components/form-fields/IconUploadField.svelte';
  import { SquarePen } from '@o7/icon/lucide';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import { Label } from '$lib/components/ui/label';
  import type { Airline } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { airlineSchema } from '$lib/zod/airline';

  let {
    airline,
    open = $bindable(false),
  }: {
    airline: Airline | null;
    open: boolean;
  } = $props();

  let currentIconPath = $state<string | null>(null);

  const form = superForm(
    defaults<Infer<typeof airlineSchema>>(zod(airlineSchema)),
    {
      dataType: 'json',
      id: 'edit-airline',
      validators: zod(airlineSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.airline.list.utils.invalidate();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance, form: formData } = form;

  // Reset form data when airline changes
  $effect(() => {
    if (airline) {
      $formData = {
        id: airline.id,
        name: airline.name,
        icao: airline.icao,
        iata: airline.iata,
        iconPath: airline.iconPath,
      };
      currentIconPath = airline.iconPath;
    }
  });

  const handleIconUpload = (path: string) => {
    currentIconPath = path;
    trpc.airline.list.utils.invalidate();
  };

  const handleIconRemove = () => {
    currentIconPath = null;
    trpc.airline.list.utils.invalidate();
  };
</script>

<Modal bind:open closeOnOutsideClick={false} class="max-w-lg">
  <ModalBreadcrumbHeader
    section="Airlines"
    title="Edit airline"
    icon={SquarePen}
  />
  <ModalBody>
    <form
      method="POST"
      action="/api/airline/save/form"
      use:enhance
      class="grid gap-4"
    >
      <AirlineFormFields {form} />
      <div class="space-y-2">
        <Label>Icon</Label>
        <IconUploadField
          {currentIconPath}
          airlineId={airline?.id ?? null}
          onUpload={handleIconUpload}
          onRemove={handleIconRemove}
        />
      </div>
      <Form.Button>Save</Form.Button>
    </form>
  </ModalBody>
</Modal>
