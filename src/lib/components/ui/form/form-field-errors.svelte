<script lang="ts">
  import type { WithoutChild } from 'bits-ui';
  import * as FormPrimitive from 'formsnap';
  import { useFormField } from 'formsnap';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    errorClasses,
    children: childrenProp,
    ...restProps
  }: WithoutChild<FormPrimitive.FieldErrorsProps> & {
    errorClasses?: string | undefined | null;
  } = $props();

  const formField = useFormField({});
</script>

{#if formField.errors.length}
  <FormPrimitive.FieldErrors
    bind:ref
    class={cn('text-destructive text-xs font-medium', className)}
    {...restProps}
  >
    {#snippet children({ errors, errorProps })}
      {#if childrenProp}
        {@render childrenProp({ errors, errorProps })}
      {:else}
        <div {...errorProps} class={cn(errorClasses)}>{errors[0]}</div>
      {/if}
    {/snippet}
  </FormPrimitive.FieldErrors>
{/if}
