<script lang="ts">
  import type { Snippet } from 'svelte';

  import * as AlertDialog from '$lib/components/ui/alert-dialog';

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

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger>
    {#snippet child({ props })}
      {@render triggerContent({ props })}
    {/snippet}
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{cancelText}</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={async () => {
          await onConfirm();
          open = false;
        }}>{confirmText}</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
