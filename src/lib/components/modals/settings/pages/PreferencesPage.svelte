<script lang="ts">
  import { Sparkles } from '@o7/icon/lucide';

  import { PageHeader } from './index';

  import {
    DateTimePreview,
    PreferenceField,
    PresetPicker,
    UnitsPreview,
  } from '$lib/components/preferences';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';
</script>

<PageHeader
  title="Preferences"
  subtitle="Choose how AirTrail displays units, dates and times for you."
  headerRight={presetButton}
>
  <section class="space-y-3">
    <h4 class="text-sm font-semibold">Units</h4>
    <div class="grid gap-3 sm:grid-cols-2">
      <PreferenceField field="distanceUnit" />
      <PreferenceField field="windSpeedUnit" />
      <PreferenceField field="temperatureUnit" />
      <PreferenceField field="pressureUnit" />
    </div>
    <UnitsPreview />
  </section>

  <Separator />

  <section class="space-y-3">
    <h4 class="text-sm font-semibold">Date &amp; time</h4>
    <div class="grid gap-3 sm:grid-cols-2">
      <PreferenceField field="timeFormat" />
      <PreferenceField field="dateFormat" />
      <PreferenceField field="weekStartsOn" />
      <PreferenceField field="flightTimeDisplay" />
    </div>
    <DateTimePreview />
  </section>
</PageHeader>

{#snippet presetButton()}
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button variant="outline" size="sm" {...props}>
          <Sparkles size={14} />
          Apply preset
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-[420px] max-w-[90vw] p-3" align="end">
      <div class="mb-2">
        <h5 class="text-sm font-semibold">Quick presets</h5>
        <p class="text-xs text-muted-foreground">
          Apply a common combination. You can still tweak individual settings
          afterwards.
        </p>
      </div>
      <PresetPicker />
    </Popover.Content>
  </Popover.Root>
{/snippet}
