<script lang="ts">
  import { PageHeader } from '../index';

  import EditUserForm from './EditUserForm.svelte';
  import ProfilePicture from './ProfilePicture.svelte';

  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/form';

  const user = $derived($page.data.user);
</script>

<PageHeader
  title="General"
  subtitle="Set up your account and manage your settings."
>
  {#if user}
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <ProfilePicture size={40} />
        <div class="min-w-0">
          <h4 class="truncate font-medium leading-4">{user.displayName}</h4>
          <span class="text-sm text-muted-foreground">
            {user.isOwner ? 'Owner' : (user.roleName ?? 'No role')}
          </span>
        </div>
      </div>
      <form method="POST" action="/log-out">
        <Button variant="destructiveOutline">Log out</Button>
      </form>
    </div>
    <EditUserForm />
  {/if}
</PageHeader>
