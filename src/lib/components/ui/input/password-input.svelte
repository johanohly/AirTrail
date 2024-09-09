<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { InputEvents } from './index.js';
  import { cn } from '$lib/utils';
  import { Eye, EyeOff } from '@o7/icon/lucide';

  type $$Props = HTMLInputAttributes;
  type $$Events = InputEvents;

  let className: $$Props['class'] = undefined;
  export let value: $$Props['value'] = undefined;
  export { className as class };

  let showPassword = false;
</script>

<div class="relative w-full">
  <input
    type={showPassword ? 'text' : 'password'}
    class={cn(
      '!pr-12 border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    bind:value
    on:blur
    on:change
    on:click
    on:focus
    on:focusin
    on:focusout
    on:keydown
    on:keypress
    on:keyup
    on:mouseover
    on:mouseenter
    on:mouseleave
    on:mousemove
    on:paste
    on:input
    on:wheel|passive
    {...$$restProps}
  />
  {#if value.length > 0}
    <button
      on:click={() => (showPassword = !showPassword)}
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
