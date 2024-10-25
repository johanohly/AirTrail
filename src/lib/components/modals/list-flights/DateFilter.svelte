<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import { CalendarArrowUp, CalendarArrowDown } from '@o7/icon/lucide';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import type { TZDate } from '@date-fns/tz';

  let {
    date = $bindable(),
    title,
    iconDirection,
  }: {
    date: TZDate | null;
    title: string;
    iconDirection: 'up' | 'down';
  } = $props();

  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger asChild let:builder>
    <Button
      builders={[builder]}
      variant="outline"
      size="sm"
      class="h-8 border-dashed"
    >
      {#if iconDirection === 'up'}
        <CalendarArrowUp size={20} class="mr-2" />
      {:else}
        <CalendarArrowDown size={20} class="mr-2" />
      {/if}
      {title}

      {#if date}
        <Separator orientation="vertical" class="mx-2 h-4" />
        <Badge variant="secondary" class="rounded-sm px-1 font-normal">
          {date.toDateString()}
        </Badge>
      {/if}
    </Button>
  </Popover.Trigger>
  <Popover.Content class="max-w-[400px] p-0" align="start" side="bottom">
    WIP
  </Popover.Content>
</Popover.Root>
