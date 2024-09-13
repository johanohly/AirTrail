<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import { Input } from '$lib/components/ui/input';
  import { toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';
  import { Separator } from '$lib/components/ui/separator';
  import { Button } from '$lib/components/ui/button';
  import { Plus } from '@o7/icon/lucide';
  import { Card } from '$lib/components/ui/card';
  import SeatUserField from '$lib/components/modals/add-flight/SeatUserField.svelte';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<section>
  <h3 class="font-medium">Seat Information</h3>
  <Separator class="my-2" />
  <Form.Fieldset {form} name="seats">
    {#each $formData.seats as _, index}
      {#if $formData.seats[index]}
        <Card class="grid gap-3 p-2">
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <SeatUserField {form} {index} />
            <button
              class="group flex items-center justify-center size-8 disabled:cursor-not-allowed"
              disabled={$formData.seats.length === 1}
              onclick={() => {
                $formData.seats = $formData.seats.filter((_, i) => i !== index);
              }}
            >
              <span
                class="flex items-center justify-center size-6 rounded-full bg-secondary group-disabled:text-muted-foreground"
              >
                <Plus
                  size="18"
                  class="rotate-45 group-hover:-rotate-45 group-disabled:rotate-45 transition-transform"
                />
              </span>
            </button>
          </div>

          {#if $formData.seats[index].userId && $formData.seats[index].guestName}
            <span class="-mt-3 text-yellow-500 font-medium text-sm">
              Ignoring guest name because user is selected
            </span>
          {/if}

          <div class="grid grid-cols-[1fr_1fr_1fr] gap-2">
            <Form.ElementField {form} name="seats[{index}].seat">
              <Form.Control let:attrs>
                <Form.Label>Seat</Form.Label>
                <Select.Root
                  selected={{
                    label: $formData.seats?.[index]?.seat
                      ? toTitleCase($formData.seats[index].seat)
                      : undefined,
                    value: $formData.seats?.[index]?.seat,
                  }}
                  onSelectedChange={(value) => {
                    if (value) {
                      if (value.value === $formData.seats[index]?.seat) {
                        $formData.seats[index].seat = null;
                      } else {
                        $formData.seats[index].seat = value.value;
                      }
                    }
                  }}
                >
                  <Select.Trigger {...attrs}>
                    <Select.Value placeholder="Select seat..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="window" label="Window" />
                    <Select.Item value="middle" label="Middle" />
                    <Select.Item value="aisle" label="Aisle" />
                    <Select.Item value="other" label="Other" />
                  </Select.Content>
                </Select.Root>
                <input
                  type="hidden"
                  value={$formData.seats?.[index]?.seat}
                  name={attrs.name}
                />
              </Form.Control>
              <Form.FieldErrors />
            </Form.ElementField>
            <Form.ElementField {form} name="seats[{index}].seatNumber">
              <Form.Control let:attrs>
                <Form.Label>Seat Number</Form.Label>
                <Input
                  bind:value={$formData.seats[index].seatNumber}
                  {...attrs}
                />
              </Form.Control>
              <Form.FieldErrors />
            </Form.ElementField>
            <Form.ElementField {form} name="seats[{index}].seatClass">
              <Form.Control let:attrs>
                <Form.Label>Seat Class</Form.Label>
                <Select.Root
                  selected={{
                    label: $formData.seats?.[index]?.seatClass
                      ? toTitleCase($formData.seats[index].seatClass)
                      : undefined,
                    value: $formData.seats?.[index]?.seatClass,
                  }}
                  onSelectedChange={(value) => {
                    if (value) {
                      if (value.value === $formData.seats?.[index]?.seatClass) {
                        $formData.seats[index].seatClass = null;
                      } else {
                        $formData.seats[index].seatClass = value.value;
                      }
                    }
                  }}
                >
                  <Select.Trigger {...attrs}>
                    <Select.Value placeholder="Select class..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="economy" label="Economy" />
                    <Select.Item value="economy+" label="Economy+" />
                    <Select.Item value="business" label="Business" />
                    <Select.Item value="first" label="First" />
                    <Select.Item value="private" label="Private" />
                  </Select.Content>
                </Select.Root>
                <input
                  type="hidden"
                  value={$formData.seats?.[index]?.seatClass}
                  name={attrs.name}
                />
              </Form.Control>
              <Form.FieldErrors />
            </Form.ElementField>
          </div>
        </Card>
      {/if}
    {/each}
    <Button
      class="w-full"
      variant="secondary"
      on:click={() => {
        $formData.seats = [
          ...$formData.seats,
          {
            userId: null,
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
        ];
      }}
    >
      Add Seat
    </Button>
    <Form.FieldErrors />
  </Form.Fieldset>
</section>
