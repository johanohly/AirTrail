<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { trpc } from '$lib/trpc';
  import { Toaster } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  import { ScreenSize } from '$lib/components/helpers';
  import { appConfig } from '$lib/utils/stores';

  const { data, children } = $props();

  $effect(() => {
    appConfig.set(data.appConfig);
  });

  const queryClient = trpc.hydrateFromServer(data.trpc);
</script>

<ModeWatcher />
<ScreenSize />
<Toaster />
<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
