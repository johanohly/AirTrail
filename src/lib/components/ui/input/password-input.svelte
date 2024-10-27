<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { WithElementRef } from 'bits-ui';
  import { cn } from '$lib/utils';
  import { Eye, EyeOff } from '@o7/icon/lucide';

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    ...restProps
  }: WithElementRef<HTMLInputAttributes> = $props();

  let showPassword = $state(false);
</script>

<div class="relative w-full">
  <input
    bind:this={ref}
    {...restProps}
    type={showPassword ? 'text' : 'password'}
    class={cn(
      '!pr-12 border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    bind:value
  />
  {#if value.length > 0}
    <button
      onclick={() => (showPassword = !showPassword)}
      type="button"
      tabindex="-1"
      class="absolute inset-y-0 end-0 px-4"
      title="Toggle password visibility"
    >
      {#if showPassword}
        <EyeOff size="20" />
      {:else}
        <Eye size="20" />
      {/if}
    </button>
  {/if}
</div>
