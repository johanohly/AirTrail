<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import EditPassword from './EditPassword.svelte';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { appConfig } from '$lib/state.svelte';
  import { api, trpc } from '$lib/trpc';

  const user = $derived($page.data.user);

  let oauthLoading = $state(false);
  const linkOAuth = async () => {
    oauthLoading = true;
    const redirect = window.location.origin + '/login';
    if (!redirect) return;

    try {
      const resp = await api.oauth.authorize.query(redirect);
      window.location.href = resp.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      oauthLoading = false;
    }
  };

  const unlinkOAuth = async () => {
    oauthLoading = true;
    try {
      await api.oauth.unlink.mutate();
      await invalidateAll();
      toast.info('OAuth unlinked successfully.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      oauthLoading = false;
    }
  };

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
  {#if user && appConfig?.config?.oauth?.enabled}
    <div class="flex items-center justify-between p-4 rounded-lg border">
      <div class="space-y-0.5">
        <h4 class="font-medium leading-4">OAuth</h4>
        <p class="text-sm text-muted-foreground">
          {#if user.oauthId}
            You can currently sign in via OAuth.
          {:else}
            Link your account to an OAuth provider.
          {/if}
        </p>
      </div>
      <div>
        {#if user.oauthId}
          <Confirm
            onConfirm={unlinkOAuth}
            title="Unlink OAuth"
            description="Are you sure you want to unlink your OAuth account? If you do not have a password set, you will not be able to sign in."
            confirmText="Unlink"
          >
            {#snippet triggerContent({ props })}
              <Button variant="outline" {...props} disabled={oauthLoading}>
                {#if oauthLoading}
                  <LoaderCircle class="animate-spin mr-1" size={16} />
                {/if}
                Unlink
              </Button>
            {/snippet}
          </Confirm>
        {:else}
          <Button onclick={linkOAuth} disabled={oauthLoading} variant="outline">
            {#if oauthLoading}
              <LoaderCircle class="animate-spin mr-1" size={16} />
            {/if}
            Link
          </Button>
        {/if}
      </div>
    </div>
  {/if}
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
