<script lang="ts">
  import { PageHeader } from '.';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { oauthConfigSchema } from '$lib/zod/oauth';
  import { appConfig } from '$lib/utils/stores';
  import { zod } from 'sveltekit-superforms/adapters';
  import * as Form from '$lib/components/ui/form';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import { toast } from 'svelte-sonner';
  import { invalidateAll } from '$app/navigation';

  const form = superForm(
    defaults<Infer<typeof oauthConfigSchema>>(
      $appConfig,
      zod(oauthConfigSchema),
    ),
    {
      resetForm: false,
      validators: zod(oauthConfigSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            invalidateAll();

            // special case for client secret, as it isn't stored in the client app config
            $formData.clientSecret = '';

            toast.success(form.message.text);
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;

  const changes = $derived.by(() => {
    return Object.entries($formData).some(([key, value]) => {
      // @ts-expect-error - safe via optional chaining
      const saved = $appConfig?.[key];
      if (!saved && !value) return false;
      return value !== saved;
    });
  });
</script>

<PageHeader
  title="OAuth"
  subtitle="Configure OAuth for your AirTrail instance."
>
  <form
    method="POST"
    action="/api/oauth/save"
    autocomplete="off"
    class="space-y-4"
    use:enhance
  >
    <Form.Field
      {form}
      name="enabled"
      class="flex flex-row items-center justify-between"
    >
      <Form.Control>
        {#snippet children({ props })}
          <div class="space-y-0.5">
            <Form.Label class="text-base">Enable OAuth</Form.Label>
            <Form.Description>
              Enable OAuth for your AirTrail instance.
            </Form.Description>
          </div>
          <Switch bind:checked={$formData.enabled} {...props} />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="issuerUrl">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Issuer URL</Form.Label>
          <Form.Description>The URL of the OAuth provider.</Form.Description>
          <Input
            bind:value={$formData.issuerUrl}
            {...props}
            placeholder="https://example.com/.well-known/openid-configuration"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="clientId">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Client ID</Form.Label>
          <Form.Description>
            The client ID provided by the OAuth provider.
          </Form.Description>
          <Input bind:value={$formData.clientId} {...props} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="clientSecret">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Client Secret</Form.Label>
          <Form.Description>
            The client secret provided by the OAuth provider.
          </Form.Description>
          <Input
            bind:value={$formData.clientSecret}
            {...props}
            placeholder="********"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="scope">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Scope</Form.Label>
          <Form.Description>
            The scope of the OAuth provider (space-separated).
          </Form.Description>
          <Input
            bind:value={$formData.scope}
            {...props}
            placeholder="openid profile"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field
      {form}
      name="autoRegister"
      class="flex flex-row items-center justify-between"
    >
      <Form.Control>
        {#snippet children({ props })}
          <div class="space-y-0.5">
            <Form.Label class="text-base">Auto Register</Form.Label>
            <Form.Description>
              Automatically register new users when they sign in with OAuth.
            </Form.Description>
          </div>
          <Switch bind:checked={$formData.autoRegister} {...props} />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field
      {form}
      name="autoLogin"
      class="flex flex-row items-center justify-between"
    >
      <Form.Control>
        {#snippet children({ props })}
          <div class="space-y-0.5">
            <Form.Label class="text-base">Auto Login</Form.Label>
            <Form.Description>
              Automatically redirect users to the OAuth provider when they visit
              the login page.
            </Form.Description>
          </div>
          <Switch bind:checked={$formData.autoLogin} {...props} />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Button disabled={!changes}>Save</Form.Button>
  </form>
</PageHeader>
