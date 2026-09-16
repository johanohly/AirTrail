<script lang="ts">
  import { KeyRound, LoaderCircle } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import ScopePicker from '$lib/components/access/ScopePicker.svelte';
  import { Button } from '$lib/components/ui/button';
  import { CopyInput, Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import type { ApiKey } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { grantableScopes, type ApiScope } from '$lib/api/v1/scopes';
  import { page } from '$app/state';

  let { keys = $bindable() }: { keys: ApiKey[] } = $props();

  const scopes = $derived(grantableScopes(page.data.authorization));
  const readonlyScopeNames = () =>
    scopes.filter((scope) => scope.readOnly).map((scope) => scope.name);

  let open = $state(false);
  let name = $state('');
  let loading = $state(false);
  let key = $state('');
  let selectedScopes = $state<ApiScope[]>([]);

  const canCreate = $derived(
    name.trim().length > 0 && selectedScopes.length > 0 && !loading,
  );

  const create = async () => {
    if (!canCreate) return;

    loading = true;
    try {
      const result = await api.user.createApiKey.mutate({
        name,
        scopes: selectedScopes,
      });
      if (!result) {
        toast.error('Failed to create API key');
        return;
      }

      key = result;
      keys.push({
        name,
        createdAt: new Date(),
        lastUsed: null,
        id: 1111,
        scopes: [...selectedScopes],
      });
      toast.success('API key created');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create API key');
    } finally {
      loading = false;
    }
  };

  $effect(() => {
    if (!open) {
      name = '';
      key = '';
      selectedScopes = readonlyScopeNames();
    }
  });
</script>

<Button variant="outline" onclick={() => (open = true)}>Create</Button>

<Modal
  bind:open
  class="max-w-2xl"
  dismissal={key ? 'view' : 'form'}
  dirty={!key && name.length > 0}
  busy={loading}
  onDiscard={() => {
    name = '';
  }}
>
  <ModalBreadcrumbHeader
    section="API Keys"
    title="Create key"
    icon={KeyRound}
  />
  {#if !key}
    <ModalBody class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <Label for="api-key-name">Name</Label>
        <Input
          bind:value={name}
          id="api-key-name"
          placeholder="e.g. Home Assistant"
          autocomplete="off"
        />
      </div>
      <ScopePicker
        {scopes}
        bind:selected={selectedScopes}
        permissionsHelp="These permissions limit what the key can do. They are also limited by your current role, so the key never grants more than you have."
      />
    </ModalBody>
    <ModalFooter>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={create} disabled={!canCreate} class="gap-2">
        {#if loading}
          <LoaderCircle size={16} class="animate-spin" />
        {/if}
        Create key
      </Button>
    </ModalFooter>
  {:else}
    <ModalBody class="flex flex-col gap-4">
      <div>
        <h2 class="text-lg font-medium">Your API key</h2>
        <p class="text-sm text-muted-foreground">
          Copy it now and store it somewhere safe. You won't be able to see it
          again.
        </p>
      </div>
      <CopyInput value={key} />
    </ModalBody>
    <ModalFooter>
      <Button onclick={() => (open = false)}>Got it</Button>
    </ModalFooter>
  {/if}
</Modal>
