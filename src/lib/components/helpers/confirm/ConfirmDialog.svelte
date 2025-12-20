<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';

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
</script>

<AlertDialog.Root
  bind:open
  onOpenChange={(v) => {
    if (!v) onCancel?.();
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{cancelText}</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={async () => {
          open = false;
          await onConfirm();
        }}>{confirmText}</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
