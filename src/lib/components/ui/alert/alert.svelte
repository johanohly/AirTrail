<script lang="ts" module>
  import { type VariantProps, tv } from 'tailwind-variants';

  export const alertVariants = tv({
    base: 'relative grid w-full items-start gap-x-2 gap-y-0.5 rounded-xl border px-3.5 py-3 text-sm text-card-foreground has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] [&>svg]:size-4! [&>svg]:translate-y-0.5',
    variants: {
      variant: {
        default:
          'bg-transparent dark:bg-input/32 [&>svg]:text-muted-foreground',
        destructive:
          'border-destructive/32 bg-destructive/4 [&>svg]:text-destructive',
        info: 'border-blue-500/32 bg-blue-500/4 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
        success:
          'border-green-500/32 bg-green-500/4 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
        warning:
          'border-amber-500/32 bg-amber-500/4 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  });

  export type AlertVariant = VariantProps<typeof alertVariants>['variant'];
</script>

<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    variant = 'default',
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    variant?: AlertVariant;
  } = $props();
</script>

<div
  bind:this={ref}
  role="alert"
  data-slot="alert"
  class={cn(alertVariants({ variant, className }))}
  {...restProps}
>
  {@render children?.()}
</div>
