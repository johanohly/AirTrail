<script lang="ts">
  import { api, trpc } from '$lib/trpc';
  import * as Form from '$lib/components/ui/form';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { Globe } from '$lib/components/ui/globe';
  import { superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { signInSchema } from '$lib/zod/auth';
  import { toast } from 'svelte-sonner';
  import { LoaderCircle } from '@o7/icon/lucide';
  import { Button } from '$lib/components/ui/button';
  import { isOAuthCallback } from '$lib/utils';
  import { untrack } from 'svelte';
  import { AcrobaticLoader } from '$lib/components/ui/loader';
  import { page } from '$app/stores';

  const { data } = $props();
  const appConfig = data.appConfig;

  const query = trpc.user.isSetup.query();
  const isSetup = $query.data;

  let oauthLoading = $state(true);

  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we need this for the effect to rerun
    [appConfig];
    untrack(() => {
      (async () => {
        if (!isSetup) {
          await goto('/setup');
        }

        if (!appConfig) {
          oauthLoading = false;
          return;
        }

        if (!appConfig.enabled) {
          oauthLoading = false;
          return;
        }

        if (isOAuthCallback($page.url.search)) {
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
          appConfig.autoLogin &&
          !window.location.search.includes('autoLogin=false')
        ) {
          await goto('/login?autoLogin=false', { replaceState: true });
          await oauthLogin();
          return;
        }

        oauthLoading = false;
      })();
    });
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
      !$page.url.search.includes('autoLogin=false') &&
      (!appConfig || appConfig.autoLogin || isOAuthCallback($page.url.search))
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
        {#if appConfig.enabled}
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
