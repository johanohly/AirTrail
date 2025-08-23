<script lang="ts">
  import { Eye, EyeOff } from '@o7/icon/lucide';
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLInputAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

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
      'pr-12! border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
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
