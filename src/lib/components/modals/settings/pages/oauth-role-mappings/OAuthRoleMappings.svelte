<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Copy,
    Info,
    Plus,
    Trash2,
    TriangleAlert,
  } from '@o7/icon/lucide';
  import { onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { confirmation } from '$lib/components/helpers/confirm';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import { api } from '$lib/trpc';
  import { getErrorText } from '$lib/utils/error';
  import { generateUUID } from '$lib/utils/string';
  import {
    oauthClaimsSchema,
    type OAuthClaims,
    type OAuthRoleMappingInput,
    type OAuthRoleMappingMode,
  } from '$lib/zod/oauth-role-mapping';

  type MappingDraft = OAuthRoleMappingInput & {
    draftId: string;
    conditionsOpen: boolean;
  };
  type MappingErrors = {
    claimPath?: string;
    claimValue?: string;
    roleId?: string;
  };
  type LoadState =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready' };
  type TestResult = Awaited<
    ReturnType<typeof api.role.testOAuthMappings.mutate>
  >;
  type TestRuleDiagnostic = TestResult['diagnostics'][number];
  type TestState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'success'; result: TestResult };
  type ParsedClaims =
    | { kind: 'valid'; value: OAuthClaims }
    | { kind: 'invalid'; message: string };

  let {
    dirty = $bindable(false),
    scope = '',
    onReviewConnection,
  }: {
    dirty?: boolean;
    scope?: string;
    onReviewConnection?: () => void;
  } = $props();

  let mode = $state<OAuthRoleMappingMode>('off');
  let mappings = $state<MappingDraft[]>([]);
  let roles = $state<Array<{ id: string; name: string }>>([]);
  let defaultRoleName = $state('Default role');
  let oauthManagedUserCount = $state(0);
  let loadState = $state<LoadState>({ kind: 'loading' });
  let saving = $state(false);
  let savedMode = $state<OAuthRoleMappingMode>('off');
  let savedMappings = $state<OAuthRoleMappingInput[]>([]);
  let savedFingerprint = $state('');
  let editInactiveRules = $state(false);
  let announcement = $state('');
  let userinfoJson = $state(
    JSON.stringify({ groups: ['airtrail-admins'] }, null, 2),
  );
  let idTokenJson = $state('{}');
  let userinfoError = $state('');
  let idTokenError = $state('');
  let testState = $state<TestState>({ kind: 'idle' });
  let testedFingerprint = $state('');
  let testedMappings = $state<OAuthRoleMappingInput[]>([]);

  const toInput = ({
    draftId: _,
    conditionsOpen: __,
    ...mapping
  }: MappingDraft) => mapping;
  const createDraft = (
    mapping: OAuthRoleMappingInput,
    conditionsOpen = false,
  ): MappingDraft => ({
    ...mapping,
    draftId: generateUUID(),
    conditionsOpen,
  });
  const mappingPayload = $derived(mappings.map(toInput));
  const draftFingerprint = $derived(
    JSON.stringify({ mode, mappings: mappingPayload }),
  );
  const isDirty = $derived(
    loadState.kind === 'ready' && draftFingerprint !== savedFingerprint,
  );
  const mappingErrors = $derived(mappings.map(validateMapping));
  const hasErrors = $derived(
    mappingErrors.some((errors) => Object.keys(errors).length > 0),
  );
  const testIsCurrent = $derived(
    testedFingerprint !== '' && testedFingerprint === draftFingerprint,
  );
  const showRules = $derived(mode !== 'off' || editInactiveRules);
  const enabledRuleCount = $derived(
    mappings.filter((mapping) => mapping.enabled).length,
  );
  const groupScopeMissing = $derived(
    mappings.some(
      (mapping) =>
        mapping.enabled &&
        (mapping.claimPath === '/groups' ||
          mapping.claimPath.startsWith('/groups/')),
    ) && !scope.trim().split(/\s+/).includes('groups'),
  );

  $effect(() => {
    dirty = isDirty;
  });

  function validateMapping(mapping: MappingDraft): MappingErrors {
    const errors: MappingErrors = {};
    if (!mapping.claimPath.trim().startsWith('/')) {
      errors.claimPath = 'Use a claim path beginning with /, such as /groups.';
    }
    if (!mapping.claimValue.trim()) {
      errors.claimValue = 'Enter the value this rule should match.';
    }
    if (!mapping.roleId) errors.roleId = 'Select the role to assign.';
    return errors;
  }

  const load = async () => {
    loadState = { kind: 'loading' };
    try {
      const [settings, roleData] = await Promise.all([
        api.role.oauthMappings.query(),
        api.role.oauthRoleOptions.query(),
      ]);
      const nextMappings = settings.mappings.map((mapping) =>
        createDraft({
          name: mapping.name,
          enabled: mapping.enabled,
          claimSource: mapping.claimSource,
          claimPath: mapping.claimPath,
          operator: mapping.operator,
          claimValue: mapping.claimValue,
          roleId: mapping.roleId,
        }),
      );
      mode = settings.oauthRoleMappingMode;
      mappings = nextMappings;
      roles = roleData;
      defaultRoleName = settings.defaultRoleName;
      oauthManagedUserCount = settings.oauthManagedUserCount;
      savedMode = mode;
      savedMappings = nextMappings.map(toInput);
      savedFingerprint = JSON.stringify({
        mode: savedMode,
        mappings: savedMappings,
      });
      editInactiveRules = false;
      testState = { kind: 'idle' };
      testedFingerprint = '';
      testedMappings = [];
      loadState = { kind: 'ready' };
    } catch (error) {
      loadState = {
        kind: 'error',
        message: getErrorText(error) || 'Could not load role assignment.',
      };
    }
  };

  onMount(() => void load());

  const ruleLabel = (mapping: MappingDraft, index: number) =>
    mapping.name.trim() || `Rule ${index + 1}`;
  const testedRuleLabel = (index: number) =>
    testedMappings[index]?.name.trim() || `Rule ${index + 1}`;
  const roleName = (roleId: string) =>
    roles.find((role) => role.id === roleId)?.name ?? 'Select a role';
  const ruleSummary = (mapping: MappingDraft) => {
    const source = mapping.claimSource === 'userinfo' ? 'UserInfo' : 'ID token';
    const comparison = mapping.operator === 'equals' ? 'equals' : 'contains';
    return `When ${source} claim ${mapping.claimPath || '/claim'} ${comparison} "${mapping.claimValue || 'value'}", assign ${roleName(mapping.roleId)}.`;
  };

  const diagnosticText = (diagnostic: TestRuleDiagnostic) => {
    const mapping = testedMappings[diagnostic.ruleIndex];
    const label = testedRuleLabel(diagnostic.ruleIndex);
    const source =
      mapping?.claimSource === 'id_token' ? 'ID token' : 'UserInfo';
    const path = mapping?.claimPath || 'the configured claim';
    switch (diagnostic.kind) {
      case 'matched':
        return `${label}: matched ${diagnostic.actual}.`;
      case 'disabled':
        return `${label}: this rule is disabled.`;
      case 'missing_claim':
        return `${label}: ${source} does not contain ${path}. Check the selected source and path${path === '/groups' ? ", then verify the provider's group scope or claim mapper" : ''}.`;
      case 'array_requires_contains':
        return `${label}: ${path} is an array, but Equals only compares one value. Use Contains to match an array item.`;
      case 'unsupported_array_items':
        return `${label}: ${path} is an array of objects. Point the rule at a text, number, or true/false value inside each item, or change the provider claim format.`;
      case 'unsupported_claim_type':
        if (diagnostic.claimType === 'object') {
          return `${label}: ${path} is an object. Point the rule at a value inside it, such as ${path}/roles.`;
        }
        if (diagnostic.claimType === 'null') {
          return `${label}: ${path} is null. Check the provider's claim mapping.`;
        }
        return `${label}: ${path} is a ${diagnostic.claimType}. Contains only works with text or arrays; use Equals instead.`;
      case 'value_mismatch':
        return `${label}: ${path} was found, but it did not match "${mapping?.claimValue ?? ''}". Received ${diagnostic.actual}. Matching is case-sensitive.`;
      default: {
        const exhaustive: never = diagnostic;
        return exhaustive;
      }
    }
  };

  const addMapping = async () => {
    const mapping = createDraft(
      {
        name: '',
        enabled: true,
        claimSource: 'userinfo',
        claimPath: '/groups',
        operator: 'contains',
        claimValue: '',
        roleId: '',
      },
      true,
    );
    mappings = [...mappings, mapping];
    editInactiveRules = true;
    await tick();
    document.getElementById(`oauth-rule-${mapping.draftId}-name`)?.focus();
  };

  const duplicateMapping = async (index: number) => {
    const source = mappings[index];
    if (!source) return;
    const duplicate = createDraft(
      {
        ...toInput(source),
        name: source.name.trim() ? `${source.name.trim()} copy` : '',
      },
      true,
    );
    mappings = [
      ...mappings.slice(0, index + 1),
      duplicate,
      ...mappings.slice(index + 1),
    ];
    announcement = `${ruleLabel(source, index)} duplicated.`;
    await tick();
    document.getElementById(`oauth-rule-${duplicate.draftId}-name`)?.focus();
  };

  const removeMapping = (index: number) => {
    const removed = mappings[index];
    if (!removed) return;
    const label = ruleLabel(removed, index);
    mappings = mappings.filter((_, item) => item !== index);
    announcement = `${label} removed.`;
    toast.info(`${label} removed.`, {
      action: {
        label: 'Undo',
        onClick: () => {
          mappings = [
            ...mappings.slice(0, index),
            removed,
            ...mappings.slice(index),
          ];
          announcement = `${label} restored.`;
        },
      },
    });
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const mapping = mappings[index];
    if (!mapping || target < 0 || target >= mappings.length) return;
    const next = [...mappings];
    [next[index], next[target]] = [next[target]!, next[index]!];
    mappings = next;
    const directionLabel = direction === -1 ? 'up' : 'down';
    announcement = `${ruleLabel(mapping, target)} moved ${directionLabel} to priority ${target + 1}.`;
    await tick();
    document
      .getElementById(`oauth-rule-${mapping.draftId}-move-${directionLabel}`)
      ?.focus();
  };

  const reset = () => {
    mode = savedMode;
    mappings = savedMappings.map((mapping) => createDraft(mapping));
    editInactiveRules = false;
    testState = { kind: 'idle' };
    testedFingerprint = '';
    testedMappings = [];
    announcement = 'Unsaved role assignment changes reset.';
  };

  const parseClaims = (value: string, label: string): ParsedClaims => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return { kind: 'invalid', message: `${label} must contain valid JSON.` };
    }
    const result = oauthClaimsSchema.safeParse(parsed);
    if (!result.success) {
      return { kind: 'invalid', message: `${label} must be a JSON object.` };
    }
    return { kind: 'valid', value: result.data };
  };

  const testRules = async () => {
    const userinfo = parseClaims(userinfoJson, 'UserInfo claims');
    const idToken = parseClaims(idTokenJson, 'ID token claims');
    userinfoError = userinfo.kind === 'invalid' ? userinfo.message : '';
    idTokenError = idToken.kind === 'invalid' ? idToken.message : '';
    if (userinfo.kind === 'invalid' || idToken.kind === 'invalid') return;

    testState = { kind: 'loading' };
    try {
      const result = await api.role.testOAuthMappings.mutate({
        mappings: mappingPayload,
        userinfo: userinfo.value,
        idToken: idToken.value,
      });
      testState = { kind: 'success', result };
      testedFingerprint = draftFingerprint;
      testedMappings = mappingPayload.map((mapping) => ({ ...mapping }));
    } catch (error) {
      testState = {
        kind: 'error',
        message: getErrorText(error) || 'Could not test these rules.',
      };
    }
  };

  const save = async () => {
    if (hasErrors || !isDirty) return;
    if (mode === 'on_login' && !testIsCurrent) {
      testState = {
        kind: 'error',
        message: 'Test the current draft before publishing login-time mapping.',
      };
      return;
    }
    if (mode === 'on_login') {
      const userLabel = `${oauthManagedUserCount} OAuth-managed ${oauthManagedUserCount === 1 ? 'user' : 'users'}`;
      const confirmed = await confirmation.show({
        title: 'Publish login-time role policy?',
        description: `${userLabel} may receive a different role the next time they sign in. Manual role assignments remain unchanged.`,
        confirmText: 'Publish policy',
        cancelText: 'Keep editing',
      });
      if (!confirmed) return;
    }

    saving = true;
    try {
      await api.role.updateOAuthMappings.mutate({
        mode,
        mappings: mappingPayload,
      });
      toast.success('OAuth role assignment updated.');
      await load();
    } catch (error) {
      toast.error(getErrorText(error) || 'Could not save role assignment.');
    } finally {
      saving = false;
    }
  };
</script>

<section class="space-y-5">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold">Role assignment</h3>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Match identity-provider claims to AirTrail roles. Rules run from top to
      bottom, and the first match wins.
    </p>
  </div>

  {#if loadState.kind === 'loading'}
    <div class="space-y-3" aria-live="polite" aria-busy="true">
      <div class="h-16 animate-pulse rounded-md bg-muted"></div>
      <div class="h-32 animate-pulse rounded-md bg-muted"></div>
      <span class="sr-only">Loading role assignment</span>
    </div>
  {:else if loadState.kind === 'error'}
    <Alert.Root variant="destructive">
      <TriangleAlert />
      <Alert.Title>Role assignment could not be loaded</Alert.Title>
      <Alert.Description class="space-y-3">
        <p>{loadState.message}</p>
        <Button variant="outline" size="sm" onclick={load}>Retry</Button>
      </Alert.Description>
    </Alert.Root>
  {:else}
    <div class="grid gap-2">
      <Label for="oauth-role-mapping-mode">When should rules run?</Label>
      <Select.Root
        type="single"
        bind:value={mode}
        name="oauth-role-mapping-mode"
      >
        <Select.Trigger id="oauth-role-mapping-mode">
          {mode === 'off'
            ? 'Off'
            : mode === 'on_create'
              ? 'When a new OAuth account is created'
              : 'At every OAuth login'}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="off" label="Off" />
          <Select.Item
            value="on_create"
            label="When a new OAuth account is created"
          />
          <Select.Item value="on_login" label="At every OAuth login" />
        </Select.Content>
      </Select.Root>
      <p class="text-xs leading-relaxed text-muted-foreground">
        Users without a match receive <strong>{defaultRoleName}</strong>. Manual
        role assignments are never overwritten.
      </p>
    </div>

    {#if groupScopeMissing && showRules}
      <Alert.Root variant="warning">
        <TriangleAlert />
        <Alert.Title>The groups claim may not be requested</Alert.Title>
        <Alert.Description class="space-y-3">
          <p>
            The current connection scope does not include
            <strong>groups</strong>. Some providers omit /groups unless a group
            membership scope or claim mapper is configured. Update the
            connection, then sign in again before testing fresh claims.
          </p>
          {#if onReviewConnection}
            <Button variant="outline" size="sm" onclick={onReviewConnection}>
              Review connection scopes
            </Button>
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if mode === 'on_login'}
      <Alert.Root variant="warning">
        <TriangleAlert />
        <Alert.Title>Login-time policy</Alert.Title>
        <Alert.Description>
          {oauthManagedUserCount} OAuth-managed
          {oauthManagedUserCount === 1 ? 'user' : 'users'} will be evaluated against
          this policy on their next login. Test the current draft before publishing
          it.
        </Alert.Description>
      </Alert.Root>
    {:else if mode === 'off'}
      <Alert.Root variant="info">
        <Info />
        <Alert.Title>Role assignment is off</Alert.Title>
        <Alert.Description class="space-y-3">
          <p>
            {savedMappings.length} saved {savedMappings.length === 1
              ? 'rule is'
              : 'rules are'}
            inactive. OAuth users receive {defaultRoleName}.
            {#if isDirty}
              This draft has unsaved changes.{/if}
          </p>
          {#if mappings.length === 0}
            <Button variant="outline" size="sm" onclick={addMapping}>
              <Plus />
              Create first rule
            </Button>
          {:else if !editInactiveRules}
            <Button
              variant="outline"
              size="sm"
              onclick={() => (editInactiveRules = true)}
            >
              Edit inactive rules
            </Button>
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if showRules}
      {#if mappings.length === 0}
        <div
          class="rounded-lg border border-dashed p-6 text-center"
          aria-live="polite"
        >
          <h4 class="font-medium">No assignment rules</h4>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add a rule such as &quot;When the UserInfo claim /groups contains
            airtrail-admins, assign Administrator.&quot;
          </p>
          <Button class="mt-4" size="sm" onclick={addMapping}>
            <Plus />
            Add first rule
          </Button>
        </div>
      {:else}
        <div class="space-y-3">
          {#each mappings as mapping, index (mapping.draftId)}
            {@const errors = mappingErrors[index] ?? {}}
            <fieldset class="space-y-4 rounded-lg border p-4">
              <legend class="sr-only">{ruleLabel(mapping, index)}</legend>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="text-sm font-semibold"
                    >{ruleLabel(mapping, index)}</span
                  >
                  <Badge variant="outline">Priority {index + 1}</Badge>
                  {#if !mapping.enabled}<Badge variant="secondary"
                      >Disabled</Badge
                    >{/if}
                </div>
                <div class="flex items-center gap-1">
                  <Button
                    id={`oauth-rule-${mapping.draftId}-move-up`}
                    variant="ghost"
                    size="icon"
                    class="max-sm:size-11"
                    aria-label={`Move ${ruleLabel(mapping, index)} up`}
                    title="Move up"
                    disabled={index === 0}
                    onclick={() => move(index, -1)}><ArrowUp /></Button
                  >
                  <Button
                    id={`oauth-rule-${mapping.draftId}-move-down`}
                    variant="ghost"
                    size="icon"
                    class="max-sm:size-11"
                    aria-label={`Move ${ruleLabel(mapping, index)} down`}
                    title="Move down"
                    disabled={index === mappings.length - 1}
                    onclick={() => move(index, 1)}><ArrowDown /></Button
                  >
                  <Button
                    variant="ghost"
                    size="icon"
                    class="max-sm:size-11"
                    aria-label={`Duplicate ${ruleLabel(mapping, index)}`}
                    title="Duplicate rule"
                    onclick={() => duplicateMapping(index)}><Copy /></Button
                  >
                  <Button
                    variant="ghost"
                    size="icon"
                    class="max-sm:size-11"
                    aria-label={`Remove ${ruleLabel(mapping, index)}`}
                    title="Remove rule"
                    onclick={() => removeMapping(index)}><Trash2 /></Button
                  >
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div class="grid gap-1.5">
                  <Label for={`oauth-rule-${mapping.draftId}-name`}>
                    Rule name <span class="font-normal text-muted-foreground"
                      >(optional)</span
                    >
                  </Label>
                  <Input
                    id={`oauth-rule-${mapping.draftId}-name`}
                    bind:value={mapping.name}
                    maxlength={80}
                    placeholder={`Rule ${index + 1}`}
                  />
                </div>
                <div class="flex items-center gap-2 sm:pt-7">
                  <Label for={`oauth-rule-${mapping.draftId}-enabled`}
                    >Enabled</Label
                  >
                  <Switch
                    id={`oauth-rule-${mapping.draftId}-enabled`}
                    bind:checked={mapping.enabled}
                  />
                </div>
              </div>

              <p class="rounded-md bg-muted/60 px-3 py-2 text-sm">
                {ruleSummary(mapping)}
              </p>

              <details
                class="rounded-md border bg-muted/20"
                bind:open={mapping.conditionsOpen}
              >
                <summary
                  class="cursor-pointer px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Rule conditions
                </summary>
                <div
                  class="grid items-start gap-3 border-t p-3 sm:grid-cols-2"
                  class:opacity-60={!mapping.enabled}
                >
                  <div class="grid gap-1.5">
                    <Label for={`oauth-rule-${mapping.draftId}-source`}
                      >Claim source</Label
                    >
                    <Select.Root
                      type="single"
                      bind:value={mapping.claimSource}
                      disabled={!mapping.enabled}
                    >
                      <Select.Trigger
                        id={`oauth-rule-${mapping.draftId}-source`}
                      >
                        {mapping.claimSource === 'userinfo'
                          ? 'UserInfo'
                          : 'ID token'}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="userinfo" label="UserInfo" />
                        <Select.Item value="id_token" label="ID token" />
                      </Select.Content>
                    </Select.Root>
                    <p class="text-xs text-muted-foreground">
                      UserInfo is fetched from the provider. The ID token is
                      returned during login.
                    </p>
                  </div>
                  <div class="grid gap-1.5">
                    <Label for={`oauth-rule-${mapping.draftId}-path`}
                      >Claim path</Label
                    >
                    <Input
                      id={`oauth-rule-${mapping.draftId}-path`}
                      bind:value={mapping.claimPath}
                      placeholder="/groups"
                      disabled={!mapping.enabled}
                      aria-invalid={Boolean(errors.claimPath)}
                      aria-describedby={errors.claimPath
                        ? `oauth-rule-${mapping.draftId}-path-error`
                        : undefined}
                    />
                    {#if errors.claimPath}
                      <p
                        id={`oauth-rule-${mapping.draftId}-path-error`}
                        class="text-xs text-destructive"
                      >
                        {errors.claimPath}
                      </p>
                    {:else}
                      <p class="text-xs text-muted-foreground">
                        JSON Pointer syntax. Nested claims look like
                        /realm_access/roles.
                      </p>
                    {/if}
                  </div>
                  <div class="grid gap-1.5">
                    <Label for={`oauth-rule-${mapping.draftId}-comparison`}
                      >Comparison</Label
                    >
                    <Select.Root
                      type="single"
                      bind:value={mapping.operator}
                      disabled={!mapping.enabled}
                    >
                      <Select.Trigger
                        id={`oauth-rule-${mapping.draftId}-comparison`}
                      >
                        {mapping.operator === 'equals' ? 'Equals' : 'Contains'}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="equals" label="Equals" />
                        <Select.Item value="contains" label="Contains" />
                      </Select.Content>
                    </Select.Root>
                    <p class="text-xs text-muted-foreground">
                      Contains finds a substring in text or an exact item in an
                      array. Matching is case-sensitive.
                    </p>
                  </div>
                  <div class="grid gap-1.5">
                    <Label for={`oauth-rule-${mapping.draftId}-value`}
                      >Expected value</Label
                    >
                    <Input
                      id={`oauth-rule-${mapping.draftId}-value`}
                      bind:value={mapping.claimValue}
                      placeholder="airtrail-admins"
                      disabled={!mapping.enabled}
                      aria-invalid={Boolean(errors.claimValue)}
                      aria-describedby={errors.claimValue
                        ? `oauth-rule-${mapping.draftId}-value-error`
                        : undefined}
                    />
                    {#if errors.claimValue}
                      <p
                        id={`oauth-rule-${mapping.draftId}-value-error`}
                        class="text-xs text-destructive"
                      >
                        {errors.claimValue}
                      </p>
                    {/if}
                  </div>
                  <div class="grid gap-1.5 sm:col-span-2">
                    <Label for={`oauth-rule-${mapping.draftId}-role`}
                      >AirTrail role</Label
                    >
                    <Select.Root
                      type="single"
                      bind:value={mapping.roleId}
                      disabled={!mapping.enabled}
                    >
                      <Select.Trigger
                        id={`oauth-rule-${mapping.draftId}-role`}
                        aria-invalid={Boolean(errors.roleId)}
                        aria-describedby={errors.roleId
                          ? `oauth-rule-${mapping.draftId}-role-error`
                          : undefined}
                        >{roleName(mapping.roleId)}</Select.Trigger
                      >
                      <Select.Content>
                        {#each roles as role}<Select.Item
                            value={role.id}
                            label={role.name}
                          />{/each}
                      </Select.Content>
                    </Select.Root>
                    {#if errors.roleId}
                      <p
                        id={`oauth-rule-${mapping.draftId}-role-error`}
                        class="text-xs text-destructive"
                      >
                        {errors.roleId}
                      </p>
                    {/if}
                  </div>
                </div>
              </details>
            </fieldset>
          {/each}
        </div>
      {/if}

      {#if mappings.length > 0}
        <Button variant="outline" size="sm" onclick={addMapping}>
          <Plus />
          Add rule
        </Button>
      {/if}

      <details class="rounded-lg border" open={mode === 'on_login'}>
        <summary
          class="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Test with sample claims
          {#if testIsCurrent}
            <span
              class="ml-1 text-xs font-normal text-green-600 dark:text-green-400"
              >Current draft tested</span
            >
          {/if}
        </summary>
        <div class="space-y-4 border-t p-4">
          <p class="text-sm text-muted-foreground">
            Paste sanitized claims from a recent sign-in. If you changed scopes
            or provider claim mappings, sign in again first. AirTrail uses the
            same evaluator as login and does not save this sample.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <Label for="oauth-test-userinfo">UserInfo claims</Label>
              <Textarea
                id="oauth-test-userinfo"
                bind:value={userinfoJson}
                class="min-h-32 font-mono text-xs"
                spellcheck="false"
                aria-invalid={Boolean(userinfoError)}
                aria-describedby={userinfoError
                  ? 'oauth-test-userinfo-error'
                  : undefined}
                oninput={() => (userinfoError = '')}
              />
              {#if userinfoError}<p
                  id="oauth-test-userinfo-error"
                  class="text-xs text-destructive"
                >
                  {userinfoError}
                </p>{/if}
            </div>
            <div class="grid gap-1.5">
              <Label for="oauth-test-id-token">ID token claims</Label>
              <Textarea
                id="oauth-test-id-token"
                bind:value={idTokenJson}
                class="min-h-32 font-mono text-xs"
                spellcheck="false"
                aria-invalid={Boolean(idTokenError)}
                aria-describedby={idTokenError
                  ? 'oauth-test-id-token-error'
                  : undefined}
                oninput={() => (idTokenError = '')}
              />
              {#if idTokenError}<p
                  id="oauth-test-id-token-error"
                  class="text-xs text-destructive"
                >
                  {idTokenError}
                </p>{/if}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onclick={testRules}
              loading={testState.kind === 'loading'}
              disabled={hasErrors}
            >
              Test rules
            </Button>
            {#if !testIsCurrent && testState.kind === 'success'}
              <p class="text-xs text-muted-foreground">
                The draft changed after this test. Run it again before
                publishing.
              </p>
            {/if}
          </div>
          {#if testState.kind === 'success'}
            <Alert.Root
              variant={testState.result.kind === 'matched'
                ? 'success'
                : 'warning'}
            >
              {#if testState.result.kind === 'matched'}
                <Info />
                <Alert.Title
                  >{testState.result.roleName} would be assigned</Alert.Title
                >
                <Alert.Description>
                  {testedRuleLabel(testState.result.ruleIndex)} matched first.
                </Alert.Description>
              {:else}
                <TriangleAlert />
                <Alert.Title>
                  No rule matched. {testState.result.roleName} would be assigned.
                </Alert.Title>
                <Alert.Description>
                  <ul class="list-disc space-y-1 pl-4">
                    {#each testState.result.diagnostics as diagnostic}
                      <li>{diagnosticText(diagnostic)}</li>
                    {/each}
                  </ul>
                </Alert.Description>
              {/if}
            </Alert.Root>
          {:else if testState.kind === 'error'}
            <Alert.Root variant="destructive">
              <TriangleAlert />
              <Alert.Title>Test failed</Alert.Title>
              <Alert.Description>{testState.message}</Alert.Description>
            </Alert.Root>
          {/if}
        </div>
      </details>
    {/if}

    <div
      class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur"
    >
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        {#if isDirty}
          <span class="size-2 rounded-full bg-amber-500"></span>
          Unsaved changes
        {:else}
          {enabledRuleCount} enabled {enabledRuleCount === 1 ? 'rule' : 'rules'}
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!isDirty || saving}
          onclick={reset}>Reset</Button
        >
        <Button
          size="sm"
          onclick={save}
          loading={saving}
          disabled={!isDirty ||
            hasErrors ||
            (mode === 'on_login' && !testIsCurrent)}
          title={mode === 'on_login' && !testIsCurrent
            ? 'Test the current draft before publishing'
            : undefined}
          >{mode === 'on_login'
            ? 'Publish policy'
            : 'Save role assignment'}</Button
        >
      </div>
    </div>
    <p class="sr-only" aria-live="polite">{announcement}</p>
  {/if}
</section>
