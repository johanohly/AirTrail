<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { FilterIcon } from 'bits-ui';
  let { icon }: { icon?: FilterIcon } = $props();
  const isComponent = $derived(
    typeof icon === 'function' &&
      (icon.length >= 2 || !!(icon.prototype && '$destroy' in icon.prototype)),
  );
  const Icon = $derived(
    isComponent
      ? (icon as Component<{ size?: number; 'aria-hidden'?: boolean }>)
      : undefined,
  );
  const snippet = $derived(
    !isComponent ? (icon as Snippet | undefined) : undefined,
  );
</script>

{#if icon}<span data-filter-menu-icon aria-hidden="true"
    >{#if Icon}<Icon
        size={16}
        aria-hidden
      />{:else if snippet}{@render snippet()}{/if}</span
  >{/if}
