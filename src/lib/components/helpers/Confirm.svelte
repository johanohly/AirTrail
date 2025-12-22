<script lang="ts">
  import type { Snippet } from 'svelte';

  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';

  let {
    onConfirm,
    title,
    description,
    triggerContent,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  }: {
    onConfirm: (() => void) | (() => Promise<void>);
    title: string;
    description: string;
    triggerContent: Snippet<[{ props: Record<string, unknown> }]>;
    confirmText?: string;
    cancelText?: string;
  } = $props();

  let open = $state(false);
</script>

{@render triggerContent({ props: { onclick: () => (open = true) } })}

<Modal bind:open preset="alert">
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <h2 class="text-lg font-semibold">{title}</h2>
      <p class="text-sm text-muted-foreground">{description}</p>
    </div>
    <div class="flex justify-end gap-2">
      <Button variant="outline" onclick={() => (open = false)}>
        {cancelText}
      </Button>
      <Button
        variant="destructive"
        onclick={async () => {
          await onConfirm();
          open = false;
        }}
      >
        {confirmText}
      </Button>
    </div>
  </div>
</Modal>
