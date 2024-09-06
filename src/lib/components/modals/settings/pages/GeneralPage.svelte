<script lang="ts">
  import { PageHeader } from '.';
  import { toTitleCase } from '$lib/utils';
  import type { User } from 'lucia';
  import { Button } from '$lib/components/ui/form';

  let { user }: { user: User } = $props();
</script>

<PageHeader
  title="General"
  subtitle="Set up your account and manage your settings."
>
  <div class="flex justify-between">
    <div>
      <h4 class="font-medium leading-4">Johan Ohly</h4>
      <span class="text-sm text-muted-foreground">{toTitleCase(user.role)}</span
      >
    </div>
    <form method="POST" action="/log-out">
      <Button variant="destructive">Log out</Button>
    </form>
  </div>
</PageHeader>
