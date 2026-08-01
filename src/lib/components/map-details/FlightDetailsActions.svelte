<script lang="ts">
  import { Locate, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';
</script>

<DetailsActionButton
  label="Locate flight"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
<DetailsActionButton
  label="Close details"
  shortLabel="Close"
  icon={X}
  onclick={closeMapDetails}
/>
