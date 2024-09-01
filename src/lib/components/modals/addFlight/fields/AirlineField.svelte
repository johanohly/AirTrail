<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import type { addFlightSchema } from '$lib/zod/flight';
  import { z } from 'zod';

  let {
    form,
    formData,
  }: {
    form: SuperForm<z.infer<typeof addFlightSchema>>;
    formData: typeof form.form;
  } = $props();
</script>
