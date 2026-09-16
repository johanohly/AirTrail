<script lang="ts">
  import { Check, Minus } from '@o7/icon/lucide';

  import { cn } from '$lib/utils';

  let {
    checked,
    indeterminate = false,
    disabled = false,
    inherited = false,
    label,
    title,
    onclick,
  }: {
    checked: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    inherited?: boolean;
    label: string;
    title?: string;
    onclick: () => void;
  } = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={indeterminate ? 'mixed' : checked}
  {disabled}
  {title}
  class="inline-flex h-7 items-center gap-2 whitespace-nowrap text-xs text-foreground focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
  {onclick}
>
  <span
    class={cn(
      'flex size-4 shrink-0 items-center justify-center rounded-sm border border-foreground/35 bg-background transition-[background-color,border-color,color]',
      (checked || indeterminate) &&
        'border-foreground bg-foreground text-background',
      inherited &&
        'border-muted-foreground bg-muted-foreground text-background',
    )}
    aria-hidden="true"
  >
    {#if indeterminate}
      <Minus size={12} strokeWidth={2.5} />
    {:else if checked}
      <Check size={12} strokeWidth={2.5} />
    {/if}
  </span>
  <span>{label}</span>
</button>
