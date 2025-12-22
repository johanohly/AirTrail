<script lang="ts">
  import { Check, Funnel, Plane, PlaneLanding, PlaneTakeoff } from '@o7/icon';
  import { Airlines } from '@o7/icon/material';

  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';
  import { cn } from '$lib/utils';
  import type { Snippet, SvelteComponent } from 'svelte';

  let {
    filterValues = $bindable<string[]>(),
    title,
    placeholder,
    triggerIcon,
    itemIcon,
    disabled,
    options,
  }: {
    filterValues: string[];
    title: string;
    placeholder: string;
    triggerIcon: string;
    itemIcon?: Snippet<[string]>;
    disabled: boolean;
    options: { value: string; label: string; shortLabel?: string }[];
  } = $props();

  let open = $state(false);

  const optionByValue = $derived.by(() => {
    const map = new Map<
      string,
      { value: string; label: string; shortLabel?: string }
    >();
    for (const o of options ?? []) map.set(o.value, o);
    return map;
  });

  function getShortLabel(value: string) {
    const opt = optionByValue.get(value);
    return opt?.shortLabel ?? opt?.label ?? value;
  }

  function handleSelect(currentValue: string) {
    if (Array.isArray(filterValues) && filterValues.includes(currentValue)) {
      filterValues = filterValues.filter((v) => v !== currentValue);
    } else {
      filterValues = [
        ...(Array.isArray(filterValues) ? filterValues : []),
        currentValue,
      ];
    }
  }
</script>

{#snippet checkbox(value: string)}
  <div
    class={cn(
      'border-foreground flex size-5 shrink-0 items-center justify-center rounded-sm border',
      filterValues.includes(value)
        ? 'text-foreground'
        : 'opacity-50 [&_svg]:invisible',
    )}
  >
    <Check className="size-4" />
  </div>
{/snippet}

{#snippet optionLabel(
  option: { value: string; label: string },
  grow: boolean = false,
)}
  <span class={cn('truncate', grow && 'flex-1')} title={option.label}>
    {option.label}
  </span>
{/snippet}

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        size="sm"
        class="h-8 border-dashed"
        {...props}
        {disabled}
      >
        {#if triggerIcon == 'plane'}
          <Plane size={16} class="mr-2" />
        {:else if triggerIcon == 'depart'}
          <PlaneTakeoff size={16} class="mr-2" />
        {:else if triggerIcon == 'arrive'}
          <PlaneLanding size={16} class="mr-2" />
        {:else if triggerIcon == 'airline'}
          <Airlines size={20} class="mr-2" />
        {:else}
          <Funnel size={16} class="mr-2" />
        {/if}
        {title}

        {#if filterValues.length > 0}
          <Separator orientation="vertical" class="mx-2 h-4" />
          <Badge
            variant="secondary"
            class="rounded-sm px-1 font-normal lg:hidden"
          >
            {filterValues.length}
          </Badge>
          <div class="hidden space-x-1 lg:flex">
            {#if filterValues.length > 2}
              <Badge variant="secondary" class="rounded-sm px-1 font-normal">
                {filterValues.length} Selected
              </Badge>
            {:else}
              {#each filterValues as value}
                <Badge variant="secondary" class="rounded-sm px-1 font-normal">
                  {getShortLabel(value)}
                </Badge>
              {/each}
            {/if}
          </div>
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="max-w-[400px] p-0" align="start" side="bottom">
    <Command.Root>
      <Command.Input {placeholder} />
      <Command.List>
        <Command.Viewport>
          <Command.Empty>No results found.</Command.Empty>
          <Command.Group>
            {#each options as option}
              <Command.Item
                value={option.value}
                keywords={[option.label]}
                onSelect={() => handleSelect(option.value)}
              >
                {#if itemIcon}
                  {@render itemIcon(option.value)}
                  {@render optionLabel(option, true)}
                  {@render checkbox(option.value)}
                {:else}
                  {@render checkbox(option.value)}
                  {@render optionLabel(option)}
                {/if}
              </Command.Item>
            {/each}
          </Command.Group>
          {#if filterValues.length > 0}
            <Command.Separator />
            <Command.Item
              class="justify-center text-center"
              value="clear"
              onSelect={() => {
                filterValues = [];
              }}
            >
              Clear filters
            </Command.Item>
          {/if}
        </Command.Viewport>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
