<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { Plus, X } from '@o7/icon/lucide';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import PassengerCustomFields from './PassengerCustomFields.svelte';
  import PassengerPicker from './PassengerPicker.svelte';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Separator } from '$lib/components/ui/separator';
  import { FlightReasons, SeatClasses, SeatTypes } from '$lib/db/types';
  import { cn, toTitleCase } from '$lib/utils';
  import type { CustomFieldDefinition } from '$lib/utils/custom-fields';
  import type { flightSchema } from '$lib/zod/flight';
  import { TextTooltip } from '$lib/components/ui/tooltip/index.ts';

  let {
    form,
    customFieldDefinitions = [],
    savedFieldIds = {},
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
    customFieldDefinitions?: CustomFieldDefinition[];
    savedFieldIds?: Record<number, Set<number>>;
  } = $props();
  const { form: formData, errors } = form;
  let customFieldSections = $state<
    Array<ReturnType<typeof PassengerCustomFields>>
  >([]);

  export function validateCustomFields(): boolean {
    for (const section of customFieldSections) {
      if (section && !section.validate()) return false;
    }
    return true;
  }

  const seatTypeLabels: Record<string, string> = {
    window: 'Window',
    middle: 'Middle',
    aisle: 'Aisle',
    pilot: 'Pilot',
    copilot: 'Co-pilot',
    jumpseat: 'Jumpseat',
    other: 'Other',
  };

  const getExcludedUserIds = (currentIndex: number): string[] => {
    return $formData.passengers
      .filter((_, i) => i !== currentIndex)
      .map((s) => s.userId)
      .filter((id): id is string => id !== null);
  };
</script>

<section>
  <h3 class="font-medium">Passenger Details</h3>
  <Separator class="my-2" />
  <Form.Fieldset {form} name="passengers">
    <div class="space-y-2" use:autoAnimate>
      {#each $formData.passengers as _, index}
        {#if $formData.passengers[index]}
          <Card class="overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-2">
              <div class="flex-1 min-w-0">
                <PassengerPicker
                  bind:userId={$formData.passengers[index].userId}
                  bind:guestName={$formData.passengers[index].guestName}
                  excludeUserIds={getExcludedUserIds(index)}
                  placeholderError={!!$errors?.passengers?.[index]?.userId
                    ?.length}
                />
              </div>
              <TextTooltip
                content="Remove passenger"
                rootProps={{ delayDuration: 0 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={$formData.passengers.length === 1}
                  onclick={() => {
                    $formData.passengers = $formData.passengers.filter(
                      (_, i) => i !== index,
                    );
                  }}
                >
                  <X size={16} />
                </Button>
              </TextTooltip>
            </div>

            <Separator />

            <div class="px-3 pt-2.5 pb-3 bg-muted/30 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <Form.ElementField {form} name="passengers[{index}].seatClass">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="text-xs">Class</Form.Label>
                      <Select.Root
                        type="single"
                        value={$formData.passengers[index]?.seatClass ??
                          undefined}
                        onValueChange={(value) => {
                          // @ts-expect-error - value is a SeatClass
                          $formData.passengers[index].seatClass =
                            SeatClasses.includes(
                              // @ts-expect-error - value is a SeatClass
                              value,
                            )
                              ? value
                              : null;
                        }}
                        allowDeselect
                      >
                        <Select.Trigger {...props} size="sm">
                          {$formData.passengers[index]?.seatClass
                            ? toTitleCase($formData.passengers[index].seatClass)
                            : 'Select class'}
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
                        value={$formData.passengers[index]?.seatClass}
                        name={props.name}
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors />
                </Form.ElementField>

                <Form.ElementField
                  {form}
                  name="passengers[{index}].flightReason"
                >
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="text-xs">Reason</Form.Label>
                      <Select.Root
                        type="single"
                        value={$formData.passengers[index]?.flightReason ??
                          undefined}
                        onValueChange={(value) => {
                          // @ts-expect-error - value is a FlightReason
                          $formData.passengers[index].flightReason =
                            FlightReasons.includes(value) ? value : null;
                        }}
                        allowDeselect
                      >
                        <Select.Trigger {...props} size="sm">
                          {$formData.passengers[index]?.flightReason
                            ? toTitleCase(
                                $formData.passengers[index].flightReason,
                              )
                            : 'Select reason'}
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="leisure" label="Leisure" />
                          <Select.Item value="business" label="Business" />
                          <Select.Item value="crew" label="Crew" />
                          <Select.Item value="other" label="Other" />
                        </Select.Content>
                      </Select.Root>
                      <input
                        type="hidden"
                        value={$formData.passengers[index]?.flightReason}
                        name={props.name}
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors />
                </Form.ElementField>
              </div>

              <div class="space-y-1.5">
                <Form.ElementField {form} name="passengers[{index}].seatNumber">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="text-xs">Seat</Form.Label>
                      <Input
                        value={$formData.passengers[index]?.seatNumber ?? ''}
                        oninput={(e) => {
                          if ($formData.passengers[index]) {
                            $formData.passengers[index].seatNumber =
                              e.currentTarget.value || null;
                          }
                        }}
                        placeholder="e.g. 12A"
                        class="h-8 w-24 text-sm not-placeholder-shown:uppercase"
                        {...props}
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors />
                </Form.ElementField>

                <Form.ElementField {form} name="passengers[{index}].seat">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="sr-only">Seat Type</Form.Label>
                      <div class="flex flex-wrap gap-1.5">
                        {#each SeatTypes as type}
                          <button
                            type="button"
                            class={cn(
                              'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                              $formData.passengers[index]?.seat === type
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-input hover:border-foreground/20 hover:text-foreground',
                            )}
                            onclick={() => {
                              if ($formData.passengers[index]) {
                                $formData.passengers[index].seat =
                                  $formData.passengers[index].seat === type
                                    ? null
                                    : type;
                              }
                            }}
                          >
                            {seatTypeLabels[type] ?? toTitleCase(type)}
                          </button>
                        {/each}
                      </div>
                      <input
                        type="hidden"
                        value={$formData.passengers[index]?.seat}
                        name={props.name}
                      />
                    {/snippet}
                  </Form.Control>
                </Form.ElementField>
              </div>

              <PassengerCustomFields
                bind:this={customFieldSections[index]}
                definitions={customFieldDefinitions}
                bind:values={$formData.passengers[index].customFields}
                savedFieldIds={$formData.passengers[index].id
                  ? savedFieldIds[$formData.passengers[index].id]
                  : undefined}
              />
            </div>
          </Card>
        {/if}
      {/each}
    </div>
    <Button
      class="w-full"
      variant="secondary"
      onclick={() => {
        $formData.passengers = [
          ...$formData.passengers,
          {
            userId: null,
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
            flightReason: null,
            customFields: {},
          },
        ];
      }}
    >
      <Plus size={16} class="mr-1" />
      Add Passenger
    </Button>
    <Form.FieldErrors />
  </Form.Fieldset>
</section>
