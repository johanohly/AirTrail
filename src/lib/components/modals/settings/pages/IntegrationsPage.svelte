<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { PageHeader } from '.';

  import { invalidateAll } from '$app/navigation';
  import { Locked } from '$lib/components/helpers';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { appConfig } from '$lib/state.svelte';
  import { flightConfigSchema } from '$lib/zod/config';

  const form = superForm(
    defaults<Infer<typeof flightConfigSchema>>(
      { apiMarketKey: null },
      zod(flightConfigSchema),
    ),
    {
      resetForm: false,
      validators: zod(flightConfigSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            invalidateAll();
            toast.success(form.message.text);
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;

  let savedKey: string | null = $state(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/integrations/flight/get');
      if (res.ok) {
        const data = await res.json();
        savedKey = data.apiMarketKey ?? null;
        $formData.apiMarketKey = savedKey ?? '';
      }
    } catch (e) {
      // ignore
    }
  });

  const changes = $derived.by(() => {
    const current = $formData.apiMarketKey ?? '';
    const base = savedKey ?? '';
    return current !== base;
  });
</script>

<PageHeader
  title="Integrations"
  subtitle="Configure integrations for your AirTrail instance."
>
  <form
    method="POST"
    action="/api/integrations/flight/save"
    autocomplete="off"
    class="space-y-4"
    use:enhance
  >
    <Locked
      locked={appConfig.envConfigured?.flight?.apiMarketKey ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="apiMarketKey">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>AeroDataBox API Market Key</Form.Label>
            <Form.Description>
              API key for AeroDataBox via API Market used for flight lookup.
            </Form.Description>
            <Input
              bind:value={$formData.apiMarketKey}
              {...props}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>
    <Form.Button disabled={!changes}>Save</Form.Button>
  </form>
</PageHeader>

{#snippet lockedTooltip()}
  <p>
    This setting is locked because it is configured via environment variables.
  </p>
  <p>
    To change this setting, update or delete the environment variable and
    restart the server.
  </p>
{/snippet}
