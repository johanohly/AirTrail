<script lang="ts">
  import { renderHashvatar, type HashvatarOptions } from 'hashvatar';
  import type { HTMLCanvasAttributes } from 'svelte/elements';

  import { page } from '$app/state';
  import { cn } from '$lib/utils';
  import { avatarUrl } from '$lib/utils/avatar';

  type UserAvatarProps = Omit<HTMLCanvasAttributes, 'height' | 'width'> & {
    username?: string | null;
    /** With `avatarHash`, shows the user's picture instead of the pattern. */
    userId?: string | null;
    avatarHash?: string | null;
    size?: number;
    mode?: HashvatarOptions['mode'];
    animated?: boolean;
    dotScale?: number;
    tones?: HashvatarOptions['tones'];
  };

  let {
    username,
    userId,
    avatarHash,
    size = 32,
    mode = 'dither',
    animated = false,
    dotScale,
    tones,
    class: className,
    title,
    style,
    'aria-label': ariaLabel,
    ...restProps
  }: UserAvatarProps = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let failedSrc = $state<string | null>(null);

  // With no username given, the avatar is the signed-in user's own.
  const isSelf = $derived(username == null);
  const resolvedUsername = $derived(
    username ?? page.data.user?.username ?? 'anonymous',
  );
  const resolvedUserId = $derived(
    userId ?? (isSelf ? page.data.user?.id : null),
  );
  const resolvedHash = $derived(
    avatarHash !== undefined
      ? avatarHash
      : isSelf
        ? page.data.user?.avatarHash
        : null,
  );
  const src = $derived(
    resolvedUserId && resolvedHash
      ? avatarUrl(resolvedUserId, resolvedHash)
      : null,
  );
  const showImage = $derived(!!src && failedSrc !== src);
  const accessibleLabel = $derived(
    ariaLabel ?? title ?? `${resolvedUsername} avatar`,
  );

  $effect(() => {
    if (!canvas || showImage) return;

    return renderHashvatar(canvas, {
      hash: resolvedUsername,
      size,
      mode,
      animated,
      dotScale,
      tones,
    });
  });
</script>

{#if showImage && src}
  <img
    {src}
    alt={accessibleLabel}
    {title}
    width={size}
    height={size}
    loading="lazy"
    decoding="async"
    onerror={() => (failedSrc = src)}
    class={cn('block shrink-0 rounded-full bg-muted object-cover', className)}
    {style}
  />
{:else}
  <canvas
    bind:this={canvas}
    role="img"
    aria-label={accessibleLabel}
    {title}
    class={cn('block shrink-0 rounded-full bg-muted', className)}
    {style}
    {...restProps}
  ></canvas>
{/if}
