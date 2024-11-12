<script lang="ts">
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';

  export let to: string;

  onMount(() => {
    goto(to, { replaceState: true });
  });
</script>
