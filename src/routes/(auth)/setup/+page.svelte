<script lang="ts">
  import { trpc } from '$lib/trpc';
  import { Input } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { LoaderCircle } from '@o7/icon/lucide';
  import { superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import { zod } from 'sveltekit-superforms/adapters';
  import { signUpSchema } from '$lib/zod/auth';
  import { Globe } from '$lib/components/ui/globe';
  import { toTitleCase } from '$lib/utils';

  const query = trpc.user.isSetup.query();
  const isSetup = $query.data;
  onMount(() => {
    if (isSetup) {
      toast.info('AirTrail is already setup');
      goto('/');
    }
  });

  const { data } = $props();
  const form = superForm(data.form, {
    validators: zod(signUpSchema),
    onUpdated({ form }) {
      if (form.message) {
        toast.error(form.message.text);
      }
    },
  });
  const { form: formData, enhance, submitting } = form;
</script>

<div class="h-full grid lg:grid-cols-2">
  <div class="flex items-center justify-center">
    <div class="mx-auto grid w-[350px] gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-3xl font-bold">Welcome</h1>
        <p class="text-muted-foreground text-balance">
          Welcome to AirTrail! Please setup an admin account to get started.
        </p>
      </div>
      <form method="POST" use:enhance class="grid gap-4">
        <Form.Field {form} name="username">
          <Form.Control let:attrs>
            <Form.Label>Username</Form.Label>
            <Input {...attrs} bind:value={$formData.username} />
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="password">
          <Form.Control let:attrs>
            <Form.Label>Password</Form.Label>
            <Input {...attrs} type="password" bind:value={$formData.password} />
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="displayName">
          <Form.Control let:attrs>
            <Form.Label>Name</Form.Label>
            <Input {...attrs} bind:value={$formData.displayName} />
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
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Button disabled={$submitting}>
          {#if $submitting}
            <LoaderCircle class="animate-spin mr-1" size="18" />
          {/if}
          Create
        </Form.Button>
      </form>
    </div>
  </div>
  <div class="items-center justify-center relative hidden lg:flex">
    <Globe />
  </div>
</div>
