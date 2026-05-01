<script lang="ts">
  import { Drawer as DrawerPrimitive } from '@johly/vaul-svelte';
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  import * as Drawer from '$lib/components/ui/drawer';
  import { Separator } from '$lib/components/ui/separator';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    open,
    header,
    actions,
    children,
    onOpenChange,
  }: {
    open: boolean;
    header: Snippet;
    actions?: Snippet;
    children: Snippet;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  let activeSnapPoint: string | number | null = $state(0.55);
</script>

{#if $isMediumScreen}
  {#if open}
    <div
      transition:fly={{ x: -32, duration: 260, easing: cubicOut }}
      class="absolute top-3 left-3 z-20 flex max-w-[calc(100vw-1.5rem)] items-start gap-2"
    >
      <aside
        class="glass-pane flex max-h-[calc(100vh-1.5rem)] w-[380px] max-w-full flex-col overflow-hidden rounded-xl"
      >
        {@render header()}
        <Separator />
        <div class="flex-1 divide-y divide-border/60 overflow-y-auto">
          {@render children()}
        </div>
      </aside>
      {#if actions}
        <div
          class="flex shrink-0 flex-col gap-1 rounded-lg border border-border/70 bg-background/95 p-1 shadow-xs"
          aria-label="Details actions"
        >
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <Drawer.Root
    {open}
    bind:activeSnapPoint
    snapPoints={[0.55, 0.95]}
    onOpenChange={(v) => onOpenChange?.(v)}
    shouldScaleBackground={false}
  >
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay
        class="fixed inset-0 z-40 bg-black/30 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in"
      />
      <DrawerPrimitive.Content
        class="glass-pane fixed right-0 bottom-0 left-0 z-50 flex h-[95vh] flex-col rounded-t-2xl outline-none"
      >
        <div
          class="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        ></div>
        <div class="shrink-0">
          {@render header()}
        </div>
        {#if actions}
          <div class="shrink-0 px-4 pb-3" aria-label="Details actions">
            <div
              class="flex gap-2 rounded-lg border border-border/70 bg-background/80 p-1"
            >
              {@render actions()}
            </div>
          </div>
        {/if}
        <Separator />
        <div
          class="flex-1 divide-y divide-border/60 overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        >
          {@render children()}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  </Drawer.Root>
{/if}
