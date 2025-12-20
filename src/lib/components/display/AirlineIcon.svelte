<script lang="ts">
  import { Plane } from '@o7/icon/lucide';
  import { Airlines } from '@o7/icon/material/solid';

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
</script>

{#if airline?.iconPath}
  <img
    src="/api/uploads/{airline.iconPath}"
    alt={airline.name}
    width={size}
    height={size}
    class="object-contain {className}"
  />
{:else}
  <div
    class="flex items-center justify-center shrink-0 text-muted-foreground {className}"
    style:width="{size}px"
    style:height="{size}px"
  >
    {#if fallback === 'plane'}
      <Plane size={size * 0.7} />
    {:else}
      <Airlines />
    {/if}
  </div>
{/if}
