<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirlineFormFields from './AirlineFormFields.svelte';

  import IconUploadField from '$lib/components/form-fields/IconUploadField.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Label } from '$lib/components/ui/label';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import {
    airlineSearchCache,
    clearAirlineLookupCaches,
  } from '$lib/utils/data/airlines';
  import { airlineSchema } from '$lib/zod/airline';

  let { open = $bindable(false), withoutTrigger } = $props();

  let pendingIconFile = $state<File | null>(null);

  async function uploadPendingIcon(airlineId: number) {
    if (!pendingIconFile) return;

    const formData = new FormData();
    formData.append('file', pendingIconFile);
    formData.append('airlineId', airlineId.toString());

    try {
      const response = await fetch('/api/airline/icon', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || 'Failed to upload icon');
      }
    } catch {
      toast.error('Failed to upload icon');
    }
  }

  const form = superForm(
    defaults<Infer<typeof airlineSchema>>(zod(airlineSchema)),
    {
      dataType: 'json',
      validators: zod(airlineSchema),
      async onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            // Upload pending icon if one was selected
            if (pendingIconFile && form.message.id) {
              await uploadPendingIcon(form.message.id);
            }
            pendingIconFile = null;
            trpc.airline.list.utils.invalidate();
            airlineSearchCache.clear();
            clearAirlineLookupCaches();
            open = false;
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
    <Plus size={16} class="shrink-0" />
    Create
  </Button>
{/if}

<Modal bind:open>
  <ModalBreadcrumbHeader section="Airlines" title="Add airline" icon={Plus} />
  <ModalBody>
    <form
      method="POST"
      action="/api/airline/save/form"
      class="grid gap-4"
      use:enhance
    >
      <AirlineFormFields {form} />
      <div class="space-y-2">
        <Label>Icon</Label>
        <IconUploadField
          currentIconPath={null}
          airlineId={null}
          pendingMode={true}
          bind:pendingFile={pendingIconFile}
        />
      </div>
      <Form.Button>Create</Form.Button>
    </form>
  </ModalBody>
</Modal>
