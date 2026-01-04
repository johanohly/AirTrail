<script lang="ts">
  import { ChevronRight } from '@o7/icon';
  import type { Component } from 'svelte';

  import ModalHeader from './ModalHeader.svelte';

  let {
    section,
    title,
    icon,
  }: {
    section: string;
    title: string;
    icon: Component<{ size: number }>;
  } = $props();

  const Icon = icon;
</script>

<ModalHeader>
  <div class="flex min-w-0 max-w-full items-center gap-1">
    <div class="flex min-w-0 items-center gap-2 px-1.5">
      <span class="min-w-0 truncate text-sm font-semibold">{section}</span>
    </div>
    <ChevronRight size={14} class="text-muted-foreground shrink-0" />
    <div class="flex min-w-0 items-center gap-2 px-1">
      <div
        class="flex items-center justify-center rounded-full bg-muted px-0 size-5 shrink-0"
      >
        <Icon size={14} />
      </div>
      <h3 class="!mt-0 max-w-sm truncate text-sm font-medium">{title}</h3>
    </div>
  </div>
</ModalHeader>
