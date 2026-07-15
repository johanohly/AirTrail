<script lang="ts">
  import { Locate, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';
</script>

<DetailsActionButton
  label="Locate flight"
  icon={Locate}
  onclick={focusMapDetails}
/>
<DetailsActionButton label="Close details" icon={X} onclick={closeMapDetails} />
