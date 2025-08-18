<script lang="ts">
  import { Info } from '@o7/icon/lucide';
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
  import { integrationsConfigSchema } from '$lib/zod/config';

  const form = superForm(
    defaults<Infer<typeof integrationsConfigSchema>>(
      { aeroDataBoxKey: null },
      zod(integrationsConfigSchema),
    ),
    {
      resetForm: false,
      validators: zod(integrationsConfigSchema),
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
      const res = await fetch('/api/integrations/config/get');
      if (res.ok) {
        const data = await res.json();
        savedKey = data.aeroDataBoxKey ?? null;
        $formData.aeroDataBoxKey = savedKey ?? '';
      }
    } catch (e) {
      // ignore
    }
  });

  const changes = $derived.by(() => {
    const current = $formData.aeroDataBoxKey ?? '';
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
    action="/api/integrations/config/save"
    autocomplete="off"
    class="space-y-4"
    use:enhance
  >
    <Locked
      locked={appConfig.envConfigured?.integrations?.aeroDataBoxKey ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="aeroDataBoxKey">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>
              AeroDataBox API Key
              <a
                href="https://airtrail.johan.ohly.dk/docs/integrations/aerodatabox"
                target="_blank"
                title="More info"
              >
                <Info class="text-primary inline-block" size={15} />
              </a>
            </Form.Label>
            <Form.Description>
              API key for AeroDataBox (via RapidAPI) used for advanced flight
              lookup, allowing AirTrail to prefill airports, departure and
              arrival times, airline & aircraft information from just a flight
              number.
            </Form.Description>
            <Input
              bind:value={$formData.aeroDataBoxKey}
              {...props}
              placeholder="Enter your AeroDataBox API key"
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
