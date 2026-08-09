<script lang="ts">
  import { ArrowDown, ArrowUp, Plus, Trash2 } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { api } from '$lib/trpc';
  import { getErrorText } from '$lib/utils/error';

  type Mode = 'off' | 'on_create' | 'on_login';
  type Mapping = {
    claimSource: 'userinfo' | 'id_token';
    claimPath: string;
    operator: 'equals' | 'contains';
    claimValue: string;
    roleId: string;
  };

  let mode = $state<Mode>('off');
  let mappings = $state<Mapping[]>([]);
  let roles = $state<Array<{ id: string; name: string }>>([]);
  let loading = $state(true);
  let saving = $state(false);

  const load = async () => {
    const [settings, roleData] = await Promise.all([
      api.role.oauthMappings.query(),
      api.role.list.query(),
    ]);
    mode = settings.oauthRoleMappingMode;
    mappings = settings.mappings.map((mapping) => ({
      claimSource: mapping.claimSource,
      claimPath: mapping.claimPath,
      operator: mapping.operator,
      claimValue: mapping.claimValue,
      roleId: mapping.roleId,
    }));
    roles = roleData.roles;
    loading = false;
  };

  onMount(load);

  const addMapping = () => {
    mappings = [
      ...mappings,
      {
        claimSource: 'userinfo',
        claimPath: '/groups',
        operator: 'contains',
        claimValue: '',
        roleId: roles[0]?.id ?? '',
      },
    ];
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= mappings.length) return;
    const next = [...mappings];
    [next[index], next[target]] = [next[target]!, next[index]!];
    mappings = next;
  };

  const save = async () => {
    saving = true;
    try {
      await api.role.updateOAuthMappings.mutate({ mode, mappings });
      toast.success('OAuth role mappings updated.');
      await load();
    } catch (error) {
      toast.error(getErrorText(error) || 'Could not save OAuth role mappings.');
    } finally {
      saving = false;
    }
  };
</script>

<section class="space-y-4 border-t pt-5">
  <div class="space-y-1">
    <h3 class="font-medium">Role mapping</h3>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Evaluate rules from top to bottom. The first match wins; users without a
      match receive the default role.
    </p>
  </div>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading mappings…</p>
  {:else}
    <div class="grid gap-2">
      <Label for="oauth-role-mapping-mode">Apply mappings</Label>
      <Select.Root
        type="single"
        bind:value={mode}
        name="oauth-role-mapping-mode"
      >
        <Select.Trigger id="oauth-role-mapping-mode">
          {mode === 'off'
            ? 'Off'
            : mode === 'on_create'
              ? 'When an account is created'
              : 'At every OAuth login'}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="off" label="Off" />
          <Select.Item value="on_create" label="When an account is created" />
          <Select.Item value="on_login" label="At every OAuth login" />
        </Select.Content>
      </Select.Root>
      <p class="text-xs leading-relaxed text-muted-foreground">
        Manual role changes are preserved. Login-time mapping only updates users
        whose role is still managed by OAuth.
      </p>
    </div>

    <div class="space-y-3">
      {#each mappings as mapping, index}
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium">Rule {index + 1}</p>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Move rule up"
                disabled={index === 0}
                onclick={() => move(index, -1)}
              >
                <ArrowUp class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Move rule down"
                disabled={index === mappings.length - 1}
                onclick={() => move(index, 1)}
              >
                <ArrowDown class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Remove rule"
                onclick={() =>
                  (mappings = mappings.filter((_, item) => item !== index))}
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <Label>Claim source</Label>
              <Select.Root type="single" bind:value={mapping.claimSource}>
                <Select.Trigger>
                  {mapping.claimSource === 'userinfo' ? 'UserInfo' : 'ID token'}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="userinfo" label="UserInfo" />
                  <Select.Item value="id_token" label="ID token" />
                </Select.Content>
              </Select.Root>
            </div>
            <div class="grid gap-1.5">
              <Label>JSON Pointer</Label>
              <Input bind:value={mapping.claimPath} placeholder="/groups" />
            </div>
            <div class="grid gap-1.5">
              <Label>Comparison</Label>
              <Select.Root type="single" bind:value={mapping.operator}>
                <Select.Trigger>
                  {mapping.operator === 'equals' ? 'Equals' : 'Contains'}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="equals" label="Equals" />
                  <Select.Item value="contains" label="Contains" />
                </Select.Content>
              </Select.Root>
            </div>
            <div class="grid gap-1.5">
              <Label>Claim value</Label>
              <Input
                bind:value={mapping.claimValue}
                placeholder="airtrail-admins"
              />
            </div>
            <div class="grid gap-1.5 sm:col-span-2">
              <Label>Assign role</Label>
              <Select.Root type="single" bind:value={mapping.roleId}>
                <Select.Trigger>
                  {roles.find((role) => role.id === mapping.roleId)?.name ??
                    'Select a role'}
                </Select.Trigger>
                <Select.Content>
                  {#each roles as role}
                    <Select.Item value={role.id} label={role.name} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" onclick={addMapping}>
        <Plus class="mr-1 size-4" />
        Add rule
      </Button>
      <Button size="sm" onclick={save} loading={saving}>Save mappings</Button>
    </div>
  {/if}
</section>
