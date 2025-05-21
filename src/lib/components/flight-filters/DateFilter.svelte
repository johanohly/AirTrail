<script lang="ts">
  import type { CalendarDate } from '@internationalized/date';
  import { CalendarArrowUp, CalendarArrowDown } from '@o7/icon/lucide';

  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Calendar } from '$lib/components/ui/calendar';
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';

  let {
    date = $bindable(),
    title,
    iconDirection,
    disabled,
  }: {
    date: CalendarDate | undefined;
    title: string;
    iconDirection: 'up' | 'down';
    disabled: boolean;
  } = $props();

  let open = $state(false);
</script>

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
        {#if iconDirection === 'up'}
          <CalendarArrowUp size={16} class="mr-2" />
        {:else}
          <CalendarArrowDown size={16} class="mr-2" />
        {/if}
        {title}

        {#if date}
          <Separator orientation="vertical" class="mx-2 h-4" />
          <Badge variant="secondary" class="rounded-sm px-1 font-normal">
            {date.toString()}
          </Badge>
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="p-0" align="start">
    <Calendar type="single" bind:value={date} />
  </Popover.Content>
</Popover.Root>
