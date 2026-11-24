<script lang="ts">
  import { getMapContext } from 'svelte-maplibre';

  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { maplibregl } from '$lib/map/maplibre';
  import { cn } from '$lib/utils';

  let { besideDock = false }: { besideDock?: boolean } = $props();

  const mapContext = getMapContext();

  let credits = $state<string[]>([]);
  let row: HTMLElement | undefined = $state();
  let truncated = $state(false);
  let open = $state(false);

  const html = $derived(credits.join(' | '));

  // MapLibre joins the credits with a " | " text node, so the nodes between
  // two separators make up one credit.
  const readCredits = (container: HTMLElement) => {
    const inner = container.querySelector('.maplibregl-ctrl-attrib-inner');
    if (!inner || container.classList.contains('maplibregl-attrib-empty'))
      return [];

    const result: string[] = [];
    let group = document.createElement('div');
    const flush = () => {
      if (group.textContent?.trim()) result.push(group.innerHTML.trim());
      group = document.createElement('div');
    };
    for (const node of inner.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent === ' | ') {
        flush();
      } else {
        group.append(node.cloneNode(true));
      }
    }
    flush();
    return result;
  };

  $effect(() => {
    const map = mapContext.map;
    if (!map) return;

    // MapLibre's own control collects and sanitizes the credits of every
    // source in use. It stays detached, and the strip below renders them.
    const control = new maplibregl.AttributionControl({ compact: false });
    const container = control.onAdd(map);
    let last = '';
    const update = () => {
      const next = readCredits(container);
      if (next.join(' | ') === last) return;
      last = next.join(' | ');
      credits = next;
    };
    const observer = new MutationObserver(update);
    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true,
    });
    update();

    return () => {
      observer.disconnect();
      control.onRemove();
    };
  });

  // Whether the row fits is measured, so it also holds for narrow windows and
  // maps that don't fill the screen.
  $effect(() => {
    const element = row;
    if (!element || !html) return;

    const measure = () => {
      truncated = element.scrollWidth > element.clientWidth;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    return () => observer.disconnect();
  });
</script>

{#if html}
  <div
    class={cn(
      'absolute right-0 bottom-0 z-2 max-w-full rounded-tl-md bg-white/70 px-1.5 text-[10px] leading-4 text-neutral-700 backdrop-blur-[2px] dark:bg-neutral-950/60 dark:text-neutral-300',
      besideDock && 'md:max-w-[calc(50%-9.5rem)]',
    )}
  >
    <div
      bind:this={row}
      class="truncate [&_a]:text-inherit [&_a]:no-underline [&_a:hover]:underline"
    >
      {@html html}
    </div>
    {#if truncated}
      <button
        type="button"
        class="absolute inset-0 cursor-pointer rounded-tl-md focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Show map credits"
        onclick={() => (open = true)}
      ></button>
    {/if}
  </div>
{/if}

<Modal bind:open class="max-w-md">
  <ModalHeader>
    <h2 class="text-lg font-medium">Map credits</h2>
  </ModalHeader>
  <ModalBody>
    <p class="text-sm text-muted-foreground">The map is drawn from:</p>
    <ul
      class="mt-2 mb-4 flex flex-col gap-2 text-sm [&_a]:underline [&_a]:underline-offset-2"
    >
      {#each credits as credit (credit)}
        <li>{@html credit}</li>
      {/each}
    </ul>
  </ModalBody>
</Modal>
