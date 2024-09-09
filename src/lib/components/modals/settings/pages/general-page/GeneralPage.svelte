<script lang="ts">
  import { PageHeader } from '../index';
  import { toTitleCase } from '$lib/utils';
  import { Button } from '$lib/components/ui/form';
  import EditUserForm from './EditUserForm.svelte';
  import { page } from '$app/stores';

  const user = $derived($page.data.user);
</script>

<PageHeader
  title="General"
  subtitle="Set up your account and manage your settings."
>
  {#if user}
    <div class="flex justify-between">
      <div>
        <h4 class="font-medium leading-4">{user.displayName}</h4>
        <span class="text-sm text-muted-foreground"
          >{toTitleCase(user.role)}</span
        >
      </div>
      <form method="POST" action="/log-out">
        <Button variant="destructiveOutline">Log out</Button>
      </form>
    </div>
    <EditUserForm />
  {/if}
</PageHeader>
