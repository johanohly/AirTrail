<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Modal } from '$lib/components/ui/modal';
  import type { ApiKey } from '$lib/db/types';
  import { api } from '$lib/trpc';

  let { keys = $bindable() }: { keys: ApiKey[] } = $props();

  let open = $state(false);
  let name = $state('');
  let loading = $state(false);
  let key = $state('');

  const create = async () => {
    if (!name) return;

    loading = true;
    const result = await api.user.createApiKey.mutate(name);
    if (!result) {
      loading = false;
      toast.error('Failed to create API key');
      return;
    }

    key = result;
    keys.push({ name, createdAt: new Date(), lastUsed: null, id: 1111 });
    loading = false;

    toast.success('API key created');
  };
</script>

<Button variant="outline" onclick={() => (open = true)}>Create</Button>

<Modal bind:open dialogOnly>
  <h1>Create API Key</h1>
  {#if !key}
    <Label>Name</Label>
    <Input bind:value={name} />
    <Button onclick={create} disabled={loading} class="mt-1">
      {#if loading}
        <LoaderCircle />
      {/if}
      Create
    </Button>
  {:else}
    <Label>API Key</Label>
    <Input value={key} readonly />
    <Button onclick={() => (open = false)} class="mt-1">Got it</Button>
  {/if}
</Modal>
