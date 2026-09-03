<script lang="ts">
  import { ChevronRight, Info, TriangleAlert } from '@o7/icon/lucide';
  import { Collapsible } from 'bits-ui';
  import { onDestroy, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { PageHeader } from '.';
  import OAuthRoleMappings from './oauth-role-mappings/OAuthRoleMappings.svelte';

  import { invalidateAll } from '$app/navigation';
  import { Locked } from '$lib/components/helpers';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import * as Tabs from '$lib/components/ui/tabs';
  import { appConfig } from '$lib/state.svelte';
  import { api } from '$lib/trpc';
  import { cancelHighlight, cn, highlightElement } from '$lib/utils';
  import { getErrorText } from '$lib/utils/error';
  import { oauthConfigSchema } from '$lib/zod/config';

  type ConnectionTestState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | {
        kind: 'success';
        issuer: string;
        authorizationEndpoint: string | null;
        tokenEndpoint: string | null;
        supportsPkce: boolean;
      }
    | { kind: 'error'; message: string };

  let { dirty = $bindable(false) }: { dirty?: boolean } = $props();
  let activeSection = $state('connection');
  let mappingDirty = $state(false);
  let connectionTest = $state<ConnectionTestState>({ kind: 'idle' });
  let testedConnectionFingerprint = $state('');
  let scopeField: HTMLDivElement | null = $state(null);
  let scopeInput: HTMLInputElement | null = $state(null);

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

            connectionTest = { kind: 'idle' };
            testedConnectionFingerprint = '';

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
  const connectionFingerprint = $derived(JSON.stringify($formData));
  const connectionTestIsCurrent = $derived(
    testedConnectionFingerprint !== '' &&
      testedConnectionFingerprint === connectionFingerprint,
  );

  $effect(() => {
    dirty = changes || mappingDirty;
  });

  const testConnection = async () => {
    connectionTest = { kind: 'loading' };
    try {
      const result = await api.oauth.testConfiguration.mutate({
        ...$formData,
        clientSecret: $formData.clientSecret ?? null,
      });
      connectionTest = { kind: 'success', ...result };
      testedConnectionFingerprint = connectionFingerprint;
    } catch (error) {
      connectionTest = {
        kind: 'error',
        message: getErrorText(error) || 'Could not connect to this provider.',
      };
    }
  };

  const warnBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
  };

  const reviewConnectionScope = async () => {
    activeSection = 'connection';
    await tick();

    if (scopeField) void highlightElement(scopeField, { scrollOffset: 0 });
    scopeInput?.focus({ preventScroll: true });
  };

  onDestroy(() => {
    if (scopeField) cancelHighlight(scopeField);
  });
</script>

<svelte:window onbeforeunload={warnBeforeUnload} />

<PageHeader
  title="OAuth"
  subtitle="Configure your identity provider and assign AirTrail roles."
>
  <Tabs.Root bind:value={activeSection} class="gap-5">
    <Tabs.List class="w-fit max-w-full">
      <Tabs.Trigger value="connection">
        Connection
        {#if changes}<Badge variant="secondary">Unsaved</Badge>{/if}
      </Tabs.Trigger>
      <Tabs.Trigger value="roles">
        Role assignment
        {#if mappingDirty}<Badge variant="secondary">Unsaved</Badge>{/if}
      </Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="connection" class="mt-0">
      <form
        method="POST"
        action="/api/oauth/save"
        autocomplete="off"
        class="space-y-4"
        use:enhance
      >
        <div class="space-y-1">
          <h3 class="text-lg font-semibold">OAuth connection</h3>
          <p class="text-sm text-muted-foreground">
            Connect AirTrail to an OpenID Connect provider and control the login
            experience.
          </p>
        </div>
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
                  <Form.Description
                    >The URL of the OAuth provider.</Form.Description
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
                <PasswordInput
                  bind:value={$formData.clientSecret}
                  {...props}
                  autocomplete="new-password"
                  placeholder={appConfig.configured?.oauth?.clientSecret
                    ? 'Enter a replacement secret'
                    : 'Enter the client secret'}
                />
              {/snippet}
            </Form.Control>
            <Form.Description>
              {appConfig.configured?.oauth?.clientSecret
                ? 'A client secret is configured. Leave this blank to keep it.'
                : 'AirTrail stores this secret on the server.'}
            </Form.Description>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>
        <Locked
          locked={appConfig.envConfigured?.oauth?.scope ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field bind:ref={scopeField} {form} name="scope">
            <Form.Control>
              {#snippet children({ props })}
                <div class="grid gap-1">
                  <Form.Label>Scope</Form.Label>
                  <Form.Description>
                    Space-separated scopes requested at sign-in. For group-based
                    role rules, check your provider's group membership scope and
                    claim mapper.
                  </Form.Description>
                </div>
                <Input
                  bind:ref={scopeInput}
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
              <div
                {...props}
                class="ml-2 flex flex-col space-y-4 border-l pl-4"
              >
                <Locked
                  locked={appConfig.envConfigured?.oauth
                    ?.tokenEndpointAuthMethod ?? false}
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
                            Optional OIDC prompt parameter, such as login,
                            consent, or select_account.
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
                    Automatically register new users when they sign in with
                    OAuth.
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
        <div class="space-y-3 border-t pt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="text-sm font-medium">Verify the connection</h4>
              <p class="text-xs text-muted-foreground">
                Tests the current draft against the provider's discovery
                document. It does not save any changes.
              </p>
            </div>
            <Button
              variant="outline"
              onclick={testConnection}
              loading={connectionTest.kind === 'loading'}
            >
              Test connection
            </Button>
          </div>
          {#if connectionTest.kind === 'success'}
            <Alert.Root
              variant={connectionTestIsCurrent ? 'success' : 'default'}
            >
              <Info />
              <Alert.Title>
                {connectionTestIsCurrent
                  ? 'OIDC discovery succeeded'
                  : 'Connection draft changed'}
              </Alert.Title>
              <Alert.Description>
                {#if connectionTestIsCurrent}
                  Connected to {connectionTest.issuer}. Authorization and token
                  endpoints are available{connectionTest.supportsPkce
                    ? ', with PKCE support.'
                    : '.'}
                {:else}
                  Test the connection again to verify the current values.
                {/if}
              </Alert.Description>
            </Alert.Root>
          {:else if connectionTest.kind === 'error'}
            <Alert.Root variant="destructive">
              <TriangleAlert />
              <Alert.Title>Connection test failed</Alert.Title>
              <Alert.Description>{connectionTest.message}</Alert.Description>
            </Alert.Root>
          {/if}
        </div>

        <div
          class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur"
        >
          <p class="flex items-center gap-2 text-xs text-muted-foreground">
            {#if changes}
              <span class="size-2 rounded-full bg-amber-500"></span>
              Unsaved connection changes
            {:else}
              Connection settings are saved
            {/if}
          </p>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!changes}
              onclick={() => form.reset()}
            >
              Reset
            </Button>
            <Form.Button size="sm" disabled={!changes}
              >Save connection</Form.Button
            >
          </div>
        </div>
      </form>
    </Tabs.Content>

    <Tabs.Content value="roles" class="mt-0">
      <OAuthRoleMappings
        bind:dirty={mappingDirty}
        scope={$formData.scope ?? ''}
        onReviewConnection={reviewConnectionScope}
      />
    </Tabs.Content>
  </Tabs.Root>
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
