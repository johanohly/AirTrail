<script lang="ts">
  import { DockItem } from '$lib/components/dock';
  import * as Tooltip from '$lib/components/ui/tooltip';

  export let item: {
    label: string;
    icon: any;
    id?: string;
    testId?: string;
    href?: string;
    onClick?: () => void;
  };
  const onClick = () => {
    if (item.onClick) item.onClick();
  };
</script>

<DockItem>
  {#if item.href}
    <a
      href={item.href}
      target={item.href.startsWith('http') ? '_blank' : '_self'}
      referrerpolicy="no-referrer"
    >
      <Tooltip.Root delayDuration={0}>
        <Tooltip.Trigger
          data-testid={item.testId}
          class="hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 rounded-full p-3 mx-0"
        >
          <svelte:component this={item.icon} />
        </Tooltip.Trigger>
        <Tooltip.Content sideOffset={8}>
          <p>{item.label}</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </a>
  {:else}
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger
        id={item.id}
        data-testid={item.testId}
        onclick={onClick}
        class="hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 rounded-full p-3 mx-0"
      >
        <svelte:component this={item.icon} />
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <p>{item.label}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}
</DockItem>
