<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { addUserSchema } from '$lib/zod/user';
  import { zod } from 'sveltekit-superforms/adapters';
  import { toast } from 'svelte-sonner';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { User, ShieldCheck, Info } from '@o7/icon/lucide';
  import { TextTooltip } from '$lib/components/ui/tooltip/index.js';

  let {
    open = $bindable(),
    updateUsers,
  }: {
    open: boolean;
    updateUsers: () => void;
  } = $props();

  const form = superForm(
    defaults<Infer<typeof addUserSchema>>(zod(addUserSchema)),
    {
      validators: zod(addUserSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            updateUsers();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );

  const { form: formData, enhance, submitting } = form;
</script>

<Modal bind:open>
  <h2 class="leading-4">Add User</h2>
  <form method="POST" action="/add-user" use:enhance>
    <Form.Field {form} name="username">
      <Form.Control let:attrs>
        <Form.Label>Username</Form.Label>
        <Input bind:value={$formData.username} {...attrs} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="password">
      <Form.Control let:attrs>
        <Form.Label>Password</Form.Label>
        <Input type="password" bind:value={$formData.password} {...attrs} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="displayName">
      <Form.Control let:attrs>
        <Form.Label>Name</Form.Label>
        <Input bind:value={$formData.displayName} {...attrs} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="role" class="pt-1">
      <Form.Control let:attrs>
        <Form.Label class="flex gap-1">
          Role
          <TextTooltip
            text="Admins can do everything except delete other admins or the owner."
          >
            <Info size="15" />
          </TextTooltip>
        </Form.Label>
        <RadioGroup.Root
          bind:value={$formData.role}
          class="flex flex-col md:flex-row"
        >
          <Label
            class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
          >
            <RadioGroup.Item value="user" class="sr-only" />
            <div
              class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
            >
              <div class="flex items-center justify-center gap-1">
                <User />
                <span class="text-2xl font-bold">User</span>
              </div>
            </div>
          </Label>
          <Label
            class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
          >
            <RadioGroup.Item value="admin" class="sr-only" />
            <div
              class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
            >
              <div class="flex items-center justify-center gap-1">
                <ShieldCheck />
                <span class="text-2xl font-bold">Admin</span>
              </div>
            </div>
          </Label>
        </RadioGroup.Root>
        <input type="hidden" bind:value={$formData.role} {...attrs} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Button disabled={$submitting} class="mt-1">Add</Form.Button>
  </form>
</Modal>
