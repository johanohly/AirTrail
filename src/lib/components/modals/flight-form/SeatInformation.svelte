<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { Plus, X } from '@o7/icon/lucide';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import PassengerPicker from './PassengerPicker.svelte';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Separator } from '$lib/components/ui/separator';
  import { SeatClasses, SeatTypes } from '$lib/db/types';
  import { cn, toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';
  import {
    HelpTooltip,
    TextTooltip,
  } from '$lib/components/ui/tooltip/index.ts';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData, errors } = form;

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
    return $formData.seats
      .filter((_, i) => i !== currentIndex)
      .map((s) => s.userId)
      .filter((id): id is string => id !== null);
  };
</script>

<section>
  <h3 class="font-medium">Seat Information</h3>
  <Separator class="my-2" />
  <Form.Fieldset {form} name="seats">
    <div class="space-y-2" use:autoAnimate>
      {#each $formData.seats as _, index}
        {#if $formData.seats[index]}
          <Card class="overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-2">
              <div class="flex-1 min-w-0">
                <PassengerPicker
                  bind:userId={$formData.seats[index].userId}
                  bind:guestName={$formData.seats[index].guestName}
                  excludeUserIds={getExcludedUserIds(index)}
                  placeholderError={!!$errors?.seats?.[index]?.userId?.length}
                />
              </div>
              <TextTooltip
                content="Remove seat"
                rootProps={{ delayDuration: 0 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={$formData.seats.length === 1}
                  onclick={() => {
                    $formData.seats = $formData.seats.filter(
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
              <div class="grid grid-cols-[3fr_2fr] gap-2">
                <Form.ElementField {form} name="seats[{index}].seatClass">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="text-xs">Class</Form.Label>
                      <Select.Root
                        type="single"
                        value={$formData.seats[index]?.seatClass ?? undefined}
                        onValueChange={(value) => {
                          // @ts-expect-error - value is a SeatClass
                          $formData.seats[index].seatClass =
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
                          {$formData.seats[index]?.seatClass
                            ? toTitleCase($formData.seats[index].seatClass)
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
                        value={$formData.seats[index]?.seatClass}
                        name={props.name}
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors />
                </Form.ElementField>

                <Form.ElementField {form} name="seats[{index}].seatNumber">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label class="text-xs">Seat #</Form.Label>
                      <Input
                        value={$formData.seats[index]?.seatNumber ?? ''}
                        oninput={(e) => {
                          if ($formData.seats[index]) {
                            $formData.seats[index].seatNumber =
                              e.currentTarget.value || null;
                          }
                        }}
                        placeholder="e.g. 12A"
                        class="h-8 text-sm not-placeholder-shown:uppercase"
                        {...props}
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors />
                </Form.ElementField>
              </div>

              <Form.ElementField {form} name="seats[{index}].seat">
                <Form.Control>
                  {#snippet children({ props })}
                    <Form.Label class="sr-only">Seat Type</Form.Label>
                    <div class="flex flex-wrap gap-1.5">
                      {#each SeatTypes as type}
                        <button
                          type="button"
                          class={cn(
                            'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                            $formData.seats[index]?.seat === type
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-input hover:border-foreground/20 hover:text-foreground',
                          )}
                          onclick={() => {
                            if ($formData.seats[index]) {
                              $formData.seats[index].seat =
                                $formData.seats[index].seat === type
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
                      value={$formData.seats[index]?.seat}
                      name={props.name}
                    />
                  {/snippet}
                </Form.Control>
              </Form.ElementField>
            </div>
          </Card>
        {/if}
      {/each}
    </div>
    <Button
      class="w-full"
      variant="secondary"
      onclick={() => {
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
      <Plus size={16} class="mr-1" />
      Add Seat
    </Button>
    <Form.FieldErrors />
  </Form.Fieldset>
</section>
