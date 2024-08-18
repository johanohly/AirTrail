<script lang="ts">
  let {
    callback,
  }: {
    callback: () => void;
  } = $props();

  let timeout;
  const onResize = () => {
    clearTimeout(timeout);
    timeout = setTimeout(callback, 100);
  };
</script>

<svelte:window on:resize={onResize} />
