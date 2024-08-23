<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  export let to: string;

  onMount(() => {
    goto(to, { replaceState: true });
  });
</script>
