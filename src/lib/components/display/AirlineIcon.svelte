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

  const iconPath = $derived(airline?.iconPath ?? null);
  const hasIcon = $derived(!!iconPath);
  const iconSrc = $derived(iconPath ? `/api/uploads/${iconPath}` : '');

  // Logos sit on a white chip (like MortgageLab lender logos), scaled with size
  const padding = $derived(Math.max(2, Math.round(size / 9)));
  const radius = $derived(Math.max(4, Math.round(size / 6)));
</script>

{#if hasIcon}
  <Avatar.Root
    bind:loadingStatus
    class="bg-white {className}"
    style="width: {size}px; height: {size}px; border-radius: {radius}px;"
  >
    <Avatar.Image
      src={iconSrc}
      alt={airline?.name}
      title={airline?.name}
      class="object-contain"
      style="padding: {padding}px;"
    />
    <Avatar.Fallback class="bg-white" style="border-radius: {radius}px;">
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
