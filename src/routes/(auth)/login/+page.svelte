<script lang="ts">
  import { api, trpc } from '$lib/trpc';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { Globe } from '$lib/components/ui/globe';
  import { superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { signInSchema } from '$lib/zod/auth';
  import { toast } from 'svelte-sonner';
  import { LoaderCircle } from '@o7/icon/lucide';
  import { appConfig } from '$lib/utils/stores';
  import { Button } from '$lib/components/ui/button';
  import { isOAuthCallback } from '$lib/utils';
  import { untrack } from 'svelte';

  const query = trpc.user.isSetup.query();
  const isSetup = $query.data;

  let oauthLoading = $state(true);

  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we need this for the effect to rerun
    [$appConfig];
    untrack(() => {
      (async () => {
        if (!isSetup) {
          await goto('/setup');
        }

        if (!$appConfig) {
          oauthLoading = false;
          return;
        }

        if (!$appConfig.enabled) {
          oauthLoading = false;
          return;
        }

        if (isOAuthCallback(window.location)) {
          oauthLoading = true;
          const resp = await fetch('/api/oauth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: window.location.toString() }),
          });

          if (!resp.ok) {
            await goto('/login'); // clear potential query params
            const err = await resp.json();
            toast.error(err?.message);
            oauthLoading = false;
            return;
          }

          await goto('/', { invalidateAll: true });
        }

        oauthLoading = false;
      })();
    });
  });

  const { data } = $props();
  const form = superForm(data.form, {
    validators: zod(signInSchema),
    onUpdated({ form }) {
      if (form.message) {
        toast.error(form.message.text);
      }
    },
  });
  const { form: formData, enhance, submitting } = form;

  const oauthLogin = async () => {
    oauthLoading = true;
    const redirect = window.location.toString().split('?')[0];
    if (!redirect) return;

    try {
      const resp = await api.oauth.authorize.query(redirect);
      window.location.href = resp.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      oauthLoading = false;
    }
  };
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
      <form
        use:enhance
        action="/api/users/login"
        method="POST"
        class="grid gap-4"
      >
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
        <Form.Button disabled={$submitting || oauthLoading}>
          {#if $submitting}
            <LoaderCircle class="animate-spin mr-1" size="18" />
          {/if}
          Log in
        </Form.Button>
      </form>
      {#if $appConfig?.enabled}
        <Button onclick={oauthLogin} disabled={oauthLoading} variant="outline">
          Log in with SSO
        </Button>
      {/if}
    </div>
  </div>
  <div class="items-center justify-center relative hidden lg:flex">
    <Globe />
  </div>
</div>
