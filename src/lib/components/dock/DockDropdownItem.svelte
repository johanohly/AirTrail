<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Motion } from 'svelte-motion';
  import { cn } from '$lib/utils';
  import { ChevronRight } from '@o7/icon/lucide';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    items,
    label,
    children,
  }: {
    items: { label: string; href: string }[];
    label: string;
    children: Snippet;
  } = $props();

  const listVariants = {
    visible: {
      clipPath: 'inset(0% 0% 0% 0% round 12px)',
      transition: {
        type: 'spring',
        bounce: 0,
      },
    },
    hidden: {
      clipPath: 'inset(90% 50% 10% 50% round 12px)',
      transition: {
        duration: 0.3,
        type: 'spring',
        bounce: 0,
      },
    },
  };
  const itemVariants = {
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.3,
        delay: (items.length + 1 - i) * 0.15,
      },
    }),
    hidden: {
      opacity: 0,
      scale: 0.3,
      filter: 'blur(20px)',
    },
  };

  let open = $state(false);
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && (open = false)} />

<div
  role="button"
  tabindex="0"
  onkeyup={(e) => e.key === 'Enter' && (open = !open)}
  onclick={() => (open = !open)}
  class="flex aspect-square cursor-pointer items-center justify-center rounded-full"
>
  <Tooltip.Root openDelay={0}>
    <Tooltip.Trigger
      class="hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 rounded-full p-3 mx-0"
    >
      {@render children()}
    </Tooltip.Trigger>
    <Tooltip.Content sideOffset={8}>
      <p>{label}</p>
    </Tooltip.Content>
  </Tooltip.Root>
</div>

<Motion
  animate={open ? 'visible' : 'hidden'}
  variants={listVariants}
  initial="hidden"
  let:motion
>
  <ul
    use:motion
    class={cn(
      'fixed bottom-[60px] left-1/2 translate-x-[-50%] z-[1] max-w-[200px] w-full space-y-1 p-2 bg-background/70 border backdrop-blur-md rounded-xl',
      open ? 'pointer-events-auto' : 'pointer-events-none',
    )}
  >
    {#each items as item, i}
      <Motion
        custom={i + 1}
        variants={itemVariants}
        initial="hidden"
        animate={open ? 'visible' : 'hidden'}
        let:motion
      >
        <li use:motion>
          <a
            href={item.href}
            onclick={() => (open = false)}
            class="group flex items-center p-2 gap-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 focus-visible:text-foreground focus-visible:border focus-visible:outline-none"
          >
            <span class="flex items-center gap-1 text-sm font-medium">
              {item.label}
              <ChevronRight
                size={12}
                class="-translate-x-1 scale-0 opacity-0 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all"
              />
            </span>
          </a>
        </li>
      </Motion>
    {/each}
  </ul>
</Motion>
