<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import ApiKeys from './ApiKeys.svelte';
  import EditPassword from './EditPassword.svelte';
  import OAuth from './OAuth.svelte';

  import { page } from '$app/stores';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { api, trpc } from '$lib/trpc';

  const user = $derived($page.data.user);

  const deleteFlights = async () => {
    const toastId = toast.loading('Deleting all your flights...');
    try {
      await api.flight.deleteAll.mutate();
      await trpc.flight.list.utils.invalidate();
      toast.info('All your flights have been deleted.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete your flights', { id: toastId });
    }
  };
</script>

<PageHeader title="Security" subtitle="Manage your account security settings.">
  <div class="flex items-center justify-between p-4 rounded-lg border">
    <h4 class="font-medium leading-4">Password</h4>
    <div>
      <EditPassword />
    </div>
  </div>
  <OAuth {user} />
  <ApiKeys {user} />
  <div class="flex items-center justify-between p-4 rounded-lg border">
    <h4 class="font-medium leading-4">Danger zone</h4>
    <div>
      <Confirm
        onConfirm={deleteFlights}
        title="Delete all flights"
        description="Are you sure you want to delete all your flights? This does not include flights you share with other users. This action cannot be undone."
        confirmText="Delete"
      >
        {#snippet triggerContent({ props })}
          <Button variant="destructiveOutline" {...props}>
            Delete all flights
          </Button>
        {/snippet}
      </Confirm>
    </div>
  </div>
</PageHeader>
