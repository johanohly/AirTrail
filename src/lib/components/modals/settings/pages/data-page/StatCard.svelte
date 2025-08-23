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
    const maxLength = 13;
    if (value === null) {
      return '-'.repeat(maxLength);
    }
    const valueLength = value.toString().length;
    const zeroLength = maxLength - valueLength;

    return '0'.repeat(zeroLength);
  });
</script>

<div class="grid sm:grid-cols-2">
  <div class="flex place-items-center gap-4 text-primary">
    {@render icon()}
    <p>{title}</p>
  </div>

  <div class="relative font-mono text-2xl font-semibold sm:text-right">
    <span class="text-[#DCDADA] dark:text-[#525252]">{zeros()}</span><span
      class="text-primary">{value}</span
    >
  </div>
</div>
