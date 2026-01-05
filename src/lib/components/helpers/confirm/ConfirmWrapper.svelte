<script lang="ts">
  import { confirmation } from '.';
  import ConfirmDialog from './ConfirmDialog.svelte';

  const { confirmProps } = confirmation;
</script>

{#if $confirmProps}
  <ConfirmDialog {...$confirmProps} />
{/if}
