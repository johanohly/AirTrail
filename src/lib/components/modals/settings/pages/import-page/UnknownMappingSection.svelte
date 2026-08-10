<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    codes,
    separated = false,
    children,
  }: {
    title: string;
    codes: string[];
    separated?: boolean;
    children: Snippet<[string]>;
  } = $props();
</script>

{#if codes.length}
  <div class="space-y-2" class:mt-4={separated}>
    <p class="text-xs font-medium text-muted-foreground uppercase">
      {title} ({codes.length})
    </p>
    {#each codes as code (code)}
      <div
        class="grid grid-cols-1 items-start gap-2 min-[440px]:grid-cols-[minmax(7rem,2fr)_minmax(0,3fr)] min-[440px]:gap-3"
      >
        <div
          class="flex min-h-9 min-w-0 items-center rounded-md border bg-muted/50 px-3 py-2"
        >
          <span
            class="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]"
            title={code}>{code}</span
          >
        </div>
        <div class="min-w-0">{@render children(code)}</div>
      </div>
    {/each}
  </div>
{/if}
