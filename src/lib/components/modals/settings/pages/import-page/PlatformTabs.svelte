<script lang="ts">
  import { platforms } from './';

  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';

  let { platform = $bindable() }: { platform: (typeof platforms)[0] } =
    $props();
  let platformValue = $state(platform.value);
  $effect(() => {
    platform = platforms.find((p) => p.value === platformValue) || platforms[0];
  });
</script>

<RadioGroup.Root
  bind:value={platformValue}
  class="grid grid-cols-2 sm:grid-cols-4 gap-2"
>
  {#each platforms as platform}
    <Label
      for={platform.value}
      class="truncate cursor-pointer border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary flex flex-col items-center justify-between rounded-md border-2 p-4"
    >
      <RadioGroup.Item
        value={platform.value}
        id={platform.value}
        class="sr-only"
        aria-label={platform.name}
      />
      {platform.name}
    </Label>
  {/each}
</RadioGroup.Root>
