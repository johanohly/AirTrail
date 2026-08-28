<script lang="ts">
  import { page } from '$app/state';
  import { setMode, userPrefersMode } from 'mode-watcher';
  import type { Snippet } from 'svelte';

  import { PageHeader } from '.';
  import BasemapSettingsForm from './appearance-page/BasemapSettingsForm.svelte';

  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Separator } from '$lib/components/ui/separator';

  type ColorThemeMode = 'system' | 'light' | 'dark';

  const user = $derived(page.data.user);
  const isAdmin = $derived(!!user && user.role !== 'user');

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
      <BasemapSettingsForm />
    {/if}
  </div>
</PageHeader>
