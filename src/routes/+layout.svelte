<script lang="ts">
  import "../app.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { trpc } from "$lib/trpc";
  import { Toaster } from "svelte-sonner";
  import { ModeWatcher } from "mode-watcher";

  const { data, children } = $props();

  const queryClient = trpc.hydrateFromServer(data.trpc);
</script>

<ModeWatcher />
<Toaster />
<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
