<script lang="ts" module>
  import type { FormPath as _FormPath } from 'sveltekit-superforms';

  type T = Record<string, unknown>;
  type U = _FormPath<T>;
</script>

<script
  lang="ts"
  generics="T extends Record<string, unknown>, U extends _FormPath<T>"
>
  import type { WithElementRef, WithoutChildren } from 'bits-ui';
  import * as FormPrimitive from 'formsnap';
  import type { HTMLAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    form,
    name,
    children: childrenProp,
    ...restProps
  }: FormPrimitive.FieldProps<T, U> &
    WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<FormPrimitive.Field {form} {name}>
  {#snippet children({ constraints, errors, tainted, value })}
    <div bind:this={ref} class={cn('grid gap-2', className)} {...restProps}>
      {@render childrenProp?.({
        constraints,
        errors,
        tainted,
        value: value as T[U],
      })}
    </div>
  {/snippet}
</FormPrimitive.Field>
