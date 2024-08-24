<script lang="ts">
  import { trpc } from '$lib/trpc';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Globe } from '$lib/components/ui/globe';
  import { superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { signInSchema } from '$lib/zod/auth';
  import { toast } from 'svelte-sonner';
  import { LoaderCircle } from '@o7/icon/lucide';

  const query = trpc.user.isSetup.query();
  const isSetup = $query.data;
  onMount(() => {
    if (!isSetup) {
      goto('/setup');
    }
  });

  const { data } = $props();
  const form = superForm(data.form, {
    validators: zod(signInSchema),
    onUpdated({ form }) {
      if (form.message) {
        toast.error(form.message);
      }
    },
  });
  const { form: formData, enhance, submitting } = form;
</script>

<div class="h-full grid lg:grid-cols-2">
  <div class="flex items-center justify-center">
    <div class="mx-auto grid w-[350px] gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-3xl font-bold">Login</h1>
        <p class="text-muted-foreground text-balance">
          Welcome back! Enter your username and password to login
        </p>
      </div>
      <form use:enhance method="POST" class="grid gap-4">
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
        <Form.Button disabled={$submitting}>
          {#if $submitting}
            <LoaderCircle class="animate-spin mr-1" size="18" />
          {/if}
          Log in
        </Form.Button>
      </form>
    </div>
  </div>
  <div class="items-center justify-center relative hidden lg:flex">
    <Globe />
  </div>
</div>
