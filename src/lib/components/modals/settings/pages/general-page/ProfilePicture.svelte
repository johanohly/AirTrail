<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { EditableAvatar } from '$lib/components/display';
  import { appConfig } from '$lib/state.svelte';

  let { size = 40 }: { size?: number } = $props();

  const user = $derived(page.data.user);
  const managedByOAuth = $derived(
    !!appConfig.config?.oauth?.syncPicture && !!user?.hasOAuthLinked,
  );
</script>

{#if user}
  <EditableAvatar
    {user}
    {size}
    editable={!managedByOAuth && !page.data.demo}
    lockedTitle={managedByOAuth
      ? 'Picture managed by your identity provider'
      : undefined}
    onChanged={() => invalidateAll()}
  />
{/if}
