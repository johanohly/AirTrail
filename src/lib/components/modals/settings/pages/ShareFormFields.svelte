<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Select } from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { generateRandomString } from '$lib/utils/string';
  import type { shareSchema } from '$lib/zod/share';

  const { form }: { form: SuperForm<Infer<typeof shareSchema>> } = $props();

  const { form: formData } = form;

  // Generate new random slug
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
        <div class="flex-1 flex">
          <span
            class="inline-flex items-center px-3 text-sm bg-muted border border-r-0 rounded-l-md"
          >
            /share/
          </span>
          <Input
            bind:value={$formData.slug}
            {...props}
            placeholder="custom-url-slug"
            class="rounded-l-none"
          />
        </div>
        <Button type="button" variant="outline" onclick={generateNewSlug}>
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
      <Select bind:value={$formData.expiryOption} {...props}>
        <option value="never">Never expires</option>
        <option value="1day">1 day</option>
        <option value="1week">1 week</option>
        <option value="1month">1 month</option>
        <option value="3months">3 months</option>
        <option value="custom">Custom date</option>
      </Select>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if $formData.expiryOption === 'custom'}
  <Form.Field {form} name="expiresAt" class="flex flex-col">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Expires At</Form.Label>
        <Input
          type="datetime-local"
          bind:value={$formData.expiresAt}
          {...props}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
{/if}

<!-- Content Visibility -->
<div class="space-y-3">
  <Label class="text-sm font-medium">Content Visibility</Label>
  <div class="space-y-2">
    <Form.Field
      {form}
      name="showMap"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showMap} {...props} />
          <Form.Label class="text-sm font-normal">Show Map</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field
      {form}
      name="showStats"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showStats} {...props} />
          <Form.Label class="text-sm font-normal">Show Statistics</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field
      {form}
      name="showFlightList"
      class="flex flex-row items-center space-x-2"
    >
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
<div class="space-y-3">
  <Label class="text-sm font-medium">Date Range (Optional)</Label>
  <div class="flex gap-2">
    <Form.Field {form} name="dateFrom" class="flex-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-sm">From</Form.Label>
          <Input
            type="date"
            bind:value={$formData.dateFrom}
            {...props}
            placeholder="From date"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="dateTo" class="flex-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-sm">To</Form.Label>
          <Input
            type="date"
            bind:value={$formData.dateTo}
            {...props}
            placeholder="To date"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
</div>

<!-- Data Privacy -->
<div class="space-y-3">
  <Label class="text-sm font-medium">Data Privacy</Label>
  <div class="space-y-2">
    <Form.Field
      {form}
      name="showFlightNumbers"
      class="flex flex-row items-center space-x-2"
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

    <Form.Field
      {form}
      name="showAirlines"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showAirlines} {...props} />
          <Form.Label class="text-sm font-normal">Show Airlines</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field
      {form}
      name="showAircraft"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showAircraft} {...props} />
          <Form.Label class="text-sm font-normal"
            >Show Aircraft Types</Form.Label
          >
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field
      {form}
      name="showTimes"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showTimes} {...props} />
          <Form.Label class="text-sm font-normal">Show Flight Times</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <Form.Field
      {form}
      name="showDates"
      class="flex flex-row items-center space-x-2"
    >
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox bind:checked={$formData.showDates} {...props} />
          <Form.Label class="text-sm font-normal">Show Flight Dates</Form.Label>
        {/snippet}
      </Form.Control>
    </Form.Field>
  </div>
</div>
