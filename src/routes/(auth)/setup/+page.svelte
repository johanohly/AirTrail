<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { goto } from '$app/navigation';
  import * as Form from '$lib/components/ui/form';
  import { Globe } from '$lib/components/ui/globe';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { toTitleCase } from '$lib/utils';
  import { signUpSchema } from '$lib/zod/auth';

  const { data } = $props();
  const { isSetup } = data;

  onMount(async () => {
    if (isSetup) {
      toast.info('AirTrail is already setup');
      await goto('/');
    }
  });

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
          Welcome to AirTrail! Please set up your owner account to get started.
        </p>
      </div>
      <form
        method="POST"
        action="/api/users/setup"
        use:enhance
        class="grid gap-4"
      >
        <Form.Field {form} name="username">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Username</Form.Label>
              <Input {...props} bind:value={$formData.username} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="password">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Password</Form.Label>
              <PasswordInput {...props} bind:value={$formData.password} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="displayName">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Display Name</Form.Label>
              <Input {...props} bind:value={$formData.displayName} />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Form.Field {form} name="unit">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Unit of measurement</Form.Label>
              <Select.Root type="single" bind:value={$formData.unit}>
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
              <input name={props.name} type="hidden" value={$formData.unit} />
            {/snippet}
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
