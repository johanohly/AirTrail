<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import type { PageProps } from './$types';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Globe } from '$lib/components/ui/globe';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import { AcrobaticLoader } from '$lib/components/ui/loader';
  import { api } from '$lib/trpc';
  import { isOAuthCallback } from '$lib/utils';
  import { signInSchema } from '$lib/zod/auth';

  const { data }: PageProps = $props();
  const isSetup = data.isSetup;
  let appConfig = $state(data.appConfig);

  let oauthLoading = $state(true);
  let autoLoggingIn = $state(false);

  onMount(async () => {
    if (!isSetup) {
      await goto('/setup');
      return;
    }

    if (!appConfig) {
      oauthLoading = false;
      return;
    }

    if (!appConfig.oauth.enabled) {
      oauthLoading = false;
      appConfig.oauth.autoLogin = false;
      return;
    }

    if (isOAuthCallback(page.url.search)) {
      oauthLoading = true;
      const resp = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: window.location.toString() }),
      });

      if (!resp.ok) {
        await goto('/login', { replaceState: true }); // clear potential query params
        const err = await resp.json();
        toast.error(err?.message);
        oauthLoading = false;
        return;
      }

      await goto('/', { invalidateAll: true });
      return;
    }

    if (
      appConfig.oauth.autoLogin &&
      !window.location.search.includes('autoLogin=false')
    ) {
      autoLoggingIn = true;
      await goto('/login?autoLogin=false', { replaceState: true });
      await oauthLogin();
      return;
    }

    oauthLoading = false;
  });

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
      oauthLoading = false;
    }
  };

  let showLoader = $derived.by(() => {
    return (
      (autoLoggingIn || !page.url.search.includes('autoLogin=false')) &&
      (!appConfig ||
        appConfig.oauth.autoLogin ||
        isOAuthCallback(page.url.search))
    );
  });
</script>

{#if !showLoader}
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
          <Form.Button disabled={$submitting || oauthLoading}>
            {#if $submitting}
              <LoaderCircle class="animate-spin mr-1" size="18" />
            {/if}
            Log in
          </Form.Button>
        </form>
        {#if appConfig.oauth.enabled}
          <Button
            onclick={oauthLogin}
            disabled={oauthLoading}
            variant="outline"
          >
            {#if oauthLoading}
              <LoaderCircle class="animate-spin mr-1" size={16} />
            {/if}
            Log in with SSO
          </Button>
        {/if}
      </div>
    </div>
    <div class="items-center justify-center relative hidden lg:flex">
      <Globe />
    </div>
  </div>
{:else}
  <div class="h-full flex items-center justify-center">
    <AcrobaticLoader />
  </div>
{/if}
