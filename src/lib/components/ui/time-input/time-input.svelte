<script lang="ts">
  import { Time } from '@internationalized/date';
  import { TimeField } from 'bits-ui';

  let {
    value = $bindable<Time | undefined>(),
    onValueChange,
    locale,
    disabled = false,
    class: className,
  }: {
    value: Time | undefined;
    onValueChange?: (value: Time | undefined) => void;
    locale: string;
    disabled?: boolean;
    class?: string;
  } = $props();

  let inputRef = $state<HTMLDivElement | null>(null);

  const syncClearedValue = () => {
    queueMicrotask(() => {
      if (!inputRef) return;

      const editableSegments = Array.from(
        inputRef.querySelectorAll<HTMLElement>('[data-segment]'),
      ).filter((segment) => {
        const part = segment.dataset.segment;
        return part !== 'literal' && part !== 'dayPeriod';
      });

      if (
        editableSegments.length > 0 &&
        editableSegments.every(
          (segment) => segment.getAttribute('aria-valuetext') === 'Empty',
        )
      ) {
        value = undefined;
        onValueChange?.(undefined);
      }
    });
  };
</script>

<TimeField.Root
  bind:value
  {onValueChange}
  granularity="minute"
  {locale}
  {disabled}
>
  <div class="flex w-full flex-col gap-1.5">
    <TimeField.Input
      bind:ref={inputRef}
      class={className}
      onkeyup={syncClearedValue}
      onfocusout={syncClearedValue}
    >
      {#snippet children({ segments })}
        {#each segments as { part, value }}
          <div class="inline-block select-none">
            {#if part === 'literal'}
              <TimeField.Segment {part} class="text-muted-foreground">
                {value}
              </TimeField.Segment>
            {:else}
              <TimeField.Segment
                {part}
                class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
              >
                {value}
              </TimeField.Segment>
            {/if}
          </div>
        {/each}
      {/snippet}
    </TimeField.Input>
  </div>
</TimeField.Root>
