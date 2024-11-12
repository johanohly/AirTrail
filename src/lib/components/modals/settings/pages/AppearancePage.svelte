<script lang="ts">
  import { mode, setMode } from 'mode-watcher';

  import { PageHeader } from '.';

  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';

  let value = $state($mode ?? 'dark'); // default to dark mode (only for type-safety during SSR)
  $effect(() => setMode(value));
</script>

<PageHeader
  title="Appearance"
  subtitle="Customize the appearance of the application."
>
  <div class="space-y-2">
    <h3 class="text-sm font-medium">Color Theme</h3>
    <p class="text-muted-foreground text-[0.8rem]">
      By default, the application will use the system's theme.
    </p>
    <RadioGroup.Root bind:value class="flex flex-col md:flex-row">
      <Label
        class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
      >
        <RadioGroup.Item value="dark" class="sr-only" />
        <div
          class="border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1"
        >
          <div class="space-y-2 rounded-sm bg-slate-950 p-2">
            <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
              <div class="h-2 w-[80px] rounded-lg bg-slate-400" />
              <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
            </div>
            <div
              class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
            >
              <div class="h-4 w-4 rounded-full bg-slate-400" />
              <div class="h-2 w-[100px] rounded-lg bg-slate-400" />
            </div>
            <div
              class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
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
            <div class="space-y-2 rounded-md bg-white p-2 shadow-sm">
              <div class="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
              <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
            </div>
            <div
              class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
            >
              <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
              <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
            </div>
            <div
              class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
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
</PageHeader>
