<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/stores';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import type { User } from '$lib/db';
  import type { flightSchema } from '$lib/zod/flight';

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
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>User</Form.Label>
        <Select.Root
          type="single"
          value={$formData.seats[index]?.userId ?? undefined}
          onValueChange={(value) => {
            if (value) {
              $formData.seats[index].userId = value;
            } else {
              $formData.seats[index].userId = null;
            }
          }}
          {...props}
        >
          <Select.Trigger {...props}>
            {#if $formData.seats[index]?.userId}
              {users.find((u) => u.id === $formData.seats?.[index]?.userId)
                ?.displayName}
            {:else}
              Select a user
            {/if}
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
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.ElementField>
  <Form.ElementField {form} name="seats[{index}].guestName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Guest Name</Form.Label>
        <Input bind:value={$formData.seats[index].guestName} {...props} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.ElementField>
</div>
