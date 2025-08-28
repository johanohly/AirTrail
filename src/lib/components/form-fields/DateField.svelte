<script lang="ts" generics="T extends Record<string, unknown>">
  import { type DateValue, parseDate } from '@internationalized/date';
  import { CalendarDays } from '@o7/icon/lucide';
  import { DateField } from 'bits-ui';
  import type { SuperForm } from 'sveltekit-superforms';

  import { Calendar } from '$lib/components/ui/calendar';
  import * as Form from '$lib/components/ui/form';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  let {
    form,
    name,
    label,
    required = false,
  }: {
    form: SuperForm<T>;
    name: string;
    label: string;
    required?: boolean;
  } = $props();

  const { form: formData, validate } = form;

  let dateValue: DateValue | undefined = $state(
    $formData[name] ? parseDate($formData[name]) : undefined,
  );

  $effect(() => {
    if ($formData[name]) {
      const date = parseDate($formData[name]);
      if (!dateValue || date.compare(dateValue) !== 0) {
        dateValue = date;
      }
    } else {
      dateValue = undefined;
    }
  });
</script>

<Form.Field {form} {name} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>
        {label}{required ? ' *' : ''}
      </Form.Label>
      <DateField.Root
        bind:value={
          () => dateValue,
          (v) => {
            if (v === undefined) {
              dateValue = undefined;
              $formData[name] = '';
              validate(name);
              return;
            }
            dateValue = v;
            $formData[name] = dateValue.toString();
            validate(name);
          }
        }
        granularity="day"
        minValue={parseDate('1970-01-01')}
        locale={navigator.language}
      >
        <div class="flex w-full max-w-[232px] flex-col gap-1.5">
          <DateField.Input
            class={cn(
              'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-[6px] text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            )}
          >
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (i)}
                <div class="inline-block select-none">
                  {#if part === 'literal'}
                    <DateField.Segment {part} class="text-muted-foreground">
                      {value}
                    </DateField.Segment>
                  {:else}
                    <DateField.Segment
                      {part}
                      class="rounded-md px-1 hover:bg-muted focus:bg-muted focus:text-foreground focus-visible:ring-0! focus-visible:ring-offset-0! aria-[valuetext=Empty]:text-muted-foreground"
                    >
                      {value}
                    </DateField.Segment>
                  {/if}
                </div>
              {/each}
              <Popover.Root>
                <Popover.Trigger
                  {...props}
                  class="ml-auto inline-flex items-center justify-center text-muted-foreground transition-all hover:text-foreground active:text-foreground"
                >
                  <CalendarDays size={16} />
                </Popover.Trigger>
                <Popover.Content class="p-0">
                  <Calendar
                    type="single"
                    value={dateValue}
                    onValueChange={(v) => {
                      if (v === undefined) {
                        dateValue = undefined;
                        $formData[name] = '';
                        validate(name);
                        return;
                      }
                      dateValue = v;
                      $formData[name] = dateValue.toString();
                      validate(name);
                    }}
                  />
                </Popover.Content>
              </Popover.Root>
            {/snippet}
          </DateField.Input>
        </div>
      </DateField.Root>
      <input hidden bind:value={$formData[name]} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
