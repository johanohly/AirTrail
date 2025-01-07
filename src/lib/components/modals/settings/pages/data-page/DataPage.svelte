<script lang="ts">
  import { PageHeader } from '../';

  import { Collapsible } from '$lib/components/ui/collapsible';
</script>

<PageHeader
  title="Data"
  subtitle="Manage custom airports, airlines and airplanes."
>
  <div class="flex">
    <Collapsible
      title="Airports"
      subtitle="Add airports not found in the official list."
    >
      Hello World!
    </Collapsible>
  </div>
</PageHeader>
