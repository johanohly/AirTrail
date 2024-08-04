<script lang="ts">
  import { trpc } from "$lib/trpc";
  import { onMount } from "svelte";

  const { data } = $props();
  const user = data.user;
  const flights = trpc.flight.list.query();
  onMount(() => {
    console.log(user, $flights.data);
  });
</script>

<h1>{user.username}</h1>
