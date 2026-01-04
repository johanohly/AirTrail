<script lang="ts">
  import { User, ShieldCheck } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { invalidateAll } from '$app/navigation';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import { HelpTooltip } from '$lib/components/ui/tooltip/index.js';
  import type { User as UserType } from '$lib/db/types';
  import { toTitleCase } from '$lib/utils';
  import { addUserSchema, adminEditUserSchema } from '$lib/zod/user';

  type Mode = 'add' | 'edit';

  let {
    open = $bindable(),
    mode = 'add',
    user = undefined,
    initialDisplayName = '',
    onSuccess,
  }: {
    open: boolean;
    mode?: Mode;
    user?: UserType;
    initialDisplayName?: string;
    onSuccess?: (username: string) => void;
  } = $props();

  const isEdit = $derived(mode === 'edit');
  const schema = $derived(isEdit ? adminEditUserSchema : addUserSchema);

  const getInitialData = () => {
    if (isEdit && user) {
      return {
        username: user.username,
        displayName: user.displayName,
        unit: user.unit,
        role: user.role === 'owner' ? 'admin' : user.role,
      };
    }
    return {
      username: '',
      password: '',
      displayName: initialDisplayName,
      unit: 'metric' as const,
      role: 'user' as const,
    };
  };

  const form = superForm(
    defaults<Infer<typeof addUserSchema>>(zod(addUserSchema)),
    {
      dataType: 'json',
      validators: zod(schema),
      onSubmit() {
        if (mode === 'edit' && user) {
          // @ts-expect-error - id is only in adminEditUserSchema
          $formData.id = user.id;
        }
      },
      async onUpdate({ form: f }) {
        if (f.message) {
          if (f.message.type === 'success') {
            await invalidateAll();
            onSuccess?.($formData.username);
            open = false;
            return void toast.success(f.message.text);
          }
          toast.error(f.message.text);
        }
      },
    },
  );

  const { form: formData, enhance, submitting } = form;

  $effect(() => {
    if (open) {
      const data = getInitialData();
      $formData.username = data.username;
      $formData.displayName = data.displayName;
      $formData.unit = data.unit;
      $formData.role = data.role;
      if ('password' in data) {
        $formData.password = data.password ?? '';
      }
    }
  });
</script>

<Modal bind:open>
  <ModalBreadcrumbHeader
    section="Users"
    title={isEdit ? 'Edit user' : 'Add user'}
    icon={User}
  />
  <ModalBody>
    <form
      class="flex flex-col gap-2"
      method="POST"
      action={isEdit ? '/api/users/admin-edit' : '/api/users/add'}
      use:enhance
    >
      <Form.Field {form} name="username">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Username</Form.Label>
            <Input bind:value={$formData.username} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      {#if !isEdit}
        <Form.Field {form} name="password">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Password</Form.Label>
              <Input
                type="password"
                bind:value={$formData.password}
                {...props}
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      {/if}
      <Form.Field {form} name="displayName">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Name</Form.Label>
            <Input bind:value={$formData.displayName} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      {#if isEdit}
        <Form.Field {form} name="unit">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Unit of measurement</Form.Label>
              <Select.Root
                type="single"
                value={$formData.unit}
                onValueChange={(v) => {
                  if (v) $formData.unit = v as 'metric' | 'imperial';
                }}
              >
                <Select.Trigger {...props}>
                  {$formData.unit
                    ? toTitleCase($formData.unit)
                    : 'Select a unit'}
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
      {/if}
      <Form.Field {form} name="role" class="pt-1">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label class="flex gap-1">
              Role
              <HelpTooltip
                text="Admins can do everything except delete other admins or the owner."
              />
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
            <input type="hidden" bind:value={$formData.role} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Button disabled={$submitting} class="mt-1">
        {isEdit ? 'Save' : 'Add'}
      </Form.Button>
    </form>
  </ModalBody>
</Modal>
