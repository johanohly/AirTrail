<script lang="ts">
  import { Copy } from '@o7/icon/lucide';
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLInputAttributes } from 'svelte/elements';

  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    value,
    class: className,
    ...restProps
  }: WithElementRef<HTMLInputAttributes> = $props();

  let label = $state('Copy');
  let timeout: number;
  const copyToClipboard = async (text: string) => {
    if (timeout) clearTimeout(timeout);

    try {
      await navigator.clipboard.writeText(text);
      label = 'Copied';
      timeout = setTimeout(() => {
        label = 'Copy';
      }, 5000);
    } catch {
      label = 'Failed';
      timeout = setTimeout(() => {
        label = 'Copy';
      }, 5000);
    }
  };
</script>

<div class="relative w-full">
  <input
    bind:this={ref}
    {...restProps}
    type="text"
    class={cn(
      '!pr-12 border-input bg-background focus:outline-none flex h-10 w-full rounded-md border px-3 py-2 text-sm appearance-none cursor-default',
      className,
    )}
    {value}
  />
  <div class="absolute flex items-center end-2 inset-y-0">
    <Button
      onclick={() => copyToClipboard(value)}
      variant="outline"
      class="h-6 px-2 gap-1  text-xs"
      title="Copy to clipboard"
    >
      <Copy size={14} />
      {label}
    </Button>
  </div>
</div>
