<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    icon,
    title,
    value,
    unit = undefined,
  }: {
    icon: Snippet;
    title: string;
    value: number | null;
    unit?: string;
  } = $props();

  const zeros = $derived(() => {
    const maxLength = 10;
    if (value === null) {
      return '-'.repeat(maxLength);
    }
    const valueLength = value.toString().length;
    const zeroLength = maxLength - valueLength;

    return '0'.repeat(zeroLength);
  });
</script>

<div
  class="flex w-full h-[120px] flex-col justify-between rounded-3xl border bg-zinc-50 dark:bg-dark-1 p-5"
>
  <div class="flex place-items-center gap-2 text-primary">
    {@render icon()}
    <p>{title}</p>
  </div>

  <div class="relative text-center font-mono text-2xl font-semibold">
    <span class="text-[#DCDADA] dark:text-[#525252]">{zeros()}</span><span
      class="text-primary">{value}</span
    >
    {#if unit}
      <span class="absolute -top-5 right-2 text-base font-light text-gray-400"
        >{unit}</span
      >
    {/if}
  </div>
</div>
