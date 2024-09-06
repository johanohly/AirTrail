<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button, type Props as ButtonProps } from '$lib/components/ui/button';
  import type { Snippet } from 'svelte';

  let {
    onConfirm,
    title,
    description,
    triggerVariant,
    triggerContent,
    triggerSize,
    triggerClass,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  }: {
    onConfirm: (() => void) | (() => Promise<void>);
    title: string;
    description: string;
    triggerVariant: ButtonProps['variant'];
    triggerContent: Snippet;
    triggerSize?: ButtonProps['size'];
    triggerClass?: string;
    confirmText?: string;
    cancelText?: string;
  } = $props();

  const callback = async () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      await result;
    }
  };
</script>

<AlertDialog.Root>
  <AlertDialog.Trigger asChild let:builder>
    <Button builders={[builder]} variant={triggerVariant} size={triggerSize} class={triggerClass}>
      {@render triggerContent()}
    </Button>
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{cancelText}</AlertDialog.Cancel>
      <AlertDialog.Action on:click={callback}>{confirmText}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
