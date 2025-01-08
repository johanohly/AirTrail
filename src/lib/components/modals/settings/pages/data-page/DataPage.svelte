<script lang="ts">
  import { PageHeader } from '../';

  import UpdateFromSource from './UpdateFromSource.svelte';

  import { Collapsible } from '$lib/components/ui/collapsible';
</script>

<PageHeader
  title="Data"
  subtitle="Manage custom airports, airlines and airplanes."
>
  <div class="flex flex-col gap-4">
    <UpdateFromSource />
    <Collapsible
      title="Custom Airports"
      subtitle="Add airports not found in the official list."
    >
      Hello World!
    </Collapsible>
  </div>
</PageHeader>
