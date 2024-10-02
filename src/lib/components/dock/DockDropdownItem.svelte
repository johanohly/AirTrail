<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Motion } from 'svelte-motion';
  import { cn } from '$lib/utils';
  import { ChevronRight } from '@o7/icon/lucide';

  let {
    items,
    label,
    children,
  }: {
    items: { label: string; href: string }[];
    label: string;
    children: Snippet;
  } = $props();

  const variants = {
    visible: {
      clipPath: 'inset(0% 0% 0% 0% round 12px)',
      transition: {
        type: 'spring',
        bounce: 0,
      },
    },
    hidden: {
      clipPath: 'inset(10% 50% 90% 50% round 12px)',
      transition: {
        duration: 0.3,
        type: 'spring',
        bounce: 0,
      },
    },
  };

  let hovered = $state(false);
</script>

<div
  role="button"
  tabindex="0"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  {@render children()}
</div>

<Motion
  animate={hovered ? 'visible' : 'hidden'}
  {variants}
  initial="hidden"
  let:motion
>
  <ul
    use:motion
    class={cn(
      'absolute z-[1] max-w-[200px] w-full space-y-3 p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl',
      hovered ? 'pointer-events-auto' : 'pointer-events-none',
    )}
  >
    {#each items as item, i}
      <Motion
        custom={i + 1}
        {variants}
        initial="hidden"
        animate={hovered ? 'visible' : 'hidden'}
        let:motion
      >
        <li use:motion>
          <a
            href={item.href}
            class="group flex items-center gap-2 rounded-md border border-transparent text-neutral-400 hover:text-neutral-300 focus-visible:text-neutral-300 focus-visible:border-neutral-800 focus-visible:outline-none"
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
