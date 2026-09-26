<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { PageHeader } from '.';

  import { invalidateAll } from '$app/navigation';
  import { Locked } from '$lib/components/helpers';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { appConfig } from '$lib/state.svelte';
  import {
    type AeroDataBoxEndpoint,
    integrationsConfigSchema,
  } from '$lib/zod/config';

  const ENDPOINT_LABELS: Record<AeroDataBoxEndpoint, string> = {
    rapidapi: 'RapidAPI',
    direct: 'AeroDataBox (direct)',
  };

  const form = superForm(
    defaults<Infer<typeof integrationsConfigSchema>>(
      {
        aeroDataBoxKey: null,
        aeroDataBoxEndpoint: 'rapidapi',
        openAipKey: null,
      },
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
  let savedEndpoint: AeroDataBoxEndpoint = $state('rapidapi');
  let savedOpenAipKey: string | null = $state(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/integrations/config/get');
      if (res.ok) {
        const data = await res.json();
        savedKey = data.aeroDataBoxKey ?? null;
        savedEndpoint = data.aeroDataBoxEndpoint;
        savedOpenAipKey = data.openAipKey ?? null;
        $formData.aeroDataBoxKey = savedKey ?? '';
        $formData.aeroDataBoxEndpoint = savedEndpoint;
        $formData.openAipKey = savedOpenAipKey ?? '';
      }
    } catch (e) {
      // ignore
    }
  });

  const changes = $derived.by(() => {
    const current = $formData.aeroDataBoxKey ?? '';
    const base = savedKey ?? '';
    const currentOpenAip = $formData.openAipKey ?? '';
    const baseOpenAip = savedOpenAipKey ?? '';
    return (
      current !== base ||
      $formData.aeroDataBoxEndpoint !== savedEndpoint ||
      currentOpenAip !== baseOpenAip
    );
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
              API key for AeroDataBox used for advanced flight lookup, allowing
              AirTrail to prefill airports, departure and arrival times, airline
              & aircraft information from just a flight number.
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

    <Locked
      locked={appConfig.envConfigured?.integrations?.aeroDataBoxEndpoint ??
        false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="aeroDataBoxEndpoint">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>AeroDataBox Endpoint</Form.Label>
            <Form.Description>
              Where your AeroDataBox API key comes from: a RapidAPI subscription
              or a direct subscription on aerodatabox.com.
            </Form.Description>
            <Select.Root
              type="single"
              name={props.name}
              bind:value={$formData.aeroDataBoxEndpoint}
            >
              <Select.Trigger {...props} class="w-full">
                {ENDPOINT_LABELS[$formData.aeroDataBoxEndpoint]}
              </Select.Trigger>
              <Select.Content>
                {#each Object.entries(ENDPOINT_LABELS) as [value, label] (value)}
                  <Select.Item {value} {label} />
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </Locked>

    <Locked
      locked={appConfig.envConfigured?.integrations?.openAipKey ?? false}
      tooltip={lockedTooltip}
    >
      <Form.Field {form} name="openAipKey">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>
              OpenAIP API Key
              <a
                href="https://airtrail.johan.ohly.dk/docs/integrations/openaip"
                target="_blank"
                title="More info"
              >
                <Info class="text-primary inline-block" size={15} />
              </a>
            </Form.Label>
            <Form.Description>
              API key for the OpenAIP public API, used to proxy optional
              aeronautical overlay tiles on the main map.
            </Form.Description>
            <Input
              bind:value={$formData.openAipKey}
              {...props}
              placeholder="Enter your OpenAIP API key"
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
