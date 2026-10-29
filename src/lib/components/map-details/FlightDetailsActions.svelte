<script lang="ts">
  import { Locate, Route, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let {
    hasTrack,
    showingTrack,
    onToggle,
  }: {
    hasTrack: boolean;
    showingTrack: boolean;
    onToggle: () => void;
  } = $props();
</script>

<DetailsActionButton
  label="Locate flight"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
{#if hasTrack}
  <DetailsActionButton
    label={showingTrack ? 'Show point-to-point route' : 'Show flight track'}
    shortLabel={showingTrack ? 'Direct' : 'Track'}
    icon={Route}
    onclick={onToggle}
    pressed={showingTrack}
  />
{/if}
<DetailsActionButton
  label="Close details"
  shortLabel="Close"
  icon={X}
  onclick={closeMapDetails}
/>
