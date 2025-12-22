<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';

  let {
    onConfirm,
    onCancel,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  }: {
    onConfirm: (() => void) | (() => Promise<void>);
    onCancel?: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
  } = $props();

  let open = $state(true);

  $effect(() => {
    if (!open) onCancel?.();
  });
</script>

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
          open = false;
          await onConfirm();
        }}
      >
        {confirmText}
      </Button>
    </div>
  </div>
</Modal>
