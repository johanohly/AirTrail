<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/stores';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { toTitleCase } from '$lib/utils';
  import { editUserSchema } from '$lib/zod/user';

  const form = superForm(
    defaults<Infer<typeof editUserSchema>>(
      $page.data.user,
      zod(editUserSchema),
    ),
    {
      resetForm: false,
      validators: zod(editUserSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            toast.success(form.message.text);
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;
</script>

<form method="POST" action="/api/users/edit" use:enhance>
  <Form.Field {form} name="username">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Username</Form.Label>
        <Input bind:value={$formData.username} {...props} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="displayName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Display Name</Form.Label>
        <Input bind:value={$formData.displayName} {...props} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="unit">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Unit of measurement</Form.Label>
        <Select.Root
          type="single"
          value={$formData.unit}
          onValueChange={(v) => {
            if (v) $formData.unit = v;
          }}
        >
          <Select.Trigger {...props}>
            {$formData.unit ? toTitleCase($formData.unit) : 'Select a unit'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="metric" label="Metric" />
            <Select.Item value="imperial" label="Imperial" />
          </Select.Content>
        </Select.Root>
        <input type="hidden" value={$formData.unit} name={props.name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Button class="mt-1">Save</Form.Button>
</form>
