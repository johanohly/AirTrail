<script lang="ts">
  import { Route } from '@o7/icon/lucide';

  import {
    getFocusedRouteDisplay,
    toggleFocusedRouteDisplay,
  } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let { hasTrack }: { hasTrack: boolean } = $props();
</script>

{#if hasTrack}
  <DetailsActionButton
    label="Show flight track"
    shortLabel="Track"
    icon={Route}
    onclick={toggleFocusedRouteDisplay}
    pressed={getFocusedRouteDisplay() === 'tracks'}
  />
{/if}
