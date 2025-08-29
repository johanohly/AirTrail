<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { generateRandomString } from '$lib/utils/string';
  import DateField from '$lib/components/form-fields/DateField.svelte';
  import DateRangeField from '$lib/components/form-fields/DateRangeField.svelte';
  import type { shareSchema } from '$lib/zod/share';

  const { form }: { form: SuperForm<Infer<typeof shareSchema>> } = $props();

  const { form: formData } = form;

  const durationOptions = [
    { value: 'never', label: 'Never expires' },
    { value: '1day', label: '1 day' },
    { value: '1week', label: '1 week' },
    { value: '1month', label: '1 month' },
    { value: '3months', label: '3 months' },
    { value: 'custom', label: 'Custom date' },
  ];

  const getCurrentDurationLabel = (value: string) => {
    const option = durationOptions.find((opt) => opt.value === value);
    return option?.label || 'Select duration';
  };

  function generateNewSlug() {
    $formData.slug = generateRandomString(12);
  }
</script>

<!-- Share URL -->
<Form.Field {form} name="slug" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Share URL *</Form.Label>
      <div class="flex gap-2">
        <div class="flex-1 flex min-w-0">
          <span
            class="inline-flex items-center px-3 text-sm bg-muted border border-r-0 rounded-l-md whitespace-nowrap"
          >
            /share/
          </span>
          <Input
            bind:value={$formData.slug}
            {...props}
            placeholder="custom-url-slug"
            class="rounded-l-none min-w-0 flex-1"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onclick={generateNewSlug}
          class="shrink-0"
        >
          Generate
        </Button>
      </div>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<!-- Expiry -->
<Form.Field {form} name="expiryOption" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Share Duration</Form.Label>
      <Select.Root type="single" bind:value={$formData.expiryOption}>
        <Select.Trigger {...props}>
          {getCurrentDurationLabel($formData.expiryOption)}
        </Select.Trigger>
        <Select.Content>
          {#each durationOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>
      <input name={props.name} type="hidden" value={$formData.expiryOption} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if $formData.expiryOption === 'custom'}
  <DateField {form} name="expiresAt" label="Expires At" />
{/if}

<!-- Content Visibility -->
<div class="space-y-3">
  <Label class="text-sm font-medium">Content Visibility</Label>
  <div class="space-y-2">
    <Form.Field {form} name="showMap" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showMap} {...props} />
          <Form.Label class="text-sm font-normal">Show Map</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showStats" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showStats} {...props} />
          <Form.Label class="text-sm font-normal">Show Statistics</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showFlightList" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showFlightList} {...props} />
          <Form.Label class="text-sm font-normal">Show Flight List</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>
  </div>
</div>

<!-- Date Range Filter -->
<DateRangeField
  {form}
  startName="dateFrom"
  endName="dateTo"
  label="Date Range (Optional)"
/>

<!-- Data Privacy -->
<div class="space-y-3">
  <Label class="text-sm font-medium">Data Privacy</Label>
  <div class="space-y-2">
    <Form.Field
      {form}
      name="showFlightNumbers"
      class="flex flex-row items-center"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showFlightNumbers} {...props} />
          <Form.Label class="text-sm font-normal"
            >Show Flight Numbers</Form.Label
          >
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showAirlines" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showAirlines} {...props} />
          <Form.Label class="text-sm font-normal">Show Airlines</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showAircraft" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showAircraft} {...props} />
          <Form.Label class="text-sm font-normal"
            >Show Aircraft Types</Form.Label
          >
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showTimes" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showTimes} {...props} />
          <Form.Label class="text-sm font-normal">Show Flight Times</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field {form} name="showDates" class="flex flex-row items-center">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showDates} {...props} />
          <Form.Label class="text-sm font-normal">Show Flight Dates</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>
  </div>
</div>
