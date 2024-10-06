<script lang="ts">
  import { DockItem } from '$lib/components/dock';
  import * as Tooltip from '$lib/components/ui/tooltip';

  export let item: {
    label: string;
    icon: any;
    href?: string;
    onClick?: () => void;
  };
  const onClick = () => {
    if (item.onClick) item.onClick();
  };

  export let mouseX: number;
  export let distance: number | undefined;
  export let magnification: number | undefined;
</script>

<DockItem {mouseX} {distance} {magnification}>
  {#if item.href}
    <a
      href={item.href}
      target={item.href.startsWith('http') ? '_blank' : '_self'}
      referrerpolicy="no-referrer"
    >
      <Tooltip.Root openDelay={0}>
        <Tooltip.Trigger
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
    <Tooltip.Root openDelay={0}>
      <Tooltip.Trigger
        class="hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 rounded-full p-3 mx-0"
      >
        <svelte:component this={item.icon} onclick={onClick} />
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <p>{item.label}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}
</DockItem>
