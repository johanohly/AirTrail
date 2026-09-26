<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { Locked } from '$lib/components/helpers';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import {
    getConfiguredAppMapStyleUrl,
    isManagedAppMapStyleUrl,
  } from '$lib/map/app-style';
  import { MAP_THEMES, type MapTheme } from '$lib/map/basemap';
  import {
    hasMapSettingsChanges,
    toMapSettingsFormData,
  } from '$lib/map/map-settings';
  import { loadMapStyleForHealthCheck } from '$lib/map/map-style-health';
  import { appConfig } from '$lib/state.svelte';
  import { mapSettingsFormSchema } from '$lib/zod/config';

  const form = superForm(
    defaults<Infer<typeof mapSettingsFormSchema>>(
      toMapSettingsFormData(appConfig.config?.map),
      zod(mapSettingsFormSchema),
    ),
    {
      dataType: 'json',
      resetForm: false,
      validators: zod(mapSettingsFormSchema),
      onUpdated({ form }) {
        if (!form.message) return;

        if (form.message.type === 'success') {
          invalidateAll();
          toast.success(form.message.text);
          return;
        }
        toast.error(form.message.text);
      },
    },
  );
  const { form: formData, enhance } = form;
  let testingMapConfig = $state(false);

  const getHealthCheckUrl = (theme: MapTheme) => {
    const styleUrl = getConfiguredAppMapStyleUrl(theme, appConfig.config?.map);
    if (!isManagedAppMapStyleUrl(styleUrl)) return styleUrl;

    const separator = styleUrl.includes('?') ? '&' : '?';
    return `${styleUrl}${separator}health-check=${Date.now()}`;
  };

  const testSavedMapConfig = async () => {
    testingMapConfig = true;
    let theme: MapTheme = 'light';

    try {
      for (theme of MAP_THEMES) {
        const styleUrl = getHealthCheckUrl(theme);
        const response = await fetch(styleUrl, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          throw new Error(`the style request returned ${response.status}`);
        }
        await response.json();

        const fallback = response.headers.get('x-airtrail-basemap-fallback');
        if (fallback) {
          throw new Error(
            `the configured provider failed and AirTrail used ${fallback}`,
          );
        }

        await loadMapStyleForHealthCheck(styleUrl);
      }

      toast.success('Both saved basemap styles loaded successfully.');
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'an unknown error occurred';
      toast.error(`The saved ${theme} basemap style could not load: ${detail}`);
    } finally {
      testingMapConfig = false;
    }
  };

  const changes = $derived.by(() => {
    const savedConfig = appConfig.config?.map;
    if (!savedConfig) return false;

    return hasMapSettingsChanges(savedConfig, $formData, {
      cartoApiKey: appConfig.configured?.map?.cartoApiKey ?? false,
      protomapsApiKey: appConfig.configured?.map?.protomapsApiKey ?? false,
    });
  });
</script>

<form
  method="POST"
  action="/api/map/config/save"
  autocomplete="off"
  class="space-y-5"
  use:enhance
>
  <div class="space-y-1">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-sm font-medium">Basemap Provider</h3>
      <Badge variant="secondary" class="text-[10px]">Admin only</Badge>
    </div>
    <p class="text-muted-foreground text-[0.8rem]">
      Choose where street-map data comes from. AirTrail adds its airport detail
      layers to every managed provider.
    </p>
  </div>

  <Locked
    locked={appConfig.envConfigured?.map?.provider ?? false}
    tooltip={lockedTooltip}
  >
    <Form.Field {form} name="provider">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Provider</Form.Label>
          <select
            bind:value={$formData.provider}
            {...props}
            class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="openfreemap">OpenFreeMap</option>
            <option value="carto">CARTO</option>
            <option value="protomaps">Protomaps</option>
          </select>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </Locked>

  {#if $formData.provider === 'openfreemap'}
    <p class="text-muted-foreground text-[0.8rem]">
      OpenFreeMap uses vector tiles and needs no account or API key. It is the
      recommended default for most AirTrail instances.
    </p>
  {:else if $formData.provider === 'carto'}
    <div class="space-y-3 border-t pt-4">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="text-sm font-medium">CARTO credentials</h4>
          {#if appConfig.configured?.map?.cartoApiKey}
            <Badge variant="outline" class="text-[10px]">Configured</Badge>
          {/if}
        </div>
        <p class="text-muted-foreground text-[0.8rem]">
          <a
            href="https://carto.com/basemaps/apikey/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline underline-offset-2"
            >Request a CARTO basemap key</a
          >. Use a key issued for this AirTrail domain. Each user's browser
          sends the key directly to CARTO.
        </p>
      </div>
      <Locked
        locked={appConfig.envConfigured?.map?.cartoApiKey ?? false}
        tooltip={lockedTooltip}
      >
        <Form.Field {form} name="cartoApiKey">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>CARTO API Key</Form.Label>
              <Input
                type="password"
                autocomplete="new-password"
                bind:value={$formData.cartoApiKey}
                {...props}
                placeholder={appConfig.configured?.map?.cartoApiKey
                  ? 'Enter a replacement key'
                  : 'Enter your CARTO API key'}
              />
            {/snippet}
          </Form.Control>
          <Form.Description>
            Leave blank to keep the configured key.
          </Form.Description>
          <Form.FieldErrors />
        </Form.Field>
        {#if appConfig.configured?.map?.cartoApiKey}
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="clearCartoApiKey"
              bind:checked={$formData.clearCartoApiKey}
              class="accent-primary size-4"
            />
            Remove the configured key
          </label>
        {/if}
      </Locked>
    </div>
  {:else}
    <div class="space-y-4 border-t pt-4">
      <div class="space-y-1">
        <h4 class="text-sm font-medium">Protomaps source</h4>
        <p class="text-muted-foreground text-[0.8rem]">
          Use the hosted API, a PMTiles archive, TileJSON, or a ZXY vector tile
          endpoint.
        </p>
      </div>

      <Locked
        locked={appConfig.envConfigured?.map?.protomapsSourceKind ?? false}
        tooltip={lockedTooltip}
      >
        <Form.Field {form} name="protomapsSourceKind">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Source Type</Form.Label>
              <select
                bind:value={$formData.protomapsSourceKind}
                {...props}
                class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="hosted">Protomaps hosted API</option>
                <option value="pmtiles">PMTiles archive</option>
                <option value="tilejson">TileJSON endpoint</option>
                <option value="zxy">ZXY vector tiles</option>
              </select>
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </Locked>

      {#if $formData.protomapsSourceKind === 'hosted'}
        <Locked
          locked={appConfig.envConfigured?.map?.protomapsApiKey ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field {form} name="protomapsApiKey">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>
                  Protomaps API Key
                  {#if appConfig.configured?.map?.protomapsApiKey}
                    <Badge variant="outline" class="ml-1 text-[10px]">
                      Configured
                    </Badge>
                  {/if}
                </Form.Label>
                <Input
                  type="password"
                  autocomplete="new-password"
                  bind:value={$formData.protomapsApiKey}
                  {...props}
                  placeholder={appConfig.configured?.map?.protomapsApiKey
                    ? 'Enter a replacement key'
                    : 'Enter your Protomaps API key'}
                />
              {/snippet}
            </Form.Control>
            <Form.Description>
              <a
                href="https://protomaps.com/api"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary underline underline-offset-2"
                >Create a Protomaps API key</a
              >, then add this AirTrail origin to its CORS allowlist. Leave
              blank to keep the configured key.
            </Form.Description>
            <Form.FieldErrors />
          </Form.Field>
          {#if appConfig.configured?.map?.protomapsApiKey}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="clearProtomapsApiKey"
                bind:checked={$formData.clearProtomapsApiKey}
                class="accent-primary size-4"
              />
              Remove the configured key
            </label>
          {/if}
        </Locked>
      {:else}
        <Locked
          locked={appConfig.envConfigured?.map?.protomapsSourceUrl ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field {form} name="protomapsSourceUrl">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>Source URL</Form.Label>
                <Input
                  bind:value={$formData.protomapsSourceUrl}
                  {...props}
                  placeholder={$formData.protomapsSourceKind === 'pmtiles'
                    ? 'https://tiles.example.com/world.pmtiles'
                    : $formData.protomapsSourceKind === 'zxy'
                      ? 'https://tiles.example.com/{z}/{x}/{y}.mvt'
                      : 'https://tiles.example.com/tiles.json'}
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>
      {/if}

      {#if $formData.protomapsSourceKind === 'zxy'}
        <Locked
          locked={appConfig.envConfigured?.map?.protomapsMaxZoom ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field {form} name="protomapsMaxZoom">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>Maximum Tile Zoom</Form.Label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  bind:value={$formData.protomapsMaxZoom}
                  {...props}
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2">
        <Locked
          locked={appConfig.envConfigured?.map?.protomapsLanguage ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field {form} name="protomapsLanguage">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>Label Language</Form.Label>
                <Input
                  bind:value={$formData.protomapsLanguage}
                  {...props}
                  placeholder="en"
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>
        <Locked
          locked={appConfig.envConfigured?.map?.protomapsAssetsBaseUrl ?? false}
          tooltip={lockedTooltip}
        >
          <Form.Field {form} name="protomapsAssetsBaseUrl">
            <Form.Control>
              {#snippet children({ props })}
                <Form.Label>Assets Base URL</Form.Label>
                <Input
                  bind:value={$formData.protomapsAssetsBaseUrl}
                  {...props}
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>
      </div>
    </div>
  {/if}

  <details class="border-t pt-4">
    <summary class="cursor-pointer text-sm font-medium">
      Advanced custom style URLs
    </summary>
    <div class="mt-3 space-y-4">
      <p class="text-muted-foreground text-[0.8rem]">
        Raw MapLibre style URLs replace the managed provider style for a theme.
        Leave them blank to retain AirTrail's airport styling.
      </p>
      <Locked
        locked={appConfig.envConfigured?.map?.lightStyleUrl ?? false}
        tooltip={lockedTooltip}
      >
        <Form.Field {form} name="lightStyleUrl">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Light Mode Style URL</Form.Label>
              <Input
                bind:value={$formData.lightStyleUrl}
                {...props}
                placeholder="Managed provider style"
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </Locked>
      <Locked
        locked={appConfig.envConfigured?.map?.darkStyleUrl ?? false}
        tooltip={lockedTooltip}
      >
        <Form.Field {form} name="darkStyleUrl">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Dark Mode Style URL</Form.Label>
              <Input
                bind:value={$formData.darkStyleUrl}
                {...props}
                placeholder="Managed provider style"
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </Locked>
    </div>
  </details>

  <div class="flex flex-wrap gap-2">
    <Form.Button disabled={!changes}>Save map settings</Form.Button>
    <Button
      type="button"
      variant="outline"
      loading={testingMapConfig}
      onclick={testSavedMapConfig}
    >
      Test saved map styles
    </Button>
  </div>
</form>

{#snippet lockedTooltip()}
  <p>
    This setting is locked because it is configured via environment variables.
  </p>
  <p>
    To change this setting, update or delete the environment variable and
    restart the server.
  </p>
{/snippet}
