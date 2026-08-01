<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { setMode, userPrefersMode } from 'mode-watcher';
  import type { Snippet } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

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

  type ColorThemeMode = 'system' | 'light' | 'dark';

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

  const isColorThemeMode = (value: string): value is ColorThemeMode =>
    value === 'system' || value === 'light' || value === 'dark';

  const setThemeMode = (value: string) => {
    if (isColorThemeMode(value)) {
      setMode(value);
    }
  };
</script>

{#snippet mockup(theme: Exclude<ColorThemeMode, 'system'>)}
  <div
    class={theme === 'dark'
      ? 'space-y-2 rounded-sm bg-slate-950 p-2'
      : 'space-y-2 rounded-sm bg-[#ecedef] p-2'}
  >
    <div
      class={theme === 'dark'
        ? 'space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'
        : 'space-y-2 rounded-md bg-white p-2 shadow-xs'}
    >
      <div
        class={theme === 'dark'
          ? 'h-2 w-[80px] max-w-[70%] rounded-lg bg-slate-400'
          : 'h-2 w-[80px] max-w-[70%] rounded-lg bg-[#ecedef]'}
      />
      <div
        class={theme === 'dark'
          ? 'h-2 w-[100px] max-w-[85%] rounded-lg bg-slate-400'
          : 'h-2 w-[100px] max-w-[85%] rounded-lg bg-[#ecedef]'}
      />
    </div>
    <div
      class={theme === 'dark'
        ? 'flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'
        : 'flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'}
    >
      <div
        class={theme === 'dark'
          ? 'h-4 w-4 rounded-full bg-slate-400'
          : 'h-4 w-4 rounded-full bg-[#ecedef]'}
      />
      <div
        class={theme === 'dark'
          ? 'h-2 max-w-[100px] flex-1 rounded-lg bg-slate-400'
          : 'h-2 max-w-[100px] flex-1 rounded-lg bg-[#ecedef]'}
      />
    </div>
    <div
      class={theme === 'dark'
        ? 'flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'
        : 'flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'}
    >
      <div
        class={theme === 'dark'
          ? 'h-4 w-4 rounded-full bg-slate-400'
          : 'h-4 w-4 rounded-full bg-[#ecedef]'}
      />
      <div
        class={theme === 'dark'
          ? 'h-2 max-w-[100px] flex-1 rounded-lg bg-slate-400'
          : 'h-2 max-w-[100px] flex-1 rounded-lg bg-[#ecedef]'}
      />
    </div>
  </div>
{/snippet}

{#snippet themeCard(
  value: ColorThemeMode,
  label: string,
  preview: Snippet,
  className = '',
)}
  <Label
    class={`min-w-0 w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary ${className}`}
  >
    <RadioGroup.Item {value} class="sr-only" />
    <div
      class="border-muted items-center overflow-hidden rounded-md border-2 p-1 transition-colors hover:border-primary/40"
    >
      {@render preview()}
    </div>
    <span class="block w-full p-2 text-center font-normal">{label}</span>
  </Label>
{/snippet}

{#snippet lightPreview()}
  {@render mockup('light')}
{/snippet}

{#snippet darkPreview()}
  {@render mockup('dark')}
{/snippet}

{#snippet systemPreview()}
  <div class="grid grid-cols-2 overflow-hidden rounded-sm bg-[#ecedef]">
    <div class="space-y-1 p-1.5">
      <div class="space-y-1 rounded-md bg-white p-1.5 shadow-xs">
        <div class="h-1.5 w-[72px] max-w-[70%] rounded-lg bg-[#ecedef]" />
        <div class="h-1.5 w-[96px] max-w-[85%] rounded-lg bg-[#ecedef]" />
      </div>
      <div
        class="flex items-center space-x-1.5 rounded-md bg-white p-1.5 shadow-xs"
      >
        <div class="h-3 w-3 rounded-full bg-[#ecedef]" />
        <div class="h-1.5 max-w-[88px] flex-1 rounded-lg bg-[#ecedef]" />
      </div>
    </div>
    <div class="space-y-1 bg-slate-950 p-1.5">
      <div class="space-y-1 rounded-md bg-slate-800 p-1.5 shadow-xs">
        <div class="h-1.5 w-[72px] max-w-[70%] rounded-lg bg-slate-400" />
        <div class="h-1.5 w-[96px] max-w-[85%] rounded-lg bg-slate-400" />
      </div>
      <div
        class="flex items-center space-x-1.5 rounded-md bg-slate-800 p-1.5 shadow-xs"
      >
        <div class="h-3 w-3 rounded-full bg-slate-400" />
        <div class="h-1.5 max-w-[88px] flex-1 rounded-lg bg-slate-400" />
      </div>
    </div>
  </div>
{/snippet}

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
        value={userPrefersMode.current}
        onValueChange={setThemeMode}
        class="grid min-w-0 grid-cols-1 sm:grid-cols-2"
      >
        {@render themeCard('system', 'System', systemPreview, 'sm:col-span-2')}
        {@render themeCard('light', 'Light', lightPreview)}
        {@render themeCard('dark', 'Dark', darkPreview)}
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
