<script lang="ts">
  import { Separator } from "$lib/components/ui/separator";

  export let title: string;
  export let subtitle: string;
</script>

<div class="space-y-6">
  <div>
    <h3 class="text-lg font-medium">{title}</h3>
    <p class="text-muted-foreground text-sm">
      {subtitle}
    </p>
  </div>
  <Separator />

  <slot />
</div>