<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import { cn } from '$lib/utils';

  // Marks the point in the list where upcoming flights end and flown ones begin.
  let { class: className }: { class?: string } = $props();
</script>

<Separator
  class={cn('my-4 bg-muted-foreground/40', className)}
  data-testid="past-flights-divider"
/>
