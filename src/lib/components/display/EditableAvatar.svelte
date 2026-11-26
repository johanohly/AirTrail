<script lang="ts">
  import { Loader, Upload, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import UserAvatar from './UserAvatar.svelte';

  const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

  type Props = {
    user: { id: string; username: string; avatarHash: string | null };
    /** Sends `userId` so an admin changes another user's picture. */
    forOtherUser?: boolean;
    editable?: boolean;
    /** Tooltip on the avatar when it can't be edited. */
    lockedTitle?: string;
    size?: number;
    onChanged?: (avatarHash: string | null) => void | Promise<void>;
  };

  let {
    user,
    forOtherUser = false,
    editable = true,
    lockedTitle,
    size = 40,
    onChanged,
  }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);
  let busy = $state(false);

  const send = async (init: RequestInit, success: string, failure: string) => {
    busy = true;
    try {
      const response = await fetch('/api/users/avatar', init);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : failure);
        return;
      }
      await onChanged?.(
        typeof body?.avatarHash === 'string' ? body.avatarHash : null,
      );
      toast.success(success);
    } catch {
      toast.error(failure);
    } finally {
      busy = false;
    }
  };

  const onChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    if (forOtherUser) body.append('userId', user.id);
    void send(
      { method: 'POST', body },
      'Picture updated',
      'Failed to upload picture',
    );
  };

  const remove = () =>
    send(
      forOtherUser
        ? {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          }
        : { method: 'DELETE' },
      'Picture removed',
      'Failed to remove picture',
    );

  const action = $derived(
    user.avatarHash ? 'Change profile picture' : 'Upload profile picture',
  );
</script>

{#if editable}
  <div class="group relative shrink-0" style:width="{size}px">
    <button
      type="button"
      class="relative block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait"
      aria-label={action}
      title={action}
      disabled={busy}
      onclick={() => input?.click()}
    >
      <UserAvatar
        username={user.username}
        userId={user.id}
        avatarHash={user.avatarHash}
        {size}
        class="transition-[filter] group-hover:brightness-50 group-focus-within:brightness-50 {busy
          ? 'brightness-50'
          : ''}"
      />
      <span
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 {busy
          ? 'opacity-100'
          : ''}"
        aria-hidden="true"
      >
        {#if busy}
          <Loader size={size * 0.45} class="animate-spin" />
        {:else}
          <Upload size={size * 0.45} />
        {/if}
      </span>
    </button>
    {#if user.avatarHash && !busy}
      <button
        type="button"
        class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow-xs transition-[opacity,filter] hover:brightness-110 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        aria-label="Remove profile picture"
        title="Remove profile picture"
        onclick={remove}
      >
        <X size={10} />
      </button>
    {/if}
    <input
      bind:this={input}
      type="file"
      accept={ACCEPT}
      class="hidden"
      onchange={onChange}
    />
  </div>
{:else}
  <UserAvatar
    username={user.username}
    userId={user.id}
    avatarHash={user.avatarHash}
    {size}
    title={lockedTitle}
  />
{/if}
