<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';
  import { Collapsible } from 'bits-ui';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { PageHeader } from '.';

  import { invalidateAll } from '$app/navigation';
  import { Locked } from '$lib/components/helpers';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import { appConfig } from '$lib/state.svelte';
  import { cn } from '$lib/utils';
  import { oauthConfigSchema } from '$lib/zod/config';

  const form = superForm(
    defaults<Infer<typeof oauthConfigSchema>>(
      appConfig?.config?.oauth,
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
  let advancedOpen = $state(
    (appConfig.config?.oauth?.tokenEndpointAuthMethod ??
      'client_secret_post') !== 'client_secret_post' ||
      !!appConfig.config?.oauth?.prompt,
  );

  const changes = $derived.by(() => {
    return Object.entries($formData).some(([key, value]) => {
      // @ts-expect-error - safe via optional chaining
      const saved = appConfig?.config?.oauth?.[key];
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
    <Locked
      locked={appConfig.envConfigured?.oauth?.enabled ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field
        {form}
        name="enabled"
        class="flex flex-row items-center justify-between"
      >
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Enable OAuth</Form.Label>
              <Form.Description>
                Enable OAuth for your AirTrail instance.
              </Form.Description>
            </div>
            <Switch bind:checked={$formData.enabled} {...props} />
          {/snippet}
        </Form.Control>
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.issuerUrl ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="issuerUrl">
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Issuer URL</Form.Label>
              <Form.Description>The URL of the OAuth provider.</Form.Description
              >
            </div>
            <Input
              bind:value={$formData.issuerUrl}
              {...props}
              placeholder="https://example.com/.well-known/openid-configuration"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.clientId ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="clientId">
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Client ID</Form.Label>
              <Form.Description>
                The client ID provided by the OAuth provider.
              </Form.Description>
            </div>
            <Input bind:value={$formData.clientId} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.clientSecret ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="clientSecret">
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Client Secret</Form.Label>
              <Form.Description>
                The client secret provided by the OAuth provider.
              </Form.Description>
            </div>
            <Input
              bind:value={$formData.clientSecret}
              {...props}
              placeholder="********"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.scope ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="scope">
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Scope</Form.Label>
              <Form.Description>
                The scope of the OAuth provider (space-separated).
              </Form.Description>
            </div>
            <Input
              bind:value={$formData.scope}
              {...props}
              placeholder="openid profile"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Collapsible.Root bind:open={advancedOpen} class="space-y-3">
      <Collapsible.Trigger
        class="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          size={16}
          class={cn('size-4 transition-transform', {
            'rotate-90': advancedOpen,
          })}
        />
        Advanced
      </Collapsible.Trigger>
      <Collapsible.Content>
        {#snippet child({ props })}
          <div {...props} class="ml-2 flex flex-col space-y-4 border-l pl-4">
            <Locked
              locked={appConfig.envConfigured?.oauth?.tokenEndpointAuthMethod ??
                false}
              tooltip={lockedTooltip}
            >
              <Form.Field {form} name="tokenEndpointAuthMethod">
                <Form.Control>
                  {#snippet children({ props })}
                    <div class="grid gap-1">
                      <Form.Label>Token Endpoint Auth Method</Form.Label>
                      <Form.Description>
                        How AirTrail authenticates to the provider token
                        endpoint.
                      </Form.Description>
                    </div>
                    <Select.Root
                      type="single"
                      name={props.name}
                      bind:value={$formData.tokenEndpointAuthMethod}
                    >
                      <Select.Trigger {...props}>
                        {$formData.tokenEndpointAuthMethod}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item
                          value="client_secret_post"
                          label="client_secret_post"
                        />
                        <Select.Item
                          value="client_secret_basic"
                          label="client_secret_basic"
                        />
                      </Select.Content>
                    </Select.Root>
                  {/snippet}
                </Form.Control>
                <Form.FieldErrors />
              </Form.Field>
            </Locked>
            <Locked
              locked={appConfig.envConfigured?.oauth?.prompt ?? false}
              tooltip={lockedTooltip}
            >
              <Form.Field {form} name="prompt">
                <Form.Control>
                  {#snippet children({ props })}
                    <div class="grid gap-1">
                      <Form.Label>Prompt</Form.Label>
                      <Form.Description>
                        Optional OIDC prompt parameter, such as login, consent,
                        or select_account.
                      </Form.Description>
                    </div>
                    <Input bind:value={$formData.prompt} {...props} />
                  {/snippet}
                </Form.Control>
                <Form.FieldErrors />
              </Form.Field>
            </Locked>
          </div>
        {/snippet}
      </Collapsible.Content>
    </Collapsible.Root>
    <Locked
      locked={appConfig.envConfigured?.oauth?.buttonText ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="buttonText">
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Button Text</Form.Label>
              <Form.Description>
                The text to display on the OAuth login button.
              </Form.Description>
            </div>
            <Input bind:value={$formData.buttonText} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.autoRegister ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field
        {form}
        name="autoRegister"
        class="flex flex-row items-center justify-between"
      >
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Auto Register</Form.Label>
              <Form.Description>
                Automatically register new users when they sign in with OAuth.
              </Form.Description>
            </div>
            <Switch
              bind:checked={
                () => $formData.autoRegister ?? false,
                (value) => ($formData.autoRegister = value)
              }
              {...props}
            />
          {/snippet}
        </Form.Control>
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.autoLogin ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field
        {form}
        name="autoLogin"
        class="flex flex-row items-center justify-between"
      >
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Auto Login</Form.Label>
              <Form.Description>
                Automatically redirect users to the OAuth provider when they
                visit the login page.
              </Form.Description>
            </div>
            <Switch
              bind:checked={
                () => $formData.autoLogin ?? false,
                (value) => ($formData.autoLogin = value)
              }
              {...props}
            />
          {/snippet}
        </Form.Control>
      </Form.Field>
    </Locked>
    <Locked
      locked={appConfig.envConfigured?.oauth?.hidePasswordForm ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field
        {form}
        name="hidePasswordForm"
        class="flex flex-row items-center justify-between"
      >
        <Form.Control>
          {#snippet children({ props })}
            <div class="grid gap-1">
              <Form.Label>Hide Password Form</Form.Label>
              <Form.Description>
                Hide password form when OAuth is enabled.
              </Form.Description>
            </div>
            <Switch
              bind:checked={
                () => $formData.hidePasswordForm ?? false,
                (value) => ($formData.hidePasswordForm = value)
              }
              {...props}
            />
          {/snippet}
        </Form.Control>
      </Form.Field>
    </Locked>
    <Form.Button disabled={!changes}>Save</Form.Button>
  </form>
</PageHeader>

{#snippet lockedTooltip()}
  <p>
    This setting is locked because it is configured via environment variables.
  </p>
  <p>
    To change this setting, update or delete the environment variable and
    restart the server.
  </p>
{/snippet}
