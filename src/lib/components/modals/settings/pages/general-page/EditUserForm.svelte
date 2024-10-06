<script lang="ts">
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { editUserSchema } from '$lib/zod/user';
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { toTitleCase } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import { page } from '$app/stores';

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
    <Form.Control let:attrs>
      <Form.Label>Username</Form.Label>
      <Input bind:value={$formData.username} {...attrs} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="displayName">
    <Form.Control let:attrs>
      <Form.Label>Display Name</Form.Label>
      <Input bind:value={$formData.displayName} {...attrs} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="unit">
    <Form.Control let:attrs>
      <Form.Label>Unit of measurement</Form.Label>
      <Select.Root
        selected={{
          label: toTitleCase($formData.unit),
          value: $formData.unit,
        }}
        onSelectedChange={(v) => {
          v && ($formData.unit = v.value);
        }}
      >
        <Select.Trigger {...attrs}>
          <Select.Value placeholder="Select a unit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="metric" label="Metric" />
          <Select.Item value="imperial" label="Imperial" />
        </Select.Content>
      </Select.Root>
      <input type="hidden" value={$formData.unit} name={attrs.name} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Button class="mt-1">Save</Form.Button>
</form>
