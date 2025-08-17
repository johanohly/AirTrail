<script lang="ts">
  import { platforms } from './';

  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Badge } from '$lib/components/ui/badge';

  let { platform = $bindable() }: { platform: (typeof platforms)[0] } =
    $props();
  let platformValue = $state(platform.value);
  $effect(() => {
    platform = platforms.find((p) => p.value === platformValue) || platforms[0];
  });
</script>

<RadioGroup.Root
  bind:value={platformValue}
  class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2"
>
  {#each platforms as platform (platform.value)}
    <Label
      for={platform.value}
      class="cursor-pointer border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary flex flex-col items-start gap-1 rounded-md border-2 p-4"
    >
      <RadioGroup.Item
        value={platform.value}
        id={platform.value}
        class="sr-only"
        aria-label={platform.name}
      />
      <span class="font-medium">{platform.name}</span>
      {#if platform.description}
        <span class="text-xs text-muted-foreground">{platform.description}</span
        >
      {/if}
      {#if platform.extensions?.length}
        <div class="mt-1 flex flex-wrap gap-1">
          {#each platform.extensions as ext (ext)}
            <Badge variant="secondary" class="text-[10px]">{ext}</Badge>
          {/each}
        </div>
      {/if}
    </Label>
  {/each}
</RadioGroup.Root>
