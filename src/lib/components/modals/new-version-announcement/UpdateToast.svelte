<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let {
    title,
    onView,
    onDismiss,
  }: {
    title: string;
    onView: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<div class="w-[356px] max-w-full rounded-lg border bg-background p-4 shadow-lg">
  <p class="text-sm font-medium">{title}</p>
  <div class="mt-3 flex justify-end gap-2">
    <Button size="sm" variant="outline" onclick={onDismiss}>Dismiss</Button>
    <Button size="sm" onclick={onView}>What's new</Button>
  </div>
</div>
