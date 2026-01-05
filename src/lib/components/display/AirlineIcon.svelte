<script lang="ts">
  import { Plane } from '@o7/icon/lucide';
  import { Airlines } from '@o7/icon/material/solid';

  import * as Avatar from '$lib/components/ui/avatar';
  import type { Airline } from '$lib/db/types';

  let {
    airline,
    size = 24,
    class: className = '',
    fallback = 'airline',
  }: {
    airline: Airline | null;
    size?: number;
    class?: string;
    fallback?: 'airline' | 'plane';
  } = $props();

  let loadingStatus = $state<'loading' | 'loaded' | 'error'>('loading');

  const hasIcon = $derived(!!airline?.iconPath);
</script>

{#if hasIcon}
  <Avatar.Root
    bind:loadingStatus
    class="rounded-none bg-transparent {className}"
    style="width: {size}px; height: {size}px;"
  >
    <Avatar.Image
      src="/api/uploads/{airline?.iconPath}"
      alt={airline?.name}
      class="object-contain"
    />
    <Avatar.Fallback class="rounded-none bg-transparent">
      <div
        class="flex items-center justify-center text-destructive"
        style:width="{size}px"
        style:height="{size}px"
        title="Failed to load icon"
      >
        {@render fallbackIcon()}
      </div>
    </Avatar.Fallback>
  </Avatar.Root>
{:else}
  <div
    class="flex items-center justify-center shrink-0 text-muted-foreground {className}"
    style:width="{size}px"
    style:height="{size}px"
  >
    {@render fallbackIcon()}
  </div>
{/if}

{#snippet fallbackIcon()}
  {#if fallback === 'plane'}
    <Plane size={size * 0.7} />
  {:else}
    <Airlines size={size * 0.8} />
  {/if}
{/snippet}
