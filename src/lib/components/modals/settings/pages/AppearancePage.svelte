<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { mode, setMode } from 'mode-watcher';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { PageHeader } from '.';

  import { Locked } from '$lib/components/helpers';
  import { Badge } from '$lib/components/ui/badge';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Separator } from '$lib/components/ui/separator';
  import {
    getConfiguredAppMapStyleUrl,
    getDefaultAppMapStyleUrl,
  } from '$lib/map/app-style';
  import { appConfig } from '$lib/state.svelte';
  import { mapConfigSchema } from '$lib/zod/config';

  const form = superForm(
    defaults<Infer<typeof mapConfigSchema>>(
      appConfig?.config?.map ?? {
        lightStyleUrl: getDefaultAppMapStyleUrl('light'),
        darkStyleUrl: getDefaultAppMapStyleUrl('dark'),
      },
      zod(mapConfigSchema),
    ),
    {
      resetForm: false,
      validators: zod(mapConfigSchema),
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

  const user = $derived(page.data.user);
  const isAdmin = $derived(!!user && user.role !== 'user');
  const defaultLightStyleUrl = getDefaultAppMapStyleUrl('light');
  const defaultDarkStyleUrl = getDefaultAppMapStyleUrl('dark');

  const changes = $derived.by(() => {
    const savedConfig = appConfig.config?.map;
    const savedLightStyleUrl =
      savedConfig?.lightStyleUrl ?? getConfiguredAppMapStyleUrl('light');
    const savedDarkStyleUrl =
      savedConfig?.darkStyleUrl ?? getConfiguredAppMapStyleUrl('dark');

    const currentLightStyleUrl =
      $formData.lightStyleUrl.trim() || defaultLightStyleUrl;
    const currentDarkStyleUrl =
      $formData.darkStyleUrl.trim() || defaultDarkStyleUrl;

    return (
      currentLightStyleUrl !== savedLightStyleUrl ||
      currentDarkStyleUrl !== savedDarkStyleUrl
    );
  });
</script>

<PageHeader
  title="Appearance"
  subtitle="Customize the appearance of the application."
>
  <div class="space-y-6">
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Color Theme</h3>
      <p class="text-muted-foreground text-[0.8rem]">
        By default, the application will use the system's theme.
      </p>
      <RadioGroup.Root
        value={mode.current}
        onValueChange={(v) => setMode(v)}
        class="flex flex-col md:flex-row"
      >
        <Label
          class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
        >
          <RadioGroup.Item value="dark" class="sr-only" />
          <div
            class="border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1"
          >
            <div class="space-y-2 rounded-sm bg-slate-950 p-2">
              <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
                <div class="h-2 w-[80px] rounded-lg bg-slate-400" />
                <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
              </div>
              <div
                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs"
              >
                <div class="h-4 w-4 rounded-full bg-slate-400" />
                <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
              </div>
              <div
                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs"
              >
                <div class="h-4 w-4 rounded-full bg-slate-400" />
                <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
              </div>
            </div>
          </div>
          <span class="block w-full p-2 text-center font-normal"> Dark </span>
        </Label>
        <Label
          class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
        >
          <RadioGroup.Item value="light" class="sr-only" />
          <div
            class="border-muted hover:border-accent items-center rounded-md border-2 p-1"
          >
            <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
              <div class="space-y-2 rounded-md bg-white p-2 shadow-xs">
                <div class="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
              </div>
              <div
                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs"
              >
                <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
              </div>
              <div
                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs"
              >
                <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
              </div>
            </div>
          </div>
          <span class="block w-full p-2 text-center font-normal"> Light </span>
        </Label>
      </RadioGroup.Root>
    </div>

    {#if isAdmin}
      <Separator />

      <form
        method="POST"
        action="/api/map/config/save"
        autocomplete="off"
        class="space-y-4"
        use:enhance
      >
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-medium">Map Style URLs</h3>
            <Badge variant="secondary" class="text-[10px]">Admin only</Badge>
          </div>
          <p class="text-muted-foreground text-[0.8rem]">
            Configure the style JSON used by in-app maps for light and dark
            mode. These URLs apply to every AirTrail user on this instance.
            Relative AirTrail URLs and external style URLs are both supported.
          </p>
        </div>

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
                  placeholder={defaultLightStyleUrl}
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
                  placeholder={defaultDarkStyleUrl}
                />
              {/snippet}
            </Form.Control>
            <Form.FieldErrors />
          </Form.Field>
        </Locked>

        <Form.Button disabled={!changes}>Save</Form.Button>
      </form>
    {/if}
  </div>
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
