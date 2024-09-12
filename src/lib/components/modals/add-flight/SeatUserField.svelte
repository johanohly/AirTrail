<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import type { flightSchema } from '$lib/zod/flight';
  import { z } from 'zod';
  import { page } from '$app/stores';
  import type { User } from '$lib/db';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { Info } from '@o7/icon/lucide';
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';

  let {
    form,
    index,
  }: { form: SuperForm<z.infer<typeof flightSchema>>; index: number } =
    $props();
  const { form: formData } = form;

  const users = $derived($page.data.users as User[]);
  const availableUsers = $derived(
    users.filter(
      (u) =>
        // If the user is already set in the seat, allow them to be "deselected"
        $formData.seats?.[index]?.userId === u.id ||
        !$formData.seats.some((seat) => seat.userId === u.id),
    ),
  );
</script>

<div class="grid grid-cols-[3fr_2fr] gap-2">
  <Form.ElementField {form} name="seats[{index}].userId">
    <Form.Control let:attrs>
      <Form.Label>User</Form.Label>
      <Select.Root
        selected={{
          label: users.find((u) => u.id === $formData.seats[index]?.userId)
            ? users.find((u) => u.id === $formData.seats[index]?.userId)
                ?.displayName
            : undefined,
          value: $formData.seats[index]?.userId,
        }}
        onSelectedChange={(value) => {
          if (value) {
            if (value.value === $formData.seats[index]?.userId) {
              $formData.seats[index].userId = null;
            } else {
              $formData.seats[index].userId = value.value;
            }
          }
        }}
        {...attrs}
      >
        <Select.Trigger {...attrs}>
          <Select.Value placeholder="Select a user" />
        </Select.Trigger>
        <Select.Content>
          {#each availableUsers as user}
            <Select.Item value={user.id} label={user.displayName} />
          {:else}
            <Select.Item
              disabled
              value={undefined}
              label="No other available users"
            />
          {/each}
        </Select.Content>
      </Select.Root>
    </Form.Control>
    <Form.FieldErrors />
  </Form.ElementField>
  <Form.ElementField {form} name="seats[{index}].guestName">
    <Form.Control let:attrs>
      <Form.Label>Guest Name</Form.Label>
      <Input bind:value={$formData.seats[index].guestName} {...attrs} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.ElementField>
</div>
